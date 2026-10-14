'use strict';
const assert=require('assert');

class MemoryStorage{
  constructor(){this.map=new Map();}
  get length(){return this.map.size;}
  key(i){return [...this.map.keys()][i]??null;}
  getItem(k){return this.map.has(k)?this.map.get(k):null;}
  setItem(k,v){this.map.set(String(k),String(v));}
  removeItem(k){this.map.delete(String(k));}
  clear(){this.map.clear();}
}

global.localStorage=new MemoryStorage();
global.location={pathname:'/taxi-pay-pwa/'};
Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Mozilla/5.0 (iPhone) AppleWebKit Safari'},configurable:true});
if(!globalThis.crypto) Object.defineProperty(globalThis,'crypto',{value:require('crypto').webcrypto,configurable:true});

const DI=require('../data-integrity-v14.js');
global.TaxiPayDataIntegrity=DI;
const STORAGE=require('../storage-safety.js');

const entry=(id,date,gross=10000)=>({id,date,paidLeaveUnits:0,grossSales:gross,adjustedGrossSales:gross,grossRevenue:gross,clockIn:'10:00',clockOut:'20:00',normalBreakMinutes:60,nightBreakMinutes:0,holidayType:'normal',hadAccident:false,hadViolation:false});
const state=entries=>({initialized:true,settings:{shiftType:'隔日勤務'},entries,history:[]});

// 1. Every ordinary storage save passes through data-integrity and records provenance.
{
  const saved=STORAGE.save(state([entry('1','2026-08-10')]),'entry-save');
  assert.equal(saved.entries.length,1);
  assert(saved.entries[0].createdAtJst);
  assert(saved.entries[0].createdDeviceId);
  const disk=JSON.parse(STORAGE.getPrimaryRaw());
  assert.equal(disk.entries[0].id,'1');
  assert(disk.entries[0].updatedAtJst);
}

// 2. Removing an active record through the normal app-save path archives it and creates a tombstone.
{
  const saved=STORAGE.save(state([]),'app-save');
  assert.equal(saved.entries.length,0);
  assert.equal(saved.dataArchive.length,1);
  assert.equal(saved.dataArchive[0].data.id,'1');
  assert.equal(saved.recordTombstones.length,1);
  assert.equal(saved.recordTombstones[0].entryId,'1');
}

// 3. A recovery/merge save must not manufacture a deletion archive merely because active entries differ.
{
  localStorage.clear();
  STORAGE.save(state([entry('2','2026-08-11')]),'entry-save');
  const restored=STORAGE.save(state([]),'manual-recovery-merge');
  assert.equal(restored.entries.length,0);
  assert.equal(restored.dataArchive.length,0);
  assert.equal(restored.recordTombstones.length,0);
}

// 4. PRODUCTION uses only the established Production key family.
{
  assert.equal(STORAGE.isDevelop,false);
  assert.equal(STORAGE.primaryKey,'taxiPayPwaStateV10');
  assert(STORAGE.legacyKeys.every(k=>/^taxiPayPwaStateV/.test(k)));
  assert(!STORAGE.legacyKeys.some(k=>/^taxiPayPwaDevelopStateV/.test(k)));
}

// 5. Re-saving unchanged data must not create an archive/tombstone or change business data.
{
  localStorage.clear();
  const first=STORAGE.save(state([entry('3','2026-08-12',12345)]),'entry-save');
  const second=STORAGE.save(state([entry('3','2026-08-12',12345)]),'entry-save');
  assert.equal(second.entries.length,1);
  assert.equal(second.entries[0].grossSales,12345);
  assert.equal(second.dataArchive.length,0);
  assert.equal(second.recordTombstones.length,0);
  assert.equal(second.entries[0].createdAtJst,first.entries[0].createdAtJst);
}

// 6. Moving an active entry into closed-month history is not a deletion and must not create a tombstone.
{
  localStorage.clear();
  STORAGE.save(state([entry('4','2026-08-13')]),'entry-save');
  const closed=state([]);
  closed.history=[{month:'2026-08',dailyEntries:[entry('4','2026-08-13')]}];
  const saved=STORAGE.save(closed,'close-month');
  assert.equal(saved.entries.length,0);
  assert.equal(saved.dataArchive.length,0);
  assert.equal(saved.recordTombstones.length,0);
}

// 7. Updating an existing entry preserves its ID, keeps one active row, and does not archive the prior version as a deletion.
{
  localStorage.clear();
  STORAGE.save(state([entry('5','2026-08-14',50000)]),'entry-save');
  const changed=STORAGE.save(state([entry('5','2026-08-14',52000)]),'entry-save');
  assert.equal(changed.entries.length,1);
  assert.equal(changed.entries[0].id,'5');
  assert.equal(changed.entries[0].grossSales,52000);
  assert.equal(changed.dataArchive.length,0);
  assert.equal(changed.recordTombstones.length,0);
}

// 8. Repeated saves after a deletion must not duplicate archive or tombstone records.
{
  localStorage.clear();
  STORAGE.save(state([entry('6','2026-08-15')]),'entry-save');
  const once=STORAGE.save(state([]),'app-save');
  const twice=STORAGE.save(state([]),'app-save');
  assert.equal(once.dataArchive.length,1);
  assert.equal(twice.dataArchive.length,1);
  assert.equal(once.recordTombstones.length,1);
  assert.equal(twice.recordTombstones.length,1);
}

// 9. A corrupt existing primary state blocks overwrite instead of replacing recoverable bytes.
{
  localStorage.clear();
  localStorage.setItem(STORAGE.primaryKey,'{broken-json');
  const loaded=STORAGE.loadCandidate();
  assert.equal(loaded.health.writeBlocked,true);
  assert.throws(()=>STORAGE.save(state([entry('7','2026-08-16')]),'entry-save'),/安全のため保存を停止/);
  assert.equal(localStorage.getItem(STORAGE.primaryKey),'{broken-json');
}

console.log('v1.4 storage integration regression: 9/9 PASS');
