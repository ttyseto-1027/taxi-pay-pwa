const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const recovery = fs.readFileSync(path.join(__dirname,'..','data-recovery-v14.js'),'utf8');

assert.ok(recovery.includes("const BEFORE_RECOVERY_KEY=()=>STORAGE()?.isDevelop?'taxiPayDevelopBeforeBuiltInRecoveryV1':'taxiPayBeforeBuiltInRecoveryV1';"), 'Develop and Production recovery safety backups must use separate keys');
assert.ok(recovery.includes('localStorage.setItem(BEFORE_RECOVERY_KEY(),JSON.stringify(backup))'), 'recovery must write through the environment-specific safety key');
assert.ok(!recovery.includes("localStorage.setItem('taxiPayBeforeBuiltInRecoveryV1',JSON.stringify(backup))"), 'recovery must not bypass the environment-specific key selector');
assert.ok(recovery.includes('現在の端末データへ統合する'), 'recovery action must describe the actual target');
assert.ok(!recovery.includes('本番データへ統合する'), 'recovery UI must describe the current terminal instead of assuming its environment');
assert.ok(recovery.includes('if(STORAGE().getPrimaryRaw()!==beforeRaw)'), 'recovery must stop if terminal data changed after comparison');
assert.ok(recovery.includes("STORAGE().save(merged,'manual-recovery-merge')"), 'recovery must use protected storage');
assert.ok(recovery.includes("if(wrote){try{if(beforeRaw===null)localStorage.removeItem(STORAGE().primaryKey);else localStorage.setItem(STORAGE().primaryKey,beforeRaw);"), 'failed post-write validation must roll back the exact pre-merge bytes');
assert.ok(recovery.includes("new Set(['taxi-pay-drive-v1','taxi-pay-drive-v2','taxi-pay-drive-v3'])"), 'known Drive backup schemas v1-v3 must remain readable');
assert.ok(recovery.includes("if(!supportedDriveSchemas.has(String(x.schema)))throw new Error"), 'unknown future Drive backup schemas must stop safely');
assert.ok(recovery.includes('アプリを更新してから再度お試しください。'), 'unsupported future formats must tell the user to update instead of guessing');
console.log('Phase 13 standard recovery safety regression: SUCCESS');
