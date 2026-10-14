import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config = window.TAXI_PAY_FIREBASE_CONFIG || {};
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const gate = document.getElementById('systemInfoAuthGate');
const check = document.getElementById('authCheckingPanel');
const status = document.getElementById('systemInfoStatus');
const list = document.getElementById('systemInfoList');
const cacheListHost = document.getElementById('cacheList');

function esc(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

function showGate(msg='管理者のGoogleアカウントでログインしてください。'){
  document.body.classList.remove('auth-checking');
  check.hidden = true;
  gate.hidden = false;
  const msgNode = document.getElementById('systemInfoMessage');
  if(msgNode) msgNode.textContent = msg;
}

function showPage(){
  document.body.classList.remove('auth-checking');
  check.hidden = true;
  gate.hidden = true;
}

function setStatus(msg=''){
  if(status) status.textContent = msg;
}

function formatError(err){
  return err?.message || String(err || '不明なエラー');
}

async function ensureServiceWorker(){
  if(!('serviceWorker' in navigator)){
    return {
      label:'非対応',
      state:'このブラウザはService Workerに対応していません。',
      registration:null
    };
  }

  try{
    let reg = await navigator.serviceWorker.getRegistration('./');

    if(!reg){
      const swUrl = new URL('./sw.js', location.href);
      reg = await navigator.serviceWorker.register(swUrl.pathname, {
        scope:'./',
        updateViaCache:'none'
      });
    }

    try{ await reg.update(); }catch(_){}

    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve => setTimeout(() => resolve(null), 5000))
    ]);

    reg = readyReg || reg;
    const worker = reg?.active || reg?.waiting || reg?.installing || null;
    let workerState = '登録済み（Worker状態取得待ち）';

    if(worker){
      const kind =
        reg.active === worker ? 'active' :
        reg.waiting === worker ? 'waiting' :
        reg.installing === worker ? 'installing' :
        'worker';
      workerState = `${kind} / ${worker.state || '状態不明'}`;
    }

    return {label:'登録済み', state:workerState, registration:reg};

  }catch(err){
    return {label:'登録失敗', state:formatError(err), registration:null};
  }
}

async function getCacheNames(){
  if(!('caches' in window)){
    return {names:[], message:'Cache Storageはこのブラウザで利用できません。'};
  }

  try{
    const names = await caches.keys();
    const appNames = names.filter(name => name.startsWith('taxi-pay-'));
    return {
      names:appNames,
      message:appNames.length ? '' : 'このアプリのキャッシュはありません。'
    };
  }catch(err){
    return {
      names:[],
      message:`キャッシュ情報を取得できませんでした：${formatError(err)}`
    };
  }
}

function renderRows(rows){
  if(!list) return;
  list.innerHTML = rows
    .map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`)
    .join('');
}

function renderCaches(cacheInfo){
  if(!cacheListHost) return;

  if(!cacheInfo.names.length){
    cacheListHost.innerHTML = `<p>${esc(cacheInfo.message || 'キャッシュはありません。')}</p>`;
    return;
  }

  cacheListHost.innerHTML = cacheInfo.names
    .map(name => `<p><code>${esc(name)}</code></p>`)
    .join('');
}

async function renderDiagnostics(){
  setStatus('システム情報を取得しています…');

  const meta = window.TAXI_PAY_APP_META || {};
  const swInfo = await ensureServiceWorker();
  const cacheInfo = await getCacheNames();

  renderRows([
    ['Version', meta.version],
    ['Build', meta.build],
    ['Environment', meta.environment],
    ['公開日時', meta.releasedAtJst],
    ['Cache Version', meta.cacheVersion],
    ['Service Worker', swInfo.label],
    ['Service Worker状態', swInfo.state],
    ['Firebase projectId', config.projectId || '—'],
    ['現在URL', location.href],
    ['ブラウザ', navigator.userAgent],
    ['PWA起動',
      matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true ? 'はい' : 'いいえ'
    ]
  ]);

  renderCaches(cacheInfo);
  setStatus('情報を更新しました。');
}

async function rebuildPwaCache(){
  const btn = document.getElementById('rebuildPwaCache');

  if(btn){
    btn.disabled = true;
    btn.textContent = '再構築中…';
  }

  try{
    setStatus('PWAキャッシュを再構築しています…');

    if('caches' in window){
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(name => name.startsWith('taxi-pay-'))
          .map(name => caches.delete(name))
      );
    }

    const swInfo = await ensureServiceWorker();

    if(swInfo.registration){
      try{
        if(swInfo.registration.waiting){
          swInfo.registration.waiting.postMessage({type:'SKIP_WAITING'});
        }
        await swInfo.registration.update();
      }catch(_){}
    }

    await renderDiagnostics();
    setStatus('PWAキャッシュの再構築が完了しました。');

  }catch(err){
    setStatus(`PWAキャッシュを再構築できませんでした：${formatError(err)}`);
  }finally{
    if(btn){
      btn.disabled = false;
      btn.textContent = 'PWAキャッシュを再構築';
    }
  }
}

document.getElementById('systemInfoLogin')?.addEventListener('click', async ()=>{
  try{
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, provider);
  }catch(err){
    showGate(formatError(err));
  }
});

document.getElementById('systemInfoLogout')?.addEventListener('click', async ()=>{
  await signOut(auth);
});

document.getElementById('refreshSystemInfo')?.addEventListener('click', async ()=>{
  const btn = document.getElementById('refreshSystemInfo');

  if(btn){
    btn.disabled = true;
    btn.textContent = '情報を取得中…';
  }

  try{
    await renderDiagnostics();
  }finally{
    if(btn){
      btn.disabled = false;
      btn.textContent = '情報を再取得';
    }
  }
});

document.getElementById('rebuildPwaCache')?.addEventListener('click', rebuildPwaCache);

onAuthStateChanged(auth, async user => {
  try{
    if(!user){
      showGate();
      return;
    }

    const adminSnap = await getDoc(doc(db, 'admins', user.uid));

    if(!adminSnap.exists() || adminSnap.data().enabled === false){
      await signOut(auth);
      showGate('管理者権限がありません。');
      return;
    }

    showPage();
    await renderDiagnostics();

  }catch(err){
    console.error('システム情報の認証確認に失敗しました。', err);
    showGate(`認証状態を確認できませんでした：${formatError(err)}`);
  }
});