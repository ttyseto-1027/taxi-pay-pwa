import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser
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
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showLogin = document.getElementById('showLogin');
const showRegister = document.getElementById('showRegister');
const userLabel = document.getElementById('signedInUser');
const logoutButton = document.getElementById('logoutButton');
const adminLink = document.getElementById('adminPageLink');
const passwordChangeGate = document.getElementById('passwordChangeGate');
const passwordChangeForm = document.getElementById('passwordChangeForm');
const passwordChangeMessage = document.getElementById('passwordChangeMessage');
const passwordChangeLogout = document.getElementById('passwordChangeLogout');
const accountPasswordCurrent = document.getElementById('accountPasswordCurrent');
const accountPasswordNew = document.getElementById('accountPasswordNew');
const accountPasswordConfirm = document.getElementById('accountPasswordConfirm');
const accountPasswordChangeButton = document.getElementById('accountPasswordChangeButton');
const accountPasswordMessage = document.getElementById('accountPasswordMessage');

function setMessage(text, kind = 'error') {
  message.textContent = text || '';
  message.dataset.kind = kind;
}

function showApp(profile) {
  document.body.classList.remove('auth-pending', 'password-change-pending');
  gate.hidden = true;
  passwordChangeGate.hidden = true;
  userLabel.textContent = profile?.name || profile?.email || '';
  adminLink.hidden = !profile?.isAdmin;
}

function showGate() {
  document.body.classList.remove('password-change-pending');
  document.body.classList.add('auth-pending');
  passwordChangeGate.hidden = true;
  gate.hidden = false;
  userLabel.textContent = '';
  adminLink.hidden = true;
}

function showPasswordChangeGate(profile) {
  document.body.classList.remove('auth-pending');
  document.body.classList.add('password-change-pending');
  gate.hidden = true;
  passwordChangeGate.hidden = false;
  userLabel.textContent = profile?.name || profile?.email || '';
  adminLink.hidden = true;
  passwordChangeMessage.textContent = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newPasswordConfirm').value = '';
}

function switchTab(mode) {
  const login = mode === 'login';
  loginForm.hidden = !login;
  registerForm.hidden = login;
  showLogin.classList.toggle('active', login);
  showRegister.classList.toggle('active', !login);
  setMessage('');
}

showLogin?.addEventListener('click', () => switchTab('login'));
showRegister?.addEventListener('click', () => switchTab('register'));

