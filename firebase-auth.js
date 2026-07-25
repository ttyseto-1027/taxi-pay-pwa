import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const DIAG_KEY = 'taxiPayAuthDiagnosticV3';
const ATTEMPT_KEY = 'taxiPayAuthAttemptV1';
const MAX_STEPS = 60;

function safeStorageGet() {
  try { return JSON.parse(localStorage.getItem(DIAG_KEY) || '{}'); } catch { return {}; }
}
function safeStorageSet(value) {
  try { localStorage.setItem(DIAG_KEY, JSON.stringify(value)); } catch {}
}

function readAttempt() {
  try { return JSON.parse(localStorage.getItem(ATTEMPT_KEY) || 'null'); } catch { return null; }
}
function writeAttempt(value) {
  try { localStorage.setItem(ATTEMPT_KEY, JSON.stringify(value)); } catch {}
}
function clearAttempt() {
  try { localStorage.removeItem(ATTEMPT_KEY); } catch {}
}
function startAttempt(method='popup') {
  const value = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    startedAt: Date.now(),
    method,
    pageUrl: location.href,
    userAgent: navigator.userAgent,
    phase: 'started'
  };
  writeAttempt(value);
  return value;
}
function updateAttempt(patch={}) {
  const current = readAttempt() || {startedAt: Date.now()};
  writeAttempt({...current, ...patch, updatedAt: Date.now()});
}

function maskEmail(email='') {
  const [name, domain] = String(email).split('@');
  if (!domain) return '';
  const masked = name.length <= 2 ? `${name.slice(0,1)}*` : `${name.slice(0,2)}***`;
  return `${masked}@${domain}`;
}
function normalizeError(err) {
  const code = String(err?.code || 'unknown');
  const message = String(err?.message || err || '不明なエラー');
  return { code, message };
}
function userFriendlyError(stage, err) {
  const {code, message} = normalizeError(err);
  const map = {
    'auth/unauthorized-domain': ['AUTH-DOMAIN-001', 'この公開URLがFirebaseの承認済みドメインに登録されていません。'],
    'auth/popup-blocked': ['AUTH-POPUP-001', 'Googleログイン画面を開けませんでした。ポップアップ制限が影響しています。'],
    'auth/popup-closed-by-user': ['AUTH-CANCEL-001', 'Googleログインがキャンセルされました。'],
    'auth/cancelled-popup-request': ['AUTH-POPUP-002', '複数のログイン処理が重なったため中断されました。'],
    'auth/network-request-failed': ['AUTH-NETWORK-001', 'Google認証の通信に失敗しました。通信状態をご確認ください。'],
    'auth/web-storage-unsupported': ['AUTH-STORAGE-001', 'このブラウザでは認証情報を保存できません。Cookie・サイト越えトラッキング・プライベートブラウズ設定をご確認ください。'],
    'auth/operation-not-supported-in-this-environment': ['AUTH-BROWSER-001', 'このブラウザ環境ではGoogleログインを完了できません。通常のSafariまたはChromeで開いてください。'],
    'permission-denied': ['AUTH-FIRESTORE-001', 'Firestoreの読み取り権限が拒否されました。管理者へご連絡ください。'],
    'unavailable': ['AUTH-FIRESTORE-002', 'Firestoreへ接続できません。通信状態またはFirebaseの稼働状況をご確認ください。']
  };
  if (map[code]) return {displayCode: map[code][0], text: map[code][1], rawCode: code, rawMessage: message};
  if (/事前登録マスター/.test(message)) return {displayCode:'AUTH-ALLOWLIST-001',text:message,rawCode:code,rawMessage:message};
  if (/利用停止/.test(message)) return {displayCode:'AUTH-STATUS-001',text:message,rawCode:code,rawMessage:message};
  if (/メールアドレス/.test(message)) return {displayCode:'AUTH-EMAIL-001',text:message,rawCode:code,rawMessage:message};
  if (/乗務員番号/.test(message)) return {displayCode:'AUTH-DRIVER-001',text:message,rawCode:code,rawMessage:message};
  return {displayCode:`AUTH-${stage}-999`,text:'ログイン処理を完了できませんでした。下の診断情報を管理者へお知らせください。',rawCode:code,rawMessage:message};
}

