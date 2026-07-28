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

const DIAG_KEY = 'taxiPayAuthDiagnosticV17';
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

function withTimeout(promise, timeoutMs, timeoutCode, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.code = timeoutCode;
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function initializeTaxiPayAuth(){
  const I=window.TaxiPayInlineDiagnostic; I?.add('V17-AUTH-INIT','initializeTaxiPayAuth を開始しました。');
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
  const showApp = profile => {
    document.body.classList.remove('auth-pending');
    gate.hidden=true;
    gate.setAttribute('aria-hidden','true');
    userLabel.textContent=profile.name||profile.email||'';
    adminLink.hidden=profile.isAdmin!==true;
    window.TaxiPayCurrentProfile=profile;
    try{
      sessionStorage.setItem('taxiPayV13Profile',JSON.stringify(profile));
    }catch{}

    const notifyProfile = () => {
      window.dispatchEvent(new CustomEvent('taxipay:profile',{detail:profile}));
      window.dispatchEvent(new CustomEvent('taxipay:app-ready',{detail:profile}));
    };

    notifyProfile();
    requestAnimationFrame(() => {
      document.body.classList.remove('auth-pending');
      gate.hidden=true;
      notifyProfile();
    });
  };

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
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);
  const loginMethod = isIOS ? 'redirect' : 'popup';
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
    let allow;

    try {
      allow=await prereg(user);
    } catch(err) {
      // 管理者がまだ事前登録されていない場合だけ、管理者専用プロフィールへ退避する。
      // 事前登録後は管理者でも通常利用者プロフィールを読み込み、組合員機能を利用できる。
      if(admin){
        diag.step(
          'AUTH-ADMIN-PROFILE-FALLBACK',
          '管理者の利用者情報が未登録のため、管理者専用プロフィールで起動します。',
          'warning'
        );
        return {
          name:user.displayName||admin.displayName||'',
          email:emailOf(user),
          status:'active',
          plan:'administrator',
          isAdmin:true,
          unionStatus:'nonmember',
          driverNumber:'',
          office:''
        };
      }
      throw err;
    }

    const uref=doc(db,'users',user.uid);
    diag.step('AUTH-USER-START','利用者情報を確認しています。');
    let us;
    try { us=await getDoc(uref); } catch(err) { throw Object.assign(err,{authStage:'USER'}); }

    if(us.exists()){
      const p=us.data();
      const a=allow.data;

      if(p.status!=='active') throw Object.assign(new Error(p.suspensionReason||'このアカウントは利用停止中です。'),{authStage:'STATUS'});
      if(String(p.email||'').toLowerCase()!==allow.email) throw Object.assign(new Error('登録済みメールアドレスとGoogleアカウントが一致しません。'),{authStage:'EMAIL'});

      // betaAllowlistを現在の正本として扱い、管理画面で変更した
      // 乗務員番号・営業所・組合員区分をログイン直後の画面へ反映する。
      const mergedProfile={
        ...p,
        name:a.displayName||p.name||p.displayName||user.displayName||'',
        displayName:a.displayName||p.displayName||user.displayName||'',
        email:allow.email,
        driverNumber:String(a.driverNumber||p.driverNumber||''),
        office:a.office||p.office||'',
        unionStatus:a.unionStatus||p.unionStatus||'nonmember',
        tester:a.tester!==false,
        isAdmin:admin!==null
      };

      await updateDoc(
        uref,
        {
          lastLoginAt:serverTimestamp(),
          lastVersion:'v1.3-beta'
        }
      ).catch(()=>{});

      if(
        allow.data.registeredUid == null
        && allow.data.invitationUsed !== true
      ){
        try{
          await updateDoc(
            allow.ref,
            {
              invitationUsed:true,
              registeredUid:user.uid,
              registeredAt:serverTimestamp()
            }
          );
          diag.step(
            'AUTH-ALLOWLIST-LINK-OK',
            '事前登録情報と既存利用者情報を紐付けました。',
            'success'
          );
        }catch(linkErr){
          diag.step(
            'AUTH-ALLOWLIST-LINK-WARN',
            '事前登録情報との紐付けを完了できませんでしたが、最新プロフィールで利用を続けます。',
            'warning',
            linkErr?.message || linkErr
          );
        }
      }

      diag.step(
        'AUTH-USER-OK',
        admin
          ? '管理者権限と最新の利用者情報を確認しました。'
          : '最新の利用者情報を確認しました。',
        'success'
      );

      return mergedProfile;
    }

    const a=allow.data;
    if(!a.driverNumber) throw Object.assign(new Error('事前登録情報に乗務員番号がありません。管理者へお問い合わせください。'),{authStage:'DRIVER'});

    const profile={
      name:user.displayName||a.displayName||'',
      displayName:user.displayName||'',
      email:allow.email,
      status:'active',
      plan:'beta_v1_3',
      version:'v1.3-beta',
      driverNumber:String(a.driverNumber),
      office:a.office||'',
      unionStatus:a.unionStatus||'nonmember',
      tester:a.tester!==false,
      authProvider:'google.com',
      createdAt:serverTimestamp(),
      lastLoginAt:serverTimestamp(),
      termsAcceptedAt:serverTimestamp()
    };

    try {
      diag.step(
        'AUTH-USER-CREATE',
        admin
          ? '管理者の利用者情報を作成しています。'
          : '初回利用者情報を作成しています。'
      );
      await setDoc(uref,profile);
      await updateDoc(
        allow.ref,
        {
          invitationUsed:true,
          registeredUid:user.uid,
          registeredAt:serverTimestamp()
        }
      ).catch(()=>{});
      diag.step(
        'AUTH-USER-CREATE-OK',
        admin
          ? '管理者の利用者情報を作成しました。'
          : '初回利用者情報を作成しました。',
        'success'
      );
    } catch(err) { throw Object.assign(err,{authStage:'USERCREATE'}); }

    return {...profile,isAdmin:admin!==null};
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
  let routingUid = '';
  let completedUid = '';
  let routingPromise = null;

  async function routeOnce(user){
    if(!user) return null;

    if(completedUid === user.uid){
      const cachedProfile = window.TaxiPayCurrentProfile || null;
      if(cachedProfile){
        return cachedProfile;
      }
      // ログアウト後はプロフィールが破棄されるため、同一UIDでも再確認する。
      completedUid = '';
    }

    if(routingUid === user.uid && routingPromise){
      diag.step('AUTH-ROUTE-JOIN','進行中の利用者確認処理の完了を待っています。');
      return routingPromise;
    }

    routingUid = user.uid;
    routingPromise = (async()=>{
      try {
        const profile = await route(user);
        completedUid = user.uid;
        return profile;
      } finally {
        routingUid = '';
        routingPromise = null;
      }
    })();

    return routingPromise;
  }
  async function route(user){
    setMessage('利用者情報を確認しています…','info');
    diag.step('AUTH-STATE-SIGNED-IN','Google認証に成功しました。','success');
    updateAttempt({phase:'auth-state-signed-in', email:maskEmail(user?.email||'')});

    const p=await ensureProfile(user);

    showApp(p);
    diag.step('AUTH-APP-SHOWN','勤務実績入力画面を表示しました。','success');

    try {
      await recordSuccessfulLogin(user,p);
    } catch(recordErr) {
      diag.step(
        'AUTH-LOGIN-RECORD-WARN',
        'ログイン成功記録を保存できませんでしたが、アプリは利用できます。',
        'warning',
        recordErr?.message || recordErr
      );
    }

    diag.step('AUTH-COMPLETE-001','ログインが完了しました。','success');
    clearAttempt();
    D.notify('ログインしました。','success','AUTH-SIGNIN-OK');
    return p;
  }

  login.addEventListener('click',async()=>{
    I?.add('V17-LOGIN-CLICK','Googleログインボタンが押されました。');
    preservedFailure=false;
    login.disabled=true;
    setMessage('Googleログインを開始しています…','info');
    diag.step('AUTH-SIGNIN-START','Googleログインを開始しました。');
    const method = loginMethod;
    startAttempt(method);
    diag.step(
      'AUTH-DEVICE-METHOD',
      isIOS
        ? 'iPhone・iPadのため画面遷移方式でログインします。'
        : isAndroid
          ? 'Android Chromeのためポップアップ方式でログインします。'
          : 'PCのためポップアップ方式でログインします。'
    );
    diag.step('AUTH-ATTEMPT-SAVED','ログイン試行情報を端末に保存しました。','success');

    try {
      diag.step('AUTH-PERSIST-START','認証情報の保存方式を設定しています。');
      try {
        await withTimeout(
          setPersistence(auth,browserLocalPersistence),
          8000,
          'auth/persistence-timeout',
          '認証情報の保存設定が時間内に完了しませんでした。'
        );
        diag.step('AUTH-PERSIST-OK','認証情報の保存設定に成功しました。','success');
      } catch (persistErr) {
        diag.step(
          'AUTH-PERSIST-WARN',
          '認証情報の保存設定を完了できませんでしたが、ログイン処理を続行します。',
          'warning',
          persistErr?.message || persistErr
        );
      }

      if(isIOS){
        updateAttempt({method:'redirect',phase:'redirect-start',isIOS});
        diag.step('AUTH-REDIRECT-START','Googleアカウント選択画面へ移動します。');
        I?.add('V17-REDIRECT-CALL','signInWithRedirect を呼び出します。', isIOS ? 'iOS' : 'mobile');
        await signInWithRedirect(auth,provider);
        return;
      }

      diag.step('AUTH-POPUP-START','Googleアカウント選択画面を開いています。');
      I?.add('V17-POPUP-CALL','signInWithPopup を呼び出します。');
      const result=await signInWithPopup(auth,provider);
      I?.add('V17-POPUP-RETURN','signInWithPopup が完了しました。',result?.user?.email||'emailなし');
      updateAttempt({phase:'popup-resolved', email:maskEmail(result?.user?.email||'')});
      diag.setUserEmail(result?.user?.email||'');
      diag.step('AUTH-POPUP-OK','Googleアカウントの選択が完了しました。','success');
      if(!result?.user) throw Object.assign(new Error('Google認証結果に利用者情報がありません。'),{code:'auth/no-user-result'});
      diag.step('AUTH-DIRECT-ROUTE','認証結果から利用者確認へ進みます。');
      const profile = await routeOnce(result.user);
      if(profile){
        showApp(profile);
        diag.step('AUTH-POPUP-TRANSITION-OK','ポップアップ認証後の画面遷移を完了しました。','success');
      }
    } catch(err) {
      const code=err?.code||'';
      if(loginMethod === 'popup' && (code==='auth/popup-blocked'||code==='auth/cancelled-popup-request')){
        diag.step('AUTH-REDIRECT-FALLBACK','ポップアップを開けないため、画面遷移方式へ切り替えます。');
        updateAttempt({method:'redirect',phase:'redirect-start'});
        try {
          I?.add('V17-REDIRECT-FALLBACK-CALL','signInWithRedirect を呼び出します。');
          await signInWithRedirect(auth,provider);
          return;
        } catch(redirErr) {
          clearAttempt();
          const info=userFriendlyError('REDIRECT',redirErr);
          preservedFailure=true;
          setMessage(info.text);
          diag.fail(info,'REDIRECT');
          D.notify(info.text,'error',info.displayCode,redirErr?.stack||redirErr);
        }
      } else {
        clearAttempt();
        const info=userFriendlyError(loginMethod === 'redirect' ? 'REDIRECT' : 'SIGNIN',err);
        preservedFailure=true;
        setMessage(info.text);
        diag.fail(info,loginMethod === 'redirect' ? 'REDIRECT' : 'SIGNIN');
        D.notify(info.text,'error',info.displayCode,err?.stack||err);
      }
    } finally {
      login.disabled=false;
    }
  });

  logout?.addEventListener('click',async()=>{
    preservedFailure=false;
    completedUid='';
    routingUid='';
    routingPromise=null;
    window.TaxiPayCurrentProfile=null;
    try{sessionStorage.removeItem('taxiPayV13Profile')}catch{}
    await signOut(auth);
    diag.step('AUTH-SIGNOUT-OK','ログアウトしました。','success');
    D.notify('ログアウトしました。','success','AUTH-SIGNOUT-OK');
  });

  // 認証状態監視は、PersistenceやRedirect結果の待機より先に開始する。
  // これにより補助処理が遅延してもログイン画面の準備を完了できる。
  diag.step('AUTH-STATE-LISTENER-START','認証状態の監視を開始しています。');

  onAuthStateChanged(auth,async user=>{
    I?.add('V17-AUTH-STATE','onAuthStateChanged',user ? ('SIGNED_IN '+(user.email||'')) : 'SIGNED_OUT');
    if(!user){
      // 次回ログイン時に同一UIDでも利用者確認と画面表示を再実行する。
      completedUid='';
      routingUid='';
      routingPromise=null;
      showGate();
      if(!preservedFailure && !readAttempt()){
        setMessage('Googleアカウントでログインしてください。','info');
        diag.step('AUTH-STATE-SIGNED-OUT','現在は未ログインです。');
      }
      return;
    }
    try { await routeOnce(user); }
    catch(err) {
      const stage=err?.authStage||'USER';
      const info=userFriendlyError(stage,err);
      preservedFailure=true;
      showGate();
      setMessage(info.text);
      diag.fail(info,stage);
      D.notify(info.text,'error',info.displayCode,err?.stack||err);
      clearAttempt();
      await signOut(auth).catch(()=>{});
    }
  });
  diag.step('AUTH-STATE-LISTENER-OK','認証状態の監視を開始しました。','success');

  try {
    diag.step('AUTH-PERSIST-BOOT-START','起動時に認証情報の保存方式を設定しています。');
    await withTimeout(
      setPersistence(auth,browserLocalPersistence),
      8000,
      'auth/persistence-timeout',
      '起動時の認証情報保存設定が時間内に完了しませんでした。'
    );
    diag.step('AUTH-PERSIST-BOOT-OK','起動時の認証情報保存設定に成功しました。','success');
  } catch(err) {
    // Persistenceの失敗だけで起動を停止しない。
    diag.step(
      'AUTH-PERSIST-BOOT-WARN',
      '認証情報の保存設定を完了できませんでしたが、ログイン機能は利用できます。',
      'warning',
      err?.message || err
    );
  }

  // Redirect結果の確認はiOSを中心に必要だが、全端末で安全に確認する。
  // 10秒で打ち切り、結果待ちで画面が永久に停止しないようにする。
  try {
    diag.step('AUTH-REDIRECT-CHECK','画面遷移後の認証結果を確認しています。');
    const redirectResult = await withTimeout(
      getRedirectResult(auth),
      10000,
      'auth/redirect-result-timeout',
      '画面遷移後の認証結果確認が時間内に完了しませんでした。'
    );
    if(redirectResult?.user){
      diag.setUserEmail(redirectResult.user.email||'');
      updateAttempt({phase:'redirect-resolved', email:maskEmail(redirectResult.user.email||'')});
      diag.step('AUTH-REDIRECT-OK','画面遷移方式のGoogle認証に成功しました。','success');
      await routeOnce(redirectResult.user);
    } else {
      diag.step('AUTH-REDIRECT-NONE','画面遷移後の認証結果はありません。','info');
    }
  } catch(err) {
    if (err?.code === 'auth/redirect-result-timeout') {
      diag.step(
        'AUTH-REDIRECT-TIMEOUT',
        '認証結果の確認を打ち切り、ログイン画面を利用可能にします。',
        'warning',
        err?.message || err
      );
    } else {
      const info=userFriendlyError('REDIRECT',err);
      preservedFailure=true;
      setMessage(info.text);
      diag.fail(info,'REDIRECT-RESULT');
      D.notify(info.text,'error',info.displayCode,err?.stack||err);
    }
  }

  login.disabled=false;
  if (!auth.currentUser && !preservedFailure) {
    setMessage('Googleアカウントでログインしてください。','info');
  }
  diag.step('AUTH-READY-001','認証機能の準備が完了しました。','success');
  return true;
}
