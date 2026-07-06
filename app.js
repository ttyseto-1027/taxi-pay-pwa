const LS_KEY = 'taxiPayPwaStateV5';
const SHIFT_RULES = {
  '隔日勤務': { shiftMinutes: 14 * 60 + 15, monthlyMinutes: 171 * 60 },
  '昼日勤': { shiftMinutes: 7 * 60 + 30, monthlyMinutes: 165 * 60 },
  '夜日勤': { shiftMinutes: 7 * 60 + 30, monthlyMinutes: 165 * 60 },
  '定時制A': { shiftMinutes: 7 * 60 + 30, monthlyMinutes: 165 * 60 },
  '定時制B': { shiftMinutes: 7 * 60 + 30, monthlyMinutes: 165 * 60 }
};
const DEFAULT_STATE = {
  settings: {
    shiftType: '隔日勤務',
    taxRate: 10,
    fareRevisionCoefficient: 1,
    payRevenueCoefficient: 0.9585,
    commissionARate: 41.44,
    commissionBRate: 19.05,
    commissionBThreshold: 420000,
    commissionBMax: 1200000,
    modelWorkAllowance: 3000,
    accidentFreeAllowance: 700,
    violationFreeAllowance: 200,
    legalOvertimeRate: 25,
    scheduledOvertimeRate: 25,
    over60Rate: 50,
    statutoryHolidayRate: 35,
    nonStatutoryHolidayRate: 25,
    nightRate: 25,
    healthInsurance: 0,
    pension: 0,
    employmentInsurance: 0,
    incomeTax: 0,
    residentTax: 0,
    otherDeduction: 0
  },
  entries: [],
  history: []
};
let state = loadState();
migrateState();

const $ = id => document.getElementById(id);
const yen = n => `${Math.round(Number(n || 0)).toLocaleString('ja-JP')}円`;
const pad = n => String(n).padStart(2,'0');
const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };

function cutoffDay(year, month){
  // month: 1-12. 賃金締め日は原則15日、2月14日、3月16日。
  if (month === 2) return 14;
  if (month === 3) return 16;
  return 15;
}
function ymdParts(dateStr){
  const [y,m,d] = (dateStr || '').split('-').map(Number);
  return {y, m, d};
}
function ymFromParts(y,m){
  while(m < 1){ y -= 1; m += 12; }
  while(m > 12){ y += 1; m -= 12; }
  return `${y}-${pad(m)}`;
}
function addMonthsToYm(ym, delta){
  const [y,m] = ym.split('-').map(Number);
  return ymFromParts(y, m + delta);
}
function payrollMonthOf(dateStr){
  const {y,m,d} = ymdParts(dateStr);
  if(!y || !m || !d) return '';
  return d <= cutoffDay(y,m) ? ymFromParts(y,m) : ymFromParts(y,m+1);
}
function payrollPeriod(ym){
  const [y,m] = ym.split('-').map(Number);
  const prevYm = addMonthsToYm(ym, -1);
  const [py,pm] = prevYm.split('-').map(Number);
  const startDay = cutoffDay(py, pm) + 1;
  const endDay = cutoffDay(y, m);
  return {start:`${py}-${pad(pm)}-${pad(startDay)}`, end:`${y}-${pad(m)}-${pad(endDay)}`};
}
function formatDateJP(dateStr){
  const {y,m,d}=ymdParts(dateStr);
  return `${y}年${m}月${d}日`;
}