function createDiagnosticUI() {
  const current = document.getElementById('authDiagnosticCurrent');
  const stepsEl = document.getElementById('authDiagnosticSteps');
  const errorEl = document.getElementById('authDiagnosticError');
  const copyBtn = document.getElementById('copyAuthDiagnostic');
  const clearBtn = document.getElementById('clearAuthDiagnostic');
  let state = safeStorageGet();
  if (!Array.isArray(state.steps)) state.steps = [];

  function persist() { safeStorageSet(state); }
  function render() {
    if (current) current.textContent = state.current || '認証機能を準備しています…';
    if (stepsEl) {
      stepsEl.replaceChildren();
      state.steps.slice(-MAX_STEPS).forEach(item => {
        const li = document.createElement('li');
        li.dataset.level = item.level || 'info';
        li.textContent = `${item.time}　${item.code}　${item.message}`;
        stepsEl.appendChild(li);
      });
    }
    if (errorEl) {
      errorEl.hidden = !state.error;
      errorEl.textContent = state.error || '';
    }
  }
  function step(code, message, level='info', detail='') {
    const time = new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    state.current = message;
    state.steps.push({time, code, message, level, detail:String(detail || '')});
    state.steps = state.steps.slice(-MAX_STEPS);
    persist(); render();
  }
  function fail(info, stage='UNKNOWN') {
    const detail = info.rawCode && info.rawCode !== 'unknown' ? `\n内部コード：${info.rawCode}` : '';
    state.current = `ログイン失敗：${info.displayCode}`;
    state.error = `${info.text}\nエラーコード：${info.displayCode}${detail}`;
    step(info.displayCode, info.text, 'error', `${stage}: ${info.rawMessage || ''}`);
    persist(); render();
  }
  function clear() {
    state = {steps:[],current:'診断情報を消去しました。',error:''};
    persist(); render();
  }
  function report() {
    const ua = navigator.userAgent;
    const lines = [
      'タクシー給与シミュレーター ログイン診断',
      `URL: ${location.origin}${location.pathname}`,
      `端末情報: ${ua}`,
      `現在の状態: ${state.current || ''}`,
      state.error ? `エラー: ${state.error.replace(/\n/g,' / ')}` : 'エラー: なし',
      '--- 処理履歴 ---',
      ...state.steps.slice(-MAX_STEPS).map(x => `${x.time} ${x.code} ${x.message}${x.detail ? ` [${x.detail}]` : ''}`)
    ];
    return lines.join('\n');
  }
  copyBtn?.addEventListener('click', async () => {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      step('AUTH-COPY-OK','診断情報をコピーしました。','success');
    } catch {
      window.prompt('下の診断情報をコピーしてください。', text);
    }
  });
  clearBtn?.addEventListener('click', clear);
  render();
  return {step, fail, clear, report, setUserEmail(email){state.maskedEmail=maskEmail(email);persist();}};
}

