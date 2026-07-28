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
function payrollMonthOf(dateStr){
  const d=new Date(`${dateStr}T00:00:00`);if(Number.isNaN(d.getTime()))return '';
  const y=d.getFullYear(),m=d.getMonth()+1,day=d.getDate();
  const closeDay=(y,m)=>new Date(y,m,0).getDate()<15?new Date(y,m,0).getDate():15;
  if(day<=closeDay(y,m))return `${y}-${String(m).padStart(2,'0')}`;
  const nx=new Date(y,m,1);return `${nx.getFullYear()}-${String(nx.getMonth()+1).padStart(2,'0')}`;
}
function currentMonthEntries(){const ym=$('currentMonth')?.value||'';return (state().entries||[]).filter(e=>payrollMonthOf(e.date)===ym);}
function totalWorkMinutes(entries){return (entries||[]).reduce((a,e)=>{if(e.paidLeaveUnits)return a;const [ih,im]=(e.clockIn||'0:0').split(':').map(Number),[oh,om]=(e.clockOut||'0:0').split(':').map(Number);let x=oh*60+om-(ih*60+im);if(x<=0)x+=1440;return a+Math.max(0,x-Number(e.normalBreakMinutes||0)-Number(e.nightBreakMinutes||0));},0)}
const yen=v=>`${Math.max(0,Math.round(Number(v)||0)).toLocaleString('ja-JP')}円`;
const textNumber=id=>Number(($(id)?.textContent||'0').replace(/[^0-9-]/g,''))||0;
const targetKey=()=>`taxiPayTargetTakeHome:${$('currentMonth')?.value||'current'}`;
function loadTarget(){const el=$('targetTakeHome');if(el)el.value=localStorage.getItem(targetKey())||'';}
function updateKpi(){
  const s=state(),entries=currentMonthEntries(),gross=entries.reduce((a,e)=>a+Number(e.grossRevenue||0),0),take=textNumber('takeHome'),pay=textNumber('grossPay'),mins=totalWorkMinutes(entries);
  if($('effectiveReturn'))$('effectiveReturn').textContent=gross?`${(pay/gross*100).toFixed(1)}%`:'—';
  if($('takeHomeReturn'))$('takeHomeReturn').textContent=gross?`${(take/gross*100).toFixed(1)}%`:'—';
  if($('hourlyTakeHome'))$('hourlyTakeHome').textContent=mins?yen(take/(mins/60)):'—';
  const target=Number($('targetTakeHome')?.value||0),remaining=Math.max(0,target-take),rate=gross&&take>0?take/gross:0.43;
  const planned=Number(s.settings?.shiftType?.startsWith('定隔')?s.settings.shiftType.replace(/\D/g,''):(s.settings?.shiftType==='隔日勤務'?12:(s.settings?.shiftType==='昼日勤'||s.settings?.shiftType==='夜日勤'?22:0)))||0;
  const worked=entries.filter(e=>!Number(e.paidLeaveUnits||0)).length,remainingShifts=Math.max(0,planned-worked),needed=target?Math.ceil((remaining/rate)/1000)*1000:0;
  if($('currentExpectedTakeHome'))$('currentExpectedTakeHome').textContent=yen(take);
  if($('targetAchievementRate'))$('targetAchievementRate').textContent=target?`${Math.min(999,(take/target)*100).toFixed(1)}%`:'—';
  if($('remainingTakeHome'))$('remainingTakeHome').textContent=target?yen(remaining):'—';
  if($('neededRevenue'))$('neededRevenue').textContent=target?yen(needed):'—';
  if($('remainingShiftCount'))$('remainingShiftCount').textContent=planned?`${remainingShifts}出番`:'—';
  if($('neededRevenuePerShift'))$('neededRevenuePerShift').textContent=target&&remainingShifts?yen(Math.ceil(needed/remainingShifts/1000)*1000):(target&&remaining===0?'達成済み':'—');
}
const mo=new MutationObserver(updateKpi);if($('takeHome'))mo.observe($('takeHome'),{childList:true,subtree:true});
$('targetTakeHome')?.addEventListener('input',()=>{localStorage.setItem(targetKey(),$('targetTakeHome').value||'');updateKpi();});
$('currentMonth')?.addEventListener('change',()=>{loadTarget();setTimeout(updateKpi,0);});
setTimeout(()=>{if(window.TaxiPayCurrentProfile)acceptProfile(window.TaxiPayCurrentProfile);restoreDraft();applyRole();loadTarget();updateKpi();},500);
})();
