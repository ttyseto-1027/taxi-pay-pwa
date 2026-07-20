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
  updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config = window.TAXI_PAY_FIREBASE_CONFIG || {};
const gate = document.getElementById('authGate');
const message = document.getElementById('authMessage');
const setupNotice = document.getElementById('firebaseSetupNotice');
const googleLoginButton = document.getElementById('googleLoginButton');
const invitePanel = document.getElementById('invitePanel');
const inviteForm = document.getElementById('inviteForm');
const inviteCodeInput = document.getElementById('inviteCode');
const inviteCancelButton = document.getElementById('inviteCancelButton');
const userLabel = document.getElementById('signedInUser');
const logoutButton = document.getElementById('logoutButton');
const adminLink = document.getElementById('adminPageLink');

function setMessage(text = '', kind = 'error') {
  message.textContent = text;
  message.dataset.kind = kind;
}
function setBusy(value) {
  googleLoginButton.disabled = value;
  const submit = inviteForm?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = value;
}
function showGate() {
  document.body.classList.add('auth-pending');
  gate.hidden = false;
  googleLoginButton.hidden = false;
  invitePanel.hidden = true;
  userLabel.textContent = '';
  adminLink.hidden = true;
}
function showInvite(user) {
  document.body.classList.add('auth-pending');
  gate.hidden = false;
  googleLoginButton.hidden = true;
  invitePanel.hidden = false;
  userLabel.textContent = user.displayName || user.email || '';
  inviteCodeInput.value = '';
  document.getElementById('inviteTerms').checked = false;
  requestAnimationFrame(() => inviteCodeInput.focus());
}
function showApp(profile) {
  document.body.classList.remove('auth-pending');
  gate.hidden = true;
  invitePanel.hidden = true;
  googleLoginButton.hidden = false;
  userLabel.textContent = profile.name || profile.displayName || profile.email || '';
  adminLink.hidden = profile.isAdmin !== true;
  setMessage('');
}
function emailOf(user) { return String(user?.email || '').trim().toLowerCase(); }
async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim()));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

