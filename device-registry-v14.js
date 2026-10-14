import {getApps,getApp,initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,setDoc,deleteDoc,collection,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const NAME_KEY='taxiPayDeviceNameV2';
const ID_KEY='taxiPayDeviceIdV1';
const ROLLOUT_AT=Date.parse('2026-08-27T12:30:00Z');
const $=id=>document.getElementById(id);
let initializedUid='';
let profile=null;
let db=null;
let auth=null;
let devices=[];

function ctx(){return window.TaxiPayDataIntegrity?.deviceContext?.()||{deviceId:localStorage.getItem(ID_KEY)||'',deviceName:localStorage.getItem(NAME_KEY)||'',browser:'',os:''};}
function normName(v){return String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ja-JP');}
function notify(text,kind='info',code='DEVICE-NAME-REMINDER'){if(window.TaxiPayDiagnostics?.notify)window.TaxiPayDiagnostics.notify(text,kind,code);else console.log(text);}
function info(){const c=ctx();return{deviceId:c.deviceId,deviceName:localStorage.getItem(NAME_KEY)||'',browser:c.browser||'',os:c.os||'',userAgent:navigator.userAgent||'',launchMode:(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)?'pwa':'browser',lastSeenAtJst:window.TaxiPayDataIntegrity?.jstNow?.()||new Date().toISOString(),lastSeenAt:serverTimestamp(),active:true};}
async function setupFirebase(){if(db&&auth)return;const cfg=window.TAXI_PAY_FIREBASE_CONFIG||{};const app=getApps().length?getApp():initializeApp(cfg);auth=getAuth(app);db=getFirestore(app);}
async function listDevices(){const user=auth?.currentUser;if(!user)return[];const snap=await getDocs(collection(db,'users',user.uid,'devices'));devices=snap.docs.map(d=>({id:d.id,...d.data()}));return devices;}
function uniqueName(name,except=''){const n=normName(name);return !!n&&!devices.some(d=>d.id!==except&&normName(d.deviceName)===n&&d.active!==false);}
async function userCreatedAt(){const u=auth?.currentUser;if(!u)return 0;const s=await getDoc(doc(db,'users',u.uid));const v=s.data()?.createdAt;return v?.toMillis?.()||0;}
async function saveName(name,deviceId=ctx().deviceId){name=String(name||'').trim().replace(/\s+/g,' ');if(!name)throw new Error('端末名を入力してください。');await listDevices();if(!uniqueName(name,deviceId))throw new Error('同じ端末名がすでに登録されています。別の端末名を入力してください。');const user=auth.currentUser;if(!user)throw new Error('ログイン状態を確認できません。');const c=ctx();localStorage.setItem(ID_KEY,deviceId);localStorage.setItem(NAME_KEY,name);await setDoc(doc(db,'users',user.uid,'devices',deviceId),{...info(),deviceId,deviceName:name,browsers:[c.browser||''],nameUpdatedAt:serverTimestamp(),nameUpdatedAtJst:window.TaxiPayDataIntegrity?.jstNow?.()||new Date().toISOString()},{merge:true});await listDevices();renderCard();window.dispatchEvent(new CustomEvent('taxipay:device-ready',{detail:{deviceId,deviceName:name}}));return{deviceId,deviceName:name};}
function hasNamedDevice(){return Boolean(String(localStorage.getItem(NAME_KEY)||'').trim());}
function requireNamedDevice(){if(hasNamedDevice())return true;notify('Google Driveを利用する前に「利用者情報」でこの端末の名前を設定してください。','error','DEVICE-NAME-REQUIRED');try{location.hash='#/profile';}catch{}return false;}
function renderCard(){const c=ctx(),root=$('deviceRegistryContent');if(!root)return;const current=devices.find(d=>d.id===c.deviceId);const name=localStorage.getItem(NAME_KEY)||current?.deviceName||'';root.innerHTML=`<dl class="profile-list"><div><dt>この端末</dt><dd>${name?escapeHtml(name):'未設定'}</dd></div><div><dt>ブラウザ</dt><dd>${escapeHtml(c.browser||'—')}</dd></div><div><dt>端末ID</dt><dd class="device-id-short">${escapeHtml(c.deviceId||'—')}</dd></div></dl><label>端末名<input id="deviceNameInputV14" maxlength="40" value="${escapeAttr(name)}" placeholder="例：iPhone / 自宅PC"></label><div class="actions"><button type="button" id="saveDeviceNameV14">端末名を保存</button></div><p class="note">同じGoogleアカウント内で端末名の重複はできません。ブラウザは自由に利用でき、作成・更新に使ったブラウザはアプリ内部で記録します。</p><details><summary>登録済み端末 ${devices.filter(d=>d.deviceName&&d.active!==false).length}台</summary><div class="registered-device-list">${devices.filter(d=>d.deviceName&&d.active!==false).map(d=>`<div><strong>${escapeHtml(d.deviceName)}</strong><small>${escapeHtml(d.os||'')} / ${escapeHtml(d.browser||'')}</small></div>`).join('')||'<p class="note">まだ登録されていません。</p>'}</div></details><p id="deviceNameMessageV14" class="phase2-message"></p>`;$('saveDeviceNameV14').onclick=async()=>{const msg=$('deviceNameMessageV14');try{await saveName($('deviceNameInputV14').value,c.deviceId);msg.textContent='端末名を保存しました。';msg.dataset.kind='success';}catch(e){msg.textContent=e.message||String(e);msg.dataset.kind='error';}};}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));}
function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;');}
function ensureProfileCard(){const panel=document.querySelector('[data-view-panel="profile"]');if(!panel||$('deviceRegistryCardV14'))return;const card=document.createElement('section');card.className='card';card.id='deviceRegistryCardV14';card.innerHTML='<div class="profile-card-title"><h2>端末情報</h2></div><div id="deviceRegistryContent"><p class="note">端末情報を確認しています…</p></div>';const diag=$('profileDiagnosticsCard');panel.insertBefore(card,diag||null);}
function ensureAssociationDialog(){let d=$('deviceAssociationDialogV14');if(d)return d;d=document.createElement('dialog');d.className='modal';d.id='deviceAssociationDialogV14';d.innerHTML='<form method="dialog"><h2>この端末を登録してください</h2><p id="deviceAssociationGuideV14" class="note"></p><div id="deviceAssociationExistingV14"></div><hr><label>新しい端末として登録<input id="deviceAssociationNewNameV14" maxlength="40" placeholder="例：iPhone / 自宅PC"></label><div class="actions"><button type="button" id="deviceAssociationNewV14">新しい端末として登録</button></div><p id="deviceAssociationMessageV14" class="phase2-message"></p></form>';document.body.appendChild(d);return d;}
async function inheritDevice(target,d,user,c){if(!target?.id||!target?.deviceName)throw new Error('引き継ぐ端末を確認できません。');const transient=c.deviceId;localStorage.setItem(ID_KEY,target.id);localStorage.setItem(NAME_KEY,target.deviceName);await setDoc(doc(db,'users',user.uid,'devices',target.id),{...info(),deviceId:target.id,deviceName:target.deviceName,lastSeenAt:serverTimestamp()},{merge:true});if(transient&&transient!==target.id){const old=devices.find(x=>x.id===transient);if(old&&!old.deviceName)await deleteDoc(doc(db,'users',user.uid,'devices',transient)).catch(()=>{});}d.close();await listDevices();renderCard();window.dispatchEvent(new CustomEvent('taxipay:device-ready',{detail:{deviceId:target.id,deviceName:target.deviceName}}));}
async function requireAssociationIfNeeded(){const user=auth.currentUser;if(!user)return;await listDevices();const c=ctx(),current=devices.find(d=>d.id===c.deviceId);if(current?.deviceName){localStorage.setItem(NAME_KEY,current.deviceName);renderCard();return;}
  const named=devices.filter(d=>d.deviceName&&d.active!==false);
  const created=await userCreatedAt().catch(()=>0);
  const newUser=created>=ROLLOUT_AT;
  if(!named.length&&!newUser){notify('端末名を設定してください。「利用者情報」から設定できます。','info','DEVICE-NAME-REMINDER');renderCard();return;}
  const d=ensureAssociationDialog();
  $('deviceAssociationGuideV14').textContent=named.length?'登録済み端末を引き継ぐ場合は、端末を選択してから「選択した端末を引き継ぐ」を押してください。該当しない場合は新しい端末名を登録してください。':'初回利用のため、この端末の名前を設定してください。';
  $('deviceAssociationExistingV14').innerHTML=named.length?'<h3>登録済み端末を引き継ぐ</h3><div class="device-inherit-options">'+named.map(x=>`<label class="device-inherit-option"><input type="radio" name="deviceInheritV14" value="${escapeAttr(x.id)}"><span><strong>${escapeHtml(x.deviceName)}</strong><small>${escapeHtml(x.os||'')} / ${escapeHtml(x.browser||'')}</small></span></label>`).join('')+'</div><div class="actions"><button type="button" id="deviceAssociationInheritV14" disabled>選択した端末を引き継ぐ</button></div>':'';
  const inheritButton=$('deviceAssociationInheritV14');
  if(inheritButton){
    $('deviceAssociationExistingV14').querySelectorAll('input[name="deviceInheritV14"]').forEach(radio=>{radio.addEventListener('change',()=>{inheritButton.disabled=!$('deviceAssociationExistingV14').querySelector('input[name="deviceInheritV14"]:checked');});});
    inheritButton.onclick=async()=>{const selected=$('deviceAssociationExistingV14').querySelector('input[name="deviceInheritV14"]:checked');if(!selected){$('deviceAssociationMessageV14').textContent='引き継ぐ端末を選択してください。';return;}const target=devices.find(x=>x.id===selected.value);try{await inheritDevice(target,d,user,c);$('deviceAssociationMessageV14').textContent='';}catch(e){$('deviceAssociationMessageV14').textContent=e.message||String(e);}};
  }
  $('deviceAssociationNewV14').onclick=async()=>{try{await saveName($('deviceAssociationNewNameV14').value,c.deviceId);d.close();$('deviceAssociationMessageV14').textContent='';}catch(e){$('deviceAssociationMessageV14').textContent=e.message||String(e);}};
  if(!d.open)d.showModal();
}
async function recordBrowserUse(){const user=auth.currentUser;if(!user)return;const c=ctx(),ref=doc(db,'users',user.uid,'devices',c.deviceId),s=await getDoc(ref),old=s.data()||{},list=[...new Set([...(Array.isArray(old.browsers)?old.browsers:[]),c.browser].filter(Boolean))];await setDoc(ref,{...info(),deviceName:localStorage.getItem(NAME_KEY)||old.deviceName||'',browsers:list},{merge:true});}
async function initialize(p){ensureProfileCard();if(!p)return;await setupFirebase();const user=auth.currentUser;if(!user)return;if(initializedUid===user.uid){await listDevices();renderCard();return;}initializedUid=user.uid;profile=p;await new Promise(r=>setTimeout(r,450));await listDevices();await recordBrowserUse().catch(()=>{});await listDevices();await requireAssociationIfNeeded();renderCard();}
function installDriveGuards(){document.addEventListener('click',e=>{const target=e.target.closest?.('#driveSyncNow,#driveRefreshBackups,#restoreSafetyButton,[data-drive-restore],[data-drive-delete]');if(!target)return;if(hasNamedDevice())return;e.preventDefault();e.stopImmediatePropagation();requireNamedDevice();},true);}
window.TaxiPayDeviceRegistry={hasNamedDevice,requireNamedDevice,getCurrent:()=>ctx(),list:()=>devices.map(x=>({...x})),saveName};
installDriveGuards();
ensureProfileCard();
window.addEventListener('DOMContentLoaded',ensureProfileCard,{once:true});
window.addEventListener('taxipay:profile',e=>initialize(e.detail).catch(err=>console.warn('device registry',err)));
window.addEventListener('taxipay:app-ready',e=>initialize(e.detail).catch(err=>console.warn('device registry',err)));
if(window.TaxiPayCurrentProfile)initialize(window.TaxiPayCurrentProfile).catch(err=>console.warn('device registry',err));
