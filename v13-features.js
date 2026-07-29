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
function closeDay(year,month){return month===2?14:month===3?16:15;}
function payrollMonthOf(dateStr){
  const d=new Date(`${dateStr}T00:00:00`);if(Number.isNaN(d.getTime()))return '';
  const y=d.getFullYear(),m=d.getMonth()+1,day=d.getDate();
  if(day<=closeDay(y,m))return `${y}-${String(m).padStart(2,'0')}`;
  const nx=new Date(y,m,1);return `${nx.getFullYear()}-${String(nx.getMonth()+1).padStart(2,'0')}`;
}
function currentMonthEntries(){const ym=$('currentMonth')?.value||'';return (state().entries||[]).filter(e=>payrollMonthOf(e.date)===ym);}
function totalWorkMinutes(entries){return (entries||[]).reduce((a,e)=>{if(e.paidLeaveUnits)return a;const [ih,im]=(e.clockIn||'0:0').split(':').map(Number),[oh,om]=(e.clockOut||'0:0').split(':').map(Number);let x=oh*60+om-(ih*60+im);if(x<=0)x+=1440;return a+Math.max(0,x-Number(e.normalBreakMinutes||0)-Number(e.nightBreakMinutes||0));},0)}
const yen=v=>`${Math.max(0,Math.round(Number(v)||0)).toLocaleString('ja-JP')}円`;
const textNumber=id=>Number(($(id)?.textContent||'0').replace(/[^0-9-]/g,''))||0;
const SALES_TARGET_PREFIX='taxiPaySalesTarget:v1:';
const selectedPayrollMonth=()=>String($('currentMonth')?.value||'');
const salesTargetKey=ym=>`${SALES_TARGET_PREFIX}${ym}`;
function previousPayrollMonth(ym){const [y,m]=String(ym||'').split('-').map(Number);if(!y||!m)return '';const d=new Date(y,m-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function sanitizeSalesTarget(input){
  const targetTakeHome=Math.max(0,Math.round(Number(input?.targetTakeHome)||0));
  const rawShifts=input?.remainingShifts;
  const remainingShifts=rawShifts===''||rawShifts===null||rawShifts===undefined?'':Math.max(0,Math.floor(Number(rawShifts)||0));
  const rounding=[1,100,1000].includes(Number(input?.rounding))?Number(input.rounding):1000;
  return {targetTakeHome,remainingShifts,rounding};
}
function readSalesTarget(ym){try{const x=JSON.parse(localStorage.getItem(salesTargetKey(ym))||'null');return x?sanitizeSalesTarget(x):null}catch{return null}}
function initialSalesTarget(ym){
  const saved=readSalesTarget(ym);if(saved)return {...saved,source:'saved'};
  const legacy=localStorage.getItem(`taxiPayTargetTakeHome:${ym}`);
  const previous=readSalesTarget(previousPayrollMonth(ym));
  if(previous)return {...previous,source:'previous'};
  if(legacy!==null)return {...sanitizeSalesTarget({targetTakeHome:legacy,remainingShifts:'',rounding:1000}),source:'legacy'};
  return {...sanitizeSalesTarget({targetTakeHome:0,remainingShifts:'',rounding:1000}),source:'empty'};
}
function setSalesTargetMessage(text='',kind='info'){
  const box=$('salesTargetMessage');if(!box)return;box.textContent=text;box.dataset.kind=kind;
}
function loadSalesTarget(){
  const ym=selectedPayrollMonth(),data=initialSalesTarget(ym);
  if($('targetTakeHome'))$('targetTakeHome').value=data.targetTakeHome||'';
  if($('remainingShiftCountInput'))$('remainingShiftCountInput').value=data.remainingShifts;
  if($('salesTargetRounding'))$('salesTargetRounding').value=String(data.rounding);
  if($('salesTargetPayrollMonth'))$('salesTargetPayrollMonth').textContent=ym?`${ym.replace('-','年')}月給与の目標と現在の状況です。`:'表示中の給与月について、目標と現在の状況を確認できます。';
  setSalesTargetMessage(data.source==='previous'?'前月の設定を初期値として表示しています。必要に応じて変更して保存してください。':'');
  updateKpi();
}
function roundUp(value,unit){const n=Math.max(0,Number(value)||0),u=[1,100,1000].includes(Number(unit))?Number(unit):1000;return Math.ceil(n/u)*u;}
function setCalculatedUnavailable(){
  for(const id of ['currentExpectedTakeHome','targetAchievementRate','remainingTakeHome','neededRevenue','neededRevenuePerShift','effectiveReturn','takeHomeReturn','hourlyTakeHome'])if($(id))$(id).textContent='算出できません';
}
function updateKpi(){
  const entries=currentMonthEntries();
  if(!entries.length){setCalculatedUnavailable();return;}
  const gross=entries.reduce((a,e)=>a+Number(e.grossRevenue||0),0),take=textNumber('takeHome'),pay=textNumber('grossPay'),mins=totalWorkMinutes(entries);
  if($('currentExpectedTakeHome'))$('currentExpectedTakeHome').textContent=yen(take);
  if($('effectiveReturn'))$('effectiveReturn').textContent=gross?`${(pay/gross*100).toFixed(1)}%`:'算出できません';
  if($('takeHomeReturn'))$('takeHomeReturn').textContent=gross?`${(take/gross*100).toFixed(1)}%`:'算出できません';
  if($('hourlyTakeHome'))$('hourlyTakeHome').textContent=mins?yen(take/(mins/60)):'算出できません';
  const target=Number($('targetTakeHome')?.value||0);
  const shiftsRaw=$('remainingShiftCountInput')?.value??'';
  const shiftsEntered=String(shiftsRaw).trim()!=='';
  const remainingShifts=shiftsEntered?Math.max(0,Math.floor(Number(shiftsRaw)||0)):null;
  const rounding=Number($('salesTargetRounding')?.value||1000);
  if(!target){
    for(const id of ['targetAchievementRate','remainingTakeHome','neededRevenue'])if($(id))$(id).textContent='—';
    if($('neededRevenuePerShift'))$('neededRevenuePerShift').textContent=shiftsEntered?'—':'残り出番数を入力してください';
    return;
  }
  const remaining=Math.max(0,target-take);
  if($('targetAchievementRate'))$('targetAchievementRate').textContent=`${(take/target*100).toFixed(1)}%`;
  if($('remainingTakeHome'))$('remainingTakeHome').textContent=yen(remaining);
  if(remaining===0){
    if($('neededRevenue'))$('neededRevenue').textContent='0円';
    if($('neededRevenuePerShift'))$('neededRevenuePerShift').textContent='残り出番あたりの必要営収はありません';
    return;
  }
  const rate=gross>0&&take>0?take/gross:0;
  if(rate<=0){
    if($('neededRevenue'))$('neededRevenue').textContent='算出できません';
    if($('neededRevenuePerShift'))$('neededRevenuePerShift').textContent='算出できません';
    return;
  }
  const needed=roundUp(remaining/rate,rounding);
  if($('neededRevenue'))$('neededRevenue').textContent=yen(needed);
  if(!shiftsEntered){if($('neededRevenuePerShift'))$('neededRevenuePerShift').textContent='残り出番数を入力してください';return;}
  if(remainingShifts===0){if($('neededRevenuePerShift'))$('neededRevenuePerShift').textContent='—';return;}
  if($('neededRevenuePerShift'))$('neededRevenuePerShift').textContent=yen(roundUp((remaining/rate)/remainingShifts,rounding));
}
function saveSalesTarget(){
  const ym=selectedPayrollMonth();if(!ym)return;
  const shiftValue=$('remainingShiftCountInput')?.value??'';
  const data=sanitizeSalesTarget({targetTakeHome:$('targetTakeHome')?.value||0,remainingShifts:shiftValue,rounding:$('salesTargetRounding')?.value||1000});
  try{localStorage.setItem(salesTargetKey(ym),JSON.stringify({...data,savedAt:new Date().toISOString()}));setSalesTargetMessage('売上目標を保存しました。','success');updateKpi();}
  catch(e){setSalesTargetMessage('売上目標を保存できませんでした。入力内容は画面に残っています。','error');D?.record?.('SALES-TARGET-SAVE-ERROR','error',e.message);}
}
const mo=new MutationObserver(updateKpi);if($('takeHome'))mo.observe($('takeHome'),{childList:true,subtree:true});
for(const id of ['targetTakeHome','remainingShiftCountInput','salesTargetRounding'])$(id)?.addEventListener('input',updateKpi);
$('salesTargetRounding')?.addEventListener('change',updateKpi);
$('saveSalesTarget')?.addEventListener('click',saveSalesTarget);
$('currentMonth')?.addEventListener('change',()=>setTimeout(loadSalesTarget,0));
for(const id of ['prevMonth','nextMonth'])$(id)?.addEventListener('click',()=>setTimeout(loadSalesTarget,0));
setTimeout(()=>{if(window.TaxiPayCurrentProfile)acceptProfile(window.TaxiPayCurrentProfile);restoreDraft();applyRole();loadSalesTarget();updateKpi();},500);
})();
