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
  collection,
  getDocs,
  updateDoc,
  writeBatch,
  serverTimestamp,
  orderBy,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config = window.TAXI_PAY_FIREBASE_CONFIG || {};

const gate = document.getElementById('adminAuthGate');
const checkingPanel = document.getElementById('authCheckingPanel');
const message = document.getElementById('adminMessage');
const usersBody = document.getElementById('usersBody');
const allowlistBody = document.getElementById('allowlistBody');

const unifiedUsersBody = document.getElementById('unifiedUsersBody');
let cachedAllowlistEntries = [];
let cachedRegisteredUsers = [];
let cachedAdminMap = new Map();
let unifiedCurrentPage = 1;

function timestampMillis(value) {
  try { return value?.toMillis?.() || value?.toDate?.().getTime?.() || 0; } catch { return 0; }
}

function buildUnifiedUsers() {
  const allowByUid = new Map();
  const allowByEmail = new Map();
  for (const entry of cachedAllowlistEntries) {
    if (entry.registeredUid) allowByUid.set(String(entry.registeredUid), entry);
    const key = String(entry.email || entry.id || '').trim().toLowerCase();
    if (key) allowByEmail.set(key, entry);
  }

  const registeredByUid = new Map(cachedRegisteredUsers.map((user) => [String(user.id), user]));
  const registeredByEmail = new Map(cachedRegisteredUsers.map((user) => [String(user.email || '').trim().toLowerCase(), user]));
  const result = [];
  const usedUserIds = new Set();

  for (const entry of cachedAllowlistEntries) {
    const email = String(entry.email || entry.id || '').trim().toLowerCase();
    const user = (entry.registeredUid && registeredByUid.get(String(entry.registeredUid))) || registeredByEmail.get(email) || null;
    if (user) usedUserIds.add(String(user.id));
    const hasAdminRole = Boolean(user && cachedAdminMap.get(String(user.id))?.enabled !== false && cachedAdminMap.has(String(user.id)));
    const registered = Boolean(user || entry.registeredUid || entry.invitationUsed === true);
    result.push({
      key: email || String(entry.id),
      allowEntry: entry,
      user,
      userId: user?.id || entry.registeredUid || '',
      email: user?.email || entry.email || entry.id || '',
      name: entry.displayName || user?.appRegisteredName || user?.name || user?.displayName || '—',
      driverNumber: entry.driverNumber || user?.driverNumber || '—',
      office: entry.office || user?.office || '—',
      unionStatus: entry.unionStatus || user?.unionStatus || '',
      tester: entry.tester !== false,
      registrationState: registered ? 'registered' : 'pending',
      status: user ? (user.status === 'active' ? 'active' : 'locked') : (entry.enabled === true ? 'active' : 'locked'),
      role: hasAdminRole ? 'admin' : 'user',
      createdAt: user?.createdAt || null,
      lastLoginAt: user?.lastLoginAt || null
    });
  }

  for (const user of cachedRegisteredUsers) {
    if (usedUserIds.has(String(user.id))) continue;
    const email = String(user.email || '').trim().toLowerCase();
    const entry = allowByUid.get(String(user.id)) || allowByEmail.get(email) || null;
    const hasAdminRole = Boolean(cachedAdminMap.get(String(user.id)) && cachedAdminMap.get(String(user.id)).enabled !== false);
    result.push({
      key: user.id,
      allowEntry: entry,
      user,
      userId: user.id,
      email: user.email || '',
      name: entry?.displayName || user.appRegisteredName || user.name || user.displayName || '—',
      driverNumber: entry?.driverNumber || user.driverNumber || '—',
      office: entry?.office || user.office || '—',
      unionStatus: entry?.unionStatus || user.unionStatus || '',
      tester: entry?.tester !== false,
      registrationState: 'registered',
      status: user.status === 'active' ? 'active' : 'locked',
      role: hasAdminRole ? 'admin' : 'user',
      createdAt: user.createdAt || null,
      lastLoginAt: user.lastLoginAt || null
    });
  }
  return result;
}

function compareJa(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ja', { numeric: true, sensitivity: 'base' });
}