export async function initializeTaxiPayAuth(){
  const I=window.TaxiPayInlineDiagnostic; I?.add('V4-AUTH-INIT','initializeTaxiPayAuth を開始しました。');
  const D = window.TaxiPayDiagnostics;
  const diag = createDiagnosticUI();
  const config = window.TAXI_PAY_FIREBASE_CONFIG || {};
  const gate = document.getElementById('authGate');
  const message = document.getElementById('authMessage');
  const setup = document.getElementById('firebaseSetupNotice');
  const login = document.getElementById('googleLoginButton');
  const userLabel = document.getElementById('signedInUser');
  const logout = document.getElementById('logoutButton');
  const adminLink = document.getElementById('adminPageLink');
  let preservedFailure = false;

  if(!login || !gate) throw new Error('認証画面の必須要素がありません。');
  const setMessage = (text='',kind='error') => { message.textContent=text; message.dataset.kind=kind; };
  const showGate = () => { document.body.classList.add('auth-pending'); gate.hidden=false; userLabel.textContent=''; adminLink.hidden=true; };
  const showApp = profile => { document.body.classList.remove('auth-pending'); gate.hidden=true; userLabel.textContent=profile.name||profile.email||''; adminLink.hidden=profile.isAdmin!==true; window.dispatchEvent(new CustomEvent('taxipay:profile',{detail:profile})); };

  diag.step('AUTH-BOOT-001','ログイン機能を開始しました。');
  if(!config.enabled || !config.apiKey || config.apiKey==='REPLACE_ME'){
    setup.hidden=false;
    const info={displayCode:'AUTH-CONFIG-001',text:'Firebase接続設定が完了していません。',rawCode:'config-missing',rawMessage:'Firebase config missing'};
    setMessage(info.text); showGate(); diag.fail(info,'CONFIG'); throw new Error('Firebase config missing');
  }

  let app, auth, db;
  try {
    diag.step('AUTH-INIT-START','Firebaseを初期化しています。');
    app=initializeApp(config); auth=getAuth(app); db=getFirestore(app);
    diag.step('AUTH-INIT-OK','Firebaseの初期化に成功しました。','success');
  } catch(err) {
    const info=userFriendlyError('INIT',err); diag.fail(info,'INIT'); D.notify(info.text,'error',info.displayCode,err?.stack||err); throw err;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  const emailOf = u => String(u?.email||'').trim().toLowerCase();

  async function adminInfo(uid){
    diag.step('AUTH-ADMIN-START','管理者登録を確認しています。');
    try {
      const s=await getDoc(doc(db,'admins',uid));
      diag.step('AUTH-ADMIN-OK',s.exists()?'管理者登録を確認しました。':'管理者登録はありません。','success');
      return s.exists()&&s.data().enabled!==false?s.data():null;
    } catch(err) { throw Object.assign(err,{authStage:'ADMIN'}); }
  }
  async function prereg(user){
    const email=emailOf(user);
    diag.step('AUTH-ALLOWLIST-START','事前登録マスターを確認しています。');
    try {
      const s=await getDoc(doc(db,'betaAllowlist',email));
      if(!s.exists()||s.data().enabled!==true) throw new Error('このGoogleアカウントはv1.3βの事前登録マスターに登録されていません。');
      diag.step('AUTH-ALLOWLIST-OK','事前登録を確認しました。','success');
      return {ref:s.ref,data:s.data(),email};
    } catch(err) { throw Object.assign(err,{authStage:'ALLOWLIST'}); }
  }
  async function ensureProfile(user){
    diag.setUserEmail(emailOf(user));
    const admin=await adminInfo(user.uid);
    if(admin) return {name:user.displayName||admin.displayName||'',email:emailOf(user),status:'active',plan:'administrator',isAdmin:true,unionStatus:'admin'};
    const allow=await prereg(user);
    const uref=doc(db,'users',user.uid);
    diag.step('AUTH-USER-START','利用者情報を確認しています。');
    let us;
    try { us=await getDoc(uref); } catch(err) { throw Object.assign(err,{authStage:'USER'}); }
    if(us.exists()){
      const p=us.data();
      if(p.status!=='active') throw Object.assign(new Error(p.suspensionReason||'このアカウントは利用停止中です。'),{authStage:'STATUS'});
      if(String(p.email||'').toLowerCase()!==allow.email) throw Object.assign(new Error('登録済みメールアドレスとGoogleアカウントが一致しません。'),{authStage:'EMAIL'});
      await updateDoc(uref,{lastLoginAt:serverTimestamp(),lastVersion:'v1.3-beta'}).catch(()=>{});
      diag.step('AUTH-USER-OK','利用者情報を確認しました。','success');
      return {...p,isAdmin:false};
    }
    const a=allow.data;
    if(!a.driverNumber) throw Object.assign(new Error('事前登録情報に乗務員番号がありません。管理者へお問い合わせください。'),{authStage:'DRIVER'});
    const profile={name:user.displayName||a.displayName||'',displayName:user.displayName||'',email:allow.email,status:'active',plan:'beta_v1_3',version:'v1.3-beta',driverNumber:String(a.driverNumber),office:a.office||'',unionStatus:a.unionStatus||'nonmember',tester:a.tester!==false,authProvider:'google.com',createdAt:serverTimestamp(),lastLoginAt:serverTimestamp(),termsAcceptedAt:serverTimestamp()};
    try {
      diag.step('AUTH-USER-CREATE','初回利用者情報を作成しています。');
      await setDoc(uref,profile);
      await updateDoc(allow.ref,{registeredUid:user.uid,registeredAt:serverTimestamp()}).catch(()=>{});
      diag.step('AUTH-USER-CREATE-OK','初回利用者情報を作成しました。','success');
    } catch(err) { throw Object.assign(err,{authStage:'USERCREATE'}); }
    return {...profile,isAdmin:false};
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
  async function route(user){
    setMessage('利用者情報を確認しています…','info');
    diag.step('AUTH-STATE-SIGNED-IN','Google認証に成功しました。','success');
    updateAttempt({phase:'auth-state-signed-in', email:maskEmail(user?.email||'')});
    const p=await ensureProfile(user);
    await recordSuccessfulLogin(user,p);
    diag.step('AUTH-COMPLETE-001','ログインが完了しました。','success');
    clearAttempt();
    showApp(p); D.notify('ログインしました。','success','AUTH-SIGNIN-OK');
  }

  login.addEventListener('click',async()=>{
    I?.add('V4-LOGIN-CLICK','Googleログインボタンが押されました。');
    preservedFailure=false;
    login.disabled=true;
    setMessage('Googleログインを開始しています…','info');
    diag.step('AUTH-SIGNIN-START','Googleログインを開始しました。');
    startAttempt('popup');
    diag.step('AUTH-ATTEMPT-SAVED','ログイン試行情報を端末に保存しました。','success');
    try {
      diag.step('AUTH-PERSIST-START','認証情報の保存可否を確認しています。');
      await setPersistence(auth,browserLocalPersistence);
      diag.step('AUTH-PERSIST-OK','認証情報を保存できます。','success');
      diag.step('AUTH-POPUP-START','Googleアカウント選択画面を開いています。');
      I?.add('V4-POPUP-CALL','signInWithPopup を呼び出します。');
      const result=await signInWithPopup(auth,provider);
      I?.add('V4-POPUP-RETURN','signInWithPopup が完了しました。',result?.user?.email||'emailなし');
      updateAttempt({phase:'popup-resolved', email:maskEmail(result?.user?.email||'')});
      diag.setUserEmail(result?.user?.email||'');
      diag.step('AUTH-POPUP-OK','Googleアカウントの選択が完了しました。','success');
    } catch(err) {
      const code=err?.code||'';
      if(code==='auth/popup-blocked'||code==='auth/cancelled-popup-request'){
        diag.step('AUTH-REDIRECT-FALLBACK','ポップアップを開けないため、画面遷移方式へ切り替えます。');
        updateAttempt({method:'redirect',phase:'redirect-start'});
        try { await signInWithRedirect(auth,provider); return; }
        catch(redirErr) {
          clearAttempt();
          const info=userFriendlyError('REDIRECT',redirErr); preservedFailure=true; setMessage(info.text); diag.fail(info,'REDIRECT'); D.notify(info.text,'error',info.displayCode,redirErr?.stack||redirErr);
        }
      } else {
        clearAttempt();
        const info=userFriendlyError('SIGNIN',err); preservedFailure=true; setMessage(info.text); diag.fail(info,'SIGNIN'); D.notify(info.text,'error',info.displayCode,err?.stack||err);
      }
    } finally { login.disabled=false; }
  });

  logout?.addEventListener('click',async()=>{ preservedFailure=false; await signOut(auth); diag.step('AUTH-SIGNOUT-OK','ログアウトしました。','success'); D.notify('ログアウトしました。','success','AUTH-SIGNOUT-OK'); });

  try {
    diag.step('AUTH-REDIRECT-CHECK','画面遷移後の認証結果を確認しています。');
    const redirectResult=await getRedirectResult(auth);
    if(redirectResult?.user){
      diag.setUserEmail(redirectResult.user.email||'');
      updateAttempt({phase:'redirect-resolved', email:maskEmail(redirectResult.user.email||'')});
      diag.step('AUTH-REDIRECT-OK','画面遷移方式のGoogle認証に成功しました。','success');
    } else {
      diag.step('AUTH-REDIRECT-NONE','画面遷移後の認証結果はありません。','info');
    }
  } catch(err) {
    const info=userFriendlyError('REDIRECT',err); preservedFailure=true; setMessage(info.text); diag.fail(info,'REDIRECT-RESULT'); D.notify(info.text,'error',info.displayCode,err?.stack||err);
  }

  let signedOutCheckTimer = null;
  onAuthStateChanged(auth,async user=>{
    I?.add('V4-AUTH-STATE','onAuthStateChanged',user ? ('SIGNED_IN '+(user.email||'')) : 'SIGNED_OUT');
    if(!user){
      showGate();
      const attempt = readAttempt();
      const age = attempt?.startedAt ? Date.now() - attempt.startedAt : null;
      const recentAttempt = attempt && age >= 0 && age < 180000;
      if(recentAttempt){
        setMessage('Google認証後のログイン状態を確認しています…','info');
        diag.step('AUTH-STATE-WAIT','Googleアカウント選択後の認証状態を確認しています。');
        clearTimeout(signedOutCheckTimer);
        signedOutCheckTimer = setTimeout(()=>{
          if(auth.currentUser) return;
          preservedFailure = true;
          const method = attempt.method === 'redirect' ? '画面遷移方式' : 'ポップアップ方式';
          const info = {
            displayCode:'AUTH-SESSION-001',
            text:`Googleアカウントは選択されましたが、${method}の認証情報をこのブラウザで保持できませんでした。Safari/ChromeのCookie・サイトデータ制限、プライベートブラウズ、またはFirebase認証セッションの保存失敗が考えられます。`,
            rawCode:'auth-state-not-persisted',
            rawMessage:`attempt=${attempt.id || ''}, method=${attempt.method || ''}, phase=${attempt.phase || ''}, age=${Date.now()-(attempt.startedAt||Date.now())}`
          };
          setMessage(info.text);
          diag.fail(info,'SESSION');
          D.notify(info.text,'error',info.displayCode,info.rawMessage);
          clearAttempt();
        }, 2500);
      } else if(!preservedFailure){
        setMessage('Googleアカウントでログインしてください。','info');
        diag.step('AUTH-STATE-SIGNED-OUT','現在は未ログインです。');
      }
      return;
    }
    clearTimeout(signedOutCheckTimer);
    try { await route(user); }
    catch(err) {
      const stage=err?.authStage||'USER';
      const info=userFriendlyError(stage,err);
      preservedFailure=true;
      showGate();
      setMessage(info.text);
      diag.fail(info,stage);
      D.notify(info.text,'error',info.displayCode,err?.stack||err);
      await signOut(auth).catch(()=>{});
    }
  });
  login.disabled=false;
  return true;
}
