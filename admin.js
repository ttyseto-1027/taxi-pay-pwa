import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, serverTimestamp, orderBy, query } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const config=window.TAXI_PAY_FIREBASE_CONFIG||{};
const gate=document.getElementById('adminAuthGate'), msg=document.getElementById('adminMessage'), body=document.getElementById('usersBody');
function fmt(ts){try{return ts?.toDate().toLocaleString('ja-JP')||'—'}catch{return '—'}}
function showGate(text){document.body.classList.add('auth-pending');gate.hidden=false;if(text)msg.textContent=text;}
function showPage(){document.body.classList.remove('auth-pending');gate.hidden=true;}
if(!config.enabled||config.apiKey==='REPLACE_ME'){showGate('Firebaseの初期設定が未完了です。');}
else{
 const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
 document.getElementById('adminLoginForm').onsubmit=async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,document.getElementById('adminEmail').value.trim(),document.getElementById('adminPassword').value)}catch{msg.textContent='ログインできませんでした。'}};
 document.getElementById('adminLogout').onclick=()=>signOut(auth);
 async function sha256(text){const bytes=new TextEncoder().encode(text.trim());const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
 document.getElementById('codeForm').onsubmit=async e=>{e.preventDefault();const status=document.getElementById('codeStatus');try{const code=document.getElementById('newAccessCode').value.trim();const maxUses=Number(document.getElementById('newAccessMaxUses').value||1);const hash=await sha256(code);await setDoc(doc(db,'accessCodes',hash),{active:true,maxUses,usageCount:0,createdAt:serverTimestamp()});status.textContent='利用コードを登録しました。コード本文は安全な場所に控え、テストユーザーへ伝えてください。';document.getElementById('newAccessCode').value='';}catch(err){status.textContent='コードを登録できませんでした。';}};

 async function loadUsers(){document.getElementById('adminStatus').textContent='読み込み中…';const snap=await getDocs(query(collection(db,'users'),orderBy('createdAt','desc')));const users=snap.docs.map(d=>({id:d.id,...d.data()}));body.innerHTML='';let active=0,locked=0;for(const u of users){u.status==='active'?active++:locked++;const tr=document.createElement('tr');tr.innerHTML=`<td>${u.name||'—'}</td><td>${u.email||'—'}</td><td>${u.plan||'—'}</td><td>${u.status==='active'?'利用中':'利用停止'}</td><td>${fmt(u.createdAt)}</td><td>${fmt(u.lastLoginAt)}</td><td><button class="${u.status==='active'?'danger':'secondary'}" data-id="${u.id}" data-status="${u.status}">${u.status==='active'?'利用停止':'利用再開'}</button></td>`;body.appendChild(tr);}document.getElementById('userCount').textContent=`${users.length}人`;document.getElementById('activeCount').textContent=`${active}人`;document.getElementById('lockedCount').textContent=`${locked}人`;document.getElementById('adminStatus').textContent='';}
 body.onclick=async e=>{const b=e.target.closest('button[data-id]');if(!b)return;const next=b.dataset.status==='active'?'locked':'active';if(!confirm(next==='locked'?'このユーザーを利用停止にしますか？':'このユーザーの利用を再開しますか？'))return;await updateDoc(doc(db,'users',b.dataset.id),{status:next,statusUpdatedAt:serverTimestamp()});await loadUsers();};
 onAuthStateChanged(auth,async user=>{if(!user){showGate();return;}const admin=await getDoc(doc(db,'admins',user.uid));if(!admin.exists()){await signOut(auth);showGate('このアカウントには管理者権限がありません。');return;}showPage();await loadUsers();});
}
