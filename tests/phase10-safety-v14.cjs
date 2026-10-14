'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const read=(name)=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const registry=read('device-registry-v14.js');
const drive=read('phase56-drive-backup.js');

// 1. Existing named current device must reuse its Firestore name without prompting.
assert(registry.includes('if(current?.deviceName){localStorage.setItem(NAME_KEY,current.deviceName);renderCard();return;}'));

// 2. Old users may skip mandatory naming only when the account has no named devices at all.
assert(registry.includes('if(!named.length&&!newUser)'));
assert(!registry.includes('if(current&&!current.deviceName&&!newUser)'));

// 3. If named devices exist, an unknown/unnamed browser reaches the association dialog.
assert(registry.includes('const d=ensureAssociationDialog();'));
assert(registry.includes("named.length?'登録済み端末を引き継ぐ場合は"));

// 4. Inheritance preserves the selected existing device ID/name and deletes only an unnamed transient record.
assert(registry.includes('localStorage.setItem(ID_KEY,target.id)'));
assert(registry.includes('localStorage.setItem(NAME_KEY,target.deviceName)'));
assert(registry.includes('if(old&&!old.deviceName)await deleteDoc'));
assert(!registry.includes('if(old&&old.deviceName)await deleteDoc'));

// 5. Duplicate active device names remain prohibited.
assert(registry.includes('!uniqueName(name,deviceId)'));
assert(registry.includes('同じ端末名がすでに登録されています'));

// 6. Drive actions are guarded at capture phase before their normal handlers can run.
for(const selector of ['#driveSyncNow','#driveRefreshBackups','#restoreSafetyButton','[data-drive-restore]','[data-drive-delete]']){
  assert(registry.includes(selector),`missing Drive guard: ${selector}`);
}
assert(registry.includes('e.preventDefault();e.stopImmediatePropagation();requireNamedDevice();'));
assert(registry.includes("},true);"),'Drive guard must run in capture phase');

// 7. Drive implementation itself independently refuses unnamed devices.
assert(drive.includes('function requireDeviceName()'));
assert(drive.includes('if (deviceName()) return true;'));
assert(drive.includes('Google Driveを利用する前に「利用者情報」でこの端末の名前を設定してください。'));
const requireCalls=(drive.match(/requireDeviceName\(\)/g)||[]).length;
assert(requireCalls>=2,'Drive gate must be called by at least one operation in addition to its definition');

// 8. The Develop-only association simulator is excluded from Production.
assert(!fs.existsSync(path.join(__dirname,'..','phase10-device-association-test.js')));
assert(!read('phase7-ui.js').includes("get('phase10DeviceTest')"));

console.log('Phase 10 safety regression: 8/8 PASS');
