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
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config = window.TAXI_PAY_FIREBASE_CONFIG || {};
const gate = document.getElementById('announcementAuthGate');
const message = document.getElementById('announcementAuthMessage');
let currentAdminUid = '';
let currentAdminEmail = '';

function setStatus(text = '', kind = '') {
  if (!message) return;
  message.textContent = text;
  message.dataset.kind = kind;
}
function errorText(error, fallback) {
  console.error(error);
  const code = error?.code ? `（${error.code}）` : '';
  return `${error?.message || fallback}${code}`;
}
function showGate(text = '管理者のGoogleアカウントでログインしてください。') {
  document.body.classList.add('auth-pending');
  if (gate) gate.hidden = false;
  setStatus(text, text.includes('してください') ? 'info' : 'error');
}
function showPage() {
  document.body.classList.remove('auth-pending');
  if (gate) gate.hidden = true;
  setStatus('');
}
function datetimeLocalToJstIso(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error('掲載日時を入力してください。');
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+09:00`;
}
function jstIsoToDatetimeLocal(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : '';
}
function formatJst(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
}
function nowJstIso() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T') + '+09:00';
}
function announcementIsActive(data) {
  if (!data?.enabled) return false;
  const now = Date.now();
  const start = new Date(data.startAtJst).getTime();
  const end = new Date(data.endAtJst).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
}
function getAnnouncementElements() {
  const elements = {
    startAt: document.getElementById('announcementStartAt'),
    endAt: document.getElementById('announcementEndAt'),
    title: document.getElementById('announcementTitle'),
    priority: document.getElementById('announcementPriority'),
    message: document.getElementById('announcementMessage'),
    enabled: document.getElementById('announcementEnabled'),
    blockLogin: document.getElementById('announcementBlockLogin'),
    status: document.getElementById('systemAnnouncementStatus'),
    preview: document.getElementById('systemAnnouncementPreview')
  };
  return Object.values(elements).every(Boolean) ? elements : null;
}
function renderAnnouncement(data = {}) {
  const elements = getAnnouncementElements();
  if (!elements) {
    throw new Error('お知らせ管理画面の必要な要素を確認できませんでした。最新版を再読み込みしてください。');
  }
  elements.startAt.value = jstIsoToDatetimeLocal(data.startAtJst);
  elements.endAt.value = jstIsoToDatetimeLocal(data.endAtJst);
  elements.title.value = data.title || '';
  elements.priority.value = data.priority || 'important';
  elements.message.value = data.message || '';
  elements.enabled.checked = data.enabled === true;
  elements.blockLogin.checked = data.blockLogin === true;
  const active = announcementIsActive(data);
  elements.status.textContent = data.message
    ? `${active ? '現在掲載中' : (data.enabled ? '掲載期間外' : '掲載停止中')}／${formatJst(data.startAtJst)} ～ ${formatJst(data.endAtJst)}${data.blockLogin ? '／ログイン停止あり' : ''}`
    : 'お知らせは未設定です。';
  elements.preview.hidden = !data.message;
  elements.preview.dataset.priority = data.priority || 'important';
  elements.preview.textContent = data.message ? `${data.title ? data.title + '\n' : ''}${data.message}` : '';
}

if (!config.enabled || !config.apiKey || config.apiKey === 'REPLACE_ME') {
  showGate('Firebaseの初期設定が未完了です。firebase-config.jsを確認してください。');
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const announcementRef = doc(db, 'appSettings', 'systemAnnouncement');

  document.getElementById('announcementGoogleLogin')?.addEventListener('click', async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      try { await signInWithPopup(auth, provider); }
      catch (error) {
        if (['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].includes(error?.code)) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw error;
      }
    } catch (error) { setStatus(errorText(error, 'Googleログインに失敗しました。'), 'error'); }
  });
  document.getElementById('announcementLogout')?.addEventListener('click', () => signOut(auth));
  document.getElementById('systemAnnouncementForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('systemAnnouncementStatus');
    try {
      const startAtJst = datetimeLocalToJstIso(document.getElementById('announcementStartAt').value);
      const endAtJst = datetimeLocalToJstIso(document.getElementById('announcementEndAt').value);
      if (new Date(endAtJst) <= new Date(startAtJst)) throw new Error('掲載終了は掲載開始より後にしてください。');
      const title = document.getElementById('announcementTitle').value.trim();
      const messageText = document.getElementById('announcementMessage').value.trim();
      if (!title) throw new Error('タイトルを入力してください。');
      if (!messageText) throw new Error('本文を入力してください。');
      const payload = {
        title,
        priority: document.getElementById('announcementPriority').value,
        sourceType: 'system',
        sourceLabel: 'システム管理者',
        message: messageText,
        startAtJst,
        endAtJst,
        enabled: document.getElementById('announcementEnabled').checked,
        blockLogin: document.getElementById('announcementBlockLogin').checked,
        updatedAt: serverTimestamp(),
        updatedAtJst: nowJstIso(),
        updatedByUid: currentAdminUid,
        updatedByEmail: currentAdminEmail
      };
      await setDoc(announcementRef, payload, { merge: true });
      renderAnnouncement(payload);
      status.textContent = 'お知らせを保存しました。';
    } catch (error) { status.textContent = errorText(error, 'お知らせを保存できませんでした。'); }
  });
  document.getElementById('disableSystemAnnouncement')?.addEventListener('click', async () => {
    const status = document.getElementById('systemAnnouncementStatus');
    try {
      await setDoc(announcementRef, {
        enabled: false,
        updatedAt: serverTimestamp(),
        updatedAtJst: nowJstIso(),
        updatedByUid: currentAdminUid,
        updatedByEmail: currentAdminEmail
      }, { merge: true });
      document.getElementById('announcementEnabled').checked = false;
      status.textContent = 'お知らせの掲載を停止しました。';
    } catch (error) { status.textContent = errorText(error, '掲載を停止できませんでした。'); }
  });

  getRedirectResult(auth).catch((error) => setStatus(errorText(error, 'Googleログインに失敗しました。'), 'error'));
  onAuthStateChanged(auth, async (user) => {
    if (!user) { showGate(); return; }
    try {
      const adminSnapshot = await getDoc(doc(db, 'admins', user.uid));
      if (!adminSnapshot.exists() || adminSnapshot.data().enabled === false) {
        await signOut(auth);
        showGate('このGoogleアカウントには管理者権限がありません。');
        return;
      }
      currentAdminUid = user.uid;
      currentAdminEmail = String(user.email || '').trim().toLowerCase();
      const snapshot = await getDoc(announcementRef);
      renderAnnouncement(snapshot.exists() ? snapshot.data() : {});
      showPage();
    } catch (error) {
      await signOut(auth).catch(() => {});
      showGate(errorText(error, '管理者権限を確認できませんでした。'));
    }
  });
}
