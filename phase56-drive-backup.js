'use strict';
(() => {
  const CLIENT_ID = String(window.TAXI_PAY_GOOGLE_DRIVE_CONFIG?.clientId || '');
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const TOKEN_KEY = 'taxiPayDriveTokenV1';
  const META_KEY = 'taxiPayDriveMetaV1';
  const FOLDER_NAME = '給与シミュレーター';
  let tokenClient = null;
  let accessToken = '';
  let folderId = '';
  let syncing = false;
  let autoTimer = 0;
  const $ = id => document.getElementById(id);

  function jstParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).formatToParts(date);
    return Object.fromEntries(parts.map(x => [x.type, x.value]));
  }
  function jstNow() {
    const p=jstParts(); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`;
  }
  function jstStamp() {
    const p=jstParts(); return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}-JST`;
  }
  window.TaxiPayJstNow = jstNow;

  function msg(id,text='',kind='info'){const el=$(id);if(!el)return;el.textContent=text;el.dataset.kind=kind;}
  function meta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {}}}
  function saveMeta(v){localStorage.setItem(META_KEY,JSON.stringify({...meta(),...v}));renderStatus();}
  function renderStatus(){
    const m=meta(), connected=!!accessToken;
    if($('driveConnectionStatus')) $('driveConnectionStatus').textContent=connected?'接続中':'未接続';
    if($('driveLastSync')) $('driveLastSync').textContent=m.lastSyncAt?`${m.lastSyncAt.replace('T',' ').replace('+09:00','')}（日本時間）`:'—';
    for(const id of ['driveSyncNow','driveDisconnect','driveCreateBackup','driveRefreshBackups']) if($(id)) $(id).disabled=!connected;
  }
  async function loadGis(){
    if(window.google?.accounts?.oauth2)return;
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Google認証ライブラリを読み込めませんでした。'));document.head.appendChild(s);});
  }
  async function initTokenClient(){
    if(!CLIENT_ID)throw new Error('Google Drive用クライアントIDが未設定です。GOOGLE_DRIVE_SETUP_PHASE56.mdの手順で設定してください。');
    await loadGis();
    if(tokenClient)return;
    tokenClient=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,callback:()=>{}});
  }
  async function connect(){
    await initTokenClient();
    const token=await new Promise((resolve,reject)=>{
      tokenClient.callback=r=>r.error?reject(new Error(r.error_description||r.error)):resolve(r);
      tokenClient.requestAccessToken({prompt:'consent'});
    });
    accessToken=token.access_token;
    sessionStorage.setItem(TOKEN_KEY,accessToken);
    saveMeta({connectedAt:jstNow()});
    await ensureFolder();
    msg('driveSyncMessage','Google Driveに接続しました。','success');
    await syncCurrent(false);
    await refreshBackups();
  }
  function disconnect(){
    if(accessToken&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(accessToken,()=>{});
    accessToken='';folderId='';sessionStorage.removeItem(TOKEN_KEY);renderStatus();msg('driveSyncMessage','Google Driveとの接続を解除しました。端末内データは削除されません。','info');
  }
  async function api(url,options={}){
    if(!accessToken)throw new Error('Google Driveに接続してください。');
    const res=await fetch(url,{...options,headers:{Authorization:`Bearer ${accessToken}`,...(options.headers||{})}});
    if(res.status===401){accessToken='';sessionStorage.removeItem(TOKEN_KEY);renderStatus();throw new Error('Google Driveの接続期限が切れました。再接続してください。');}
    if(!res.ok){let d={};try{d=await res.json()}catch{}throw new Error(d.error?.message||`Google Drive APIエラー（${res.status}）`);}
    return res.status===204?null:res.json();
  }
  async function ensureFolder(){
    if(folderId)return folderId;
    const q=encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const found=await api(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=10`);
    folderId=found.files?.[0]?.id||'';
    if(!folderId){const created=await api('https://www.googleapis.com/drive/v3/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})});folderId=created.id;}
    return folderId;
  }
  function exportPayload(){if(!window.TaxiPayDataPort)throw new Error('データ書き出し機能を初期化できませんでした。');return window.TaxiPayDataPort.exportAll();}
  async function findFile(name){
    const fid=await ensureFolder(); const q=encodeURIComponent(`name='${name}' and '${fid}' in parents and trashed=false`);
    const d=await api(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=10`);return d.files?.[0]||null;
  }
  async function uploadJson(name,payload,existingId=''){
    const metadata={name,mimeType:'application/json'}; if(!existingId)metadata.parents=[await ensureFolder()];
    const boundary='taxipay-'+Date.now();
    const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;
    const url=existingId?`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`:'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    return api(url,{method:existingId?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  }
  async function syncCurrent(show=true){
    if(syncing)return; syncing=true;
    try{const payload=exportPayload();const current=await findFile('current.json');await uploadJson('current.json',payload,current?.id||'');saveMeta({lastSyncAt:jstNow()});if(show)msg('driveSyncMessage','最新データをGoogle Driveへ同期しました。','success');}
    catch(e){if(show)msg('driveSyncMessage',e.message,'error');throw e;}finally{syncing=false;}
  }
  async function createBackup(){
    try{const name=`backup-${jstStamp()}.json`;await uploadJson(name,exportPayload());msg('driveBackupMessage',`${name} を作成しました。`,'success');await refreshBackups();}
    catch(e){msg('driveBackupMessage',e.message,'error');}
  }
  async function listBackups(){
    const fid=await ensureFolder();const q=encodeURIComponent(`'${fid}' in parents and name contains 'backup-' and trashed=false`);
    return api(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=createdTime desc&pageSize=50`);
  }
  async function refreshBackups(){
    const root=$('driveBackupList');if(!root)return;
    try{const d=await listBackups(),rows=d.files||[];root.innerHTML=rows.length?rows.map(f=>`<div class="drive-backup-row"><div><strong>${f.name}</strong><span>${f.modifiedTime?new Date(f.modifiedTime).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):''}</span></div><button class="secondary" data-drive-restore="${f.id}" type="button">復元</button></div>`).join(''):'<p class="note">バックアップはまだありません。</p>';}
    catch(e){root.innerHTML='<p class="note">一覧を取得できませんでした。</p>';msg('driveBackupMessage',e.message,'error');}
  }
  async function restoreDrive(id){
    if(!confirm('選択したバックアップから復元します。現在のデータは復元前バックアップを作成して保護します。続行しますか？'))return;
    try{await createSafetyBackup();const payload=await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);window.TaxiPayDataPort.importAll(payload);await syncCurrent(false);msg('driveBackupMessage','バックアップから復元しました。','success');}
    catch(e){msg('driveBackupMessage',e.message,'error');}
  }
  async function createSafetyBackup(){await uploadJson(`before-restore-${jstStamp()}.json`,exportPayload());}
  function downloadLocal(){const payload=exportPayload(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download=`taxi-pay-backup-${jstStamp()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);msg('driveBackupMessage','端末にバックアップを保存しました。','success');}
  async function restoreLocal(file){
    if(!file)return;try{const payload=JSON.parse(await file.text());if(!confirm('選択したファイルから復元します。現在の端末データは自動的に保持用ファイルとしてダウンロードします。続行しますか？'))return;downloadLocal();window.TaxiPayDataPort.importAll(payload);if(accessToken)await syncCurrent(false);msg('driveBackupMessage','端末のファイルから復元しました。','success');}catch(e){msg('driveBackupMessage',e.message||'復元できませんでした。','error');}
  }
  function scheduleAutoSync(){if(!accessToken||!navigator.onLine)return;clearTimeout(autoTimer);autoTimer=setTimeout(()=>syncCurrent(false).catch(()=>{}),1200);}
  function bind(){
    accessToken=sessionStorage.getItem(TOKEN_KEY)||'';renderStatus();
    $('driveConnect')?.addEventListener('click',()=>connect().catch(e=>msg('driveSyncMessage',e.message,'error')));
    $('driveDisconnect')?.addEventListener('click',disconnect);
    $('driveSyncNow')?.addEventListener('click',()=>syncCurrent(true).catch(()=>{}));
    $('driveCreateBackup')?.addEventListener('click',createBackup);
    $('driveRefreshBackups')?.addEventListener('click',refreshBackups);
    $('localBackupDownload')?.addEventListener('click',downloadLocal);
    $('localBackupRestore')?.addEventListener('change',e=>{restoreLocal(e.target.files?.[0]);e.target.value='';});
    $('driveBackupList')?.addEventListener('click',e=>{const id=e.target.dataset.driveRestore;if(id)restoreDrive(id);});
    window.addEventListener('taxipay:state-saved',scheduleAutoSync);
    window.addEventListener('taxipay:profile-updated',scheduleAutoSync);
    window.addEventListener('online',()=>{if(accessToken){msg('driveSyncMessage','オンラインに戻りました。同期を再開します。','info');scheduleAutoSync();}});
    window.addEventListener('offline',()=>msg('driveSyncMessage','オフラインです。端末内への保存を継続します。','info'));
    if(accessToken){ensureFolder().then(refreshBackups).catch(()=>{accessToken='';sessionStorage.removeItem(TOKEN_KEY);renderStatus();});}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',bind):bind();
})();
