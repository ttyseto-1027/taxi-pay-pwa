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

  document.getElementById('codeForm').onsubmit = async (event) => {
    event.preventDefault();
    const status = document.getElementById('codeStatus');
    status.textContent = '登録しています…';

    try {
      const codeInput = document.getElementById('newAccessCode');
      const maxInput = document.getElementById('newAccessMaxUses');
      const code = codeInput.value.trim();
      const maxUses = Number(maxInput.value || 3);

      if (!code) throw new Error('利用コードを入力してください。');
      if (!Number.isInteger(maxUses) || maxUses < 1) {
        throw new Error('利用上限は1人以上の整数で入力してください。');
      }

      const hash = await sha256(code);
      const codeRef = doc(db, 'accessCodes', hash);
      const existingSnap = await getDoc(codeRef);

      if (existingSnap.exists()) {
        const existing = existingSnap.data();
        const usageCount = Number(existing.usageCount || 0);

        if (!Number.isInteger(usageCount) || usageCount < 0) {
          throw new Error('既存コードの登録人数が不正です。');
        }

        if (maxUses < usageCount) {
          throw new Error(`現在${usageCount}人が登録済みのため、上限を${maxUses}人には減らせません。`);
        }

        await updateDoc(codeRef, {
          active: true,
          maxUses,
          updatedAt: serverTimestamp()
        });

        status.textContent = `既存コードの利用上限を${maxUses}人に変更しました。現在${usageCount}人が登録済みです。`;
      } else {
        await setDoc(codeRef, {
          active: true,
          maxUses,
          usageCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        status.textContent = `新しい利用コードを発行しました。利用上限は${maxUses}人です。`;
      }

      codeInput.value = '';
      maxInput.value = '3';
    } catch (error) {
      status.textContent = error?.message || 'コードを登録できませんでした。';
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
