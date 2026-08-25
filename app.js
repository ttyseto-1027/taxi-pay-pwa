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
  try{const s=mergeDeep(DEFAULT_STATE,raw?JSON.parse(raw):{});s.entries=(s.entries||[]).map(e=>{
      const legacyGross=Number(e.grossRevenue||0);
      const grossSales=Number(e.grossSales ?? e.reportedGrossRevenue ?? legacyGross);
      const otherPlus=Number(e.otherPlus||0);
      const otherMinus=Number(e.otherMinus||0);
      const idleA=Number(e.idleA ?? e.idleAdjustmentA ?? 0);
      const idleB=Number(e.idleB ?? e.idleAdjustmentB ?? 0);
      const adjustedGrossSales=Number(e.adjustedGrossSales ?? legacyGross);
      return {...e,
        grossSales,otherPlus,otherMinus,idleA,idleB,
        adjustedGrossSales,
        grossRevenue:adjustedGrossSales,
        clockIn:e.clockIn||'',clockOut:e.clockOut||'',
        normalBreakMinutes:Number(e.normalBreakMinutes||0),
        nightBreakMinutes:Number(e.nightBreakMinutes||0),
        holidayType:e.holidayType||'normal',
        hadAccident:!!e.hadAccident,hadViolation:!!e.hadViolation,
        paidLeaveUnits:Number(e.paidLeaveUnits||0)
      };
    });return s;}catch{return clone(DEFAULT_STATE);}
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
function setPaidLeaveMode(){const n=Number(document.querySelector('input[name="paidLeaveType"]:checked')?.value||0),leave=n>0;for(const id of ['grossRevenue','otherPlus','otherMinus','idleA','idleB','clockIn','clockOut','holidayType','hadAccident','hadViolation']){const el=$(id);if(!el)continue;el.disabled=leave;if(leave){if(el.type==='checkbox')el.checked=false;else if(el.tagName==='SELECT')el.selectedIndex=0;
else if(el.tagName==='BUTTON'){
  const span=el.querySelector('span');
  if(span)span.textContent=el.id.toLowerCase().includes('minutes')?'00':'0';
}else el.value='';}}document.querySelectorAll('[data-break-target]').forEach(btn=>{btn.disabled=leave;if(leave)setBreak(btn.dataset.breakTarget,0);});
if($('adjustedGrossRevenue'))$('adjustedGrossRevenue').value='';$('netRevenue').value='';const editingId=$('editingId').value||'';$('paidLeaveEntryNote').textContent=leave?`${leaveLabel(n)}を使用します。保存後の残数：${Math.max(0,paidLeaveBalance(editingId)-n)}日`:`通常勤務です。有給残数：${paidLeaveBalance(editingId)}日`;}
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
function payrollGross(e){return Number(e?.adjustedGrossSales ?? e?.grossRevenue ?? 0);}
function grossSalesOf(e){return Number(e?.grossSales ?? e?.reportedGrossRevenue ?? e?.grossRevenue ?? 0);}
function adjustmentValue(id){return Math.max(0,Number($(id)?.value||0));}
function calculateAdjustedGross(){
  const gross=Math.max(0,Number($('grossRevenue')?.value||0));
  const otherPlus=adjustmentValue('otherPlus');
  const otherMinus=adjustmentValue('otherMinus');
  const idleA=adjustmentValue('idleA');
  const idleB=adjustmentValue('idleB');
  return Math.max(0,gross+otherPlus-otherMinus-idleA-idleB);
}
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
  const gross=actual.reduce((s,e)=>s+payrollGross(e),0),net=actual.reduce((s,e)=>s+Math.round(calcNet(payrollGross(e))),0),revenue=monthlyRevenue(net),c=commission(revenue),rule=currentRule();
  const actualCompleted=actual.filter(e=>entryTimeInfo(e).work>=rule.shiftMinutes).length;
  const leaveCredit=entries.reduce((s,e)=>s+paidLeaveShiftCredit(e),0);
  const completedStandardShifts=actualCompleted+leaveCredit;
  const model=rule.modelAllowance&&completedStandardShifts>=rule.plannedShifts?Number(state.settings.modelWorkAllowance||0):0;
  const accidentFree=actual.filter(e=>!e.hadAccident).length*Number(state.settings.accidentFreeAllowance||0),violationFree=actual.filter(e=>!e.hadViolation).length*Number(state.settings.violationFreeAllowance||0);
  const paidLeaveDays=entries.reduce((s,e)=>s+leaveUnits(e),0);
  const allowances=model+accidentFree+violationFree,paidLeavePay=paidLeaveDays*Number(state.settings.paidLeaveDailyRate||0),premium=premiumCalculation(actual,c);
  const ym=$('currentMonth')?.value||today().slice(0,7),deductionSettings=effectiveDeductionSettings(ym),additionalPaymentItems=additionalPaymentsForMonth(ym);
  const hourlyPayments=additionalPaymentItems.filter(x=>x.type!=='other').reduce((sum,x)=>sum+Number(x.amount||0),0),otherPayments=additionalPaymentItems.filter(x=>x.type==='other').reduce((sum,x)=>sum+Number(x.amount||0),0),additionalPayments=hourlyPayments+otherPayments;
  const grossPay=Math.ceil(c.total+premium.total+allowances+paidLeavePay+additionalPayments);
  const social=Number(deductionSettings.healthInsurance||0)+Number(deductionSettings.pension||0)+Number(deductionSettings.employmentInsurance||0);
  const incomeTax=incomeTax2026(Math.max(0,grossPay-social),deductionSettings.dependentCount,state.settings.withholdingCategory);
  const statutoryDeductions=social+incomeTax+Number(deductionSettings.residentTax||0),voluntaryDeductions=Number(deductionSettings.unionFee||0)+Number(deductionSettings.mutualAidFee||0),otherDeductions=(deductionSettings.otherItems||[]).reduce((sum,x)=>sum+Number(x.amount||0),0),deductions=statutoryDeductions+voluntaryDeductions+otherDeductions;
  return {gross,net,revenue,c,premium,model,completedStandardShifts,actualCompleted,leaveCredit,paidLeaveDays,accidentFree,violationFree,allowances,paidLeavePay,additionalPaymentItems,hourlyPayments,otherPayments,additionalPayments,grossPay,deductionSettings,social,incomeTax,statutoryDeductions,voluntaryDeductions,otherDeductions,deductions,takeHome:grossPay-deductions};
}

