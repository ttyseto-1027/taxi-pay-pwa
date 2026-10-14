'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const DI=require('../data-integrity-v14.js');
const baseSettings={shiftType:'隔日勤務',residentTax:0};
const entry=(id,date,gross=10000,extra={})=>({id,date,paidLeaveUnits:0,grossSales:gross,adjustedGrossSales:gross,grossRevenue:gross,clockIn:'10:00',clockOut:'20:00',normalBreakMinutes:60,nightBreakMinutes:0,holidayType:'normal',hadAccident:false,hadViolation:false,...extra});
const state=(entries=[],extra={})=>({initialized:true,settings:{...baseSettings},entries,history:[],...extra});
const ctx={deviceId:'dev-a',deviceName:'iPhone',browser:'Safari'};

// 1. backward compatible shape
{
  const s=DI.ensureState({entries:[],history:[],settings:{}});
  for(const k of ['dataArchive','conflictHistory','deletionHistory','recordTombstones'])assert(Array.isArray(s[k]),k);
}
// 2. metadata does not alter semantic equality
{
  const a=entry('1','2026-08-10',10000),b={...a,updatedAtJst:'x',updatedDeviceId:'y'};
  assert(DI.same(a,b));
}
// 3. save normalization adds provenance
{
  const out=DI.normalizeBeforeSave(state([]),state([entry('1','2026-08-10')]),'entry-save',ctx);
  assert.equal(out.entries[0].createdDeviceId,'dev-a');assert.equal(out.entries[0].updatedBrowser,'Safari');
}
// 4. user deletion archives + tombstone
{
  const prev=state([entry('1','2026-08-10')]);
  const out=DI.normalizeBeforeSave(prev,state([]),'app-save',ctx);
  assert.equal(out.dataArchive.length,1);assert.equal(out.recordTombstones.length,1);assert.equal(out.dataArchive[0].data.id,'1');
}
// 5. month close removal is not mistaken for deletion
{
  const e=entry('1','2026-08-10');
  const prev=state([e]);
  const next=state([],{history:[{month:'2026-08',dailyEntries:[e]}]});
  const out=DI.normalizeBeforeSave(prev,next,'app-save',ctx);
  assert.equal(out.dataArchive.length,0);assert.equal(out.recordTombstones.length,0);
}
// 6. remote-only is auto-added
{
  const p=DI.buildMergePlan(state([entry('1','2026-08-10')]),state([entry('2','2026-08-11')]));
  assert.equal(p.addRemote.length,1);assert.equal(p.conflicts.length,0);
  const out=DI.applyMergePlan(p,{},ctx);assert.deepEqual(out.entries.map(x=>x.id).sort(),['1','2']);
}
// 7. identical same-date different ID is deduplicated
{
  const a=entry('1','2026-08-10'),b={...a,id:'2'};
  const p=DI.buildMergePlan(state([a]),state([b]));assert.equal(p.conflicts.length,1);
}
// 8. same ID content difference is a conflict and remote winner archives local
{
  const p=DI.buildMergePlan(state([entry('1','2026-08-10',10000)]),state([entry('1','2026-08-10',20000)]));
  assert.equal(p.conflicts.length,1);assert(p.conflicts[0].diffs.some(x=>x.field==='grossSales'||x.field==='grossRevenue'||x.field==='adjustedGrossSales'));
  const out=DI.applyMergePlan(p,{[p.conflicts[0].id]:'remote'},ctx);assert.equal(out.entries[0].grossSales,20000);assert.equal(out.dataArchive.length,1);
}
// 9. local winner keeps local and archives remote
{
  const p=DI.buildMergePlan(state([entry('1','2026-08-10',10000)]),state([entry('1','2026-08-10',20000)]));
  const out=DI.applyMergePlan(p,{[p.conflicts[0].id]:'local'},ctx);assert.equal(out.entries[0].grossSales,10000);assert.equal(out.dataArchive.length,1);
}
// 10. field-by-field merge preserves both source records in archive
{
  const l=entry('1','2026-08-10',10000,{normalBreakMinutes:60}),r=entry('1','2026-08-10',20000,{normalBreakMinutes:90});
  const p=DI.buildMergePlan(state([l]),state([r])),c=p.conflicts[0];
  const fields={};c.diffs.forEach(d=>fields[d.field]=d.field==='normalBreakMinutes'?'remote':'local');
  const out=DI.applyMergePlan(p,{[c.id]:{mode:'fields',fields}},ctx);assert.equal(out.entries[0].normalBreakMinutes,90);assert.equal(out.entries[0].grossSales,10000);assert(out.dataArchive.length>=2);
}
// 11. deletion vs existing record is never auto-decided
{
  const l=state([],{recordTombstones:[{entryId:'1',workDate:'2026-08-10',deletedAtJst:'2026-08-27T10:00:00+09:00'}]});
  const r=state([entry('1','2026-08-10',10000)]);const p=DI.buildMergePlan(l,r);assert.equal(p.conflicts.length,1);assert.equal(p.conflicts[0].type,'entry-delete');
}
// 12. deleted-state choice archives surviving record
{
  const l=state([],{recordTombstones:[{entryId:'1',workDate:'2026-08-10',deletedAtJst:'2026-08-27T10:00:00+09:00'}]});
  const r=state([entry('1','2026-08-10',10000)]);const p=DI.buildMergePlan(l,r),c=p.conflicts[0];const out=DI.applyMergePlan(p,{[c.id]:'local'},ctx);assert.equal(out.entries.length,0);assert.equal(out.dataArchive.length,1);
}
// 13. setting differences are user-visible conflicts when both states are active
{
  const l=state([entry('1','2026-08-10')]);l.settings.residentTax=1000;const r=state([entry('1','2026-08-10')]);r.settings.residentTax=2000;
  const p=DI.buildMergePlan(l,r);assert(p.conflicts.some(x=>x.id==='setting:residentTax'));
}
// 14. fresh empty local adopts remote settings without pointless conflict
{
  const l={initialized:false,settings:{},entries:[],history:[]},r=state([entry('1','2026-08-10')]);r.settings.residentTax=3000;
  const p=DI.buildMergePlan(l,r);assert(!p.conflicts.some(x=>x.type==='setting'));const out=DI.applyMergePlan(p,{},ctx);assert.equal(out.settings.residentTax,3000);
}
// 15. archive union deduplicates
{
  const archive={archiveId:'a',kind:'entry',sourceId:'1',workDate:'2026-08-10',archivedAtJst:'x',reason:'x',data:entry('1','2026-08-10')};
  const l=state([],{dataArchive:[archive]}),r=state([],{dataArchive:[{...archive,archiveId:'b'}]});const out=DI.applyMergePlan(DI.buildMergePlan(l,r),{},ctx);assert.equal(out.dataArchive.length,1);
}
// 16. permanent archive deletion removes body and keeps only audit metadata
{
  const archive={archiveId:'a',kind:'entry',sourceId:'1',workDate:'2026-08-10',archivedAtJst:'x',reason:'x',data:entry('1','2026-08-10')};
  const out=DI.permanentlyDeleteArchives(state([],{dataArchive:[archive]}),['a'],ctx);assert.equal(out.dataArchive.length,0);assert.equal(out.deletionHistory.length,1);assert(!('data' in out.deletionHistory[0]));
}
// 17. recovery/restore reason does not manufacture deletion archives
{
  const prev=state([entry('1','2026-08-10')]);const out=DI.normalizeBeforeSave(prev,state([]),'manual-recovery-merge',ctx);assert.equal(out.dataArchive.length,0);
}
// 18. history remote-only is merged
{
  const l=state([]),r=state([],{history:[{month:'2026-07',gross:1000}]});const p=DI.buildMergePlan(l,r);const out=DI.applyMergePlan(p,{},ctx);assert.equal(out.history.length,1);
}
// 19. history differing same month is conflict
{
  const l=state([],{history:[{month:'2026-07',gross:1000}]}),r=state([],{history:[{month:'2026-07',gross:2000}]});const p=DI.buildMergePlan(l,r);assert(p.conflicts.some(x=>x.type==='history'));
}
// 20. no unchosen conflict is allowed to apply
{
  const p=DI.buildMergePlan(state([entry('1','2026-08-10',10000)]),state([entry('1','2026-08-10',20000)]));assert.throws(()=>DI.applyMergePlan(p,{},ctx),/未解決/);
}
// 21. archived entry restore is planned as a user-visible conflict and archive remains
{
  const active=entry('1','2026-08-10',20000);
  const archived={archiveId:'restore-entry',kind:'entry',sourceId:'1',workDate:'2026-08-10',archivedAtJst:'x',reason:'conflict-loser',data:entry('1','2026-08-10',10000)};
  const s=state([active],{dataArchive:[archived]});
  const built=DI.buildArchiveRestorePlan(s,'restore-entry');
  assert.equal(built.plan.conflicts.length,1);
  const out=DI.applyMergePlan(built.plan,{[built.plan.conflicts[0].id]:'remote'},ctx);
  assert.equal(out.entries.find(x=>x.id==='1').grossSales,10000);
  assert(out.dataArchive.some(x=>x.archiveId==='restore-entry'),'restoring must not auto-delete the archive');
}
// 22. archived setting restore never overwrites silently
{
  const archived={archiveId:'restore-setting',kind:'setting',sourceId:'residentTax',workDate:'',archivedAtJst:'x',reason:'setting-conflict-loser',data:{field:'residentTax',value:5000}};
  const s=state([entry('1','2026-08-10')],{dataArchive:[archived]});s.settings.residentTax=1000;
  const built=DI.buildArchiveRestorePlan(s,'restore-setting');
  const conflict=built.plan.conflicts.find(x=>x.id==='setting:residentTax');assert(conflict);
  const out=DI.applyMergePlan(built.plan,{[conflict.id]:'remote'},ctx);
  assert.equal(out.settings.residentTax,5000);assert(out.dataArchive.some(x=>x.archiveId==='restore-setting'));
}
// 23. archived history restore never overwrites silently
{
  const archived={archiveId:'restore-history',kind:'history',sourceId:'2026-07',workDate:'',archivedAtJst:'x',reason:'history-conflict-loser',data:{month:'2026-07',gross:2000}};
  const s=state([],{history:[{month:'2026-07',gross:1000}],dataArchive:[archived]});
  const built=DI.buildArchiveRestorePlan(s,'restore-history');
  const conflict=built.plan.conflicts.find(x=>x.type==='history');assert(conflict);
  const out=DI.applyMergePlan(built.plan,{[conflict.id]:'remote'},ctx);
  assert.equal(out.history.find(x=>x.month==='2026-07').gross,2000);assert(out.dataArchive.some(x=>x.archiveId==='restore-history'));
}
// 24. archive restore UI must preserve archive and support all Phase 11 archive kinds
{
  const ui=fs.readFileSync(path.join(__dirname,'..','phase11-archive-restore.js'),'utf8');
  assert(ui.includes('buildArchiveRestorePlan'),'archive restore must use the conflict-aware restore planner');
  assert(!ui.includes("filter(a=>a.archiveId!==archive.archiveId)"),'restore must never auto-delete the source archive');
  assert(ui.includes('元の退避データは安全のため残しています'),'UI must tell the user that the archive remains');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert(html.includes('phase11-archive-restore.js'),'Phase 11 archive restore UI must actually be loaded by index.html');
  assert(html.includes('data-view="settings" type="button"><span>バックアップ</span>'),'user-facing menu name must remain バックアップ');
  const recovery=fs.readFileSync(path.join(__dirname,'..','data-recovery-v14.js'),'utf8');
  assert(recovery.includes('const backupPanel=document.querySelector(\'[data-view-panel="settings"]\')'),'internal settings view id must be treated as the Backup panel');
  assert(ui.includes("action:usedRemote?'restore':'keep-current'"),'restore flow must distinguish a real restore from keeping current data');
  assert(ui.includes('現在の有効データを維持しました。退避データもそのまま残しています。'),'keep-current choice must not be reported as restored');
}
// 25. Develop-only live-test assets and query loaders never ship in Production.
{
  const phase7=fs.readFileSync(path.join(__dirname,'..','phase7-ui.js'),'utf8');
  assert(!fs.existsSync(path.join(__dirname,'..','phase11-live-test.js')),'Phase 11 live test must not ship to Production');
  assert(!fs.existsSync(path.join(__dirname,'..','phase10-device-association-test.js')),'Phase 10 association simulator must not ship to Production');
  assert(!phase7.includes("get('phase11Test')"),'Production UI must not contain the Phase 11 test loader');
  assert(!phase7.includes("get('phase10DeviceTest')"),'Production UI must not contain the Phase 10 test loader');
}
// 26. Production keeps the controlled Service Worker update flow and explicit V2 acknowledgement.
{
  const ops=fs.readFileSync(path.join(__dirname,'..','phase75-ops.js'),'utf8');
  const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
  assert(!ops.includes('disableDevelopServiceWorkers'),'Production must not unregister its Service Worker');
  assert(ops.includes('キャッシュ更新'),'visible cache update label is required');
  assert(ops.includes('serviceWorker.register'),'Production must register the Service Worker');
  assert(ops.includes('taxiPayPendingCacheVersionV2'),'explicit update must use V2 pending acknowledgement');
  assert(ops.includes('taxiPayLastExplicitCacheVersionV2'),'explicit update must use a dedicated V2 applied key');
  assert(!ops.includes('taxiPayLastAppliedCacheVersionV1'),'legacy auto-acknowledgement must not influence current update state');
  assert(ops.includes('pending===latestVersion && currentVersion===pending'),'acknowledgement must complete only after the requested build loads');
  assert(sw.includes('SKIP_WAITING'),'Service Worker must support controlled activation');
}
console.log('v1.4 regression core: 26/26 PASS');
