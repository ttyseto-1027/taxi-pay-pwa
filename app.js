'use strict';
const LS_KEY='taxiPayPwaStateV10';
const OLD_KEYS=['taxiPayPwaStateV9','taxiPayPwaStateV8','taxiPayPwaStateV7','taxiPayPwaStateV6'];
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
  settings:{shiftType:'',taxRate:10,fareRevisionCoefficient:1,payRevenueCoefficient:0.9585,modelWorkAllowance:3000,accidentFreeAllowance:700,violationFreeAllowance:200,healthInsurance:0,pension:0,employmentInsurance:0,residentTax:0,unionFee:0,mutualAidFee:0,otherDeduction:0,dependentCount:0,withholdingCategory:'A',paidLeaveDailyRate:0,paidLeaveOpeningBalance:0,paidLeaveNextGrantDate:'',paidLeaveNextGrantDays:0,paidLeaveAppliedGrants:[],paidLeaveUsageHistory:[],deductionHistory:[],additionalPayments:[],minimumWageHistory:[{region:'東京都',hourlyRate:1226,effectiveFrom:'2025-10-03',effectiveTo:''}],statutoryOvertimeRate:25,scheduledOvertimeRate:25,over60Rate:50,statutoryHolidayRate:35,nonStatutoryHolidayRate:25,nightRate:25},
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
  try{const s=mergeDeep(DEFAULT_STATE,raw?JSON.parse(raw):{});s.entries=(s.entries||[]).map(e=>({...e,clockIn:e.clockIn||'',clockOut:e.clockOut||'',normalBreakMinutes:Number(e.normalBreakMinutes||0),nightBreakMinutes:Number(e.nightBreakMinutes||0),holidayType:e.holidayType||'normal',hadAccident:!!e.hadAccident,hadViolation:!!e.hadViolation,paidLeaveUnits:Number(e.paidLeaveUnits||0)}));return s;}catch{return clone(DEFAULT_STATE);}
}
let state=loadState();
function saveState(){localStorage.setItem(LS_KEY,JSON.stringify(state));}
function leaveUnits(e){return Number(e?.paidLeaveUnits||0);}
function leaveLabel(n){return Number(n)===1?'1有給':Number(n)===2?'2有給':'通常勤務';}
function isKakuShift(){const t=state.settings.shiftType||'';return t==='隔日勤務'||t.startsWith('定隔');}
function paidLeaveMinutes(n){n=Number(n||0);if(!n)return 0;return isKakuShift()?(n===1?450:855):450*n;}
function paidLeaveShiftCredit(e){const n=leaveUnits(e);return n?(isKakuShift()?n/2:n):0;}
function addOneYearISO(s){if(!s)return '';const [y,m,d]=s.split('-').map(Number),x=new Date(y+1,m-1,d);return fmtDate(x);}
function applyDuePaidLeaveGrant(){const st=state.settings,date=st.paidLeaveNextGrantDate,days=Number(st.paidLeaveNextGrantDays||0);if(!date||days<=0||date>today())return false;st.paidLeaveAppliedGrants=Array.isArray(st.paidLeaveAppliedGrants)?st.paidLeaveAppliedGrants:[];if(!st.paidLeaveAppliedGrants.some(x=>x.date===date))st.paidLeaveAppliedGrants.push({date,days,appliedAt:new Date().toISOString()});st.paidLeaveNextGrantDate=addOneYearISO(date);saveState();return true;}
function paidLeaveBalance(excludeId=''){const st=state.settings,grants=(st.paidLeaveAppliedGrants||[]).reduce((a,x)=>a+Number(x.days||0),0),closed=(st.paidLeaveUsageHistory||[]).reduce((a,x)=>a+Number(x.days||0),0),open=(state.entries||[]).filter(e=>e.id!==excludeId).reduce((a,e)=>a+leaveUnits(e),0);return Math.max(0,Number(st.paidLeaveOpeningBalance||0)+grants-closed-open);}
function setPaidLeaveMode(){const n=Number(document.querySelector('input[name="paidLeaveType"]:checked')?.value||0),leave=n>0;for(const id of ['grossRevenue','clockIn','clockOut','holidayType','normalBreakHours','normalBreakMinutes','nightBreakHours','nightBreakMinutes','hadAccident','hadViolation']){const el=$(id);if(!el)continue;el.disabled=leave;if(leave){if(el.type==='checkbox')el.checked=false;else if(el.tagName==='SELECT')el.selectedIndex=0;else el.value='';}}$('netRevenue').value='';const editingId=$('editingId').value||'';$('paidLeaveEntryNote').textContent=leave?`${leaveLabel(n)}を使用します。保存後の残数：${Math.max(0,paidLeaveBalance(editingId)-n)}日`:`通常勤務です。有給残数：${paidLeaveBalance(editingId)}日`;}
function renderPaidLeaveHistory(){const box=$('paidLeaveHistoryList');if(!box)return;const grants=(state.settings.paidLeaveAppliedGrants||[]).map(x=>({date:x.date,text:`${x.days}日付与`})),uses=(state.settings.paidLeaveUsageHistory||[]).map(x=>({date:x.periodEnd||x.closedAt?.slice(0,10)||'',text:`${x.days}日使用（${x.month}給与）`})),rows=[...grants,...uses].sort((a,b)=>b.date.localeCompare(a.date));box.innerHTML=rows.length?'<strong>付与・使用履歴</strong>'+rows.map(x=>`<div>${x.date}　${x.text}</div>`).join(''):'<span class="note">付与・使用履歴はまだありません。</span>';}

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
  if(leaveUnits(e)>0){const m=paidLeaveMinutes(leaveUnits(e));return {duration:m,work:m,night:0};}
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
  entries=entries.filter(e=>leaveUnits(e)===0);
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
function effectiveDeductionSettings(ym){
  const history=Array.isArray(state.settings.deductionHistory)?state.settings.deductionHistory:[];
  const row=history.filter(x=>x&&/^\d{4}-\d{2}$/.test(String(x.effectiveMonth||''))&&x.effectiveMonth<=ym).sort((a,b)=>String(b.effectiveMonth).localeCompare(String(a.effectiveMonth)))[0];
  if(row)return mergeDeep({effectiveMonth:ym,dependentCount:0,healthInsurance:0,pension:0,employmentInsurance:0,residentTax:0,unionFee:0,mutualAidFee:0,otherItems:[]},row);
  return {effectiveMonth:'legacy',dependentCount:Number(state.settings.dependentCount||0),healthInsurance:Number(state.settings.healthInsurance||0),pension:Number(state.settings.pension||0),employmentInsurance:Number(state.settings.employmentInsurance||0),residentTax:Number(state.settings.residentTax||0),unionFee:Number(state.settings.unionFee||0),mutualAidFee:Number(state.settings.mutualAidFee||0),otherItems:Number(state.settings.otherDeduction||0)>0?[{id:'legacy-other',name:'その他控除',amount:Number(state.settings.otherDeduction||0)}]:[]};
}
function minimumWageForDate(date){
  const rows=Array.isArray(state.settings.minimumWageHistory)?state.settings.minimumWageHistory:[];
  return rows.filter(x=>x&&x.effectiveFrom<=date&&(!x.effectiveTo||date<=x.effectiveTo)).sort((a,b)=>String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0]||{region:'東京都',hourlyRate:1226,effectiveFrom:'2025-10-03',effectiveTo:''};
}
function overlapMinutes(start,end,nightStartHour=22,nightEndHour=5){
  let total=0;const cursor=new Date(start);cursor.setHours(0,0,0,0);cursor.setDate(cursor.getDate()-1);
  const limit=new Date(end);limit.setDate(limit.getDate()+1);
  while(cursor<limit){
    const ns=new Date(cursor);ns.setHours(nightStartHour,0,0,0);
    const ne=new Date(cursor);ne.setDate(ne.getDate()+1);ne.setHours(nightEndHour,0,0,0);
    total+=Math.max(0,Math.min(end,ne)-Math.max(start,ns))/60000;
    cursor.setDate(cursor.getDate()+1);
  }
  return Math.min(Math.max(0,(end-start)/60000),total);
}
function calculateAdditionalPayment(item){
  if(item.type==='other')return {...item,totalMinutes:0,nightMinutes:0,regularMinutes:0,amount:Number(item.amount||0)};
  const start=new Date(item.startAt),end=new Date(item.endAt),rate=Number(item.hourlyRate||0);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||rate<0)return {...item,totalMinutes:0,nightMinutes:0,regularMinutes:0,amount:0};
  const totalMinutes=Math.round((end-start)/60000),nightMinutes=Math.round(overlapMinutes(start,end)),regularMinutes=Math.max(0,totalMinutes-nightMinutes);
  const amount=Math.round((regularMinutes/60)*rate+(nightMinutes/60)*rate*1.25);
  return {...item,totalMinutes,nightMinutes,regularMinutes,amount};
}
function additionalPaymentsForMonth(ym){
  return (Array.isArray(state.settings.additionalPayments)?state.settings.additionalPayments:[]).filter(x=>x&&x.date&&payrollMonthOf(x.date)===ym).map(calculateAdditionalPayment);
}
function totals(entries=currentEntries()){
  const actual=entries.filter(e=>leaveUnits(e)===0);
  const gross=actual.reduce((s,e)=>s+Number(e.grossRevenue||0),0),net=actual.reduce((s,e)=>s+calcNet(e.grossRevenue),0),revenue=monthlyRevenue(net),c=commission(revenue),rule=currentRule();
  const actualCompleted=actual.filter(e=>entryTimeInfo(e).work>=rule.shiftMinutes).length;
  const leaveCredit=entries.reduce((s,e)=>s+paidLeaveShiftCredit(e),0);
  const completedStandardShifts=actualCompleted+leaveCredit;
  const model=rule.modelAllowance&&completedStandardShifts>=rule.plannedShifts?Number(state.settings.modelWorkAllowance||0):0;
  const accidentFree=actual.filter(e=>!e.hadAccident).length*Number(state.settings.accidentFreeAllowance||0),violationFree=actual.filter(e=>!e.hadViolation).length*Number(state.settings.violationFreeAllowance||0);
  const paidLeaveDays=entries.reduce((s,e)=>s+leaveUnits(e),0);
  const allowances=model+accidentFree+violationFree,paidLeavePay=paidLeaveDays*Number(state.settings.paidLeaveDailyRate||0),premium=premiumCalculation(actual,c);
  const ym=$('currentMonth')?.value||today().slice(0,7),deductionSettings=effectiveDeductionSettings(ym),additionalPaymentItems=additionalPaymentsForMonth(ym);
  const hourlyPayments=additionalPaymentItems.filter(x=>x.type!=='other').reduce((sum,x)=>sum+Number(x.amount||0),0),otherPayments=additionalPaymentItems.filter(x=>x.type==='other').reduce((sum,x)=>sum+Number(x.amount||0),0),additionalPayments=hourlyPayments+otherPayments;
  const grossPay=c.total+premium.total+allowances+paidLeavePay+additionalPayments;
  const social=Number(deductionSettings.healthInsurance||0)+Number(deductionSettings.pension||0)+Number(deductionSettings.employmentInsurance||0);
  const incomeTax=incomeTax2026(Math.max(0,grossPay-social),deductionSettings.dependentCount,state.settings.withholdingCategory);
  const statutoryDeductions=social+incomeTax+Number(deductionSettings.residentTax||0),voluntaryDeductions=Number(deductionSettings.unionFee||0)+Number(deductionSettings.mutualAidFee||0),otherDeductions=(deductionSettings.otherItems||[]).reduce((sum,x)=>sum+Number(x.amount||0),0),deductions=statutoryDeductions+voluntaryDeductions+otherDeductions;
  return {gross,net,revenue,c,premium,model,completedStandardShifts,actualCompleted,leaveCredit,paidLeaveDays,accidentFree,violationFree,allowances,paidLeavePay,additionalPaymentItems,hourlyPayments,otherPayments,additionalPayments,grossPay,deductionSettings,social,incomeTax,statutoryDeductions,voluntaryDeductions,otherDeductions,deductions,takeHome:grossPay-deductions};
}
function populateShiftSelects(){for(const id of ['shiftType','onboardingShiftType']){const sel=$(id);sel.innerHTML='';for(const k of Object.keys(SHIFT_RULES)){const o=document.createElement('option');o.value=k;o.textContent=k;sel.appendChild(o);}}}
function ruleDescription(type){const r=SHIFT_RULES[type];if(!r)return '';const desc=r.family==='fixed'?`定時制・積算歩合率 ${r.rate.toFixed(2)}%（給与算定係数0.9585なし、歩合給Bなし）`:'通常勤務・累進歩合';return `<strong>${r.label}</strong><br>1乗務所定：${minutesText(r.shiftMinutes)}／月間所定：${minutesText(r.monthlyMinutes)}／所定乗務：${r.plannedShifts}回${r.equivalentDays?`（実質${r.equivalentDays}日相当）`:''}<br>${desc}`;}
function payRow(label,value){return `<div><span>${label}</span><strong>${yen(value)}</strong></div>`;}
function renderBreakdown(t){
  let html='<h4>積算歩合給</h4>';for(const [n,v] of t.c.names)html+=payRow(n,v);html+=payRow('積算歩合給計',t.c.total);
  html+='<h4>諸手当</h4>'+payRow('模範勤務手当',t.model)+payRow('無事故手当',t.accidentFree)+payRow('無違反手当',t.violationFree)+payRow('有休手当',t.paidLeavePay);
  html+='<h4>割増賃金</h4>'+payRow('所定時間外',t.premium.items.scheduled)+payRow('法定時間外（60時間以内）',t.premium.items.statutory)+payRow('月60時間超',t.premium.items.over60)+payRow('法定休日',t.premium.items.statutoryHoliday)+payRow('法定外休日',t.premium.items.nonStatutoryHoliday)+payRow('深夜',t.premium.items.night)+payRow('割増賃金計',t.premium.total);
  html+='<h4>追加支給・給与調整</h4>'+payRow('時給勤務分',t.hourlyPayments)+payRow('その他支給',t.otherPayments)+payRow('追加支給計',t.additionalPayments)+payRow('概算総支給',t.grossPay);
  html+='<h4>法定控除</h4>'+payRow('健康保険料',t.deductionSettings.healthInsurance)+payRow('厚生年金保険料',t.deductionSettings.pension)+payRow('雇用保険料',t.deductionSettings.employmentInsurance)+payRow('所得税（令和8年分・自動）',t.incomeTax)+payRow('住民税',t.deductionSettings.residentTax)+payRow('法定控除小計',t.statutoryDeductions);
  html+='<h4>任意控除</h4>'+payRow('組合費',t.deductionSettings.unionFee)+payRow('共済費',t.deductionSettings.mutualAidFee)+payRow('任意控除小計',t.voluntaryDeductions);
  html+='<h4>その他控除</h4>';for(const x of (t.deductionSettings.otherItems||[]))html+=payRow(x.name||'その他控除',x.amount);html+=payRow('その他控除小計',t.otherDeductions)+payRow('控除合計',t.deductions)+payRow('概算手取り',t.takeHome);
  html+=`<p class="note">所定労働達成 ${t.completedStandardShifts}/${currentRule().plannedShifts}乗務／総実働 ${minutesText(t.premium.work)}／深夜 ${minutesText(t.premium.night)}／歩合時間単価（概算） ${yen(t.premium.hourly)}</p>`;$('paySlipBreakdown').innerHTML=html;
}
function render(){const t=totals(),ym=$('currentMonth').value,pp=payrollPeriod(ym);$('headerShift').textContent=`勤務区分：${state.settings.shiftType||'未設定'}`;$('reportTitle').textContent=`${ym.replace('-','年')}月 給与シミュレーション`;$('payPeriod').textContent=`給与対象期間：${formatDateJP(pp.start)}〜${formatDateJP(pp.end)}`;$('sumGross').textContent=yen(t.gross);$('sumNet').textContent=yen(t.net);$('payRevenue').textContent=yen(t.revenue);$('commissionTotal').textContent=yen(t.c.total);$('premiumTotal').textContent=yen(t.premium.total);$('allowances').textContent=yen(t.allowances);$('paidLeavePay').textContent=yen(t.paidLeavePay);$('grossPay').textContent=yen(t.grossPay);$('incomeTaxResult').textContent=yen(t.incomeTax);$('deductions').textContent=yen(t.deductions);$('takeHome').textContent=yen(t.takeHome);$('shiftCount').textContent=`${currentEntries().filter(e=>leaveUnits(e)===0).length}回／有給${t.paidLeaveDays}日`;renderBreakdown(t);renderEntries();renderHistory();updateSettingsViews();}
function holidayLabel(v){return v==='statutory'?'法定休日':v==='nonstatutory'?'法定外休日':'通常';}
function renderEntries(){const body=$('entriesTable').querySelector('tbody');body.innerHTML='';for(const e of currentEntries()){const t=entryTimeInfo(e),leave=leaveUnits(e)>0,tr=document.createElement('tr');tr.innerHTML=`<td>${e.date}</td><td>${leave?'—':yen(e.grossRevenue)}</td><td>${leave?'—':(e.clockIn||'—')}</td><td>${leave?'—':(e.clockOut||'—')}</td><td>${minutesText(t.work)}</td><td>${minutesText(t.night)}</td><td>${leave?leaveLabel(leaveUnits(e)):holidayLabel(e.holidayType)}</td><td class="no-print"><button class="ghost" data-edit="${e.id}">編集</button> <button class="danger" data-del="${e.id}">削除</button></td>`;body.appendChild(tr);}}
function renderHistory(){const d=$('historyList');d.innerHTML='';if(!state.history.length){d.innerHTML='<p class="note">まだ給与締め履歴はありません。</p>';return;}for(const h of state.history.slice().reverse()){const x=document.createElement('div');x.className='history-item';x.innerHTML=`<strong>${h.month}給与（${h.shiftType}）</strong><br>対象期間 ${h.periodStart}〜${h.periodEnd}<br>税込営収 ${yen(h.gross)}／積算歩合給 ${yen(h.commission)}／概算手取り ${yen(h.takeHome)}／${h.count}乗務／有給${Number(h.paidLeaveDays||0)}日`;d.appendChild(x);}}
function updateSettingsViews(){const r=currentRule();$('shiftRuleInfo').innerHTML=ruleDescription(state.settings.shiftType);$('taxRateDisplay').value=`${state.settings.taxRate}%`;$('standardShiftHoursDisplay').value=minutesText(r.shiftMinutes);$('standardHoursDisplay').value=minutesText(r.monthlyMinutes);if($('paidLeaveCurrentBalance'))$('paidLeaveCurrentBalance').value=`${paidLeaveBalance()}日`;renderPaidLeaveHistory();}
function loadSettingsForm(){for(const k of Object.keys(state.settings))if($(k))$(k).value=state.settings[k];$('shiftType').value=state.settings.shiftType;updateSettingsViews();}
function saveSettingsForm(){const nums=['healthInsurance','pension','employmentInsurance','residentTax','unionFee','mutualAidFee','otherDeduction','dependentCount','paidLeaveDailyRate','paidLeaveOpeningBalance','paidLeaveNextGrantDays'];state.settings.shiftType=$('shiftType').value;for(const k of nums)state.settings[k]=Number($(k).value||0);state.settings.paidLeaveNextGrantDate=$('paidLeaveNextGrantDate').value;state.settings.withholdingCategory=$('withholdingCategory').value;saveState();applyDuePaidLeaveGrant();render();}
const ADMIN_FIELDS=['fareRevisionCoefficient','payRevenueCoefficient','taxRate','modelWorkAllowance','accidentFreeAllowance','violationFreeAllowance','statutoryOvertimeRate','scheduledOvertimeRate','over60Rate','statutoryHolidayRate','nonStatutoryHolidayRate','nightRate'];
function loadAdminForm(){for(const k of ADMIN_FIELDS)$(k).value=state.settings[k];}
function saveAdminForm(){for(const k of ADMIN_FIELDS)state.settings[k]=Number($(k).value||0);saveState();render();}
function breakValue(prefix){return Number($(prefix+'Hours').value||0)*60+Number($(prefix+'Minutes').value||0);}
function fillNumberSelect(id,max){const select=$(id);select.innerHTML='';for(let i=0;i<=max;i++){const option=document.createElement('option');option.value=String(i);option.textContent=String(i).padStart(2,'0');select.appendChild(option);}}
function initBreakPickers(){fillNumberSelect('normalBreakHours',24);fillNumberSelect('normalBreakMinutes',59);fillNumberSelect('nightBreakHours',24);fillNumberSelect('nightBreakMinutes',59);}
function setBreak(prefix,total){const minutes=Math.max(0,Number(total||0));$(prefix+'Hours').value=String(Math.min(24,Math.floor(minutes/60)));$(prefix+'Minutes').value=String(Math.min(59,minutes%60));}
function clearEntry(){$('entryForm').reset();$('date').value=today();setBreak('normalBreak',0);setBreak('nightBreak',0);$('editingId').value='';$('netRevenue').value='';const normal=document.querySelector('input[name="paidLeaveType"][value="0"]');if(normal)normal.checked=true;setPaidLeaveMode();}
function updateNet(){const v=Number($('grossRevenue').value||0);$('netRevenue').value=v?calcNet(v).toLocaleString('ja-JP'):'';}
function validateEntry(e){const t=entryTimeInfo(e);if(!e.clockIn||!e.clockOut)return '出勤・退勤時刻を入力してください。';if(t.duration<=0)return '勤務時間を確認してください。';if(e.normalBreakMinutes+e.nightBreakMinutes>t.duration)return '休憩時間が拘束時間を超えています。';if(t.work<=0)return '実働時間が0以下です。';return '';}