if (!config.enabled || !config.apiKey || config.apiKey === 'REPLACE_ME') {
  setupNotice.hidden = false;
  setMessage('Firebase接続前のため、ユーザー登録・ログインはまだ利用できません。', 'info');
  showGate();
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let registrationInProgress = false;
  let profileRecoveryUser = null;

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text.trim());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async function loadProfile(user) {
    const profileRef = doc(db, 'users', user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      throw new Error('利用者情報が登録されていません。');
    }

    const profile = profileSnap.data();
    if (profile.status !== 'active') {
      throw new Error('このアカウントは利用停止中です。');
    }

    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    await updateDoc(profileRef, { lastLoginAt: serverTimestamp() }).catch(() => {});

    return { ...profile, email: user.email, isAdmin: adminSnap.exists() };
  }

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('ログインしています…', 'info');

    try {
      await signInWithEmailAndPassword(
        auth,
        document.getElementById('loginEmail').value.trim(),
        document.getElementById('loginPassword').value
      );
    } catch {
      setMessage('ログインできませんでした。メールアドレスとパスワードをご確認ください。');
    }
  });

  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('登録しています…', 'info');

    let credential;
    registrationInProgress = true;

    try {
      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const accessCode = document.getElementById('registerAccessCode').value.trim();

      if (!name) throw new Error('氏名を入力してください。');
      if (!accessCode) throw new Error('β版無料利用コードを入力してください。');

      const accessCodeHash = await sha256(accessCode);

      let user;
      let createdNewAuthUser = false;

      if (profileRecoveryUser) {
        if ((profileRecoveryUser.email || '').toLowerCase() !== email.toLowerCase()) {
          throw new Error('ログイン中のメールアドレスと登録メールアドレスが一致しません。');
        }
        user = profileRecoveryUser;
      } else {
        credential = await createUserWithEmailAndPassword(auth, email, password);
        user = credential.user;
        createdNewAuthUser = true;
      }
      const codeRef = doc(db, 'accessCodes', accessCodeHash);
      const userRef = doc(db, 'users', user.uid);

      await runTransaction(db, async (tx) => {
        const codeSnap = await tx.get(codeRef);

        if (!codeSnap.exists()) {
          throw new Error('β版無料利用コードが正しくありません。');
        }

        const code = codeSnap.data();
        const uses = Number(code.usageCount || 0);
        const max = Number(code.maxUses || 0);

        if (!Number.isInteger(uses) || uses < 0 || !Number.isInteger(max) || max < 0) {
          throw new Error('無料利用コードの設定が不正です。管理者へお問い合わせください。');
        }

        if (code.active !== true) {
          throw new Error('β版無料利用コードは現在利用できません。');
        }

        if (max > 0 && uses >= max) {
          throw new Error('β版テストユーザーの募集は終了しました。');
        }

        tx.update(codeRef, {
          usageCount: uses + 1,
          lastUsedAt: serverTimestamp(),
          lastUsedBy: user.uid
        });

        tx.set(userRef, {
          name,
          email,
          status: 'active',
          plan: 'beta_free',
          accessCodeHash,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          termsAcceptedAt: serverTimestamp(),
          mustChangePassword: false
        });
      });

      // 登録中は onAuthStateChanged を抑止しているため、登録完了後は
      // ここで利用者情報を直接読み込み、確実にアプリ画面へ移動する。
      const profile = await loadProfile(user);
      profileRecoveryUser = null;
      registrationInProgress = false;
      setMessage('登録が完了しました。', 'info');
      showApp(profile);
    } catch (error) {
      if (credential?.user && !profileRecoveryUser) {
        await deleteUser(credential.user).catch(() => {});
      }

      const code = error?.code || '';
      const friendlyMessage =
        code === 'auth/email-already-in-use'
          ? 'このメールアドレスは既に登録されています。ログインしてください。'
          : code === 'auth/invalid-email'
            ? 'メールアドレスの形式が正しくありません。'
            : code === 'auth/weak-password'
              ? 'パスワードは8文字以上で設定してください。'
              : code === 'permission-denied' || code === 'firestore/permission-denied'
                ? '登録権限を確認できませんでした。Firestoreルールを最新版へ更新してください。'
                : (error?.message || '登録できませんでした。入力内容をご確認ください。');

      showGate();
      switchTab('register');
      setMessage(friendlyMessage);
    } finally {
      registrationInProgress = false;
    }
  });

  logoutButton?.addEventListener('click', () => signOut(auth));
  passwordChangeLogout?.addEventListener('click', () => signOut(auth));

  passwordChangeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = auth.currentUser;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('newPasswordConfirm').value;

    passwordChangeMessage.dataset.kind = 'error';
    if (!user) {
      passwordChangeMessage.textContent = 'ログイン状態を確認できません。もう一度ログインしてください。';
      return;
    }
    if (newPassword.length < 8) {
      passwordChangeMessage.textContent = '新しいパスワードは8文字以上で設定してください。';
      return;
    }
    if (newPassword !== confirmPassword) {
      passwordChangeMessage.textContent = '確認用パスワードが一致しません。';
      return;
    }

    passwordChangeMessage.dataset.kind = 'info';
    passwordChangeMessage.textContent = 'パスワードを変更しています…';

    try {
      await updatePassword(user, newPassword);
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, {
        mustChangePassword: false,
        passwordChangedAt: serverTimestamp()
      });
      const profile = await loadProfile(user);
      passwordChangeMessage.textContent = '';
      showApp(profile);
    } catch (error) {
      passwordChangeMessage.dataset.kind = 'error';
      passwordChangeMessage.textContent = error?.code === 'auth/requires-recent-login'
        ? '安全確認のため、いったんログアウトして仮パスワードで再ログインしてください。'
        : 'パスワードを変更できませんでした。別のパスワードをお試しください。';
    }
  });


  accountPasswordChangeButton?.addEventListener('click', async () => {
    const user = auth.currentUser;
    const currentPassword = accountPasswordCurrent?.value || '';
    const newPassword = accountPasswordNew?.value || '';
    const confirmPassword = accountPasswordConfirm?.value || '';

    if (!accountPasswordMessage) return;
    accountPasswordMessage.dataset.kind = 'error';
    accountPasswordMessage.textContent = '';

    if (!user || !user.email) {
      accountPasswordMessage.textContent = 'ログイン状態を確認できません。もう一度ログインしてください。';
      return;
    }
    if (!currentPassword) {
      accountPasswordMessage.textContent = '現在のパスワードを入力してください。';
      return;
    }
    if (newPassword.length < 8) {
      accountPasswordMessage.textContent = '新しいパスワードは8文字以上で設定してください。';
      return;
    }
    if (newPassword !== confirmPassword) {
      accountPasswordMessage.textContent = '新しいパスワードと確認用パスワードが一致しません。';
      return;
    }
    if (currentPassword === newPassword) {
      accountPasswordMessage.textContent = '現在とは異なる新しいパスワードを設定してください。';
      return;
    }

    accountPasswordChangeButton.disabled = true;
    accountPasswordMessage.dataset.kind = 'info';
    accountPasswordMessage.textContent = '本人確認後、パスワードを変更しています…';

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      accountPasswordCurrent.value = '';
      accountPasswordNew.value = '';
      accountPasswordConfirm.value = '';
      accountPasswordMessage.dataset.kind = 'info';
      accountPasswordMessage.textContent = 'パスワードを変更しました。次回から新しいパスワードでログインしてください。';
    } catch (error) {
      const code = error?.code || '';
      accountPasswordMessage.dataset.kind = 'error';
      accountPasswordMessage.textContent =
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? '現在のパスワードが正しくありません。'
          : code === 'auth/weak-password'
            ? '新しいパスワードは8文字以上で設定してください。'
            : code === 'auth/too-many-requests'
              ? '試行回数が多すぎます。時間をおいてから再度お試しください。'
              : code === 'auth/network-request-failed'
                ? '通信に失敗しました。インターネット接続をご確認ください。'
                : 'パスワードを変更できませんでした。入力内容をご確認ください。';
    } finally {
      accountPasswordChangeButton.disabled = false;
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (registrationInProgress) {
      return;
    }

    if (!user) {
      showGate();
      return;
    }

    try {
      const profile = await loadProfile(user);
      setMessage('');
      if (profile.mustChangePassword === true) {
        showPasswordChangeGate(profile);
      } else {
        showApp(profile);
      }
    } catch (error) {
      if (error?.message === '利用者情報が登録されていません。') {
        profileRecoveryUser = user;
        showGate();
        switchTab('register');
        document.getElementById('registerEmail').value = user.email || '';
        document.getElementById('registerEmail').readOnly = true;
        const passwordInput = document.getElementById('registerPassword');
        passwordInput.required = false;
        passwordInput.closest('label').hidden = true;
        setMessage('利用者情報が未登録です。氏名と無料利用コードを入力して登録を完了してください。', 'info');
        return;
      }

      await signOut(auth).catch(() => {});
      showGate();
      setMessage(error?.message || 'このアカウントでは利用できません。');
    }
  });
}
