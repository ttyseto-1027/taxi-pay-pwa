(() => {
'use strict';
const D=window.TaxiPayDiagnostics, $=id=>document.getElementById(id), LS='taxiPayPwaStateV10', DRAFT='taxiPayV13EntryDraft', PROFILE='taxiPayV13Profile';

function readStoredProfile(){
  try{return JSON.parse(sessionStorage.getItem(PROFILE)||'null')}
  catch{return null}
}

function normalizeProfile(value){
  if(!value||typeof value!=='object')return null;
  return {
    ...value,
    driverNumber:String(value.driverNumber||'').trim(),
    office:String(value.office||'').trim(),
    unionStatus:String(value.unionStatus||'').trim().toLowerCase()
  };
}

let profile=normalizeProfile(window.TaxiPayCurrentProfile)||normalizeProfile(readStoredProfile());

function acceptProfile(value){
  const next=normalizeProfile(value);
  if(!next)return;
  profile=next;
  window.TaxiPayCurrentProfile=next;
  try{sessionStorage.setItem(PROFILE,JSON.stringify(next))}catch{}
  applyRole();
}

window.addEventListener('taxipay:profile',e=>acceptProfile(e.detail));
window.addEventListener('taxipay:app-ready',e=>acceptProfile(e.detail));

if(window.TaxiPayCurrentProfile)acceptProfile(window.TaxiPayCurrentProfile);
function state(){try{return JSON.parse(localStorage.getItem(LS)||'{}')}catch{return {}}}
function draftData(){return {date:$('date')?.value||'',paidLeaveType:document.querySelector('input[name="paidLeaveType"]:checked')?.value||'0',grossRevenue:$('grossRevenue')?.value||'',clockIn:$('clockIn')?.value||'',clockOut:$('clockOut')?.value||'',normalBreakHours:$('normalBreakHours')?.value||'0',normalBreakMinutes:$('normalBreakMinutes')?.value||'0',nightBreakHours:$('nightBreakHours')?.value||'0',nightBreakMinutes:$('nightBreakMinutes')?.value||'0',holidayType:$('holidayType')?.value||'normal',hadAccident:!!$('hadAccident')?.checked,hadViolation:!!$('hadViolation')?.checked,editingId:$('editingId')?.value||'',savedAt:new Date().toISOString()};}
let draftTimer;
function saveDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{try{localStorage.setItem(DRAFT,JSON.stringify(draftData()));D.record('DATA-DRAFT-SAVED','info','入力中データを一時保存');}catch(e){D.notify('入力中データを一時保存できませんでした。','warning','DATA-DRAFT-01',e.message)}},250);}
function restoreDraft(){let x;try{x=JSON.parse(localStorage.getItem(DRAFT)||'null')}catch{} if(!x||!x.date)return; const current=$('date')?.value; if(current&&current!==new Date().toISOString().slice(0,10))return; for(const k of ['date','grossRevenue','clockIn','clockOut','normalBreakHours','normalBreakMinutes','nightBreakHours','nightBreakMinutes','holidayType','editingId'])if($(k)&&x[k]!=null)$(k).value=x[k]; const r=document.querySelector(`input[name="paidLeaveType"][value="${x.paidLeaveType}"]`);if(r)r.checked=true;if($('hadAccident'))$('hadAccident').checked=!!x.hadAccident;if($('hadViolation'))$('hadViolation').checked=!!x.hadViolation;$('grossRevenue')?.dispatchEvent(new Event('input'));D.notify('前回の未保存入力を復元しました。','info','DATA-DRAFT-RESTORED');}
const form=$('entryForm'); form?.addEventListener('input',saveDraft);form?.addEventListener('change',saveDraft);form?.addEventListener('submit',()=>{const submitted=draftData();setTimeout(()=>{const s=state();const paidLeaveUnits=Number(submitted.paidLeaveType||0);const ok=(s.entries||[]).some(e=>submitted.editingId?e.id===submitted.editingId:(e.date===submitted.date&&Number(e.paidLeaveUnits||0)===paidLeaveUnits&&(paidLeaveUnits>0||Number(e.grossRevenue||0)===Number(submitted.grossRevenue||0))));if(ok){localStorage.removeItem(DRAFT);D.notify('勤務実績を保存しました。','success','DATA-SAVE-OK');}else D.notify('保存結果を確認できませんでした。入力内容は保持されています。','error','DATA-SAVE-VERIFY-01');},150);},true);
$('resetForm')?.addEventListener('click',()=>{localStorage.removeItem(DRAFT);D.notify('入力欄をクリアしました。','info','DATA-DRAFT-CLEAR');});
function applyRole(){
  const current=normalizeProfile(window.TaxiPayCurrentProfile)||profile;
  if(current&&current!==profile)profile=current;

  const unionStatus=String(profile?.unionStatus||'').trim().toLowerCase();
  const member=unionStatus==='member'||unionStatus==='union'||unionStatus==='組合員';
  const driverNumber=String(profile?.driverNumber||'').trim();

  document.querySelectorAll('[data-union-only]').forEach(x=>{x.hidden=!member;});

  const badge=$('userEligibility');
  if(badge){
    badge.textContent=profile
      ? `乗務員番号：${driverNumber||'未登録'}／${member?'組合員':'非組合員'}`
      : '';
  }

  document.body.dataset.unionStatus=member?'member':'nonmember';
  window.TaxiPayInlineDiagnostic?.add(
    'V16-ROLE-APPLY',
    `権限表示を反映しました: driverNumber=${driverNumber||'未登録'}, unionStatus=${unionStatus||'未設定'}, member=${member}`
  );
}
function totalWorkMinutes(entries){return (entries||[]).reduce((a,e)=>{if(e.paidLeaveUnits)return a;const [ih,im]=(e.clockIn||'0:0').split(':').map(Number),[oh,om]=(e.clockOut||'0:0').split(':').map(Number);let x=oh*60+om-(ih*60+im);if(x<=0)x+=1440;return a+Math.max(0,x-Number(e.normalBreakMinutes||0)-Number(e.nightBreakMinutes||0));},0)}
function updateKpi(){const s=state(),entries=s.entries||[],gross=entries.reduce((a,e)=>a+Number(e.grossRevenue||0),0),take=Number(($('takeHome')?.textContent||'0').replace(/[^0-9-]/g,'')),pay=Number(($('grossPay')?.textContent||'0').replace(/[^0-9-]/g,'')),mins=totalWorkMinutes(entries);if($('effectiveReturn'))$('effectiveReturn').textContent=gross?`${(pay/gross*100).toFixed(1)}%`:'—';if($('takeHomeReturn'))$('takeHomeReturn').textContent=gross?`${(take/gross*100).toFixed(1)}%`:'—';if($('hourlyTakeHome'))$('hourlyTakeHome').textContent=mins?`${Math.round(take/(mins/60)).toLocaleString('ja-JP')}円`:'—';}
const mo=new MutationObserver(updateKpi);if($('takeHome'))mo.observe($('takeHome'),{childList:true,subtree:true});setTimeout(()=>{
  if(window.TaxiPayCurrentProfile)acceptProfile(window.TaxiPayCurrentProfile);
  restoreDraft();
  applyRole();
  updateKpi();
},500);
let restStart=Number(localStorage.getItem('taxiPayRestStart')||0),driveStart=Number(localStorage.getItem('taxiPayDriveStart')||Date.now());
function restRender(){const active=restStart>0,now=Date.now(),drive=active?0:now-driveStart,rest=active?now-restStart:0;if($('restStatus'))$('restStatus').textContent=active?`休憩中：${Math.floor(rest/60000)}分`:`連続運転：${Math.floor(drive/60000)}分`;const h=drive/3600000;if(!active&&h>=6){const level=h>=8?'error':h>=7?'warning':'warning';D.notify(h>=8?'連続運転が8時間を超えています。安全な場所で直ちに休憩してください。':h>=7?'連続運転が7時間を超えています。速やかに休憩してください。':'連続運転が6時間を超えました。休憩を取ってください。',level,'REST-CONTINUOUS-01');driveStart=now-5.5*3600000;localStorage.setItem('taxiPayDriveStart',driveStart);}}
$('startRest')?.addEventListener('click',()=>{restStart=Date.now();localStorage.setItem('taxiPayRestStart',restStart);D.notify('休憩を開始しました。','success','REST-START');restRender();});
$('endRest')?.addEventListener('click',()=>{if(!restStart)return;const mins=Math.round((Date.now()-restStart)/60000);restStart=0;driveStart=Date.now();localStorage.removeItem('taxiPayRestStart');localStorage.setItem('taxiPayDriveStart',driveStart);D.notify(`休憩を終了しました（${mins}分）。`,'success','REST-END');restRender();});
setInterval(restRender,60000);restRender();
$('targetTakeHome')?.addEventListener('input',()=>{const target=Number($('targetTakeHome').value||0),current=Number(($('takeHome')?.textContent||'0').replace(/[^0-9-]/g,'')),gross=(state().entries||[]).reduce((a,e)=>a+Number(e.grossRevenue||0),0),rate=gross?current/gross:.43,need=rate?Math.max(0,(target-current)/rate):0;$('neededRevenue').textContent=target?`${(Math.ceil(need/1000)*1000).toLocaleString('ja-JP')||Math.ceil(need/1000)*1000}円`:'—';});
})();
