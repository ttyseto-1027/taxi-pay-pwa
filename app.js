'use strict';
const LS_KEY='taxiPayPwaStateV9';
const OLD_KEYS=['taxiPayPwaStateV8','taxiPayPwaStateV7','taxiPayPwaStateV6'];
const ADMIN_PASSWORD='TaxiPay-Dev-2026';

const SHIFT_RULES={
  '隔日勤務':{family:'regular',label:'隔日勤務',shiftMinutes:855,monthlyMinutes:10260,plannedShifts:12,modelAllowance:true,calc:'kaku'},
  '昼日勤':{family:'regular',label:'昼日勤',shiftMinutes:450,monthlyMinutes:9900,plannedShifts:22,modelAllowance:true,calc:'day'},
  '夜日勤':{family:'regular',label:'夜日勤',shiftMinutes:450,monthlyMinutes:9900,plannedShifts:22,modelAllowance:true,calc:'night'},
  '定隔10':{family:'fixed',label:'定隔10',shiftMinutes:855,monthlyMinutes:8550,plannedShifts:10,equivalentDays:20,rate:45.32,modelAllowance:false,display:'定隔積算歩合給'},
  '定隔8':{family:'fixed',label:'定隔8',shiftMinutes:855,monthlyMinutes:6840,plannedShifts:8,equivalentDays:16,rate:45.32,modelAllowance:false,display:'定隔積算歩合給'},
  '定隔4':{family:'fixed',label:'定隔4',shiftMinutes:855,monthlyMinutes:3420,plannedShifts:4,equivalentDays:8,rate:45.32,modelAllowance:false,display:'定隔積算歩合給'},
  '定昼20':{family:'fixed',label:'定昼20',shiftMinutes:450,monthlyMinutes:9000,plannedShifts:20,rate:49.92,modelAllowance:false,display:'定昼積算歩合給'},
  '定昼16':{family:'fixed',label:'定昼16',shiftMinutes:450,monthlyMinutes:7200,plannedShifts:16,rate:49.92,modelAllowance:false,display:'定昼積算歩合給'},
  '定昼8':{family:'fixed',label:'定昼8',shiftMinutes:450,monthlyMinutes:3600,plannedShifts:8,rate:49.92,modelAllowance:false,display:'定昼積算歩合給'},
  '定夜20':{family:'fixed',label:'定夜20',shiftMinutes:450,monthlyMinutes:9000,plannedShifts:20,rate:44.50,modelAllowance:false,display:'定夜積算歩合給'},
  '定夜16':{family:'fixed',label:'定夜16',shiftMinutes:450,monthlyMinutes:7200,plannedShifts:16,rate:44.50,modelAllowance:false,display:'定夜積算歩合給'},
  '定夜8':{family:'fixed',label:'定夜8',shiftMinutes:450,monthlyMinutes:3600,plannedShifts:8,rate:44.50,modelAllowance:false,display:'定夜積算歩合給'}
};

const DEFAULT_STATE={
  initialized:false,
  settings:{shiftType:'',taxRate:10,fareRevisionCoefficient:1,payRevenueCoefficient:0.9585,modelWorkAllowance:3000,accidentFreeAllowance:700,violationFreeAllowance:200,healthInsurance:0,pension:0,employmentInsurance:0,residentTax:0,unionFee:0,mutualAidFee:0,otherDeduction:0,dependentCount:0,withholdingCategory:'A',paidLeaveDays:0,paidLeaveDailyRate:0,statutoryOvertimeRate:25,scheduledOvertimeRate:25,over60Rate:50,statutoryHolidayRate:35,nonStatutoryHolidayRate:25,nightRate:25},
  entries:[],history:[]
};