const PHASE8_METRICS={
  gross:{label:'税込営収',unit:'円',value:r=>Number(r.gross||0)},
  grossPay:{label:'概算総支給',unit:'円',value:r=>Number(r.grossPay||0)},
  takeHome:{label:'概算手取り',unit:'円',value:r=>Number(r.takeHome||0)},
  takeHomeHourly:{label:'時間あたり手取り',unit:'円/時間',value:r=>Number(r.workMinutes||0)>0?Number(r.takeHome||0)/(Number(r.workMinutes)/60):0},
  effectiveReturn:{label:'実質還元率',unit:'%',value:r=>Number(r.gross||0)>0?Number(r.grossPay||0)/Number(r.gross)*100:0},
  takeHomeReturn:{label:'手取り還元率',unit:'%',value:r=>Number(r.gross||0)>0?Number(r.takeHome||0)/Number(r.gross)*100:0}
};
function phase8CurrentRow(){
  const t=totals(),entries=currentEntries(),actual=entries.filter(e=>leaveUnits(e)===0);
  return {month:$('currentMonth')?.value||today().slice(0,7),gross:t.gross,grossPay:t.grossPay,takeHome:t.takeHome,workMinutes:t.premium.work,breakMinutes:actual.reduce((s,e)=>s+Number(e.normalBreakMinutes||0)+Number(e.nightBreakMinutes||0),0),count:actual.length,inProgress:true};
}
function phase8Rows(){
  const map=new Map();
  for(const h of (Array.isArray(state.history)?state.history:[]))map.set(h.month,{...h,inProgress:false});
  const cur=phase8CurrentRow();map.set(cur.month,cur);
  return [...map.values()].filter(x=>x.month).sort((a,b)=>a.month.localeCompare(b.month));
}
function phase8FormatMetric(key,v){
  if(key==='effectiveReturn'||key==='takeHomeReturn')return `${Number(v||0).toFixed(1)}%`;
  return `${Math.round(Number(v||0)).toLocaleString('ja-JP')}${key==='takeHomeHourly'?'円/時':'円'}`;
}
function phase8PopulateMetrics(){
  const a=$('phase8Primary'),b=$('phase8Secondary');if(!a||!b)return;
  if(!a.options.length)for(const [k,m] of Object.entries(PHASE8_METRICS)){a.add(new Option(m.label,k));b.add(new Option(m.label,k));}
  if(!a.value)a.value='gross';if(!b.value)b.value='takeHome';
}
function phase8MetricIsAdditive(key){
  return ['gross','grossPay','takeHome'].includes(key);
}
function phase8SyncChartTypeAvailability(){
  const sel=$('phase8ChartType'); if(!sel)return;
  const period=$('phase8Period')?.value||'current';
  const dailyMode=window.phase8CustomActive||period==='current';
  const secondaryVisible=!!$('phase8SecondaryWrap') && !$('phase8SecondaryWrap').hidden;
  const primary=$('phase8Primary')?.value||'gross';
  const stacked=[...sel.options].find(o=>o.value==='stacked');

  const stackedAllowed=!dailyMode && !secondaryVisible && phase8MetricIsAdditive(primary);
  if(stacked)stacked.disabled=!stackedAllowed;
  if(!stackedAllowed && sel.value==='stacked')sel.value='bar';
}
function renderMonthlyDashboard(){
  phase8SyncChartTypeAvailability();
  if(!$('phase8Chart'))return;
  phase8PopulateMetrics();
  const current=phase8CurrentRow(),actual=current.count||0;
  $('monthlyGross').textContent=yen(current.gross);
  $('monthlyWorkHours').textContent=minutesText(current.workMinutes||0);
  $('monthlyBreakHours').textContent=minutesText(current.breakMinutes||0);
  $('monthlyAvgGross').textContent=yen(actual?current.gross/actual:0);
  $('monthlyGrossPerHour').textContent=yen(current.workMinutes?current.gross/(current.workMinutes/60):0);
  $('monthlyTakeHome').textContent=yen(current.takeHome);
  $('monthlyProgressNote').textContent=`${current.month.replace('-','年')}月は進行中のデータです。`;
  let rows=phase8Rows(),period=$('phase8Period')?.value||'12';
  let dailyAxis=false;
  if(window.phase8CustomActive){ rows=phase8CustomRows(); dailyAxis=true; }
  else if(period==='current'){ rows=phase8CurrentDailyRows(); dailyAxis=true; }
  else if(period!=='all') rows=rows.slice(-Number(period));
  if($('phase8PeriodLabel'))$('phase8PeriodLabel').textContent=dailyAxis?'日付':'月';
  const body=$('phase8TableBody');body.innerHTML='';
  for(const r of rows){const tr=document.createElement('tr'),tag=(!r.dailyAxis&&r.inProgress)?' <span class="phase8-progress">進行中</span>':'';tr.innerHTML=`<td>${r.month}${tag}</td><td>${yen(r.gross)}</td><td>${r.grossPay==null?'—':yen(r.grossPay)}</td><td>${yen(r.takeHome)}</td><td>${r.workMinutes?phase8FormatMetric('takeHomeHourly',PHASE8_METRICS.takeHomeHourly.value(r)):'—'}</td><td>${r.grossPay==null?'—':phase8FormatMetric('effectiveReturn',PHASE8_METRICS.effectiveReturn.value(r))}</td><td>${phase8FormatMetric('takeHomeReturn',PHASE8_METRICS.takeHomeReturn.value(r))}</td>`;body.appendChild(tr);}
  drawPhase8Chart(rows);
}
function phase8AllDailyEntries(){
  const byId=new Map();
  for(const e of (state.entries||[]))byId.set(e.id||`${e.date}|${Math.random()}`,e);
  for(const h of (state.history||[])){
    for(const e of (Array.isArray(h.dailyEntries)?h.dailyEntries:[]))byId.set(e.id||`${e.date}|${Math.random()}`,e);
  }
  return [...byId.values()].filter(e=>e?.date).sort((a,b)=>a.date.localeCompare(b.date));
}
function phase8EstimateForEntries(entries,label){
  const actual=entries.filter(e=>leaveUnits(e)===0);
  const gross=actual.reduce((s,e)=>s+payrollGross(e),0);
  const net=actual.reduce((s,e)=>s+Math.round(calcNet(payrollGross(e))),0);
  const revenue=monthlyRevenue(net),c=commission(revenue),premium=premiumCalculation(actual,c);
  const accidentFree=actual.filter(e=>!e.hadAccident).length*Number(state.settings.accidentFreeAllowance||0);
  const violationFree=actual.filter(e=>!e.hadViolation).length*Number(state.settings.violationFreeAllowance||0);
  const paidLeaveDays=entries.reduce((s,e)=>s+leaveUnits(e),0);
  const paidLeavePay=paidLeaveDays*Number(state.settings.paidLeaveDailyRate||0);
  const grossPay=Math.ceil(c.total+premium.total+accidentFree+violationFree+paidLeavePay);
  const workMinutes=actual.reduce((s,e)=>s+entryTimeInfo(e).work,0);
  return {month:label,gross,grossPay,takeHome:grossPay,workMinutes,count:actual.length,inProgress:true,custom:true};
}
function phase8CurrentDailyRows(){
  const ym=$('currentMonth')?.value||payrollMonthOf(today());
  const pp=payrollPeriod(ym);
  const entries=(state.entries||[])
    .filter(e=>e?.date && e.date>=pp.start && e.date<=pp.end)
    .slice()
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(!entries.length)return [];
  const groups=new Map();
  entries.forEach(e=>{if(!groups.has(e.date))groups.set(e.date,[]);groups.get(e.date).push(e);});
  return [...groups.entries()].map(([date,rows])=>{
    const r=phase8EstimateForEntries(rows,date.slice(5).replace('-','/'));
    r.date=date;
    r.dailyAxis=true;
    r.inProgress=true;
    return r;
  });
}
function phase8CustomRows(){
  const start=$('phase8StartDate')?.value||'',end=$('phase8EndDate')?.value||'';
  if(!start||!end||start>end)return [];
  const entries=phase8AllDailyEntries().filter(e=>e.date>=start&&e.date<=end);
  const groups=new Map();
  for(const e of entries){
    const key=e.date;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(e);
  }
  return [...groups.entries()].map(([date,rows])=>{const r=phase8EstimateForEntries(rows,date.slice(5).replace('-','/'));r.date=date;r.dailyAxis=true;return r;});
}
function phase8WorkdayColor(i){const hue=Math.round((i*137.508)%360);const light=42+(i%3)*8;return `hsl(${hue} 58% ${light}%)`;}
function phase8MonthlyWorkdaySegments(row,metricKey){
  if(!row?.month || row.dailyAxis)return [];
  const ym=row.month;
  const pp=payrollPeriod(ym);

  const byId=new Map();
  for(const e of (state.entries||[])){
    if(e?.date && e.date>=pp.start && e.date<=pp.end)byId.set(e.id||`${e.date}|${Math.random()}`,e);
  }
  for(const h of (state.history||[])){
    for(const e of (Array.isArray(h.dailyEntries)?h.dailyEntries:[])){
      if(e?.date && e.date>=pp.start && e.date<=pp.end)byId.set(e.id||`${e.date}|${Math.random()}`,e);
    }
  }

  const entries=[...byId.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const groups=new Map();
  entries.forEach(e=>{if(!groups.has(e.date))groups.set(e.date,[]);groups.get(e.date).push(e);});

  return [...groups.entries()].map(([date,dayEntries])=>{
    const day=phase8EstimateForEntries(dayEntries,date.slice(5).replace('-','/'));
    return {date,value:PHASE8_METRICS[metricKey].value(day)};
  });
}
function drawPhase8Chart(rows){
  const canvas=$('phase8Chart'),empty=$('phase8Empty');if(!canvas)return;
  const ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1,w=Math.max(320,canvas.parentElement.clientWidth||900),h=360;
  canvas.style.width=w+'px';canvas.style.height=h+'px';canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  if(!rows.length){empty.hidden=false;return;}empty.hidden=true;

  const primary=$('phase8Primary').value;
  const secondary=!$('phase8SecondaryWrap').hidden?$('phase8Secondary').value:null;
  const chartType=$('phase8ChartType')?.value||'line';
  const pMetric=PHASE8_METRICS[primary],sMetric=secondary?PHASE8_METRICS[secondary]:null;
  const pVals=rows.map(r=>pMetric.value(r));
  const sVals=secondary?rows.map(r=>sMetric.value(r)):[];
  const sameUnit=!!secondary && pMetric.unit===sMetric.unit;

  const pad={l:58,r:secondary&&!sameUnit?58:18,t:24,b:54},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  const pMoney=['gross','grossPay','takeHome'].includes(primary);
  const sMoney=secondary&&['gross','grossPay','takeHome'].includes(secondary);
  const pHourly=primary==='hourly', sHourly=secondary==='hourly';
  const pRate=['effectiveRate','takeHomeRate'].includes(primary);
  const sRate=secondary&&['effectiveRate','takeHomeRate'].includes(secondary);
  const moneyStep=20000, hourlyStep=1000, rateStep=20;
  const axisMax=(vals,isMoney,isHourly,isRate)=>{
    const raw=Math.max(1,...vals);
    if(isMoney)return Math.max(moneyStep,Math.ceil(raw/moneyStep)*moneyStep);
    if(isHourly)return Math.max(hourlyStep,Math.ceil(raw/hourlyStep)*hourlyStep);
    if(isRate)return Math.max(rateStep,Math.ceil(raw/rateStep)*rateStep);
    return raw*1.08;
  };
  let maxP=axisMax(pVals,pMoney,pHourly,pRate);
  let maxS=secondary?axisMax(sVals,sMoney,sHourly,sRate):1;

  // 積み上げ棒は、同じ単位の2系列だけ本当に積み上げる。
  // 第1軸のみなら通常の棒グラフと同じ値・高さ。
  if(chartType==='stacked' && secondary && sameUnit){
    maxP=Math.max(1,...pVals.map((v,i)=>v+sVals[i]))*1.08;
    maxS=maxP;
  }
  if(chartType==='stacked' && !secondary && phase8MetricIsAdditive(primary) && rows.every(r=>!r.dailyAxis)){
    const stackedTotals=rows.map(r=>phase8MonthlyWorkdaySegments(r,primary).reduce((s,x)=>s+x.value,0));
    if(stackedTotals.length)maxP=pMoney?Math.max(moneyStep,Math.ceil(Math.max(1,...stackedTotals)/moneyStep)*moneyStep):Math.max(1,...stackedTotals)*1.08;
  }

  ctx.font='12px sans-serif';ctx.lineWidth=1;
  const pTicks=pMoney?Math.round(maxP/moneyStep):pHourly?Math.round(maxP/hourlyStep):pRate?Math.round(maxP/rateStep):4;
  const tickCount=Math.max(1,pTicks);
  for(let i=0;i<=tickCount;i++){
    const frac=i/tickCount,y=pad.t+ch*frac;
    ctx.strokeStyle='rgba(127,127,127,.35)';
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
    ctx.textAlign='left';ctx.fillStyle='#17212b';
    const pv=maxP*(1-frac);
    const pLabel=pMoney?(pv===0?'0':`${Math.round(pv/10000)}万円`)
      :pHourly?(pv===0?'0':`${Math.round(pv).toLocaleString('ja-JP')}円`)
      :pRate?`${Math.round(pv)}%`
      :phase8AxisNumber(pv,primary);
    ctx.fillText(pLabel,4,y+4);
    if(secondary&&!sameUnit){
      ctx.fillStyle='#a52a2a';
      const sv=maxS*(1-frac);
      const sLabel=sMoney?(sv===0?'0':`${Math.round(sv/10000)}万円`)
        :sHourly?(sv===0?'0':`${Math.round(sv).toLocaleString('ja-JP')}円`)
        :sRate?`${Math.round(sv)}%`
        :phase8AxisNumber(sv,secondary);
      ctx.fillText(sLabel,w-pad.r+5,y+4);
    }
  }

  const x=i=>rows.length===1?pad.l+cw/2:pad.l+cw*i/(rows.length-1);
  const yP=v=>pad.t+ch-(v/maxP)*ch;
  const yS=v=>pad.t+ch-(v/(sameUnit?maxP:maxS))*ch;

  if(chartType==='line'){
    const line=(vals,yFn,color)=>{
      ctx.save();ctx.lineWidth=2.5;ctx.strokeStyle=color;ctx.fillStyle=color;
      ctx.beginPath();
      vals.forEach((v,i)=>i?ctx.lineTo(x(i),yFn(v)):ctx.moveTo(x(i),yFn(v)));
      if(vals.length>1)ctx.stroke();
      // 1点しかない場合も見えるように必ずポイントを描画。
      vals.forEach((v,i)=>{ctx.beginPath();ctx.arc(x(i),yFn(v),4,0,Math.PI*2);ctx.fill();});
      ctx.restore();
    };
    line(pVals,yP,'#0f4c5c');
    if(secondary)line(sVals,yS,'#c94a4a');
  }else{
    const slots=Math.max(rows.length,1);
    const groupW=Math.max(18,Math.min(72,cw/slots*.72));
    const sideBarW=secondary&&chartType==='bar'?groupW/2.2:groupW;

    rows.forEach((r,i)=>{
      const cx=rows.length===1?pad.l+cw/2:pad.l+cw*(i+.5)/rows.length;

      if(chartType==='bar' || (chartType==='stacked' && secondary && !sameUnit)){
        // 異なる単位は積み上げると意味が崩れるため、積み上げ指定でも横並び表示。
        const pH=ch*Math.min(1,pVals[i]/maxP);
        ctx.fillStyle='#0f4c5c';
        ctx.fillRect(cx-(secondary?sideBarW:sideBarW/2),pad.t+ch-pH,sideBarW,pH);
        if(secondary){
          const sH=ch*Math.min(1,sVals[i]/maxS);
          ctx.fillStyle='#c94a4a';
          ctx.fillRect(cx+2,pad.t+ch-sH,sideBarW,sH);
        }
      }else if(chartType==='stacked'){
        if(!secondary && phase8MetricIsAdditive(primary) && rows.every(r=>!r.dailyAxis)){
          const segments=phase8MonthlyWorkdaySegments(r,primary);
          let bottom=pad.t+ch;
          segments.forEach((seg,segIndex)=>{
            const segH=ch*Math.min(1,Math.max(0,seg.value)/maxP);
            ctx.fillStyle=phase8WorkdayColor(segIndex);
            ctx.fillRect(cx-groupW/2,bottom-segH,groupW,segH);
            bottom-=segH;
          });
        }else{
          const pH=ch*Math.min(1,pVals[i]/maxP);
          ctx.fillStyle='#0f4c5c';
          ctx.fillRect(cx-groupW/2,pad.t+ch-pH,groupW,pH);
          if(secondary){
            const sH=ch*Math.min(1,sVals[i]/maxP);
            ctx.fillStyle='#c94a4a';
            ctx.fillRect(cx-groupW/2,pad.t+ch-pH-sH,groupW,sH);
          }
        }
      }
    });
  }

  rows.forEach((r,i)=>{
    const cx=chartType==='line'?x(i):(rows.length===1?pad.l+cw/2:pad.l+cw*(i+.5)/rows.length);
    ctx.fillStyle='#17212b';ctx.textAlign='center';
    const label=r.dailyAxis?r.month:r.month.slice(2).replace('-','/');
    ctx.fillText(label,cx,h-26);
    if(r.inProgress&&!r.dailyAxis){
      ctx.font='10px sans-serif';ctx.fillText('進行中',cx,h-10);ctx.font='12px sans-serif';
    }
  });

  ctx.textAlign='left';
  let legend=`第1軸：${pMetric.label}`;
  if(secondary){
    legend+=`　／　第2軸：${sMetric.label}（赤系）`;
    if(chartType==='stacked'&&!sameUnit)legend+='　※単位が異なるため横並び表示';
  }
  $('phase8Legend').textContent=legend;
}
function phase8AxisNumber(v,key){if(key==='effectiveReturn'||key==='takeHomeReturn')return `${Math.round(v)}%`;if(v>=10000)return `${Math.round(v/1000)}k`;return String(Math.round(v));}

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
function render(){const t=totals(),ym=$('currentMonth').value,pp=payrollPeriod(ym);$('headerShift').textContent=`勤務区分：${state.settings.shiftType||'未設定'}`;$('reportTitle').textContent=`${ym.replace('-','年')}月 給与シミュレーション`;$('payPeriod').textContent=`給与対象期間：${formatDateJP(pp.start)}〜${formatDateJP(pp.end)}`;$('sumGross').textContent=yen(t.gross);$('sumNet').textContent=yen(t.net);$('payRevenue').textContent=yen(t.revenue);$('commissionTotal').textContent=yen(t.c.total);$('premiumTotal').textContent=yen(t.premium.total);$('allowances').textContent=yen(t.allowances);$('paidLeavePay').textContent=yen(t.paidLeavePay);$('grossPay').textContent=yen(t.grossPay);$('incomeTaxResult').textContent=yen(t.incomeTax);$('deductions').textContent=yen(t.deductions);$('takeHome').textContent=yen(t.takeHome);$('shiftCount').textContent=`${currentEntries().filter(e=>leaveUnits(e)===0).length}回／有給${t.paidLeaveDays}日`;renderBreakdown(t);renderEntries();renderHistory();updateSettingsViews();renderMonthlyDashboard();}
function holidayLabel(v){return v==='statutory'?'法定休日':v==='nonstatutory'?'法定外休日':'通常';}
function renderEntries(){const body=$('entriesTable').querySelector('tbody');body.innerHTML='';for(const e of currentEntries()){const t=entryTimeInfo(e),leave=leaveUnits(e)>0,tr=document.createElement('tr');tr.innerHTML=`<td>${e.date}</td><td>${leave?'—':yen(payrollGross(e))}</td><td>${leave?'—':(e.clockIn||'—')}</td><td>${leave?'—':(e.clockOut||'—')}</td><td>${minutesText(t.work)}</td><td>${minutesText(t.night)}</td><td>${leave?leaveLabel(leaveUnits(e)):holidayLabel(e.holidayType)}</td><td class="no-print"><button class="ghost" data-edit="${e.id}">編集</button> <button class="danger" data-del="${e.id}">削除</button></td>`;body.appendChild(tr);}}
function renderHistory(){const d=$('historyList');d.innerHTML='';if(!state.history.length){d.innerHTML='<p class="note">まだ給与締め履歴はありません。</p>';return;}for(const h of state.history.slice().reverse()){const x=document.createElement('div');x.className='history-item';x.innerHTML=`<strong>${h.month}給与（${h.shiftType}）</strong><br>対象期間 ${h.periodStart}〜${h.periodEnd}<br>税込営収 ${yen(h.gross)}／積算歩合給 ${yen(h.commission)}／概算手取り ${yen(h.takeHome)}／${h.count}乗務／有給${Number(h.paidLeaveDays||0)}日`;d.appendChild(x);}}
function updateSettingsViews(){const r=currentRule();$('shiftRuleInfo').innerHTML=ruleDescription(state.settings.shiftType);$('taxRateDisplay').value=`${state.settings.taxRate}%`;$('standardShiftHoursDisplay').value=minutesText(r.shiftMinutes);$('standardHoursDisplay').value=minutesText(r.monthlyMinutes);if($('paidLeaveCurrentBalance'))$('paidLeaveCurrentBalance').value=`${paidLeaveBalance()}日`;renderPaidLeaveHistory();}
function loadSettingsForm(){for(const k of Object.keys(state.settings))if($(k))$(k).value=state.settings[k];$('shiftType').value=state.settings.shiftType;updateSettingsViews();}
function saveSettingsForm(){const nums=['healthInsurance','pension','employmentInsurance','residentTax','unionFee','mutualAidFee','otherDeduction','dependentCount','paidLeaveDailyRate','paidLeaveOpeningBalance','paidLeaveNextGrantDays'];state.settings.shiftType=$('shiftType').value;for(const k of nums)state.settings[k]=Number($(k).value||0);state.settings.paidLeaveNextGrantDate=$('paidLeaveNextGrantDate').value;state.settings.withholdingCategory=$('withholdingCategory').value;saveState();applyDuePaidLeaveGrant();render();}
const ADMIN_FIELDS=['fareRevisionCoefficient','payRevenueCoefficient','taxRate','modelWorkAllowance','accidentFreeAllowance','violationFreeAllowance','statutoryOvertimeRate','scheduledOvertimeRate','over60Rate','statutoryHolidayRate','nonStatutoryHolidayRate','nightRate'];
function loadAdminForm(){for(const k of ADMIN_FIELDS)$(k).value=state.settings[k];}
function saveAdminForm(){for(const k of ADMIN_FIELDS)state.settings[k]=Number($(k).value||0);saveState();render();}
function breakValue(prefix){return Number($(prefix+'Hours').value||0)*60+Number($(prefix+'Minutes').value||0);}
let tapNumberTarget='';
let tapNumberBuffer='';
let tapInputMode='clock';
let activeBreakPrefix='';
let breakDraftHours=null;

function tapValue(id){
  const el=$(id);
  if(!el)return 0;
  return Math.max(0,Number(String(el.textContent||'0').replace('--','0'))||0);
}
function setTapValue(id,value,pad2=false){
  const el=$(id); if(!el)return;
  const n=Math.max(0,Number(value||0));
  el.textContent=pad2?String(n).padStart(2,'0'):String(n);
}
function initBreakPickers(){}
function breakDisplayText(total){
  const minutes=Math.max(0,Math.round(Number(total||0)));
  return `${Math.floor(minutes/60)}時間${String(minutes%60).padStart(2,'0')}分`;
}
function setBreak(prefix,total){
  const minutes=Math.max(0,Math.round(Number(total||0)));
  const display=$(prefix+'Display');
  if(display)display.textContent=breakDisplayText(minutes);
  const holder=document.querySelector(`[data-duration-prefix="${prefix}"]`);
  if(holder)holder.dataset.totalMinutes=String(minutes);
}
function breakValue(prefix){
  const holder=document.querySelector(`[data-duration-prefix="${prefix}"]`);
  return Math.max(0,Number(holder?.dataset.totalMinutes||0));
}
function normalizeBreak(prefix){const total=breakValue(prefix);setBreak(prefix,total);return total;}
function normalizeAllBreaks(){return {normal:normalizeBreak('normalBreak'),night:normalizeBreak('nightBreak')};}

function setClockParts(prefix,value){
  const parts=String(value||'').split(':');
  const valid=!!value&&parts.length===2;
  if($(prefix+'Hour'))$(prefix+'Hour').textContent=valid?String(Number(parts[0])).padStart(2,'0'):'--';
  if($(prefix+'Minute'))$(prefix+'Minute').textContent=valid?String(Number(parts[1])).padStart(2,'0'):'--';
  $(prefix).value=valid?`${String(Number(parts[0])).padStart(2,'0')}:${String(Number(parts[1])).padStart(2,'0')}`:'';
}
function syncClock(prefix,showAlert=true){
  const hs=$(prefix+'Hour')?.textContent||'--';
  const ms=$(prefix+'Minute')?.textContent||'--';
  if(hs==='--'||ms==='--'){$(prefix).value='';return false;}
  const h=Number(hs),m=Number(ms);
  if(h<0||h>23||m<0||m>59){
    if(showAlert)alert('時刻は「時 0～23」「分 0～59」で入力してください。');
    return false;
  }
  $(prefix).value=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  return true;
}
function openTapNumber(targetId){
  tapInputMode='clock';
  activeBreakPrefix='';
  tapNumberTarget=targetId;
  // 修正時も前回値を数字パネルへ引き継がない。
  // 入力枠の既存値は、ユーザーが新しい数字を押すまではそのまま保持する。
  tapNumberBuffer='';
  $('tapNumberDisplay').textContent='';
  if($('tapBreakUnits'))$('tapBreakUnits').hidden=true;
  if($('tapNumberGuide'))$('tapNumberGuide').hidden=true;
  $('tapNumberDialog').showModal();
}
function openBreakNumber(prefix){
  tapInputMode='break';
  activeBreakPrefix=prefix;
  tapNumberTarget='';
  tapNumberBuffer='';
  breakDraftHours=null;
  // 休憩時間を上書きするときも、数字パネルは常に空欄から開始する。
  $('tapNumberDisplay').textContent='';
  $('tapBreakUnits').hidden=false;
  $('tapNumberGuide').hidden=false;
  $('tapNumberGuide').textContent='時間を入力してください';
  $('tapNumberDialog').showModal();
}
function applyClockBuffer(){
  if(!tapNumberTarget)return;
  const value=Math.max(0,Number(tapNumberBuffer||0));
  const minuteField=tapNumberTarget.toLowerCase().includes('minute');
  setTapValue(tapNumberTarget,value,minuteField);
  if(tapNumberTarget.startsWith('clockIn'))syncClock('clockIn',false);
  if(tapNumberTarget.startsWith('clockOut'))syncClock('clockOut',false);
}
function closeTapNumber(){
  tapNumberTarget='';
  tapNumberBuffer='';
  tapInputMode='clock';
  activeBreakPrefix='';
  breakDraftHours=null;
  $('tapNumberDialog').close();
}
function longBreakSignature(){
  return `${$('clockIn')?.value||''}|${$('clockOut')?.value||''}|${breakValue('normalBreak')}|${breakValue('nightBreak')}`;
}
let confirmedLongBreakSignature='';
function checkLongBreakWarning(force){
  if(!syncClock('clockIn',false)||!syncClock('clockOut',false))return true;
  const start=timeToMinutes($('clockIn').value),out=timeToMinutes($('clockOut').value);
  let end=out;if(end<=start)end+=1440;
  const duration=end-start;
  const normal=breakValue('normalBreak'),night=breakValue('nightBreak'),total=normal+night;
  if(total < duration/3)return true;
  const sig=longBreakSignature();
  if(!force&&confirmedLongBreakSignature===sig)return true;
  const ok=confirm(`休憩時間が拘束時間の1/3以上になっています。\n拘束時間：${minutesText(duration)}\n休憩時間：${minutesText(total)}\n\nこの休憩時間で間違いありませんか？`);
  if(ok)confirmedLongBreakSignature=sig;
  return ok;
}
function clearEntry(){
  $('entryForm').reset();
  $('date').value=today();
  for(const id of ['otherPlus','otherMinus','idleA','idleB'])if($(id))$(id).value='0';
  setBreak('normalBreak',0);setBreak('nightBreak',0);setClockParts('clockIn','');setClockParts('clockOut','');confirmedLongBreakSignature='';
  $('editingId').value='';
  if($('adjustedGrossRevenue'))$('adjustedGrossRevenue').value='';
  $('netRevenue').value='';
  const normal=document.querySelector('input[name="paidLeaveType"][value="0"]');if(normal)normal.checked=true;
  setPaidLeaveMode();
}
function updateRevenuePreview(){
  const gross=Math.max(0,Number($('grossRevenue')?.value||0));
  const adjusted=calculateAdjustedGross();
  if($('adjustedGrossRevenue'))$('adjustedGrossRevenue').value=gross||adjusted?adjusted.toLocaleString('ja-JP'):'';
  $('netRevenue').value=adjusted?calcNet(adjusted).toLocaleString('ja-JP'):'';
  const formula=$('revenueAdjustmentFormula');
  if(formula){
    const p=adjustmentValue('otherPlus'),m=adjustmentValue('otherMinus'),a=adjustmentValue('idleA'),b=adjustmentValue('idleB');
    formula.textContent=`${gross.toLocaleString('ja-JP')}円 － ${a.toLocaleString('ja-JP')}円 － ${b.toLocaleString('ja-JP')}円 ＋ ${p.toLocaleString('ja-JP')}円 － ${m.toLocaleString('ja-JP')}円 ＝ ${adjusted.toLocaleString('ja-JP')}円`;
  }
}
function validateEntry(e){const t=entryTimeInfo(e);if(!e.clockIn||!e.clockOut)return '出勤・退勤時刻を入力してください。';if(t.duration<=0)return '勤務時間を確認してください。';if(e.normalBreakMinutes+e.nightBreakMinutes>t.duration)return '休憩時間が拘束時間を超えています。';if(t.work<=0)return '実働時間が0以下です。';return '';}

initBreakPickers();populateShiftSelects();$('currentMonth').value=payrollMonthOf(today());clearEntry();
for(const id of ['grossRevenue','otherPlus','otherMinus','idleA','idleB']){
  const el=$(id);
  if(!el) continue;
  el.addEventListener('input',()=>{
    if(['otherPlus','otherMinus','idleA','idleB'].includes(id)){
      const cleaned=String(el.value||'').replace(/[^0-9]/g,'');
      if(el.value!==cleaned)el.value=cleaned;
    }
    updateRevenuePreview();
  });
}document.querySelectorAll('input[name="paidLeaveType"]').forEach(x=>x.addEventListener('change',setPaidLeaveMode));
document.querySelectorAll('.tap-number-field').forEach(btn=>btn.addEventListener('click',()=>openTapNumber(btn.dataset.tapTarget)));
document.querySelectorAll('[data-break-target]').forEach(btn=>btn.addEventListener('click',()=>openBreakNumber(btn.dataset.breakTarget)));

$('tapNumberDialog')?.querySelectorAll('[data-key]').forEach(btn=>btn.addEventListener('click',()=>{
  const key=btn.dataset.key;
  if(key==='clear')tapNumberBuffer='';
  else if(key==='back')tapNumberBuffer=tapNumberBuffer.slice(0,-1);
  else if(tapNumberBuffer.length<4)tapNumberBuffer=(tapNumberBuffer==='0'?'':tapNumberBuffer)+key;

  $('tapNumberDisplay').textContent=tapNumberBuffer;

  // 出退勤時刻は従来どおり数字を押すたび即時反映。
  if(tapInputMode==='clock')applyClockBuffer();
}));

$('tapBreakUnits')?.querySelectorAll('[data-unit]').forEach(btn=>btn.addEventListener('click',()=>{
  if(tapInputMode!=='break'||!activeBreakPrefix)return;
  const unit=btn.dataset.unit;
  const value=Math.max(0,Number(tapNumberBuffer||0));

  if(unit==='hour'){
    // 「2」→「時間」で2時間を確定。分は未入力のままなので00分扱い。
    breakDraftHours=value;
        if($('tapNumberGuide'))$('tapNumberGuide').textContent='分を入力してください';
    setBreak(activeBreakPrefix,value*60);
    tapNumberBuffer='';
    $('tapNumberDisplay').textContent='0';
    confirmedLongBreakSignature='';
    return;
  }

  if(unit==='minute'){
    // 時間ボタンを押していない場合は、現在表示中の時間をそのまま基準にする。
    // 2時間ちょうどなら「2→時間→分」で00分。
    const hours=breakDraftHours===null?0:breakDraftHours;
    const total=hours*60+value; // 78分なら自動的に1時間18分へ正規化
    setBreak(activeBreakPrefix,total);
    confirmedLongBreakSignature='';
    closeTapNumber();
    checkLongBreakWarning(false);
  }
}));

$('tapNumberDialog')?.addEventListener('click',ev=>{
  if(ev.target===$('tapNumberDialog'))closeTapNumber();
});
$('tapNumberDialog')?.addEventListener('cancel',ev=>{
  ev.preventDefault();
  closeTapNumber();
});

$('entryForm').addEventListener('submit',ev=>{
  ev.preventDefault();
  const paidLeaveUnits=Number(document.querySelector('input[name="paidLeaveType"]:checked')?.value||0);
  const id=$('editingId').value||crypto.randomUUID();

  if(paidLeaveUnits>0){
    if(!$('date').value)return alert('勤務日を入力してください。');
    if(paidLeaveUnits>paidLeaveBalance($('editingId').value||''))return alert(`有給残数が不足しています。現在使用可能：${paidLeaveBalance($('editingId').value||'')}日`);
    const entry={
      id,date:$('date').value,paidLeaveUnits,
      grossSales:0,otherPlus:0,otherMinus:0,idleA:0,idleB:0,
      adjustedGrossSales:0,grossRevenue:0,
      clockIn:'',clockOut:'',normalBreakMinutes:0,nightBreakMinutes:0,
      holidayType:'normal',hadAccident:false,hadViolation:false
    };
    state.entries=state.entries.filter(x=>x.id!==id).concat(entry);
    saveState();clearEntry();render();return;
  }

  if(!syncClock('clockIn')||!syncClock('clockOut'))return;
   normalizeAllBreaks();
   if(!checkLongBreakWarning(true))return;
   const grossSales=Math.max(0,Number($('grossRevenue').value||0));
  const otherPlus=adjustmentValue('otherPlus');
  const otherMinus=adjustmentValue('otherMinus');
  const idleA=adjustmentValue('idleA');
  const idleB=adjustmentValue('idleB');
  const adjustedGrossSales=Math.max(0,grossSales+otherPlus-otherMinus-idleA-idleB);

  if(grossSales<=0)return alert('総営収（税込）を入力してください。');
  if(adjustedGrossSales<=0)return alert('給与計算用営収が0円以下になっています。営収調整の金額を確認してください。');

  const entry={
    id,date:$('date').value,paidLeaveUnits:0,
    grossSales,otherPlus,otherMinus,idleA,idleB,
    adjustedGrossSales,
    grossRevenue:adjustedGrossSales, // 既存計算・バックアップとの互換用
    clockIn:$('clockIn').value,clockOut:$('clockOut').value,
    normalBreakMinutes:breakValue('normalBreak'),
    nightBreakMinutes:breakValue('nightBreak'),
    holidayType:$('holidayType').value,
    hadAccident:$('hadAccident').checked,
    hadViolation:$('hadViolation').checked
  };
  const err=validateEntry(entry);if(err)return alert(err);
  state.entries=state.entries.filter(x=>x.id!==id).concat(entry);
  saveState();clearEntry();render();
});
$('resetForm').onclick=clearEntry;
$('entriesTable').addEventListener('click',ev=>{const edit=ev.target.dataset.edit,del=ev.target.dataset.del;if(edit){const e=state.entries.find(x=>x.id===edit);$('date').value=e.date;$('editingId').value=e.id;const radio=document.querySelector(`input[name="paidLeaveType"][value="${leaveUnits(e)}"]`);if(radio)radio.checked=true;if(leaveUnits(e)===0){
  $('grossRevenue').value=grossSalesOf(e);
  $('otherPlus').value=Number(e.otherPlus||0);
  $('otherMinus').value=Number(e.otherMinus||0);
  $('idleA').value=Number(e.idleA ?? e.idleAdjustmentA ?? 0);
  $('idleB').value=Number(e.idleB ?? e.idleAdjustmentB ?? 0);
  setClockParts('clockIn',e.clockIn);setClockParts('clockOut',e.clockOut);
  setBreak('normalBreak',e.normalBreakMinutes);setBreak('nightBreak',e.nightBreakMinutes);
  $('holidayType').value=e.holidayType;$('hadAccident').checked=e.hadAccident;$('hadViolation').checked=e.hadViolation;
  updateRevenuePreview();
}setPaidLeaveMode();scrollTo({top:0,behavior:'smooth'});}if(del&&confirm('この勤務データを削除しますか？')){state.entries=state.entries.filter(x=>x.id!==del);saveState();render();}});
$('prevMonth').onclick=()=>{$('currentMonth').value=addMonths($('currentMonth').value,-1);render();};$('nextMonth').onclick=()=>{$('currentMonth').value=addMonths($('currentMonth').value,1);render();};$('currentMonth').onchange=render;$('printReport').onclick=()=>window.print();
$('exportCsv').onclick=()=>{
  const rows=[
    ['勤務日','勤務区分','勤務・有給区分','有給日数','総営収（税込）','その他（＋）','その他（－）','A空転','B空転','給与計算用税込営収','税抜営収','出勤時刻（アルコール）','退勤時刻（アルコール）','通常休憩分','深夜休憩分','実働分','深夜労働分','休日区分'],
    ...currentEntries().map(e=>{
      const t=entryTimeInfo(e),leave=leaveUnits(e);
      return [
        e.date,state.settings.shiftType,leaveLabel(leave),leave,
        leave?0:grossSalesOf(e),
        leave?0:Number(e.otherPlus||0),
        leave?0:Number(e.otherMinus||0),
        leave?0:Number(e.idleA||0),
        leave?0:Number(e.idleB||0),
        leave?0:payrollGross(e),
        leave?0:calcNet(payrollGross(e)),
        leave?'':e.clockIn,leave?'':e.clockOut,
        leave?0:e.normalBreakMinutes,leave?0:e.nightBreakMinutes,
        t.work,t.night,leave?'':holidayLabel(e.holidayType)
      ];
    })
  ];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));
  a.download=`taxi-pay-${$('currentMonth').value}.csv`;
  a.click();
};
$('closeMonth').onclick=()=>{const entries=currentEntries();if(!entries.length)return alert('給与締めするデータがありません。');const ym=$('currentMonth').value,pp=payrollPeriod(ym);if(!confirm(`${ym}給与を締めます。履歴保存後、この期間の勤務データは削除されます。`))return;const t=totals(entries);state.settings.paidLeaveUsageHistory=Array.isArray(state.settings.paidLeaveUsageHistory)?state.settings.paidLeaveUsageHistory:[];if(t.paidLeaveDays>0&&!state.settings.paidLeaveUsageHistory.some(x=>x.month===ym))state.settings.paidLeaveUsageHistory.push({month:ym,days:t.paidLeaveDays,periodStart:pp.start,periodEnd:pp.end,closedAt:new Date().toISOString()});state.history.push({month:ym,shiftType:state.settings.shiftType,periodStart:pp.start,periodEnd:pp.end,gross:t.gross,grossPay:t.grossPay,commission:t.c.total,takeHome:t.takeHome,workMinutes:t.premium.work,breakMinutes:entries.filter(e=>leaveUnits(e)===0).reduce((s,e)=>s+Number(e.normalBreakMinutes||0)+Number(e.nightBreakMinutes||0),0),count:entries.filter(e=>leaveUnits(e)===0).length,paidLeaveDays:t.paidLeaveDays,dailyEntries:clone(entries),closedAt:new Date().toISOString()});state.entries=state.entries.filter(e=>payrollMonthOf(e.date)!==ym);saveState();render();};
phase8PopulateMetrics();
window.phase8CustomActive=false;
$('phase8Period')?.addEventListener('change',()=>{window.phase8CustomActive=false;$('phase8CustomPeriod').hidden=true;renderMonthlyDashboard();});
$('phase8ToggleCustomPeriod')?.addEventListener('click',()=>{const box=$('phase8CustomPeriod');box.hidden=!box.hidden;if(!box.hidden)window.phase8CustomActive=false;});
$('phase8ApplyCustomPeriod')?.addEventListener('click',()=>{
  const s=$('phase8StartDate').value,e=$('phase8EndDate').value;
  if(!s||!e)return alert('開始日と終了日を指定してください。');
  if(s>e)return alert('開始日は終了日以前の日付を指定してください。');
  window.phase8CustomActive=true;
  renderMonthlyDashboard();
});
$('phase8CancelCustomPeriod')?.addEventListener('click',()=>{window.phase8CustomActive=false;$('phase8CustomPeriod').hidden=true;renderMonthlyDashboard();});
$('phase8ChartType')?.addEventListener('change',renderMonthlyDashboard);
$('phase8Primary')?.addEventListener('change',()=>{phase8SyncChartTypeAvailability();renderMonthlyDashboard();});
$('phase8Secondary')?.addEventListener('change',renderMonthlyDashboard);
$('phase8AddSecondary')?.addEventListener('click',()=>{$('phase8SecondaryWrap').hidden=false;$('phase8RemoveSecondary').hidden=false;$('phase8AddSecondary').hidden=true;phase8SyncChartTypeAvailability();renderMonthlyDashboard();});
$('phase8RemoveSecondary')?.addEventListener('click',()=>{$('phase8SecondaryWrap').hidden=true;$('phase8RemoveSecondary').hidden=true;$('phase8AddSecondary').hidden=false;phase8SyncChartTypeAvailability();renderMonthlyDashboard();});
window.addEventListener('resize',()=>{if(!$('phase8Chart')?.closest('[hidden]'))drawPhase8Chart((()=>{let r=phase8Rows(),p=$('phase8Period')?.value||'12';return window.phase8CustomActive?phase8CustomRows():p==='all'?r:p==='current'?phase8CurrentDailyRows():r.slice(-Number(p));})());});
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