function renderUnifiedUserList(resetPage = false) {
  if (!unifiedUsersBody) return;
  if (resetPage) unifiedCurrentPage = 1;
  const search = normalizeSearchText(document.getElementById('unifiedUserSearch')?.value);
  const registration = document.getElementById('unifiedRegistrationFilter')?.value || '';
  const status = document.getElementById('unifiedStatusFilter')?.value || '';
  const role = document.getElementById('unifiedRoleFilter')?.value || '';
  const sort = document.getElementById('unifiedSort')?.value || 'name-asc';
  const pageSize = Number(document.getElementById('unifiedPageSize')?.value || 10);

  let rows = buildUnifiedUsers().filter((item) => {
    const text = normalizeSearchText([item.name, item.email, item.driverNumber, item.office].join(' '));
    return (!search || text.includes(search))
      && (!registration || item.registrationState === registration)
      && (!status || item.status === status)
      && (!role || item.role === role);
  });

  rows.sort((a, b) => {
    switch (sort) {
      case 'name-desc': return compareJa(b.name, a.name);
      case 'office-asc': return compareJa(a.office, b.office) || compareJa(a.name, b.name);
      case 'driver-asc': return compareJa(a.driverNumber, b.driverNumber) || compareJa(a.name, b.name);
      case 'registration': return compareJa(a.registrationState === 'pending' ? '0' : '1', b.registrationState === 'pending' ? '0' : '1') || compareJa(a.name, b.name);
      case 'created-desc': return timestampMillis(b.createdAt) - timestampMillis(a.createdAt) || compareJa(a.name, b.name);
      case 'last-desc': return timestampMillis(b.lastLoginAt) - timestampMillis(a.lastLoginAt) || compareJa(a.name, b.name);
      default: return compareJa(a.name, b.name);
    }
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  unifiedCurrentPage = Math.min(Math.max(1, unifiedCurrentPage), totalPages);
  const start = (unifiedCurrentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  unifiedUsersBody.innerHTML = '';
  for (const item of pageRows) {
    const row = document.createElement('tr');
    const registered = item.registrationState === 'registered';
    const nameHtml = registered && item.userId
      ? `<button class="user-name-link" type="button" data-unified-action="detail" data-user-id="${escapeHtml(item.userId)}" data-user-email="${escapeHtml(item.email)}" data-user-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`
      : escapeHtml(item.name);
    const unionLabel = item.unionStatus === 'member' ? '組合員' : (item.unionStatus === 'nonmember' ? '非組合員' : '—');
    const roleLabel = item.role === 'admin' ? '<span class="admin-role-badge is-admin">管理者</span>' : (registered ? '<span class="admin-role-badge not-admin">一般利用者</span>' : '—');
    const actionSlots = {
      edit: item.allowEntry
        ? `<button class="table-action-button edit-action" type="button" data-unified-action="allow-edit" data-email="${escapeHtml(item.allowEntry.id)}">✎ 編集</button>`
        : '<span class="table-action-placeholder" aria-hidden="true"></span>',
      admin: '<span class="table-action-placeholder" aria-hidden="true"></span>',
      toggle: '<span class="table-action-placeholder" aria-hidden="true"></span>',
      delete: '<span class="table-action-placeholder" aria-hidden="true"></span>'
    };

    if (registered && item.userId) {
      actionSlots.admin = `<button class="table-action-button admin-role-action" type="button" data-unified-action="user-admin" data-user-id="${escapeHtml(item.userId)}">${item.role === 'admin' ? (String(item.userId) === currentAdminUid ? '現在の管理者' : '管理者解除') : '管理者にする'}</button>`;
      actionSlots.toggle = `<button class="table-action-button toggle-action" type="button" data-unified-action="user-toggle" data-user-id="${escapeHtml(item.userId)}">${item.status === 'active' ? '利用停止' : '利用再開'}</button>`;
      actionSlots.delete = `<button class="table-action-button delete-action" type="button" data-unified-action="user-delete" data-user-id="${escapeHtml(item.userId)}">🗑 削除</button>`;
    } else if (item.allowEntry) {
      actionSlots.toggle = `<button class="table-action-button toggle-action" type="button" data-unified-action="allow-toggle" data-email="${escapeHtml(item.allowEntry.id)}">${item.status === 'active' ? '利用停止' : '利用再開'}</button>`;
      actionSlots.delete = `<button class="table-action-button delete-action" type="button" data-unified-action="allow-delete" data-email="${escapeHtml(item.allowEntry.id)}">🗑 削除</button>`;
    }

    const actionsHtml = `
      <div class="table-action-slot action-slot-edit">${actionSlots.edit}</div>
      <div class="table-action-slot action-slot-admin">${actionSlots.admin}</div>
      <div class="table-action-slot action-slot-toggle">${actionSlots.toggle}</div>
      <div class="table-action-slot action-slot-delete">${actionSlots.delete}</div>
    `;

    row.innerHTML = `<td>${nameHtml}</td><td>${escapeHtml(item.email || '—')}</td><td>${escapeHtml(item.driverNumber)}</td><td>${escapeHtml(item.office)}</td><td>${unionLabel}</td><td>${registered ? '登録済み' : '未登録'}</td><td>${item.status === 'active' ? '利用中' : '利用停止'}</td><td>${roleLabel}</td><td>${registered ? formatTimestamp(item.createdAt) : '—'}</td><td>${registered ? formatTimestamp(item.lastLoginAt) : '—'}</td><td><div class="table-action-buttons unified-action-grid">${actionsHtml}</div></td>`;
    unifiedUsersBody.appendChild(row);
  }

  const count = document.getElementById('unifiedVisibleCount');
  if (count) count.textContent = total ? `全${total}件中 ${start + 1}～${Math.min(start + pageSize, total)}件を表示` : '該当するユーザーはありません。';
  const prev = document.getElementById('unifiedPrevPage');
  const next = document.getElementById('unifiedNextPage');
  if (prev) prev.disabled = unifiedCurrentPage <= 1;
  if (next) next.disabled = unifiedCurrentPage >= totalPages;
  const pageBox = document.getElementById('unifiedPageButtons');
  if (pageBox) {
    pageBox.innerHTML = '';
    for (let page = 1; page <= totalPages; page += 1) {
      if (totalPages > 7 && page > 2 && page < totalPages - 1 && Math.abs(page - unifiedCurrentPage) > 1) {
        if (page === 3 || page === totalPages - 2) pageBox.insertAdjacentHTML('beforeend', '<span class="pagination-ellipsis">…</span>');
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(page);
      button.dataset.page = String(page);
      if (page === unifiedCurrentPage) button.setAttribute('aria-current', 'page');
      pageBox.appendChild(button);
    }
  }
}

function clickLegacy(selector) {
  const target = document.querySelector(selector);
  if (target instanceof HTMLElement) { target.click(); return true; }
  return false;
}


function normalizeSearchText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().trim();
}

function applyAllowlistFilters() {
  const queryText = normalizeSearchText(document.getElementById('allowlistSearch')?.value);
  const registration = document.getElementById('allowlistRegistrationFilter')?.value || '';
  let visible = 0;
  for (const row of allowlistBody?.querySelectorAll('tr') || []) {
    const matchesText = !queryText || normalizeSearchText(row.textContent).includes(queryText);
    const matchesRegistration = !registration || row.dataset.registrationState === registration;
    row.hidden = !(matchesText && matchesRegistration);
    if (!row.hidden) visible += 1;
  }
  const count = document.getElementById('allowlistVisibleCount');
  if (count) count.textContent = `表示 ${visible}件`;
}

function applyRegisteredUserFilters() {
  const queryText = normalizeSearchText(document.getElementById('registeredUserSearch')?.value);
  const status = document.getElementById('registeredStatusFilter')?.value || '';
  const role = document.getElementById('registeredRoleFilter')?.value || '';
  let visible = 0;
  for (const row of usersBody?.querySelectorAll('tr') || []) {
    const matchesText = !queryText || normalizeSearchText(row.textContent).includes(queryText);
    const matchesStatus = !status || row.dataset.userStatus === status;
    const matchesRole = !role || row.dataset.userRole === role;
    row.hidden = !(matchesText && matchesStatus && matchesRole);
    if (!row.hidden) visible += 1;
  }
  const count = document.getElementById('registeredVisibleCount');
  if (count) count.textContent = `表示 ${visible}件`;
}

['allowlistSearch', 'allowlistRegistrationFilter'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', applyAllowlistFilters);
  document.getElementById(id)?.addEventListener('change', applyAllowlistFilters);
});
['registeredUserSearch', 'registeredStatusFilter', 'registeredRoleFilter'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', applyRegisteredUserFilters);
  document.getElementById(id)?.addEventListener('change', applyRegisteredUserFilters);
});

let currentAdminUid = '';
let currentAdminEmail = '';

function formatTimestamp(timestamp) {
  try {
    return timestamp?.toDate().toLocaleString('ja-JP') || '—';
  } catch {
    return '—';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]
  );
}