const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const yen=n=>`${Math.round(Number(n||0)).toLocaleString('ja-JP')}円`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const minutesText=m=>`${Math.floor(Math.max(0,m)/60)}時間${pad(Math.round(Math.max(0,m)%60))}分`;
const round10=n=>Math.max(0,Math.round(Number(n||0)/10)*10);
function clone(x){return JSON.parse(JSON.stringify(x));}
function mergeDeep(base,obj){const out=clone(base);if(obj&&typeof obj==='object'){for(const [k,v] of Object.entries(obj)){if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object')out[k]=mergeDeep(out[k],v);else out[k]=v;}}return out;}
function loadState(){
  let raw=localStorage.getItem(LS_KEY);
  if(!raw){for(const key of OLD_KEYS){raw=localStorage.getItem(key);if(raw)break;}}
  try{const s=mergeDeep(DEFAULT_STATE,raw?JSON.parse(raw):{});s.entries=(s.entries||[]).map(e=>({...e,clockIn:e.clockIn||'',clockOut:e.clockOut||'',normalBreakMinutes:Number(e.normalBreakMinutes||0),nightBreakMinutes:Number(e.nightBreakMinutes||0),holidayType:e.holidayType||'normal',hadAccident:!!e.hadAccident,hadViolation:!!e.hadViolation}));return s;}catch{return clone(DEFAULT_STATE);}
}
let state=loadState();
function saveState(){localStorage.setItem(LS_KEY,JSON.stringify(state));}
function parseDate(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
function fmtDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function formatDateJP(s){const d=parseDate(s);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;}
function addMonths(ym,n){const [y,m]=ym.split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;}
function closeDay(year,month){return month===2?14:month===3?16:15;}
function payrollMonthOf(dateStr){const d=parseDate(dateStr),y=d.getFullYear(),m=d.getMonth()+1,day=d.getDate();if(day<=closeDay(y,m))return `${y}-${pad(m)}`;const nx=new Date(y,m,1);return `${nx.getFullYear()}-${pad(nx.getMonth()+1)}`;}
function payrollPeriod(ym){const [y,m]=ym.split('-').map(Number);const end=new Date(y,m-1,closeDay(y,m));const pm=new Date(y,m-2,1),start=new Date(pm.getFullYear(),pm.getMonth(),closeDay(pm.getFullYear(),pm.getMonth()+1)+1);return {start:fmtDate(start),end:fmtDate(end)};}
function currentRule(){return SHIFT_RULES[state.settings.shiftType]||SHIFT_RULES['隔日勤務'];}
function currentEntries(){const ym=$('currentMonth').value;return state.entries.filter(e=>payrollMonthOf(e.date)===ym).sort((a,b)=>a.date.localeCompare(b.date));}
function calcNet(gross){return Math.round(Number(gross||0)/(1+Number(state.settings.taxRate||0)/100));}
function monthlyRevenue(net){const r=currentRule(),fare=Number(state.settings.fareRevisionCoefficient||1);return r.family==='fixed'?net*fare:net*fare*Number(state.settings.payRevenueCoefficient||0.9585);}
function commission(revenue){
  const r=currentRule();let A=0,B=0,C=0,names=[];
  if(r.family==='fixed'){A=revenue*r.rate/100;return {A,B,C,total:A,names:[[r.display,A]]};}
  if(r.calc==='kaku'){A=revenue*.4144;B=Math.max(0,Math.min(revenue,1200000)-420000)*.1905;names=[['隔日歩合給A',A],['隔日歩合給B',B]];}
  if(r.calc==='day'){A=revenue*.458;B=Math.max(0,revenue-378000)*.1405;C=Math.max(0,revenue-748000)*.122;names=[['昼日勤歩合給A',A],['昼日勤歩合給B',B],['昼日勤歩合給C',C]];}
  if(r.calc==='night'){A=revenue*.3798;B=Math.max(0,Math.min(revenue,1200000)-420000)*.2095;names=[['夜日勤歩合給A',A],['夜日勤歩合給B',B]];}
  return {A,B,C,total:A+B+C,names};
}
function timeToMinutes(v){if(!v)return null;const [h,m]=v.split(':').map(Number);return h*60+m;}
function entryTimeInfo(e){
  const start=timeToMinutes(e.clockIn),out=timeToMinutes(e.clockOut);if(start===null||out===null)return {duration:0,work:0,night:0};
  let end=out;if(end<=start)end+=1440;const duration=end-start;
  const normalBreak=Number(e.normalBreakMinutes||0),nightBreak=Number(e.nightBreakMinutes||0);
  const work=Math.max(0,duration-normalBreak-nightBreak);
  let overlap=0;
  for(const [a,b] of [[1320,1740],[-120,300]]){overlap+=Math.max(0,Math.min(end,b)-Math.max(start,a));}
  const night=Math.max(0,Math.min(overlap,work)-nightBreak);
  return {duration,work,night};
}
function premiumCalculation(entries,c){
  const r=currentRule();let work=0,night=0,dailyExcess=0,statHoliday=0,nonStatHoliday=0,regularWork=0;
  for(const e of entries){const t=entryTimeInfo(e);work+=t.work;night+=t.night;if(e.holidayType==='statutory')statHoliday+=t.work;else if(e.holidayType==='nonstatutory')nonStatHoliday+=t.work;else{regularWork+=t.work;dailyExcess+=Math.max(0,t.work-r.shiftMinutes);}}
  const monthlyExcess=Math.max(0,regularWork-r.monthlyMinutes);
  const statutoryOT=Math.max(0,monthlyExcess);
  const scheduledOnly=Math.max(0,dailyExcess-statutoryOT);
  const over60=Math.max(0,statutoryOT-3600),statutoryUpTo60=Math.max(0,statutoryOT-over60);
  const hourly=work>0?c.total/(work/60):0;
  const s=state.settings;
  const items={
    scheduled:hourly*(scheduledOnly/60)*(Number(s.scheduledOvertimeRate)/100),
    statutory:hourly*(statutoryUpTo60/60)*(Number(s.statutoryOvertimeRate)/100),
    over60:hourly*(over60/60)*(Number(s.over60Rate)/100),
    statutoryHoliday:hourly*(statHoliday/60)*(Number(s.statutoryHolidayRate)/100),
    nonStatutoryHoliday:hourly*(nonStatHoliday/60)*(Number(s.nonStatutoryHolidayRate)/100),
    night:hourly*(night/60)*(Number(s.nightRate)/100)
  };
  return {work,night,dailyExcess,scheduledOnly,statutoryUpTo60,over60,statHoliday,nonStatHoliday,hourly,items,total:Object.values(items).reduce((a,b)=>a+b,0)};
}
function incomeTax2026(afterSocial,dependents,category){
  const x=Math.max(0,Math.floor(afterSocial)),dep=Math.max(0,Math.floor(dependents||0));
  if(category==='B'){
    let tax;
    if(x<105000)tax=x*.03063;
    else if(x<740000){const row=NTA_MONTHLY_TAX_2026.find(r=>x>=r[0]&&x<r[1]);tax=row?row[10]:0;}
    else if(x<1710000)tax=259200+(x-740000)*.4084;
    else tax=655400+(x-1710000)*.45945;
    return round10(tax);
  }
  const col=Math.min(dep,7)+2; // row: lo,hi, 0人(index2)..7人(index9),乙(index10)
  let tax=0;
  if(x<105000)tax=0;
  else if(x<740000){const row=NTA_MONTHLY_TAX_2026.find(r=>x>=r[0]&&x<r[1]);tax=row?row[col]:0;}
  else{
    const base={740000:[71680,65210,58750,52290,45810,39350,32890,26410],790000:[81890,75420,68960,62500,56020,49560,43100,36620],960000:[121820,115340,108880,102420,95940,89480,83020,76540],1710000:[374520,368040,361580,355120,348640,342180,335720,329240],2130000:[549440,542970,536500,530040,523570,517110,510640,504170],2170000:[571220,564750,558280,551820,545350,538880,532420,525950],2210000:[593000,586520,580060,573600,567120,560660,554200,547730],2250000:[614770,608300,601840,595380,588900,582440,575980,569500],3500000:[1125270,1118800,1112340,1105880,1099400,1092940,1086480,1080000]};
    const i=Math.min(dep,7);
    if(x<790000)tax=base[740000][i]+(x-740000)*.2042;
    else if(x<960000)tax=base[790000][i]+(x-790000)*.23483;
    else if(x<1710000)tax=base[960000][i]+(x-960000)*.33693;
    else if(x<2130000)tax=base[1710000][i]+(x-1710000)*.4084;
    else if(x<2170000)tax=base[2130000][i]+(x-2130000)*.4084;
    else if(x<2210000)tax=base[2170000][i]+(x-2170000)*.4084;
    else if(x<2250000)tax=base[2210000][i]+(x-2210000)*.4084;
    else if(x<3500000)tax=base[2250000][i]+(x-2250000)*.4084;
    else tax=base[3500000][i]+(x-3500000)*.45945;
  }
  tax=round10(tax);if(dep>7)tax=Math.max(0,tax-(dep-7)*1610);return tax;
}
function totals(entries=currentEntries()){
  const gross=entries.reduce((s,e)=>s+Number(e.grossRevenue||0),0),net=entries.reduce((s,e)=>s+calcNet(e.grossRevenue),0),revenue=monthlyRevenue(net),c=commission(revenue),rule=currentRule();
  const model=rule.modelAllowance&&entries.length?Number(state.settings.modelWorkAllowance||0):0;
  const accidentFree=entries.filter(e=>!e.hadAccident).length*Number(state.settings.accidentFreeAllowance||0),violationFree=entries.filter(e=>!e.hadViolation).length*Number(state.settings.violationFreeAllowance||0);
  const allowances=model+accidentFree+violationFree,paidLeavePay=Number(state.settings.paidLeaveDays||0)*Number(state.settings.paidLeaveDailyRate||0),premium=premiumCalculation(entries,c),grossPay=c.total+premium.total+allowances+paidLeavePay;
  const social=Number(state.settings.healthInsurance||0)+Number(state.settings.pension||0)+Number(state.settings.employmentInsurance||0);
  const incomeTax=incomeTax2026(Math.max(0,grossPay-social),state.settings.dependentCount,state.settings.withholdingCategory);
  const deductions=social+incomeTax+Number(state.settings.residentTax||0)+Number(state.settings.unionFee||0)+Number(state.settings.mutualAidFee||0)+Number(state.settings.otherDeduction||0);
  return {gross,net,revenue,c,premium,model,accidentFree,violationFree,allowances,paidLeavePay,grossPay,social,incomeTax,deductions,takeHome:grossPay-deductions};
}
function populateShiftSelects(){for(const id of ['shiftType','onboardingShiftType']){const sel=$(id);sel.innerHTML='';for(const k of Object.keys(SHIFT_RULES)){const o=document.createElement('option');o.value=k;o.textContent=k;sel.appendChild(o);}}}
function ruleDescription(type){const r=SHIFT_RULES[type];if(!r)return '';const desc=r.family==='fixed'?`定時制・積算歩合率 ${r.rate.toFixed(2)}%（給与算定係数0.9585なし、歩合給Bなし）`:'通常勤務・累進歩合';return `<strong>${r.label}</strong><br>1乗務所定：${minutesText(r.shiftMinutes)}／月間所定：${minutesText(r.monthlyMinutes)}／所定乗務：${r.plannedShifts}回${r.equivalentDays?`（実質${r.equivalentDays}日相当）`:''}<br>${desc}`;}
function payRow(label,value){return `<div><span>${label}</span><strong>${yen(value)}</strong></div>`;}
function renderBreakdown(t){let html='<h4>積算歩合給</h4>';for(const [n,v] of t.c.names)html+=payRow(n,v);html+=payRow('積算歩合給計',t.c.total);html+='<h4>諸手当</h4>'+payRow('模範勤務手当',t.model)+payRow('無事故手当',t.accidentFree)+payRow('無違反手当',t.violationFree);html+='<h4>割増賃金</h4>'+payRow('所定時間外',t.premium.items.scheduled)+payRow('法定時間外（60時間以内）',t.premium.items.statutory)+payRow('月60時間超',t.premium.items.over60)+payRow('法定休日',t.premium.items.statutoryHoliday)+payRow('法定外休日',t.premium.items.nonStatutoryHoliday)+payRow('深夜',t.premium.items.night)+payRow('割増賃金計',t.premium.total);html+='<h4>支給・控除</h4>'+payRow('有休手当',t.paidLeavePay)+payRow('概算総支給',t.grossPay)+payRow('所得税（令和8年分・自動）',t.incomeTax)+payRow('控除合計',t.deductions)+payRow('概算手取り',t.takeHome);html+=`<p class="note">総実働 ${minutesText(t.premium.work)}／深夜 ${minutesText(t.premium.night)}／歩合時間単価（概算） ${yen(t.premium.hourly)}</p>`;$('paySlipBreakdown').innerHTML=html;}
function render(){const t=totals(),ym=$('currentMonth').value,pp=payrollPeriod(ym);$('headerShift').textContent=`勤務区分：${state.settings.shiftType||'未設定'}`;$('reportTitle').textContent=`${ym.replace('-','年')}月 給与シミュレーション`;$('payPeriod').textContent=`給与対象期間：${formatDateJP(pp.start)}〜${formatDateJP(pp.end)}`;$('sumGross').textContent=yen(t.gross);$('sumNet').textContent=yen(t.net);$('payRevenue').textContent=yen(t.revenue);$('commissionTotal').textContent=yen(t.c.total);$('premiumTotal').textContent=yen(t.premium.total);$('allowances').textContent=yen(t.allowances);$('paidLeavePay').textContent=yen(t.paidLeavePay);$('grossPay').textContent=yen(t.grossPay);$('incomeTaxResult').textContent=yen(t.incomeTax);$('deductions').textContent=yen(t.deductions);$('takeHome').textContent=yen(t.takeHome);$('shiftCount').textContent=`${currentEntries().length}回`;renderBreakdown(t);renderEntries();renderHistory();updateSettingsViews();}
function holidayLabel(v){return v==='statutory'?'法定休日':v==='nonstatutory'?'法定外休日':'通常';}
function renderEntries(){const body=$('entriesTable').querySelector('tbody');body.innerHTML='';for(const e of currentEntries()){const t=entryTimeInfo(e),tr=document.createElement('tr');tr.innerHTML=`<td>${e.date}</td><td>${yen(e.grossRevenue)}</td><td>${e.clockIn||'—'}</td><td>${e.clockOut||'—'}</td><td>${minutesText(t.work)}</td><td>${minutesText(t.night)}</td><td>${holidayLabel(e.holidayType)}</td><td class="no-print"><button class="ghost" data-edit="${e.id}">編集</button> <button class="danger" data-del="${e.id}">削除</button></td>`;body.appendChild(tr);}}
function renderHistory(){const d=$('historyList');d.innerHTML='';if(!state.history.length){d.innerHTML='<p class="note">まだ給与締め履歴はありません。</p>';return;}for(const h of state.history.slice().reverse()){const x=document.createElement('div');x.className='history-item';x.innerHTML=`<strong>${h.month}給与（${h.shiftType}）</strong><br>対象期間 ${h.periodStart}〜${h.periodEnd}<br>税込営収 ${yen(h.gross)}／積算歩合給 ${yen(h.commission)}／概算手取り ${yen(h.takeHome)}／${h.count}乗務`;d.appendChild(x);}}
function updateSettingsViews(){const r=currentRule();$('shiftRuleInfo').innerHTML=ruleDescription(state.settings.shiftType);$('taxRateDisplay').value=`${state.settings.taxRate}%`;$('standardShiftHoursDisplay').value=minutesText(r.shiftMinutes);$('standardHoursDisplay').value=minutesText(r.monthlyMinutes);}
function loadSettingsForm(){for(const k of Object.keys(state.settings))if($(k))$(k).value=state.settings[k];$('shiftType').value=state.settings.shiftType;updateSettingsViews();}
function saveSettingsForm(){const nums=['healthInsurance','pension','employmentInsurance','residentTax','unionFee','mutualAidFee','otherDeduction','dependentCount','paidLeaveDays','paidLeaveDailyRate'];state.settings.shiftType=$('shiftType').value;for(const k of nums)state.settings[k]=Number($(k).value||0);state.settings.withholdingCategory=$('withholdingCategory').value;saveState();render();}
const ADMIN_FIELDS=['fareRevisionCoefficient','payRevenueCoefficient','taxRate','modelWorkAllowance','accidentFreeAllowance','violationFreeAllowance','statutoryOvertimeRate','scheduledOvertimeRate','over60Rate','statutoryHolidayRate','nonStatutoryHolidayRate','nightRate'];
function loadAdminForm(){for(const k of ADMIN_FIELDS)$(k).value=state.settings[k];}
function saveAdminForm(){for(const k of ADMIN_FIELDS)state.settings[k]=Number($(k).value||0);saveState();render();}
function breakValue(prefix){return Number($(prefix+'Hours').value||0)*60+Number($(prefix+'Minutes').value||0);}
function fillNumberSelect(id,max){const select=$(id);select.innerHTML='';for(let i=0;i<=max;i++){const option=document.createElement('option');option.value=String(i);option.textContent=String(i).padStart(2,'0');select.appendChild(option);}}
function initBreakPickers(){fillNumberSelect('normalBreakHours',24);fillNumberSelect('normalBreakMinutes',59);fillNumberSelect('nightBreakHours',24);fillNumberSelect('nightBreakMinutes',59);}
function setBreak(prefix,total){const minutes=Math.max(0,Number(total||0));$(prefix+'Hours').value=String(Math.min(24,Math.floor(minutes/60)));$(prefix+'Minutes').value=String(Math.min(59,minutes%60));}
function clearEntry(){$('entryForm').reset();$('date').value=today();setBreak('normalBreak',0);setBreak('nightBreak',0);$('editingId').value='';$('netRevenue').value='';}
function updateNet(){const v=Number($('grossRevenue').value||0);$('netRevenue').value=v?calcNet(v).toLocaleString('ja-JP'):'';}
function validateEntry(e){const t=entryTimeInfo(e);if(!e.clockIn||!e.clockOut)return '出勤・退勤時刻を入力してください。';if(t.duration<=0)return '勤務時間を確認してください。';if(e.normalBreakMinutes+e.nightBreakMinutes>t.duration)return '休憩時間が拘束時間を超えています。';if(t.work<=0)return '実働時間が0以下です。';return '';}

initBreakPickers();populateShiftSelects();$('currentMonth').value=payrollMonthOf(today());clearEntry();
$('grossRevenue').addEventListener('input',updateNet);
$('entryForm').addEventListener('submit',ev=>{ev.preventDefault();const gross=Number($('grossRevenue').value||0);if(gross<=0)return alert('税込営収を入力してください。');const id=$('editingId').value||crypto.randomUUID();const entry={id,date:$('date').value,grossRevenue:gross,clockIn:$('clockIn').value,clockOut:$('clockOut').value,normalBreakMinutes:breakValue('normalBreak'),nightBreakMinutes:breakValue('nightBreak'),holidayType:$('holidayType').value,hadAccident:$('hadAccident').checked,hadViolation:$('hadViolation').checked};const err=validateEntry(entry);if(err)return alert(err);state.entries=state.entries.filter(x=>x.id!==id).concat(entry);saveState();clearEntry();render();});
$('resetForm').onclick=clearEntry;
$('entriesTable').addEventListener('click',ev=>{const edit=ev.target.dataset.edit,del=ev.target.dataset.del;if(edit){const e=state.entries.find(x=>x.id===edit);$('date').value=e.date;$('grossRevenue').value=e.grossRevenue;$('clockIn').value=e.clockIn;$('clockOut').value=e.clockOut;setBreak('normalBreak',e.normalBreakMinutes);setBreak('nightBreak',e.nightBreakMinutes);$('holidayType').value=e.holidayType;$('hadAccident').checked=e.hadAccident;$('hadViolation').checked=e.hadViolation;$('editingId').value=e.id;updateNet();scrollTo({top:0,behavior:'smooth'});}if(del&&confirm('この勤務データを削除しますか？')){state.entries=state.entries.filter(x=>x.id!==del);saveState();render();}});
$('prevMonth').onclick=()=>{$('currentMonth').value=addMonths($('currentMonth').value,-1);render();};$('nextMonth').onclick=()=>{$('currentMonth').value=addMonths($('currentMonth').value,1);render();};$('currentMonth').onchange=render;$('printReport').onclick=()=>window.print();
$('exportCsv').onclick=()=>{const rows=[['勤務日','勤務区分','税込営収','税抜営収','出勤時刻（アルコール）','退勤時刻（アルコール）','通常休憩分','深夜休憩分','実働分','深夜労働分','休日区分'],...currentEntries().map(e=>{const t=entryTimeInfo(e);return[e.date,state.settings.shiftType,e.grossRevenue,calcNet(e.grossRevenue),e.clockIn,e.clockOut,e.normalBreakMinutes,e.nightBreakMinutes,t.work,t.night,holidayLabel(e.holidayType)]})];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download=`taxi-pay-${$('currentMonth').value}.csv`;a.click();};
$('closeMonth').onclick=()=>{const entries=currentEntries();if(!entries.length)return alert('給与締めするデータがありません。');const ym=$('currentMonth').value,pp=payrollPeriod(ym);if(!confirm(`${ym}給与を締めます。履歴保存後、この期間の勤務データは削除されます。`))return;const t=totals(entries);state.history.push({month:ym,shiftType:state.settings.shiftType,periodStart:pp.start,periodEnd:pp.end,gross:t.gross,commission:t.c.total,takeHome:t.takeHome,count:entries.length,closedAt:new Date().toISOString()});state.entries=state.entries.filter(e=>payrollMonthOf(e.date)!==ym);saveState();render();};
$('openSettings').onclick=()=>{loadSettingsForm();$('settingsDialog').showModal();};$('shiftType').onchange=()=>{$('shiftRuleInfo').innerHTML=ruleDescription($('shiftType').value);const r=SHIFT_RULES[$('shiftType').value];$('standardShiftHoursDisplay').value=minutesText(r.shiftMinutes);$('standardHoursDisplay').value=minutesText(r.monthlyMinutes);};$('saveSettings').onclick=e=>{e.preventDefault();saveSettingsForm();$('settingsDialog').close();};
$('openAdmin').onclick=()=>{const p=prompt('開発者パスワードを入力してください。');if(p!==ADMIN_PASSWORD)return alert('パスワードが違います。');loadAdminForm();$('adminDialog').showModal();};$('saveAdmin').onclick=e=>{e.preventDefault();saveAdminForm();$('adminDialog').close();alert('開発者設定を保存しました。');};
$('onboardingShiftType').onchange=()=>{$('onboardingRule').innerHTML=ruleDescription($('onboardingShiftType').value);};$('completeOnboarding').onclick=e=>{e.preventDefault();if(!$('agreeDisclaimer').checked)return alert('確認欄にチェックしてください。');state.settings.shiftType=$('onboardingShiftType').value;state.initialized=true;saveState();$('onboardingDialog').close();render();};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(!state.initialized||!SHIFT_RULES[state.settings.shiftType]){const first=Object.keys(SHIFT_RULES)[0];$('onboardingShiftType').value=first;$('onboardingRule').innerHTML=ruleDescription(first);$('onboardingDialog').showModal();}else loadSettingsForm();
render();