function loadState(){
  for (const key of [LS_KEY, 'taxiPayPwaStateV4', 'taxiPayPwaStateV3', 'taxiPayPwaStateV2', 'taxiPayPwaStateV1']) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved) return {...structuredClone(DEFAULT_STATE), ...saved, settings:{...DEFAULT_STATE.settings, ...(saved.settings||{})}};
    } catch {}
  }
  return structuredClone(DEFAULT_STATE);
}
function migrateState(){
  delete state.settings.baseHourly;
  delete state.settings.basePay;
  delete state.settings.overtimeHourly;
  delete state.settings.overtimePremiumRate;
  delete state.settings.bands;
  delete state.settings.standardHours;
  state.settings = {...DEFAULT_STATE.settings, ...state.settings};
  state.entries = (state.entries || []).map(e => {
    const totalBreak = Number(e.breakMinutes || 0);
    const normalBreak = e.normalBreakMinutes !== undefined ? Number(e.normalBreakMinutes || 0) : totalBreak;
    const nightBreak = e.nightBreakMinutes !== undefined ? Number(e.nightBreakMinutes || 0) : 0;
    const copy = {...e, normalBreakMinutes: normalBreak, nightBreakMinutes: nightBreak};
    delete copy.breakMinutes;
    delete copy.nightMinutes;
    return copy;
  });
  saveState();
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function num(id){ return Number($(id)?.value || 0); }
function minutesToHHMM(min){
  min = Math.max(0, Math.round(min || 0));
  return `${Math.floor(min/60)}時間${pad(min%60)}分`;
}
function minutesToClock(min){
  min = Math.max(0, Math.round(min || 0));
  return `${Math.floor(min/60)}:${pad(min%60)}`;
}
function monthOf(date){ return (date || '').slice(0,7); }
function shiftRule(){ return SHIFT_RULES[state.settings.shiftType] || SHIFT_RULES['隔日勤務']; }
function minutesBetween(start, end){
  if(!start || !end) return 0;
  const [sh,sm]=start.split(':').map(Number), [eh,em]=end.split(':').map(Number);
  let s=sh*60+sm, e=eh*60+em; if(e < s) e += 24*60; return e-s;
}
function overlapMinutes(startA, endA, startB, endB){
  return Math.max(0, Math.min(endA,endB) - Math.max(startA,startB));
}
function rawNightMinutes(e){
  if(!e.startTime || !e.endTime) return 0;
  const [sh,sm]=e.startTime.split(':').map(Number), [eh,em]=e.endTime.split(':').map(Number);
  let s=sh*60+sm, end=eh*60+em; if(end < s) end += 1440;
  const night1 = overlapMinutes(s, end, 22*60, 29*60);   // 22:00-翌5:00
  const night0 = overlapMinutes(s, end, 0, 5*60);       // 同日0:00-5:00用
  return night0 + night1;
}
function totalBreakMinutes(e){ return Number(e.normalBreakMinutes || 0) + Number(e.nightBreakMinutes || 0); }
function nightMinutes(e){ return Math.max(0, rawNightMinutes(e) - Number(e.nightBreakMinutes || 0)); }
function workMinutes(e){ return Math.max(0, minutesBetween(e.startTime, e.endTime) - totalBreakMinutes(e)); }
function currentEntries(){ const ym=$('currentMonth').value; return state.entries.filter(e => payrollMonthOf(e.date) === ym).sort((a,b)=>a.date.localeCompare(b.date)); }
function unitWage(payRevenue, totalWorkMin){
  const hours = totalWorkMin / 60;
  return hours > 0 ? payRevenue / hours : 0;
}
function totals(entries=currentEntries()){
  const gross = entries.reduce((s,e)=>s+Number(e.grossRevenue||0),0);
  const net = entries.reduce((s,e)=>s+calcNetRevenue(Number(e.grossRevenue||0)),0);
  const wm = entries.reduce((s,e)=>s+workMinutes(e),0);
  const nightMin = entries.reduce((s,e)=>s+nightMinutes(e),0);
  const payRevenue = net * Number(state.settings.fareRevisionCoefficient || 1) * Number(state.settings.payRevenueCoefficient || 0.9585);
  const commissionA = payRevenue * Number(state.settings.commissionARate || 0) / 100;
  const threshold = Number(state.settings.commissionBThreshold || 0);
  const maxB = Number(state.settings.commissionBMax || payRevenue);
  const bBase = payRevenue >= threshold ? Math.max(0, Math.min(payRevenue, maxB) - threshold) : 0;
  const commissionB = bBase * Number(state.settings.commissionBRate || 0) / 100;
  const noAccidentCount = entries.filter(e=>!e.hasAccident).length;
  const noViolationCount = entries.filter(e=>!e.hasViolation).length;
  const allowances = Number(state.settings.modelWorkAllowance || 0)
    + noAccidentCount * Number(state.settings.accidentFreeAllowance || 0)
    + noViolationCount * Number(state.settings.violationFreeAllowance || 0);
  const monthlyStandardMin = shiftRule().monthlyMinutes;
  const overtimeMin = Math.max(0, wm - monthlyStandardMin);
  const over60Min = Math.max(0, overtimeMin - 60*60);
  const normalOverMin = Math.max(0, overtimeMin - over60Min);
  const statutoryHolidayMin = entries.filter(e=>e.holidayType==='statutory').reduce((s,e)=>s+workMinutes(e),0);
  const nonStatHolidayMin = entries.filter(e=>e.holidayType==='nonstatutory').reduce((s,e)=>s+workMinutes(e),0);
  const base = unitWage(payRevenue, wm);
  const overtimePremium = (normalOverMin/60) * base * (Number(state.settings.legalOvertimeRate||0)/100)
    + (over60Min/60) * base * (Number(state.settings.over60Rate||0)/100);
  const holidayPremium = (statutoryHolidayMin/60) * base * (Number(state.settings.statutoryHolidayRate||0)/100)
    + (nonStatHolidayMin/60) * base * (Number(state.settings.nonStatutoryHolidayRate||0)/100);
  const nightPremium = (nightMin/60) * base * (Number(state.settings.nightRate||0)/100);
  const premiumPay = overtimePremium + holidayPremium + nightPremium;
  const grossPay = commissionA + commissionB + allowances + premiumPay;
  const deductions = ['healthInsurance','pension','employmentInsurance','incomeTax','residentTax','otherDeduction'].reduce((s,k)=>s+Number(state.settings[k]||0),0);
  return {gross, net, wm, nightMin, payRevenue, commissionA, commissionB, allowances, overtimeMin, over60Min, premiumPay, grossPay, deductions, takeHome:grossPay-deductions};
}
function render(){
  updateReadOnlySettings();
  const t = totals(); const ym=$('currentMonth').value;
  $('reportTitle').textContent = `${ym.replace('-', '年')}月 給与シミュレーション`;
  const pp = payrollPeriod(ym);
  if ($('payPeriod')) $('payPeriod').textContent = `給与対象期間：${formatDateJP(pp.start)}〜${formatDateJP(pp.end)}（締め日：${formatDateJP(pp.end)}）`;
  $('sumGross').textContent = yen(t.gross); $('sumNet').textContent = yen(t.net);
  $('payRevenue').textContent = yen(t.payRevenue);
  $('commissionA').textContent = yen(t.commissionA);
  $('commissionB').textContent = yen(t.commissionB);
  $('allowances').textContent = yen(t.allowances);
  $('premiumPay').textContent = yen(t.premiumPay);
  $('grossPay').textContent = yen(t.grossPay); $('deductions').textContent = yen(t.deductions); $('takeHome').textContent = yen(t.takeHome);
  $('shiftCount').textContent = `${currentEntries().length}回`; $('workHours').textContent = minutesToHHMM(t.wm); $('overtimeHours').textContent = minutesToHHMM(t.overtimeMin); $('nightHours').textContent = minutesToHHMM(t.nightMin);
  renderEntries(); renderHistory();
}
function renderEntries(){
  const tbody = $('entriesTable').querySelector('tbody'); tbody.innerHTML='';
  for(const e of currentEntries()){
    const tr=document.createElement('tr');
    const holiday = e.holidayType==='statutory' ? '法定' : e.holidayType==='nonstatutory' ? '法定外' : '';
    tr.innerHTML = `<td>${e.date}</td><td>${yen(e.grossRevenue)}</td><td>${yen(calcNetRevenue(e.grossRevenue))}</td><td>${e.startTime||''}</td><td>${e.endTime||''}</td><td>${minutesToHHMM(e.normalBreakMinutes)}</td><td>${minutesToHHMM(e.nightBreakMinutes)}</td><td>${minutesToHHMM(workMinutes(e))}</td><td>${minutesToHHMM(nightMinutes(e))}</td><td>${holiday}</td><td>${e.hasAccident?'あり':''}</td><td>${e.hasViolation?'あり':''}</td><td class="no-print"><button class="ghost" data-edit="${e.id}">編集</button> <button class="danger" data-del="${e.id}">削除</button></td>`;
    tbody.appendChild(tr);
  }
}
function renderHistory(){
  const div=$('historyList'); div.innerHTML='';
  if(!state.history.length){ div.innerHTML='<p class="note">まだ給与締め履歴はありません。</p>'; return; }
  state.history.slice().reverse().forEach(h=>{
    const item=document.createElement('div'); item.className='history-item';
    item.innerHTML=`<strong>${h.month} 給与</strong><br>${h.periodStart && h.periodEnd ? `対象期間 ${h.periodStart}〜${h.periodEnd}<br>` : ''}税込営収 ${yen(h.gross)} / 税抜営収 ${yen(h.net)} / 算定営業収入 ${yen(h.payRevenue)} / 概算手取り ${yen(h.takeHome)} / 勤務 ${h.count}回`;
    div.appendChild(item);
  });
}
function updateReadOnlySettings(){
  const rule = shiftRule();
  if ($('standardShiftHoursDisplay')) $('standardShiftHoursDisplay').value = minutesToHHMM(rule.shiftMinutes);
  if ($('standardHoursDisplay')) $('standardHoursDisplay').value = minutesToHHMM(rule.monthlyMinutes);
}
function loadSettingsToForm(){
  Object.entries(state.settings).forEach(([k,v])=>{ if($(k)) $(k).value = v; });
  updateReadOnlySettings();
}
function saveSettingsFromForm(){
  ['shiftType'].forEach(k=>state.settings[k]=$(k).value);
  ['taxRate','fareRevisionCoefficient','payRevenueCoefficient','commissionARate','commissionBRate','commissionBThreshold','commissionBMax','modelWorkAllowance','accidentFreeAllowance','violationFreeAllowance','legalOvertimeRate','scheduledOvertimeRate','over60Rate','statutoryHolidayRate','nonStatutoryHolidayRate','nightRate','healthInsurance','pension','employmentInsurance','incomeTax','residentTax','otherDeduction'].forEach(k=>state.settings[k]=num(k));
  saveState(); render(); alert('設定を保存しました。');
}
function calcNetRevenue(gross){
  return Math.round(Number(gross || 0) / (1 + Number(state.settings.taxRate || 0) / 100));
}
function updateNetRevenueDisplay(){
  if($('netRevenue')) $('netRevenue').value = $('grossRevenue').value ? calcNetRevenue(num('grossRevenue')) : '';
}
function readNormalBreakMinutes(){
  return Math.max(0, num('normalBreakHours') * 60 + num('normalBreakMinutePart'));
}
function readNightBreakMinutes(){
  return Math.max(0, num('nightBreakHours') * 60 + num('nightBreakMinutePart'));
}
function setNormalBreakInputs(minutes){
  minutes = Math.max(0, Number(minutes || 0));
  $('normalBreakHours').value = Math.floor(minutes / 60);
  $('normalBreakMinutePart').value = minutes % 60;
}
function setNightBreakInputs(minutes){
  minutes = Math.max(0, Number(minutes || 0));
  $('nightBreakHours').value = Math.floor(minutes / 60);
  $('nightBreakMinutePart').value = minutes % 60;
}

$('entryForm').addEventListener('submit', ev=>{
  ev.preventDefault();
  const gross=num('grossRevenue');
  const net = calcNetRevenue(gross);
  const entry = {
    id:$('editingId').value || crypto.randomUUID(), date:$('date').value, grossRevenue:gross, netRevenue:net,
    startTime:$('startTime').value, endTime:$('endTime').value, normalBreakMinutes:readNormalBreakMinutes(),
    nightBreakMinutes:readNightBreakMinutes(), holidayType:$('holidayType').value,
    hasAccident:$('hasAccident').checked, hasViolation:$('hasViolation').checked, memo:$('memo').value
  };
  state.entries = state.entries.filter(e=>e.id!==entry.id).concat(entry);
  saveState(); clearEntryForm(); render();
});
function clearEntryForm(){
  $('entryForm').reset(); $('date').value=today(); setNormalBreakInputs(120); setNightBreakInputs(60); $('netRevenue').value=''; $('editingId').value=''; $('holidayType').value='normal'; $('hasAccident').checked=false; $('hasViolation').checked=false;
}
$('entriesTable').addEventListener('click', ev=>{
  const edit=ev.target.dataset.edit, del=ev.target.dataset.del;
  if(edit){
    const e=state.entries.find(x=>x.id===edit);
    ['date','grossRevenue','startTime','endTime','memo'].forEach(k=>$(k).value=e[k]??'');
    updateNetRevenueDisplay();
    setNormalBreakInputs(e.normalBreakMinutes || 0);
    setNightBreakInputs(e.nightBreakMinutes || 0);
    $('holidayType').value=e.holidayType || 'normal'; $('hasAccident').checked=!!e.hasAccident; $('hasViolation').checked=!!e.hasViolation; $('editingId').value=e.id; scrollTo({top:0, behavior:'smooth'});
  }
  if(del && confirm('この日報を削除しますか？')){ state.entries=state.entries.filter(e=>e.id!==del); saveState(); render(); }
});
$('saveSettings').onclick=saveSettingsFromForm;
$('shiftType').addEventListener('change', ()=>{ state.settings.shiftType = $('shiftType').value; updateReadOnlySettings(); render(); });
$('toggleAdmin').onclick=()=>{
  const panel = $('adminSettings');
  const willShow = panel.classList.contains('hidden');
  if(willShow){
    const code = prompt('管理者設定を表示します。管理者コードを入力してください。初期コードは 0000 です。');
    if(code !== '0000') return;
  }
  panel.classList.toggle('hidden');
  panel.setAttribute('aria-hidden', panel.classList.contains('hidden') ? 'true' : 'false');
  $('toggleAdmin').textContent = panel.classList.contains('hidden') ? '管理者設定を表示' : '管理者設定を隠す';
};
$('resetForm').onclick=clearEntryForm;
$('printReport').onclick=()=>window.print();
$('exportCsv').onclick=()=>{
  const rows=[['日付','税込営収','税抜営収','出庫','帰庫','通常休憩','通常休憩分','深夜休憩','深夜休憩分','実働','実働分','深夜労働','深夜労働分','休日区分','事故あり','違反あり','メモ'], ...currentEntries().map(e=>[e.date,e.grossRevenue,calcNetRevenue(e.grossRevenue),e.startTime,e.endTime,minutesToHHMM(e.normalBreakMinutes),e.normalBreakMinutes,minutesToHHMM(e.nightBreakMinutes),e.nightBreakMinutes,minutesToHHMM(workMinutes(e)),workMinutes(e),minutesToHHMM(nightMinutes(e)),nightMinutes(e),e.holidayType||'normal',e.hasAccident?'1':'0',e.hasViolation?'1':'0',e.memo||''])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob=new Blob(['\ufeff'+csv], {type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`taxi-pay-payroll-${$('currentMonth').value}.csv`; a.click();
};
$('closeMonth').onclick=()=>{
  const entries=currentEntries(); if(!entries.length){ alert('給与締めする日報がありません。'); return; }
  const ym=$('currentMonth').value;
  const pp = payrollPeriod(ym);
  if(!confirm(`${ym} 給与（対象期間：${pp.start}〜${pp.end}）を給与締めします。履歴に保存し、この給与対象期間の日報を削除します。設定は残ります。`)) return;
  const t=totals(entries); state.history.push({month:ym, periodStart:pp.start, periodEnd:pp.end, gross:t.gross, net:t.net, payRevenue:t.payRevenue, takeHome:t.takeHome, grossPay:t.grossPay, count:entries.length, closedAt:new Date().toISOString()});
  state.entries=state.entries.filter(e=>payrollMonthOf(e.date)!==ym); saveState(); render(); alert('給与締めが完了しました。');
};
$('prevMonth').onclick=()=>{ $('currentMonth').value=addMonthsToYm($('currentMonth').value, -1); render(); };
$('nextMonth').onclick=()=>{ $('currentMonth').value=addMonthsToYm($('currentMonth').value, 1); render(); };
$('grossRevenue').addEventListener('input', updateNetRevenueDisplay);
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
$('currentMonth').value=payrollMonthOf(today()); $('date').value=today(); loadSettingsToForm(); clearEntryForm(); render();