if (!config.enabled || !config.apiKey || config.apiKey === 'REPLACE_ME') {
  setupNotice.hidden = false;
  setMessage('Firebase接続設定が完了していません。', 'info');
  showGate();
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let registrationInProgress = false;

  async function getAllowlist(user) {
    const email = emailOf(user);
    if (!email) throw new Error('Googleアカウントのメールアドレスを取得できませんでした。');
    const ref = doc(db, 'betaAllowlist', email);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().enabled !== true) {
      throw new Error('このGoogleアカウントはv1.2βの利用許可リストに登録されていません。');
    }
    return { ref, data: snap.data(), email };
  }

  async function loadProfile(user) {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const profile = snap.data();
    if (profile.status !== 'active') throw new Error('このアカウントは利用停止中です。');
    if (String(profile.email || '').toLowerCase() !== emailOf(user)) throw new Error('登録済みメールアドレスとGoogleアカウントが一致しません。');
    const allow = await getAllowlist(user);
    if (allow.data.invitationUsed !== true || allow.data.registeredUid !== user.uid) throw new Error('利用許可情報が一致しません。管理者へお問い合わせください。');
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    await updateDoc(ref, { lastLoginAt: serverTimestamp() }).catch(() => {});
    return { ...profile, isAdmin: adminSnap.exists() };
  }

  async function routeUser(user) {
    const allow = await getAllowlist(user);
    const profile = await loadProfile(user);
    if (profile) return showApp(profile);
    if (allow.data.invitationUsed === true || allow.data.registeredUid) throw new Error('このメールアドレスは登録済みですが、利用者情報を確認できません。管理者へお問い合わせください。');
    showInvite(user);
    setMessage('許可済みアカウントです。初回のみ招待コードを入力してください。', 'info');
  }

  googleLoginButton.addEventListener('click', async () => {
    setBusy(true); setMessage('Googleアカウントを確認しています…', 'info');
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = error?.code || '';
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') { await signInWithRedirect(auth, provider); return; }
      if (code === 'auth/popup-closed-by-user') setMessage('Googleログインがキャンセルされました。');
      else if (code === 'auth/unauthorized-domain') setMessage('この公開URLがFirebaseの承認済みドメインに登録されていません。');
      else setMessage(`Googleログインに失敗しました。${code ? `（${code}）` : ''}`);
    } finally { setBusy(false); }
  });

  inviteCancelButton.addEventListener('click', async () => { await signOut(auth); showGate(); setMessage(''); });
  logoutButton.addEventListener('click', () => signOut(auth));

  inviteForm.addEventListener('submit', async event => {
    event.preventDefault();
    const user = auth.currentUser;
    const rawCode = inviteCodeInput.value.trim();
    if (!user) return setMessage('ログイン状態を確認できません。もう一度Googleログインしてください。');
    if (!rawCode) return setMessage('招待コードを入力してください。');
    if (!document.getElementById('inviteTerms').checked) return setMessage('利用条件とプライバシーポリシーへの同意が必要です。');
    registrationInProgress = true; setBusy(true); setMessage('初回利用登録を確認しています…', 'info');
    try {
      const email = emailOf(user);
      const hash = await sha256(rawCode);
      const allowRef = doc(db, 'betaAllowlist', email);
      const codeRef = doc(db, 'accessCodes', hash);
      const userRef = doc(db, 'users', user.uid);
      await runTransaction(db, async tx => {
        const allowSnap = await tx.get(allowRef);
        const codeSnap = await tx.get(codeRef);
        const userSnap = await tx.get(userRef);
        if (!allowSnap.exists() || allowSnap.data().enabled !== true) throw new Error('このGoogleアカウントは利用許可リストに登録されていません。');
        const allow = allowSnap.data();
        if (allow.invitationUsed === true || allow.registeredUid) throw new Error('このGoogleアカウントは既に初回登録済みです。');
        if (userSnap.exists()) throw new Error('このGoogleアカウントの利用者情報は既に存在します。');
        if (!codeSnap.exists()) throw new Error('招待コードが正しくありません。');
        const code = codeSnap.data();
        const uses = Number(code.usageCount || 0), max = Number(code.maxUses || 0);
        if (code.active !== true) throw new Error('この招待コードは現在利用できません。');
        if (code.version && code.version !== 'v1.2-beta') throw new Error('この招待コードはv1.2β用ではありません。');
        if (!Number.isInteger(uses) || uses < 0 || !Number.isInteger(max) || max < 1) throw new Error('招待コードの設定が不正です。');
        if (uses >= max) throw new Error('β版テスターの登録上限に達しています。');
        tx.update(codeRef, { usageCount: uses + 1, lastUsedAt: serverTimestamp(), lastUsedBy: user.uid });
        tx.update(allowRef, { invitationUsed: true, registeredUid: user.uid, registeredAt: serverTimestamp() });
        tx.set(userRef, {
          name: user.displayName || allow.displayName || '', displayName: user.displayName || '', email,
          status: 'active', plan: 'beta_v1_2', authProvider: 'google.com', accessCodeHash: hash,
          version: 'v1.2-beta', createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), termsAcceptedAt: serverTimestamp()
        });
      });
      const profile = await loadProfile(user);
      if (!profile) throw new Error('登録後の利用者情報を確認できませんでした。');
      showApp(profile);
    } catch (error) { setMessage(error?.message || '初回利用登録に失敗しました。'); }
    finally { registrationInProgress = false; setBusy(false); }
  });

  getRedirectResult(auth).catch(error => setMessage(`Googleログインに失敗しました。${error?.code ? `（${error.code}）` : ''}`));
  onAuthStateChanged(auth, async user => {
    if (registrationInProgress) return;
    if (!user) return showGate();
    try { await routeUser(user); }
    catch (error) { await signOut(auth).catch(() => {}); showGate(); setMessage(error?.message || 'このアカウントでは利用できません。'); }
  });
}
