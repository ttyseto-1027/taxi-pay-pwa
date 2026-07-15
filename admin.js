import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  serverTimestamp,
  orderBy,
  query
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config = window.TAXI_PAY_FIREBASE_CONFIG || {};
const gate = document.getElementById('adminAuthGate');
const msg = document.getElementById('adminMessage');
const body = document.getElementById('usersBody');

function fmt(timestamp) {
  try {
    return timestamp?.toDate().toLocaleString('ja-JP') || '—';
  } catch {
    return '—';
  }
}

function showGate(text) {
  document.body.classList.add('auth-pending');
  gate.hidden = false;
  if (text) msg.textContent = text;
}

function showPage() {
  document.body.classList.remove('auth-pending');
  gate.hidden = true;
}

if (!config.enabled || config.apiKey === 'REPLACE_ME') {
  showGate('Firebaseの初期設定が未完了です。');
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  document.getElementById('adminLoginForm').onsubmit = async (event) => {
    event.preventDefault();
    try {
      await signInWithEmailAndPassword(
        auth,
        document.getElementById('adminEmail').value.trim(),
        document.getElementById('adminPassword').value
      );
    } catch {
      msg.textContent = 'ログインできませんでした。';
    }
  };

  document.getElementById('adminLogout').onclick = () => signOut(auth);

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text.trim());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function positiveInteger(value, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
      throw new Error(`${label}は1人以上の整数で入力してください。`);
    }
    return number;
  }

  document.getElementById('codeForm').onsubmit = async (event) => {
    event.preventDefault();
    const status = document.getElementById('codeStatus');
    status.textContent = '発行しています…';
    try {
      const codeInput = document.getElementById('newAccessCode');
      const maxInput = document.getElementById('newAccessMaxUses');
      const code = codeInput.value.trim();
      const maxUses = positiveInteger(maxInput.value, '利用上限');
      if (!code) throw new Error('利用コードを入力してください。');
      const codeRef = doc(db, 'accessCodes', await sha256(code));
      const existingSnap = await getDoc(codeRef);
      if (existingSnap.exists()) {
        throw new Error('このコードは既に登録されています。下の「利用上限を変更」を使用してください。');
      }
      await setDoc(codeRef, {active:true,maxUses,usageCount:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      status.textContent = `新しい利用コードを発行しました。利用上限は${maxUses}人です。`;
      codeInput.value = '';
      maxInput.value = '3';
    } catch (error) {
      status.textContent = error?.message || 'コードを発行できませんでした。';
    }
  };

  document.getElementById('limitForm').onsubmit = async (event) => {
    event.preventDefault();
    const status = document.getElementById('limitStatus');
    status.textContent = '変更しています…';
    try {
      const codeInput = document.getElementById('limitAccessCode');
      const code = codeInput.value.trim();
      const maxUses = positiveInteger(document.getElementById('limitMaxUses').value, '新しい利用上限');
      if (!code) throw new Error('現在の利用コードを入力してください。');
      const codeRef = doc(db, 'accessCodes', await sha256(code));
      const snap = await getDoc(codeRef);
      if (!snap.exists()) throw new Error('入力された利用コードは登録されていません。');
      const data = snap.data();
      const usageCount = Number(data.usageCount || 0);
      const oldMaxUses = Number(data.maxUses || 0);
      if (!Number.isInteger(usageCount) || usageCount < 0) throw new Error('登録済み人数のデータが不正です。');
      if (maxUses < usageCount) throw new Error(`現在${usageCount}人が登録済みのため、上限を${maxUses}人には変更できません。`);
      await updateDoc(codeRef, {maxUses,active:true,updatedAt:serverTimestamp()});
      status.textContent = `利用上限を${oldMaxUses}人から${maxUses}人へ変更しました。登録済み人数は${usageCount}人のままです。`;
      codeInput.value = '';
    } catch (error) {
      status.textContent = error?.message || '利用上限を変更できませんでした。';
    }
  };

  async function loadUsers() {
    document.getElementById('adminStatus').textContent = '読み込み中…';
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    const users = snap.docs.map((item) => ({ id: item.id, ...item.data() }));

    body.innerHTML = '';
    let active = 0;
    let locked = 0;

    for (const user of users) {
      user.status === 'active' ? active++ : locked++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.name || '—'}</td>
        <td>${user.email || '—'}</td>
        <td>${user.plan || '—'}</td>
        <td>${user.status === 'active' ? '利用中' : '利用停止'}</td>
        <td>${fmt(user.createdAt)}</td>
        <td>${fmt(user.lastLoginAt)}</td>
        <td>
          <button type="button" data-id="${user.id}" data-status="${user.status}">
            ${user.status === 'active' ? '利用停止' : '利用再開'}
          </button>
        </td>`;
      body.appendChild(tr);
    }

    document.getElementById('userCount').textContent = `${users.length}人`;
    document.getElementById('activeCount').textContent = `${active}人`;
    document.getElementById('lockedCount').textContent = `${locked}人`;
    document.getElementById('adminStatus').textContent = '';
  }

  body.onclick = async (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;

    const next = button.dataset.status === 'active' ? 'locked' : 'active';
    const confirmed = confirm(
      next === 'locked'
        ? 'このユーザーを利用停止にしますか？'
        : 'このユーザーの利用を再開しますか？'
    );
    if (!confirmed) return;

    await updateDoc(doc(db, 'users', button.dataset.id), {
      status: next,
      statusUpdatedAt: serverTimestamp()
    });
    await loadUsers();
  };

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showGate();
      return;
    }

    const admin = await getDoc(doc(db, 'admins', user.uid));
    if (!admin.exists()) {
      await signOut(auth);
      showGate('このアカウントには管理者権限がありません。');
      return;
    }

    showPage();
    await loadUsers();
  });
}
