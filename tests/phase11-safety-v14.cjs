const assert = require('node:assert/strict');

function makeStorage(){
  const map = new Map();
  return {
    getItem:k=>map.has(k)?map.get(k):null,
    setItem:(k,v)=>map.set(k,String(v)),
    removeItem:k=>map.delete(k),
  };
}

global.localStorage = makeStorage();
global.navigator = { userAgent: 'Mozilla/5.0 Windows Chrome/151 Safari/537.36' };
const DI = require('../data-integrity-v14.js');

const ctx = { deviceId:'pc-a', deviceName:'PC', browser:'Chrome' };
const entry = { id:'e1', date:'2026-09-01', grossSales:50000, grossRevenue:50000 };

// 1. Active record removal must archive the full record and create a tombstone.
{
  const prev = DI.ensureState({ entries:[entry] });
  const next = DI.normalizeBeforeSave(prev, { entries:[] }, 'user-delete', ctx);
  assert.equal(next.entries.length, 0);
  assert.equal(next.dataArchive.length, 1);
  assert.equal(next.dataArchive[0].sourceId, 'e1');
  assert.deepEqual(DI.stripMeta(next.dataArchive[0].data), entry);
  assert.equal(next.recordTombstones.length, 1);
  assert.equal(next.recordTombstones[0].entryId, 'e1');
}

// 2. A deleted record on one side and a live record on the other must become a conflict.
{
  const deleted = DI.ensureState({ entries:[], recordTombstones:[{entryId:'e1',workDate:'2026-09-01',deletedAtJst:'2026-09-02T00:00:00+09:00'}] });
  const live = DI.ensureState({ entries:[entry] });
  const plan = DI.buildMergePlan(deleted, live);
  const c = plan.conflicts.find(x=>x.type==='entry-delete');
  assert.ok(c, 'entry-delete conflict must exist');
  assert.equal(c.remote.id, 'e1');
}

// 3. Choosing deletion must first archive the still-live record instead of discarding it.
{
  const deleted = DI.ensureState({ entries:[], recordTombstones:[{entryId:'e1',workDate:'2026-09-01',deletedAtJst:'2026-09-02T00:00:00+09:00'}] });
  const live = DI.ensureState({ entries:[entry] });
  const plan = DI.buildMergePlan(deleted, live);
  const conflict = plan.conflicts.find(x=>x.type==='entry-delete');
  const merged = DI.applyMergePlan(plan, {[conflict.id]:'local'}, ctx);
  assert.equal(merged.entries.length, 0);
  assert.ok(merged.dataArchive.some(a=>a.sourceId==='e1' && a.reason==='deleted-state-selected'));
  assert.ok(merged.conflictHistory.some(h=>h.conflictId===conflict.id && h.selected==='local'));
}

// 4. Choosing the live side restores it to active data and clears the deletion tombstone.
{
  const deleted = DI.ensureState({ entries:[], recordTombstones:[{entryId:'e1',workDate:'2026-09-01',deletedAtJst:'2026-09-02T00:00:00+09:00'}] });
  const live = DI.ensureState({ entries:[entry] });
  const plan = DI.buildMergePlan(deleted, live);
  const conflict = plan.conflicts.find(x=>x.type==='entry-delete');
  const merged = DI.applyMergePlan(plan, {[conflict.id]:'remote'}, ctx);
  assert.ok(merged.entries.some(e=>e.id==='e1'));
  assert.equal(merged.recordTombstones.some(t=>t.entryId==='e1'), false);
}

// 5. The inverse conflict must also clear the imported tombstone when the live local record is kept.
{
  const localLive = DI.ensureState({ entries:[entry] });
  const remoteDeleted = DI.ensureState({ entries:[], recordTombstones:[{entryId:'e1',workDate:'2026-09-01',deletedAtJst:'2026-09-02T00:00:00+09:00'}] });
  const plan = DI.buildMergePlan(localLive, remoteDeleted);
  const conflict = plan.conflicts.find(x=>x.type==='delete-entry');
  assert.ok(conflict, 'delete-entry conflict must exist');
  const merged = DI.applyMergePlan(plan, {[conflict.id]:'local'}, ctx);
  assert.ok(merged.entries.some(e=>e.id==='e1'));
  assert.equal(merged.recordTombstones.some(t=>t.entryId==='e1'), false);
}

// 6. Permanent deletion removes only archive payloads and leaves a content-free audit record.
{
  const s = DI.ensureState({ dataArchive:[{
    archiveId:'a1', kind:'entry', sourceId:'e1', workDate:'2026-09-01',
    data:{...entry, memo:'private payroll data'}
  }]});
  const out = DI.permanentlyDeleteArchives(s, ['a1'], ctx);
  assert.equal(out.dataArchive.length, 0);
  assert.equal(out.deletionHistory.length, 1);
  const audit = out.deletionHistory[0];
  assert.equal(audit.archiveId, 'a1');
  assert.equal(audit.targetDate, '2026-09-01');
  assert.equal(audit.deviceId, 'pc-a');
  assert.equal('data' in audit, false);
  assert.equal('memo' in audit, false);
  assert.equal(JSON.stringify(audit).includes('private payroll data'), false);
}

// 7. Permanent deletion must be selective and idempotent for unknown IDs.
{
  const s = DI.ensureState({ dataArchive:[
    {archiveId:'a1',kind:'entry',sourceId:'e1',workDate:'2026-09-01',data:entry},
    {archiveId:'a2',kind:'entry',sourceId:'e2',workDate:'2026-09-02',data:{id:'e2',date:'2026-09-02'}}
  ]});
  const out = DI.permanentlyDeleteArchives(s, ['a1','missing'], ctx);
  assert.deepEqual(out.dataArchive.map(x=>x.archiveId), ['a2']);
  assert.deepEqual(out.deletionHistory.map(x=>x.archiveId), ['a1']);
}

// 8. An explicitly empty integrity array must remain empty after normalization.
// This protects the last archive from reappearing after permanent deletion or restoration.
{
  const prev = DI.ensureState({
    entries:[],
    dataArchive:[{archiveId:'a1',kind:'entry',sourceId:'e1',workDate:'2026-09-01',data:entry}],
    conflictHistory:[{conflictId:'c1'}],
    deletionHistory:[{archiveId:'old'}],
    recordTombstones:[{entryId:'e1'}]
  });
  const next = DI.normalizeBeforeSave(prev, {
    entries:[], settings:{}, history:[],
    dataArchive:[], conflictHistory:[], deletionHistory:[], recordTombstones:[]
  }, 'archive-restore', ctx);
  assert.deepEqual(next.dataArchive, []);
  assert.deepEqual(next.conflictHistory, []);
  assert.deepEqual(next.deletionHistory, []);
  assert.deepEqual(next.recordTombstones, []);
}

// 9. Archive UI must expose human-readable identity without changing archive payloads.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const ui = fs.readFileSync(path.join(__dirname,'..','data-recovery-v14.js'),'utf8');
  assert.ok(ui.includes("ARCHIVE_KIND_LABELS={entry:'勤務実績'"));
  assert.ok(ui.includes("'conflict-loser':'競合で非採用'"));
  assert.ok(ui.includes("['grossRevenue','adjustedGrossSales','grossSales']"));
  assert.ok(ui.includes("営収 "));
  assert.ok(ui.includes("const d=archiveDisplay(a)"));
}

console.log('Phase 11 safety regression: SUCCESS');