initBreakPickers();populateShiftSelects();$('currentMonth').value=payrollMonthOf(today());clearEntry();
$('grossRevenue').addEventListener('input',updateNet);document.querySelectorAll('input[name="paidLeaveType"]').forEach(x=>x.addEventListener('change',setPaidLeaveMode));
$('entryForm').addEventListener('submit',ev=>{ev.preventDefault();const paidLeaveUnits=Number(document.querySelector('input[name="paidLeaveType"]:checked')?.value||0),id=$('editingId').value||crypto.randomUUID();if(paidLeaveUnits>0){if(!$('date').value)return alert('勤務日を入力してください。');if(paidLeaveUnits>paidLeaveBalance($('editingId').value||''))return alert(`有給残数が不足しています。現在使用可能：${paidLeaveBalance($('editingId').value||'')}日`);const entry={id,date:$('date').value,paidLeaveUnits,grossRevenue:0,clockIn:'',clockOut:'',normalBreakMinutes:0,nightBreakMinutes:0,holidayType:'normal',hadAccident:false,hadViolation:false};state.entries=state.entries.filter(x=>x.id!==id).concat(entry);saveState();clearEntry();render();return;}const gross=Number($('grossRevenue').value||0);if(gross<=0)return alert('税込営収を入力してください。');const entry={id,date:$('date').value,paidLeaveUnits:0,grossRevenue:gross,clockIn:$('clockIn').value,clockOut:$('clockOut').value,normalBreakMinutes:breakValue('normalBreak'),nightBreakMinutes:breakValue('nightBreak'),holidayType:$('holidayType').value,hadAccident:$('hadAccident').checked,hadViolation:$('hadViolation').checked};const err=validateEntry(entry);if(err)return alert(err);state.entries=state.entries.filter(x=>x.id!==id).concat(entry);saveState();clearEntry();render();});
$('resetForm').onclick=clearEntry;
$('entriesTable').addEventListener('click',ev=>{const edit=ev.target.dataset.edit,del=ev.target.dataset.del;if(edit){const e=state.entries.find(x=>x.id===edit);$('date').value=e.date;$('editingId').value=e.id;const radio=document.querySelector(`input[name="paidLeaveType"][value="${leaveUnits(e)}"]`);if(radio)radio.checked=true;if(leaveUnits(e)===0){$('grossRevenue').value=e.grossRevenue;$('clockIn').value=e.clockIn;$('clockOut').value=e.clockOut;setBreak('normalBreak',e.normalBreakMinutes);setBreak('nightBreak',e.nightBreakMinutes);$('holidayType').value=e.holidayType;$('hadAccident').checked=e.hadAccident;$('hadViolation').checked=e.hadViolation;updateNet();}setPaidLeaveMode();scrollTo({top:0,behavior:'smooth'});}if(del&&confirm('この勤務データを削除しますか？')){state.entries=state.entries.filter(x=>x.id!==del);saveState();render();}});
$('prevMonth').onclick=()=>{$('currentMonth').value=addMonths($('currentMonth').value,-1);render();};$('nextMonth').onclick=()=>{$('currentMonth').value=addMonths($('currentMonth').value,1);render();};$('currentMonth').onchange=render;$('printReport').onclick=()=>window.print();
$('exportCsv').onclick=()=>{const rows=[['勤務日','勤務区分','勤務・有給区分','有給日数','税込営収','税抜営収','出勤時刻（アルコール）','退勤時刻（アルコール）','通常休憩分','深夜休憩分','実働分','深夜労働分','休日区分'],...currentEntries().map(e=>{const t=entryTimeInfo(e),leave=leaveUnits(e);return[e.date,state.settings.shiftType,leaveLabel(leave),leave,leave?0:e.grossRevenue,leave?0:calcNet(e.grossRevenue),leave?'':e.clockIn,leave?'':e.clockOut,leave?0:e.normalBreakMinutes,leave?0:e.nightBreakMinutes,t.work,t.night,leave?'':holidayLabel(e.holidayType)]})];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download=`taxi-pay-${$('currentMonth').value}.csv`;a.click();};
$('closeMonth').onclick=()=>{const entries=currentEntries();if(!entries.length)return alert('給与締めするデータがありません。');const ym=$('currentMonth').value,pp=payrollPeriod(ym);if(!confirm(`${ym}給与を締めます。履歴保存後、この期間の勤務データは削除されます。`))return;const t=totals(entries);state.settings.paidLeaveUsageHistory=Array.isArray(state.settings.paidLeaveUsageHistory)?state.settings.paidLeaveUsageHistory:[];if(t.paidLeaveDays>0&&!state.settings.paidLeaveUsageHistory.some(x=>x.month===ym))state.settings.paidLeaveUsageHistory.push({month:ym,days:t.paidLeaveDays,periodStart:pp.start,periodEnd:pp.end,closedAt:new Date().toISOString()});state.history.push({month:ym,shiftType:state.settings.shiftType,periodStart:pp.start,periodEnd:pp.end,gross:t.gross,commission:t.c.total,takeHome:t.takeHome,count:entries.filter(e=>leaveUnits(e)===0).length,paidLeaveDays:t.paidLeaveDays,closedAt:new Date().toISOString()});state.entries=state.entries.filter(e=>payrollMonthOf(e.date)!==ym);saveState();render();};
$('openSettings').onclick=()=>{loadSettingsForm();$('settingsDialog').showModal();};$('shiftType').onchange=()=>{$('shiftRuleInfo').innerHTML=ruleDescription($('shiftType').value);const r=SHIFT_RULES[$('shiftType').value];$('standardShiftHoursDisplay').value=minutesText(r.shiftMinutes);$('standardHoursDisplay').value=minutesText(r.monthlyMinutes);};$('saveSettings').onclick=e=>{e.preventDefault();saveSettingsForm();$('settingsDialog').close();};
$('openAdmin').onclick=()=>{const p=prompt('開発者パスワードを入力してください。');if(p!==ADMIN_PASSWORD)return alert('パスワードが違います。');loadAdminForm();$('adminDialog').showModal();};$('saveAdmin').onclick=e=>{e.preventDefault();saveAdminForm();$('adminDialog').close();alert('開発者設定を保存しました。');};
$('onboardingShiftType').onchange=()=>{$('onboardingRule').innerHTML=ruleDescription($('onboardingShiftType').value);};$('completeOnboarding').onclick=e=>{e.preventDefault();if(!$('agreeDisclaimer').checked)return alert('確認欄にチェックしてください。');state.settings.shiftType=$('onboardingShiftType').value;state.initialized=true;saveState();$('onboardingDialog').close();render();};
applyDuePaidLeaveGrant();
// 診断版v4では古いキャッシュを避けるためService Workerを登録しない。
window.TaxiPayInlineDiagnostic?.add('V5-SW-SKIP','診断版のためService Worker登録を停止しています。');
function showOnboardingAfterLogin(){const dialog=$('onboardingDialog');if(!dialog||document.body.classList.contains('auth-pending'))return;if(!state.initialized||!SHIFT_RULES[state.settings.shiftType]){const first=Object.keys(SHIFT_RULES)[0];$('onboardingShiftType').value=first;$('onboardingRule').innerHTML=ruleDescription(first);if(!dialog.open)dialog.showModal();}else{if(dialog.open)dialog.close();loadSettingsForm();}}
window.addEventListener('taxipay:profile',showOnboardingAfterLogin);
showOnboardingAfterLogin();
render();

