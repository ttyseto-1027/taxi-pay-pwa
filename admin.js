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
  serverTimestamp,
  orderBy,
  query
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config = window.TAXI_PAY_FIREBASE_CONFIG || {};

const gate = document.getElementById('adminAuthGate');
const message = document.getElementById('adminMessage');
const usersBody = document.getElementById('usersBody');
const allowlistBody = document.getElementById('allowlistBody');

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
  document.body.classList.add('auth-pending');
  gate.hidden = false;
  setStatus(message, text, text.includes('してください') ? 'info' : 'error');
}

function showPage() {
  document.body.classList.remove('auth-pending');
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

  document.getElementById('allowlistForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const status = document.getElementById('allowlistStatus');

    try {
      setStatus(status, '登録しています…', 'info');

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

      const allowRef = doc(db, 'betaAllowlist', email);
      const existing = await getDoc(allowRef);

      if (existing.exists()) {
        throw new Error('このGoogleアカウントは既に登録されています。');
      }

      const allowSnapshot = await getDocs(collection(db, 'betaAllowlist'));
      const duplicateDriver = allowSnapshot.docs.find(
        (item) => String(item.data().driverNumber || '').trim() === driverNumber
      );

      if (duplicateDriver) {
        throw new Error(`乗務員番号 ${driverNumber} は既に登録されています。`);
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

      setStatus(
        status,
        `${displayName}さんをテストユーザーとして登録しました。`,
        'success'
      );

      form.reset();
      document.getElementById('allowTester').value = 'true';
      document.getElementById('allowEnabled').value = 'true';
      await loadAllowlist();
    } catch (error) {
      setStatus(status, errorText(error, 'テストユーザーを登録できませんでした。'), 'error');
    }
  });

  async function loadAllowlist() {
    const snapshot = await getDocs(collection(db, 'betaAllowlist'));

    const entries = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((left, right) => left.id.localeCompare(right.id, 'ja'));

    allowlistBody.innerHTML = '';

    for (const entry of entries) {
      const row = document.createElement('tr');

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
          <button
            type="button"
            data-allow-email="${escapeHtml(entry.id)}"
            data-enabled="${entry.enabled === true}"
          >
            ${entry.enabled === true ? '利用停止' : '利用再開'}
          </button>
        </td>
      `;

      allowlistBody.appendChild(row);
    }
  }

  allowlistBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-allow-email]');
    if (!button) return;

    const nextEnabled = button.dataset.enabled !== 'true';
    const action = nextEnabled ? '利用を再開' : '利用を停止';

    if (!confirm(`${button.dataset.allowEmail} の${action}しますか？`)) return;

    try {
      button.disabled = true;

      await updateDoc(
        doc(db, 'betaAllowlist', button.dataset.allowEmail),
        {
          enabled: nextEnabled,
          updatedAt: serverTimestamp()
        }
      );

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
      const snapshot = await getDocs(
        query(collection(db, 'users'), orderBy('createdAt', 'desc'))
      );

      const users = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      usersBody.innerHTML = '';

      let activeCount = 0;
      let lockedCount = 0;

      for (const user of users) {
        if (user.status === 'active') activeCount += 1;
        else lockedCount += 1;

        const row = document.createElement('tr');

        row.innerHTML = `
          <td>${escapeHtml(user.name || user.displayName || '—')}</td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td>${escapeHtml(user.plan || '—')}</td>
          <td>${user.status === 'active' ? '利用中' : '利用停止'}</td>
          <td>${formatTimestamp(user.createdAt)}</td>
          <td>${formatTimestamp(user.lastLoginAt)}</td>
          <td>
            <button
              type="button"
              data-user-id="${escapeHtml(user.id)}"
              data-status="${escapeHtml(user.status || '')}"
            >
              ${user.status === 'active' ? '利用停止' : '利用再開'}
            </button>
          </td>
        `;

        usersBody.appendChild(row);
      }

      document.getElementById('userCount').textContent = `${users.length}人`;
      document.getElementById('activeCount').textContent = `${activeCount}人`;
      document.getElementById('lockedCount').textContent = `${lockedCount}人`;
      setStatus(status);
    } catch (error) {
      setStatus(status, errorText(error, '利用者一覧を読み込めませんでした。'), 'error');
    }
  }

  usersBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-user-id]');
    if (!button) return;

    const nextStatus = button.dataset.status === 'active' ? 'locked' : 'active';
    const action = nextStatus === 'locked' ? '利用停止' : '利用再開';

    if (!confirm(`このユーザーを${action}にしますか？`)) return;

    try {
      button.disabled = true;

      await updateDoc(
        doc(db, 'users', button.dataset.userId),
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

      showPage();
      await Promise.all([loadAllowlist(), loadUsers()]);
    } catch (error) {
      await signOut(auth).catch(() => {});
      showGate(errorText(error, '管理者権限を確認できませんでした。'));
    }
  });
}


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


/* v8 編集機能 */
async function editAllowlistUser(email){
  const ref=doc(db,'betaAllowlist',email);
  const snap=await getDoc(ref);
  if(!snap.exists()) return;
  const d=snap.data();
  document.getElementById('allowDisplayName').value=d.displayName||'';
  document.getElementById('allowEmail').value=d.email||email;
  document.getElementById('allowEmail').readOnly=true;
  document.getElementById('allowDriverNumber').value=d.driverNumber||'';
  document.getElementById('allowOffice').value=d.office||'';
  document.getElementById('allowUnionStatus').value=d.unionStatus||'';
  document.getElementById('allowTester').value=String(d.tester!==false);
  document.getElementById('allowEnabled').value=String(d.enabled!==false);
  window.__editingAllowlist=email;
}
async function saveAllowlistUser(data){
  const ref=doc(db,'betaAllowlist',window.__editingAllowlist);
  await updateDoc(ref,{...data,updatedAt:serverTimestamp()});
  window.__editingAllowlist=null;
  document.getElementById('allowEmail').readOnly=false;
}