function setStatus(element, text = '', kind = '') {
  element.textContent = text;
  element.dataset.kind = kind;
}

function errorText(error, fallback) {
  console.error(error);
  const code = error?.code ? `（${error.code}）` : '';
  return `${error?.message || fallback}${code}`;
}

function showGate(text = '管理者のGoogleアカウントでログインしてください。') {
  document.body.classList.remove('auth-checking');
  document.body.classList.add('auth-pending');
  if (checkingPanel) checkingPanel.hidden = true;
  gate.hidden = false;
  setStatus(message, text, text.includes('してください') ? 'info' : 'error');
}

function showPage() {
  document.body.classList.remove('auth-checking', 'auth-pending');
  if (checkingPanel) checkingPanel.hidden = true;
  gate.hidden = true;
  setStatus(message);
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${label}は1人以上の整数で入力してください。`);
  }
  return number;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text.trim())
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

if (!config.enabled || !config.apiKey || config.apiKey === 'REPLACE_ME') {
  showGate('Firebaseの初期設定が未完了です。firebase-config.jsを確認してください。');
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({ prompt: 'select_account' });

  // お知らせ管理は announcement.html / announcement-admin.js に完全分離しています。

  let editingAllowlistEmail = null;
  const allowlistForm = document.getElementById('allowlistForm');
  const allowSubmitButton = document.getElementById('allowSubmitButton');
  const allowCancelEdit = document.getElementById('allowCancelEdit');

  function resetAllowlistForm() {
    editingAllowlistEmail = null;
    allowlistForm.reset();
    document.getElementById('allowEmail').readOnly = false;
    document.getElementById('allowTester').value = 'true';
    document.getElementById('allowEnabled').value = 'true';
    allowSubmitButton.textContent = 'テストユーザーを登録';
    allowCancelEdit.hidden = true;
  }

  function startAllowlistEdit(entry) {
    editingAllowlistEmail = entry.id;
    document.getElementById('allowDisplayName').value = entry.displayName || '';
    document.getElementById('allowEmail').value = entry.email || entry.id;
    document.getElementById('allowEmail').readOnly = true;
    document.getElementById('allowDriverNumber').value = entry.driverNumber || '';
    document.getElementById('allowOffice').value = entry.office || '';
    document.getElementById('allowUnionStatus').value = entry.unionStatus || '';
    document.getElementById('allowTester').value = String(entry.tester !== false);
    document.getElementById('allowEnabled').value = String(entry.enabled !== false);
    allowSubmitButton.textContent = '登録情報を更新';
    allowCancelEdit.hidden = false;
    document.getElementById('allowDisplayName').focus();
    setStatus(
      document.getElementById('allowlistStatus'),
      `${entry.displayName || entry.id} の登録情報を編集中です。`,
      'info'
    );
  }

  allowCancelEdit.addEventListener('click', () => {
    resetAllowlistForm();
    setStatus(document.getElementById('allowlistStatus'), '編集をキャンセルしました。', 'info');
  });

  document.getElementById('adminGoogleLogin').addEventListener('click', async () => {
    setStatus(message, 'Googleアカウントを確認しています…', 'info');

    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = error?.code || '';

      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, provider);
        return;
      }

      if (code === 'auth/popup-closed-by-user') {
        setStatus(message, 'Googleログインがキャンセルされました。', 'error');
      } else if (code === 'auth/unauthorized-domain') {
        setStatus(
          message,
          'この公開URLがFirebase Authenticationの承認済みドメインに登録されていません。',
          'error'
        );
      } else {
        setStatus(message, errorText(error, 'Googleログインできませんでした。'), 'error');
      }
    }
  });

  document.getElementById('adminLogout').addEventListener('click', async () => {
    await signOut(auth);
  });

  document.getElementById('codeForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const status = document.getElementById('codeStatus');

    try {
      setStatus(status, '登録しています…', 'info');

      const code = document.getElementById('newAccessCode').value.trim();
      const maxUses = positiveInteger(
        document.getElementById('newAccessMaxUses').value,
        '利用上限'
      );

      if (!code) throw new Error('利用コードを入力してください。');

      const codeRef = doc(db, 'accessCodes', await sha256(code));
      const existing = await getDoc(codeRef);

      if (existing.exists()) {
        throw new Error('この利用コードは既に登録されています。上限変更欄を使用してください。');
      }

      await setDoc(codeRef, {
        active: true,
        version: 'v1.3-beta',
        maxUses,
        usageCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setStatus(
        status,
        `新しい利用コードを登録しました。利用上限は${maxUses}人です。`,
        'success'
      );

      form.reset();
      document.getElementById('newAccessMaxUses').value = '10';
    } catch (error) {
      setStatus(status, errorText(error, '利用コードを登録できませんでした。'), 'error');
    }
  });

  document.getElementById('limitForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const status = document.getElementById('limitStatus');

    try {
      setStatus(status, '変更しています…', 'info');

      const code = document.getElementById('limitAccessCode').value.trim();
      const maxUses = positiveInteger(
        document.getElementById('limitMaxUses').value,
        '新しい利用上限'
      );

      if (!code) throw new Error('利用コードを入力してください。');

      const codeRef = doc(db, 'accessCodes', await sha256(code));
      const snapshot = await getDoc(codeRef);

      if (!snapshot.exists()) {
        throw new Error('入力された利用コードは登録されていません。');
      }

      const usageCount = Number(snapshot.data().usageCount || 0);

      if (!Number.isInteger(usageCount) || usageCount < 0) {
        throw new Error('現在の登録人数が不正です。');
      }

      if (maxUses < usageCount) {
        throw new Error(
          `現在${usageCount}人が登録済みのため、上限を${maxUses}人には減らせません。`
        );
      }

      await updateDoc(codeRef, {
        active: true,
        version: 'v1.3-beta',
        maxUses,
        updatedAt: serverTimestamp()
      });

      setStatus(
        status,
        `利用上限を${maxUses}人に変更しました。現在${usageCount}人が登録済みです。`,
        'success'
      );
    } catch (error) {
      setStatus(status, errorText(error, '利用上限を変更できませんでした。'), 'error');
    }
  });

  allowlistForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const status = document.getElementById('allowlistStatus');

    try {
      setStatus(status, editingAllowlistEmail ? '更新しています…' : '登録しています…', 'info');

      const displayName = document.getElementById('allowDisplayName').value.trim();
      const email = document.getElementById('allowEmail').value.trim().toLowerCase();
      const driverNumber = document.getElementById('allowDriverNumber').value.trim();
      const office = document.getElementById('allowOffice').value.trim();
      const unionStatus = document.getElementById('allowUnionStatus').value;
      const tester = document.getElementById('allowTester').value === 'true';
      const enabled = document.getElementById('allowEnabled').value === 'true';

      if (!displayName) throw new Error('氏名を入力してください。');
      if (!email) throw new Error('Googleアカウントを入力してください。');
      if (!driverNumber) throw new Error('乗務員番号を入力してください。');
      if (!/^\d+$/.test(driverNumber)) {
        throw new Error('乗務員番号は半角数字のみで入力してください。');
      }
      if (!office) throw new Error('営業所を入力してください。');
      if (!['member', 'nonmember'].includes(unionStatus)) {
        throw new Error('組合員区分を選択してください。');
      }

      const allowSnapshot = await getDocs(collection(db, 'betaAllowlist'));
      const duplicateDriver = allowSnapshot.docs.find((item) => {
        if (editingAllowlistEmail && item.id === editingAllowlistEmail) return false;
        return String(item.data().driverNumber || '').trim() === driverNumber;
      });

      if (duplicateDriver) {
        throw new Error(`乗務員番号 ${driverNumber} は既に登録されています。`);
      }

      if (editingAllowlistEmail) {
        const allowRef = doc(db, 'betaAllowlist', editingAllowlistEmail);
        const currentAllow = await getDoc(allowRef);

        let registeredUid = currentAllow.exists()
          ? String(currentAllow.data().registeredUid || '')
          : '';

        if (!registeredUid) {
          const matchingUsers = await getDocs(
            query(
              collection(db, 'users'),
              where('email', '==', editingAllowlistEmail)
            )
          );

          if (matchingUsers.size > 1) {
            throw new Error(
              `同じGoogleアカウントの利用者情報が${matchingUsers.size}件あります。重複を解消してから更新してください。`
            );
          }

          if (matchingUsers.size === 1) {
            registeredUid = matchingUsers.docs[0].id;
          }
        }

        const batch = writeBatch(db);

        batch.update(allowRef, {
          displayName,
          email,
          driverNumber,
          office,
          unionStatus,
          tester,
          enabled,
          ...(registeredUid
            ? {
                invitationUsed: true,
                registeredUid,
                registeredAt: currentAllow.data().registeredAt || serverTimestamp()
              }
            : {}),
          updatedAt: serverTimestamp()
        });

        if (registeredUid) {
          batch.update(doc(db, 'users', registeredUid), {
            name: displayName,
            displayName,
            email,
            driverNumber,
            office,
            unionStatus,
            tester,
            status: enabled ? 'active' : 'locked',
            plan: 'beta_v1_3',
            version: 'v1.3-beta',
            lastVersion: 'v1.3-beta',
            profileUpdatedAt: serverTimestamp()
          });
        }

        await batch.commit();

        setStatus(
          status,
          registeredUid
            ? `${displayName}さんの事前登録情報と利用者情報を同期し、紐付けを完了しました。`
            : `${displayName}さんの事前登録情報を更新しました。利用者情報は初回ログイン時に作成されます。`,
          'success'
        );
      } else {
        const allowRef = doc(db, 'betaAllowlist', email);
        const existing = await getDoc(allowRef);

        if (existing.exists()) {
          throw new Error('このGoogleアカウントは既に登録されています。');
        }

        await setDoc(allowRef, {
          displayName,
          email,
          driverNumber,
          office,
          unionStatus,
          tester,
          enabled,
          invitationUsed: false,
          registeredUid: null,
          version: 'v1.3-beta',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        setStatus(status, `${displayName}さんをテストユーザーとして登録しました。`, 'success');
      }

      resetAllowlistForm();
      await loadAllowlist();
    } catch (error) {
      setStatus(
        status,
        errorText(
          error,
          editingAllowlistEmail
            ? 'テストユーザー情報を更新できませんでした。'
            : 'テストユーザーを登録できませんでした。'
        ),
        'error'
      );
    }
  });

  async function loadAllowlist() {
    const snapshot = await getDocs(collection(db, 'betaAllowlist'));

    const entries = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((left, right) => left.id.localeCompare(right.id, 'ja'));

    cachedAllowlistEntries = entries;
    allowlistBody.innerHTML = '';

    for (const entry of entries) {
      const row = document.createElement('tr');
      row.dataset.registrationState = entry.invitationUsed === true || entry.registeredUid ? 'registered' : 'pending';

      row.innerHTML = `
        <td>${escapeHtml(entry.displayName || '—')}</td>
        <td>${escapeHtml(entry.email || entry.id)}</td>
        <td>${escapeHtml(entry.driverNumber || '—')}</td>
        <td>${escapeHtml(entry.office || '—')}</td>
        <td>${entry.unionStatus === 'member' ? '組合員' : '非組合員'}</td>
        <td>${entry.tester === false ? '対象外' : '対象'}</td>
        <td>${entry.enabled === true ? '利用中' : '利用停止'}</td>
        <td>${entry.invitationUsed === true ? '登録済み' : '未登録'}</td>
        <td>
          <div class="table-action-buttons">
            <button
              class="table-action-button edit-action"
              type="button"
              data-action="edit"
              data-allow-email="${escapeHtml(entry.id)}"
            >
              ✎ 編集
            </button>
            <button
              class="table-action-button toggle-action"
              type="button"
              data-action="toggle"
              data-allow-email="${escapeHtml(entry.id)}"
              data-enabled="${entry.enabled === true}"
            >
              ${entry.enabled === true ? '利用停止' : '利用再開'}
            </button>
            <button
              class="table-action-button delete-action"
              type="button"
              data-action="delete-allowlist"
              data-allow-email="${escapeHtml(entry.id)}"
              data-allow-name="${escapeHtml(entry.displayName || '')}"
              data-registered-uid="${escapeHtml(entry.registeredUid || '')}"
            >
              🗑 削除
            </button>
          </div>
        </td>
      `;

      allowlistBody.appendChild(row);
    }
    applyAllowlistFilters();
    renderUnifiedUserList();
  }

  allowlistBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-allow-email]');
    if (!button) return;

    const email = button.dataset.allowEmail;
    const action = button.dataset.action;

    if (action === 'edit') {
      try {
        const snapshot = await getDoc(doc(db, 'betaAllowlist', email));
        if (!snapshot.exists()) {
          throw new Error('編集対象の登録情報が見つかりません。');
        }
        startAllowlistEdit({ id: snapshot.id, ...snapshot.data() });
      } catch (error) {
        alert(errorText(error, '登録情報を読み込めませんでした。'));
      }
      return;
    }

    if (action === 'delete-allowlist') {
      const displayName = button.dataset.allowName || email;
      const registeredUid = button.dataset.registeredUid || '';
      const typed = prompt(
        `${displayName} の事前登録情報を削除します。\n` +
        `関連するFirestoreの利用者情報も削除されます。\n\n` +
        `確認のため、Googleアカウントを入力してください。\n${email}`
      );

      if (typed === null) return;
      if (typed.trim().toLowerCase() !== email.toLowerCase()) {
        alert('入力されたGoogleアカウントが一致しないため、削除を中止しました。');
        return;
      }

      try {
        button.disabled = true;
        const batch = writeBatch(db);

        batch.delete(doc(db, 'betaAllowlist', email));

        if (registeredUid) {
          batch.delete(doc(db, 'users', registeredUid));
          batch.delete(doc(db, 'v13LoginSuccess', registeredUid));
        }

        await batch.commit();

        if (editingAllowlistEmail === email) {
          resetAllowlistForm();
        }

        setStatus(
          document.getElementById('allowlistStatus'),
          `${displayName} の事前登録情報${registeredUid ? 'と利用者情報' : ''}を削除しました。`,
          'success'
        );

        await Promise.all([loadAllowlist(), loadUsers()]);
      } catch (error) {
        alert(errorText(error, '事前登録情報を削除できませんでした。'));
        button.disabled = false;
      }
      return;
    }

    if (action !== 'toggle') return;

    const nextEnabled = button.dataset.enabled !== 'true';
    const actionText = nextEnabled ? '利用を再開' : '利用を停止';

    if (!confirm(`${email} の${actionText}しますか？`)) return;

    try {
      button.disabled = true;
      await updateDoc(doc(db, 'betaAllowlist', email), {
        enabled: nextEnabled,
        updatedAt: serverTimestamp()
      });

      if (editingAllowlistEmail === email) {
        document.getElementById('allowEnabled').value = String(nextEnabled);
      }

      await loadAllowlist();
    } catch (error) {
      alert(errorText(error, '許可状態を変更できませんでした。'));
      button.disabled = false;
    }
  });

  async function loadUsers() {
    const status = document.getElementById('adminStatus');
    setStatus(status, '読み込み中…', 'info');

    try {
      const [userSnapshot, adminSnapshot, allowlistSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'admins')),
        getDocs(collection(db, 'betaAllowlist'))
      ]);

      // 氏名はGoogleアカウントの表示名ではなく、管理者が事前登録マスターに
      // 登録したdisplayNameを正本として扱う。既存usersドキュメントは変更しない。
      const allowlistByUid = new Map();
      const allowlistByEmail = new Map();
      for (const item of allowlistSnapshot.docs) {
        const data = item.data();
        if (data.registeredUid) allowlistByUid.set(String(data.registeredUid), data);
        const emailKey = String(data.email || item.id || '').trim().toLowerCase();
        if (emailKey) allowlistByEmail.set(emailKey, data);
      }

      const users = userSnapshot.docs.map((item) => {
        const data = item.data();
        const emailKey = String(data.email || '').trim().toLowerCase();
        const allowEntry = allowlistByUid.get(item.id) || allowlistByEmail.get(emailKey) || null;
        return {
          id: item.id,
          ...data,
          appRegisteredName: allowEntry?.displayName || data.name || data.displayName || ''
        };
      });

      const adminMap = new Map(
        adminSnapshot.docs.map((item) => [
          item.id,
          { id: item.id, ...item.data() }
        ])
      );

      const activeAdmins = [...adminMap.values()]
        .filter((admin) => admin.enabled !== false);

      cachedRegisteredUsers = users;
      cachedAdminMap = adminMap;
      usersBody.innerHTML = '';

      let activeCount = 0;
      let lockedCount = 0;

      for (const user of users) {
        if (user.status === 'active') activeCount += 1;
        else lockedCount += 1;

        const adminRecord = adminMap.get(user.id);
        const hasAdminRole = Boolean(adminRecord && adminRecord.enabled !== false);
        const isCurrentAdmin = user.id === currentAdminUid;
        const row = document.createElement('tr');
        row.dataset.userStatus = user.status === 'active' ? 'active' : 'locked';
        row.dataset.userRole = hasAdminRole ? 'admin' : 'user';

        row.innerHTML = `
          <td><button class="user-name-link" type="button" data-user-action="detail" data-user-id="${escapeHtml(user.id)}" data-user-email="${escapeHtml(user.email || '')}" data-user-name="${escapeHtml(user.appRegisteredName || user.name || user.displayName || '')}">${escapeHtml(user.appRegisteredName || user.name || user.displayName || '—')}</button></td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td>${escapeHtml(user.plan || '—')}</td>
          <td>${user.status === 'active' ? '利用中' : '利用停止'}</td>
          <td>
            <span class="admin-role-badge ${hasAdminRole ? 'is-admin' : 'not-admin'}">
              ${hasAdminRole ? '管理者' : '一般利用者'}
            </span>
          </td>
          <td>${formatTimestamp(user.createdAt)}</td>
          <td>${formatTimestamp(user.lastLoginAt)}</td>
          <td>
            <div class="table-action-buttons">
              <button
                class="table-action-button admin-role-action"
                type="button"
                data-user-action="${hasAdminRole ? 'revoke-admin' : 'grant-admin'}"
                data-user-id="${escapeHtml(user.id)}"
                data-user-email="${escapeHtml(user.email || '')}"
                data-user-name="${escapeHtml(user.appRegisteredName || user.name || user.displayName || '')}"
                data-is-current-admin="${isCurrentAdmin}"
                ${isCurrentAdmin && hasAdminRole ? 'disabled title="自分自身の管理者権限は解除できません"' : ''}
              >
                ${hasAdminRole
                  ? (isCurrentAdmin ? '現在の管理者' : '管理者解除')
                  : '管理者にする'}
              </button>
              <button
                class="table-action-button toggle-action"
                type="button"
                data-user-action="toggle"
                data-user-id="${escapeHtml(user.id)}"
                data-user-email="${escapeHtml(user.email || '')}"
                data-user-name="${escapeHtml(user.appRegisteredName || user.name || user.displayName || '')}"
                data-status="${escapeHtml(user.status || '')}"
              >
                ${user.status === 'active' ? '利用停止' : '利用再開'}
              </button>
              <button
                class="table-action-button delete-action"
                type="button"
                data-user-action="delete"
                data-user-id="${escapeHtml(user.id)}"
                data-user-email="${escapeHtml(user.email || '')}"
                data-user-name="${escapeHtml(user.appRegisteredName || user.name || user.displayName || '')}"
                data-has-admin-role="${hasAdminRole}"
                ${isCurrentAdmin ? 'disabled title="現在ログイン中の管理者は削除できません"' : ''}
              >
                🗑 削除
              </button>
            </div>
          </td>
        `;

        usersBody.appendChild(row);
      }
      applyRegisteredUserFilters();
      renderUnifiedUserList();

      document.getElementById('userCount').textContent = `${users.length}人`;
      document.getElementById('activeCount').textContent = `${activeCount}人`;
      document.getElementById('lockedCount').textContent = `${lockedCount}人`;
      document.getElementById('adminCount').textContent = `${activeAdmins.length}人`;
      setStatus(status);
    } catch (error) {
      setStatus(status, errorText(error, '利用者一覧を読み込めませんでした。'), 'error');
    }
  }


  ['unifiedUserSearch', 'unifiedRegistrationFilter', 'unifiedStatusFilter', 'unifiedRoleFilter', 'unifiedSort', 'unifiedPageSize'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => renderUnifiedUserList(true));
    document.getElementById(id)?.addEventListener('change', () => renderUnifiedUserList(true));
  });
  document.getElementById('unifiedPrevPage')?.addEventListener('click', () => { unifiedCurrentPage -= 1; renderUnifiedUserList(); });
  document.getElementById('unifiedNextPage')?.addEventListener('click', () => { unifiedCurrentPage += 1; renderUnifiedUserList(); });
  document.getElementById('unifiedPageButtons')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button) return;
    unifiedCurrentPage = Number(button.dataset.page || 1);
    renderUnifiedUserList();
  });
  unifiedUsersBody?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-unified-action]');
    if (!button) return;
    const action = button.dataset.unifiedAction;
    const userId = button.dataset.userId || '';
    const email = button.dataset.email || '';
    if (action === 'detail') {
      clickLegacy(`#usersBody button[data-user-action="detail"][data-user-id="${CSS.escape(userId)}"]`);
    } else if (action === 'allow-edit') {
      clickLegacy(`#allowlistBody button[data-action="edit"][data-allow-email="${CSS.escape(email)}"]`);
    } else if (action === 'allow-toggle') {
      clickLegacy(`#allowlistBody button[data-action="toggle"][data-allow-email="${CSS.escape(email)}"]`);
    } else if (action === 'allow-delete') {
      clickLegacy(`#allowlistBody button[data-action="delete-allowlist"][data-allow-email="${CSS.escape(email)}"]`);
    } else if (action === 'user-admin') {
      clickLegacy(`#usersBody button[data-user-id="${CSS.escape(userId)}"][data-user-action="grant-admin"], #usersBody button[data-user-id="${CSS.escape(userId)}"][data-user-action="revoke-admin"]`);
    } else if (action === 'user-toggle') {
      clickLegacy(`#usersBody button[data-user-id="${CSS.escape(userId)}"][data-user-action="toggle"]`);
    } else if (action === 'user-delete') {
      clickLegacy(`#usersBody button[data-user-id="${CSS.escape(userId)}"][data-user-action="delete"]`);
    }
  });


  const userDetailDialog=document.getElementById('userDetailDialog');
  document.getElementById('closeUserDetail')?.addEventListener('click',()=>userDetailDialog?.close());
  async function openUserDetail(userId,userName,userEmail){
    const content=document.getElementById('userDetailContent');
    document.getElementById('userDetailTitle').textContent=`ユーザー詳細：${userName||userEmail||userId}`;
    content.innerHTML='<p>詳細情報を取得しています…</p>';
    if (typeof userDetailDialog?.showModal === 'function') userDetailDialog.showModal();
    try{
      const [userSnap,devicesSnap,historySnap]=await Promise.all([getDoc(doc(db,'users',userId)),getDocs(collection(db,'users',userId,'devices')),getDocs(collection(db,'users',userId,'loginHistory'))]);
      const u=userSnap.exists()?userSnap.data():{};
      const devices=devicesSnap.docs.map(d=>d.data()).sort((a,b)=>(b.lastSeenAt?.toMillis?.()||0)-(a.lastSeenAt?.toMillis?.()||0));
      const history=historySnap.docs.map(d=>d.data()).sort((a,b)=>(b.occurredAt?.toMillis?.()||0)-(a.occurredAt?.toMillis?.()||0)).slice(0,100);
      const basic=[['氏名',userName||u.name||u.displayName||'—'],['Googleアカウント',u.email||userEmail||'—'],['乗務員番号',u.driverNumber||'—'],['営業所',u.office||'—'],['勤務形態',u.shiftType||'—'],['組合員区分',u.unionStatus||'—'],['利用状態',u.status||'—'],['登録日',formatTimestamp(u.createdAt)],['最終更新',formatTimestamp(u.updatedAt||u.lastLoginAt)]];
      content.innerHTML=`<details open><summary>基本情報</summary><dl class="profile-list">${basic.map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl></details><details open><summary>利用端末（${devices.length}台）</summary>${devices.length?devices.map((d,i)=>`<div class="device-detail-card"><strong>${i+1}. ${escapeHtml(d.os||'—')} / ${escapeHtml(d.browser||'—')}</strong><p>起動方式：${escapeHtml(d.launchMode||'—')}｜画面：${escapeHtml(`${d.screenWidth||0}×${d.screenHeight||0}`)}</p><p>Version ${escapeHtml(d.appVersion||'—')}｜Build ${escapeHtml(d.build||'—')}｜${escapeHtml(d.environment||'—')}</p><p>最終利用：${escapeHtml(d.lastSeenAtJst||formatTimestamp(d.lastSeenAt))}</p></div>`).join(''):'<p>端末情報はまだありません。</p>'}</details><details open><summary>ログイン履歴（直近60日）</summary>${history.length?`<div class="table-wrap"><table><thead><tr><th>日時</th><th>端末</th><th>結果</th><th>Build</th><th>エラー</th></tr></thead><tbody>${history.map(h=>`<tr><td>${escapeHtml(h.occurredAtJst||formatTimestamp(h.occurredAt))}</td><td>${escapeHtml(`${h.os||'—'} / ${h.browser||'—'}`)}</td><td>${h.result==='success'?'成功':'失敗'}</td><td>${escapeHtml(h.build||'—')}</td><td>${escapeHtml(h.errorCode||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p>履歴はまだありません。</p>'}</details><details><summary>監査ログ（将来対応）</summary><p>勤務実績や設定変更の監査ログは将来追加します。</p></details>`;
    } catch (error) {
      console.error('[UserDetail] Failed to load user detail', error);
      const permissionDenied = error?.code === 'permission-denied' ||
        String(error?.message || '').includes('Missing or insufficient permissions');
      content.innerHTML = permissionDenied
        ? `<div class="admin-detail-error"><p class="error-text">ユーザー詳細を取得できませんでした。</p><p>管理者向けFirestoreルールがまだ反映されていない可能性があります。FirebaseコンソールのFirestoreルールを更新してください。</p></div>`
        : `<div class="admin-detail-error"><p class="error-text">ユーザー詳細を取得できませんでした。</p><p>通信状態を確認して、もう一度お試しください。</p></div>`;
    }
  }

  usersBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-user-id]');
    if (!button) return;

    const userId = button.dataset.userId;
    const userEmail = (button.dataset.userEmail || '').trim().toLowerCase();
    const userName = button.dataset.userName || userEmail || userId;
    const actionType = button.dataset.userAction || 'toggle';
    if(actionType==='detail'){await openUserDetail(userId,userName,userEmail);return;}

    if (actionType === 'grant-admin' || actionType === 'revoke-admin') {
      const granting = actionType === 'grant-admin';

      if (!granting && userId === currentAdminUid) {
        alert('現在ログイン中の自分自身から管理者権限を解除することはできません。');
        return;
      }

      const confirmationText = granting
        ? `${userName} に、このシステムの管理者権限を付与しますか？\n\n` +
          `管理者は利用者情報、事前登録、無料コード、他の管理者権限を操作できます。`
        : `${userName} の管理者権限を解除しますか？\n\n` +
          `組合員・非組合員としての通常機能と利用者情報は残ります。`;

      if (!confirm(confirmationText)) return;

      const typed = prompt(
        `確認のため、対象者のGoogleアカウントを入力してください。\n${userEmail}`
      );

      if (typed === null) return;
      if (!userEmail || typed.trim().toLowerCase() !== userEmail) {
        alert('入力されたGoogleアカウントが一致しないため、処理を中止しました。');
        return;
      }

      try {
        button.disabled = true;

        await setDoc(
          doc(db, 'admins', userId),
          {
            enabled: granting,
            email: userEmail,
            displayName: userName,
            updatedAt: serverTimestamp(),
            updatedByUid: currentAdminUid,
            updatedByEmail: currentAdminEmail,
            ...(granting
              ? {
                  grantedAt: serverTimestamp(),
                  grantedByUid: currentAdminUid,
                  grantedByEmail: currentAdminEmail
                }
              : {
                  revokedAt: serverTimestamp(),
                  revokedByUid: currentAdminUid,
                  revokedByEmail: currentAdminEmail
                })
          },
          { merge: true }
        );

        setStatus(
          document.getElementById('adminStatus'),
          granting
            ? `${userName} に管理者権限を付与しました。`
            : `${userName} の管理者権限を解除しました。`,
          'success'
        );

        await loadUsers();
      } catch (error) {
        alert(
          errorText(
            error,
            granting
              ? '管理者権限を付与できませんでした。'
              : '管理者権限を解除できませんでした。'
          )
        );
        button.disabled = false;
      }
      return;
    }

    if (actionType === 'delete') {
      const typed = prompt(
        `${userName} の利用者情報を完全に削除します。\n` +
        `対象：users・v13LoginSuccess・紐づくbetaAllowlist\n` +
        `Firebase Authenticationのアカウント自体は削除されません。\n\n` +
        `確認のため、Googleアカウントを入力してください。\n${userEmail}`
      );

      if (typed === null) return;
      if (!userEmail || typed.trim().toLowerCase() !== userEmail) {
        alert('入力されたGoogleアカウントが一致しないため、削除を中止しました。');
        return;
      }

      try {
        button.disabled = true;

        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', userId));
        batch.delete(doc(db, 'v13LoginSuccess', userId));

        if (button.dataset.hasAdminRole === 'true') {
          batch.delete(doc(db, 'admins', userId));
        }

        const allowRef = doc(db, 'betaAllowlist', userEmail);
        const allowSnapshot = await getDoc(allowRef);

        if (
          allowSnapshot.exists() &&
          String(allowSnapshot.data().registeredUid || '') === userId
        ) {
          batch.delete(allowRef);
        }

        await batch.commit();

        setStatus(
          document.getElementById('adminStatus'),
          `${userName} のFirestore利用者情報を削除しました。`,
          'success'
        );

        await Promise.all([loadUsers(), loadAllowlist()]);
      } catch (error) {
        alert(errorText(error, '利用者情報を削除できませんでした。'));
        button.disabled = false;
      }
      return;
    }

    const nextStatus = button.dataset.status === 'active' ? 'locked' : 'active';
    const statusAction = nextStatus === 'locked' ? '利用停止' : '利用再開';

    if (!confirm(`${userName} を${statusAction}にしますか？`)) return;

    try {
      button.disabled = true;

      await updateDoc(
        doc(db, 'users', userId),
        {
          status: nextStatus,
          statusUpdatedAt: serverTimestamp()
        }
      );

      await loadUsers();
    } catch (error) {
      alert(errorText(error, '利用状態を変更できませんでした。'));
      button.disabled = false;
    }
  });

  getRedirectResult(auth).catch((error) => {
    setStatus(message, errorText(error, 'Googleログインに失敗しました。'), 'error');
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showGate();
      return;
    }

    try {
      const adminSnapshot = await getDoc(doc(db, 'admins', user.uid));

      if (!adminSnapshot.exists() || adminSnapshot.data().enabled === false) {
        await signOut(auth);
        showGate('このGoogleアカウントには管理者権限がありません。');
        return;
      }

      currentAdminUid = user.uid;
      currentAdminEmail = String(user.email || '').trim().toLowerCase();

      showPage();
      await Promise.all([loadAllowlist(), loadUsers()]);
    } catch (error) {
      await signOut(auth).catch(() => {});
      showGate(errorText(error, '管理者権限を確認できませんでした。'));
    }
  });

  // v1.3β 事前登録マスターと猶予期間表示
  async function refreshV13Status(){
    try{
      const success=await getDocs(collection(db,'v13LoginSuccess'));
      const count=success.docs.filter(x=>x.data().isAdmin!==true).length;
      const el=document.getElementById('v13LoginCount'); if(el)el.textContent=`${count}人`;
      const st=await getDoc(doc(db,'appSettings','v1_3_beta')); const box=document.getElementById('graceStatus');
      if(box){if(!st.exists()||!st.data().gracePeriodStartedAt)box.textContent='未開始';else{const d=st.data().gracePeriodStartedAt.toDate();const end=new Date(d);end.setDate(end.getDate()+13);box.textContent=`進行中（${d.toLocaleDateString('ja-JP')}〜${end.toLocaleDateString('ja-JP')}）`;}}
    }catch(e){console.error(e);}
  }
  async function importMasterCsv(){
    const file=document.getElementById('masterCsv')?.files?.[0],status=document.getElementById('masterStatus');if(!file){status.textContent='CSVファイルを選択してください。';return;}
    const text=await file.text(),lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean),headers=lines.shift().split(',').map(x=>x.trim());
    const required=['displayName','email','driverNumber','office','unionStatus','tester','enabled'];if(required.some(x=>!headers.includes(x))){status.textContent='見出しが仕様と一致しません。';return;}
    let ok=0,ng=0;
    for(const line of lines){try{const vals=line.split(',').map(x=>x.trim().replace(/^"|"$/g,'')),row=Object.fromEntries(headers.map((h,i)=>[h,vals[i]??''])),email=String(row.email).toLowerCase();if(!email||!row.driverNumber)throw new Error();await setDoc(doc(db,'betaAllowlist',email),{displayName:row.displayName||'',email,driverNumber:String(row.driverNumber),office:row.office||'',unionStatus:row.unionStatus==='member'?'member':'nonmember',tester:String(row.tester).toLowerCase()!=='false',enabled:String(row.enabled).toLowerCase()!=='false',version:'v1.3-beta',updatedAt:serverTimestamp()},{merge:true});ok++;}catch{ng++;}}
    status.textContent=`取込完了：成功${ok}件／エラー${ng}件`;await loadAllowlist();
  }
  document.getElementById('importMaster')?.addEventListener('click',()=>importMasterCsv().catch(e=>{document.getElementById('masterStatus').textContent=`取込失敗：${e.message}`}));
  setTimeout(refreshV13Status,1000);

}