// Phase 3: 個人設定画面と既存給与計算を安全に連携する公開API。
// 認証処理には関与せず、端末内の既存state.settingsだけを更新する。
(() => {
  const PERSONAL_SETTING_KEYS = [
    'dependentCount', 'residentTax', 'unionFee', 'mutualAidFee', 'otherDeduction',
    'paidLeaveDailyRate', 'paidLeaveOpeningBalance', 'paidLeaveNextGrantDate',
    'paidLeaveNextGrantDays', 'paidLeaveAppliedGrants', 'paidLeaveUsageHistory',
    'deductionHistory', 'additionalPayments', 'minimumWageHistory'
  ];
  const numericKeys = new Set([
    'dependentCount', 'residentTax', 'unionFee', 'mutualAidFee', 'otherDeduction',
    'paidLeaveDailyRate', 'paidLeaveOpeningBalance', 'paidLeaveNextGrantDays'
  ]);
  function cleanPersonalSettings(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('設定データの形式が正しくありません。');
    const source = input.settings && typeof input.settings === 'object' ? input.settings : input;
    const output = {};
    for (const key of PERSONAL_SETTING_KEYS) {
      if (!(key in source)) continue;
      if (numericKeys.has(key)) {
        const value = Number(source[key]);
        if (!Number.isFinite(value) || value < 0) throw new Error(`${key}の値が正しくありません。`);
        output[key] = value;
      } else if (key === 'paidLeaveNextGrantDate') {
        const value = String(source[key] || '');
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('次回有給付与日の形式が正しくありません。');
        output[key] = value;
      } else if (Array.isArray(source[key])) {
        output[key] = clone(source[key]);
      }
    }
    if ('dependentCount' in output && (!Number.isInteger(output.dependentCount) || output.dependentCount > 20)) {
      throw new Error('扶養人数は0～20人の整数で入力してください。');
    }
    return output;
  }
  window.TaxiPayAppSettings = Object.freeze({
    get() { return clone(state.settings); },
    update(values) {
      const cleaned = cleanPersonalSettings(values);
      Object.assign(state.settings, cleaned);
      saveState();
      applyDuePaidLeaveGrant();
      render();
      window.dispatchEvent(new CustomEvent('taxipay:personal-settings-updated', { detail: clone(state.settings) }));
      return clone(state.settings);
    },
    getPaidLeaveBalance() { return paidLeaveBalance(); },
    exportPersonalSettings() {
      const settings = {};
      for (const key of PERSONAL_SETTING_KEYS) settings[key] = clone(state.settings[key]);
      return { format: 'taxi-pay-personal-settings', version: 1, exportedAt: new Date().toISOString(), settings };
    },
    importPersonalSettings(payload) {
      if (!payload || payload.format !== 'taxi-pay-personal-settings' || Number(payload.version) !== 1) {
        throw new Error('このアプリの設定ファイルではありません。');
      }
      const cleaned = cleanPersonalSettings(payload.settings);
      Object.assign(state.settings, cleaned);
      saveState();
      applyDuePaidLeaveGrant();
      render();
      window.dispatchEvent(new CustomEvent('taxipay:personal-settings-updated', { detail: clone(state.settings) }));
      return clone(state.settings);
    }
  });


// Phase 4: 控除履歴・追加支給を既存stateへ追加する後方互換API。
(() => {
  const cleanMoney=n=>{n=Number(n||0);if(!Number.isFinite(n)||n<0)throw new Error('金額を確認してください。');return n;};
  const id=()=>`p4-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  window.TaxiPayPhase4=Object.freeze({
    getSnapshot(ym){return {deduction:clone(effectiveDeductionSettings(ym)),deductionHistory:clone(state.settings.deductionHistory||[]),additionalPayments:clone(state.settings.additionalPayments||[]),minimumWageHistory:clone(state.settings.minimumWageHistory||[])};},
    getMinimumWage(date){return clone(minimumWageForDate(date));},
    getPaymentsForMonth(ym){return clone((state.settings.additionalPayments||[]).filter(x=>x&&x.date&&payrollMonthOf(x.date)===ym));},
    saveDeduction(values){
      const month=String(values.effectiveMonth||'');if(!/^\d{4}-\d{2}$/.test(month))throw new Error('適用年月を確認してください。');
      const row={effectiveMonth:month,dependentCount:Number(values.dependentCount||0),healthInsurance:cleanMoney(values.healthInsurance),pension:cleanMoney(values.pension),employmentInsurance:cleanMoney(values.employmentInsurance),residentTax:cleanMoney(values.residentTax),unionFee:cleanMoney(values.unionFee),mutualAidFee:cleanMoney(values.mutualAidFee),otherItems:(Array.isArray(values.otherItems)?values.otherItems:[]).map(x=>({id:String(x.id||id()),name:String(x.name||'').trim()||'その他控除',amount:cleanMoney(x.amount)})),updatedAt:new Date().toISOString()};
      if(!Number.isInteger(row.dependentCount)||row.dependentCount<0||row.dependentCount>20)throw new Error('扶養人数は0～20人の整数で入力してください。');
      const rows=Array.isArray(state.settings.deductionHistory)?state.settings.deductionHistory.slice():[];const i=rows.findIndex(x=>x.effectiveMonth===month);if(i>=0)rows[i]=row;else rows.push(row);state.settings.deductionHistory=rows;saveState();render();window.dispatchEvent(new CustomEvent('taxipay:phase4-updated'));return clone(row);
    },
    addPayment(values){
      const type=String(values.type||'hourly'),date=String(values.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('対象日を確認してください。');
      let row={id:id(),type,date,category:String(values.category||''),memo:String(values.memo||'').trim(),createdAt:new Date().toISOString()};
      if(type==='other'){row.amount=cleanMoney(values.amount);row.name=String(values.name||'その他支給').trim()||'その他支給';}
      else{row.startAt=String(values.startAt||'');row.endAt=String(values.endAt||'');row.hourlyRate=cleanMoney(values.hourlyRate);const c=calculateAdditionalPayment(row);if(!c.totalMinutes)throw new Error('開始日時と終了日時を確認してください。');}
      const rows=Array.isArray(state.settings.additionalPayments)?state.settings.additionalPayments.slice():[];rows.push(row);state.settings.additionalPayments=rows;saveState();render();window.dispatchEvent(new CustomEvent('taxipay:phase4-updated'));return clone(row);
    },
    deletePayment(paymentId){state.settings.additionalPayments=(state.settings.additionalPayments||[]).filter(x=>x.id!==paymentId);saveState();render();window.dispatchEvent(new CustomEvent('taxipay:phase4-updated'));},
    calculatePayment(values){return clone(calculateAdditionalPayment(values));}
  });
})();
})();
