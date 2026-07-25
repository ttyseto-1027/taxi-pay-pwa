import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, runTransaction, serverTimestamp, updateDoc, setDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

export async function initializeTaxiPayAuth(){
  const D=window.TaxiPayDiagnostics;
  const config=window.TAXI_PAY_FIREBASE_CONFIG||{};
  const gate=document.getElementById('authGate'), message=document.getElementById('authMessage'), setup=document.getElementById('firebaseSetupNotice');
  const login=document.getElementById('googleLoginButton'), userLabel=document.getElementById('signedInUser'), logout=document.getElementById('logoutButton'), adminLink=document.getElementById('adminPageLink');
  if(!login||!gate) throw new Error('認証画面の必須要素がありません。');
  const setMessage=(text='',kind='error')=>{message.textContent=text;message.dataset.kind=kind;};
  let pendingAuthError='';
  const setAuthError=(code,text,user=null)=>{
    const account=emailOf(user);
    pendingAuthError=[text,code,account?`選択されたGoogleアカウント：${account}`:''].filter(Boolean).join('\n');
    setMessage(pendingAuthError,'error');
  };
  const showGate=()=>{document.body.classList.add('auth-pending');gate.hidden=false;userLabel.textContent='';adminLink.hidden=true;};
  const showApp=(profile)=>{document.body.classList.remove('auth-pending');gate.hidden=true;userLabel.textContent=profile.name||profile.email||'';adminLink.hidden=profile.isAdmin!==true;window.dispatchEvent(new CustomEvent('taxipay:profile',{detail:profile}));};
  if(!config.enabled||!config.apiKey||config.apiKey==='REPLACE_ME'){setup.hidden=false;setMessage('Firebase接続設定が完了していません。','info');showGate();throw new Error('Firebase config missing');}
  let app,auth,db;
  try{app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);}catch(err){D.notify('Firebaseの初期化に失敗しました。','error','AUTH-INIT-01',err?.stack||err);throw err;}
  const provider=new GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
  const emailOf=u=>String(u?.email||'').trim().toLowerCase();
  async function adminInfo(uid){const s=await getDoc(doc(db,'admins',uid));return s.exists()&&s.data().enabled!==false?s.data():null;}
  async function prereg(user){const email=emailOf(user);const s=await getDoc(doc(db,'betaAllowlist',email));if(!s.exists()||s.data().enabled!==true) throw new Error('このGoogleアカウントはv1.3βの事前登録マスターに登録されていません。');return {ref:s.ref,data:s.data(),email};}
  async function ensureProfile(user){
    const admin=await adminInfo(user.uid);
    if(admin) return {name:user.displayName||admin.displayName||'',email:emailOf(user),status:'active',plan:'administrator',isAdmin:true,unionStatus:'admin'};
    const allow=await prereg(user); const uref=doc(db,'users',user.uid); const us=await getDoc(uref);
    if(us.exists()){
      const p=us.data(); if(p.status!=='active') throw new Error(p.suspensionReason||'このアカウントは利用停止中です。');
      if(String(p.email||'').toLowerCase()!==allow.email) throw new Error('登録済みメールアドレスとGoogleアカウントが一致しません。');
      await updateDoc(uref,{lastLoginAt:serverTimestamp(),lastVersion:'v1.3-beta'}).catch(()=>{});
      return {...p,isAdmin:false};
    }
    const a=allow.data;
    if(!a.driverNumber) throw new Error('事前登録情報に乗務員番号がありません。管理者へお問い合わせください。');
    const profile={name:user.displayName||a.displayName||'',displayName:user.displayName||'',email:allow.email,status:'active',plan:'beta_v1_3',version:'v1.3-beta',driverNumber:String(a.driverNumber),office:a.office||'',unionStatus:a.unionStatus||'nonmember',tester:a.tester!==false,authProvider:'google.com',createdAt:serverTimestamp(),lastLoginAt:serverTimestamp(),termsAcceptedAt:serverTimestamp()};
    await setDoc(uref,profile); await updateDoc(allow.ref,{registeredUid:user.uid,registeredAt:serverTimestamp()}).catch(()=>{}); return {...profile,isAdmin:false};
  }
  async function recordSuccessfulLogin(user,profile){
    if(profile.isAdmin||profile.tester===false) return;
    const loginRef=doc(db,'v13LoginSuccess',user.uid);
    await setDoc(loginRef,{uid:user.uid,email:emailOf(user),driverNumber:profile.driverNumber||'',firstSuccessAt:serverTimestamp(),lastSuccessAt:serverTimestamp(),isAdmin:false},{merge:true});
    const settingsRef=doc(db,'appSettings','v1_3_beta');
    await runTransaction(db,async tx=>{
      const settingsSnap=await tx.get(settingsRef); const settings=settingsSnap.exists()?settingsSnap.data():{};
      if(settings.gracePeriodStartedAt) return;
      const snap=await getDocs(query(collection(db,'v13LoginSuccess'),where('isAdmin','==',false)));
      const unique=new Set(snap.docs.map(x=>x.id)); unique.add(user.uid);
      if(unique.size>=3) tx.set(settingsRef,{gracePeriodStartedAt:serverTimestamp(),gracePeriodDays:14,gracePeriodTriggerCount:3,status:'running'},{merge:true});
    }).catch(err=>D.record('AUTH-GRACE-01','error','猶予期間判定を更新できませんでした',err?.message||err));
  }
  async function route(user){pendingAuthError='';setMessage('利用者情報を確認しています…','info');const p=await ensureProfile(user);await recordSuccessfulLogin(user,p);showApp(p);D.notify('ログインしました。','success','AUTH-SIGNIN-OK');}
  login.addEventListener('click',async()=>{
    login.disabled=true;setMessage('Googleログインを開始しています…','info');D.record('AUTH-SIGNIN-START','info','Googleログイン開始');
    try{await setPersistence(auth,browserLocalPersistence);await signInWithPopup(auth,provider);}catch(err){
      const code=err?.code||''; if(code==='auth/popup-blocked'||code==='auth/cancelled-popup-request'){await signInWithRedirect(auth,provider);return;}
      const text=code==='auth/popup-closed-by-user'?'Googleログインがキャンセルされました。':code==='auth/unauthorized-domain'?'この公開URLがFirebaseの承認済みドメインに登録されていません。':'Googleログインに失敗しました。再試行してください。';
      setAuthError('AUTH-SIGNIN-01',text);D.notify(text,'error','AUTH-SIGNIN-01',`${code} ${err?.message||''}`);
    }finally{login.disabled=false;}
  });
  if(!login.onclick && login.disabled){login.disabled=false;D.record('AUTH-BUTTON-01','info','ログインボタンを有効化');}
  logout?.addEventListener('click',async()=>{await signOut(auth);D.notify('ログアウトしました。','success','AUTH-SIGNOUT-OK');});
  getRedirectResult(auth).catch(err=>{
    const text='リダイレクト後のGoogleログインに失敗しました。';
    setAuthError('AUTH-SIGNIN-REDIRECT-01',text);
    D.notify(text,'error','AUTH-SIGNIN-REDIRECT-01',err?.message||err);
  });
  onAuthStateChanged(auth,async user=>{
    if(!user){
      showGate();
      if(pendingAuthError){setMessage(pendingAuthError,'error');return;}
      setMessage('Googleアカウントでログインしてください。','info');
      return;
    }
    try{
      await route(user);
    }catch(err){
      const text=err?.message||'このアカウントでは利用できません。';
      setAuthError('AUTH-USER-01',text,user);
      D.notify(text,'error','AUTH-USER-01',err?.stack||err);
      await signOut(auth).catch(signOutErr=>D.record('AUTH-SIGNOUT-ERROR','error','認証エラー後のログアウトに失敗しました',signOutErr?.message||signOutErr));
      showGate();
      setMessage(pendingAuthError,'error');
    }
  });
  return true;
}
