const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const drive = fs.readFileSync(path.join(__dirname,'..','phase56-drive-backup.js'),'utf8');
const integrity = fs.readFileSync(path.join(__dirname,'..','data-integrity-v14.js'),'utf8');

assert.ok(drive.includes("schema: 'taxi-pay-drive-v3'"));
assert.ok(drive.includes('TaxiPayDataIntegrity?.ensureState?.(parsed)'));
for (const key of ['dataArchive','conflictHistory','deletionHistory','recordTombstones']) assert.ok(integrity.includes(key), key);
assert.ok(drive.includes('function normalizedBackupState(backup)'));
assert.ok(drive.includes('TaxiPayDataIntegrity?.ensureState?.(backup.data.state)'));
assert.ok(drive.includes('window.TaxiPayRecoveryV14.resolveStates('));
assert.ok(drive.includes('const resolved = await resolver('));
assert.ok(drive.includes('remoteState'));
assert.ok(drive.includes('if (!requireDeviceName()) return;'));
assert.ok(drive.includes('const backupName = `backup-${jstStamp()}.json`;'));
assert.ok(drive.includes('await uploadJson(backupName, snapshot);'));
assert.ok(drive.includes("await uploadJson('current.json', snapshot"));
assert.ok(drive.includes("if ($('driveRefreshBackups')) $('driveRefreshBackups').disabled = syncing;"));
assert.ok(!drive.includes("$('driveRefreshBackups').disabled = !connected"));
const refreshStart = drive.indexOf('async function refreshBackups()');
const refreshEnd = drive.indexOf('async function readDrive', refreshStart);
const refreshBody = drive.slice(refreshStart, refreshEnd);
assert.ok(refreshBody.includes('await ensureDriveAccess();'), 'backup list refresh must reauthorize Drive when the session token is absent');
const restoreStart = drive.indexOf('async function restoreDrive(id)');
const restoreEnd = drive.indexOf('function restoreSafety()', restoreStart);
const restoreBody = drive.slice(restoreStart, restoreEnd);
assert.ok(restoreBody.includes('saveSafety();'), 'restore must save a pre-restore safety snapshot');
assert.ok(restoreBody.includes('const remoteState = normalizedBackupState(backup);'), 'restore must normalize the selected generation');
assert.ok(restoreBody.includes('const localState ='), 'restore must compare against the current terminal state');
assert.ok(restoreBody.includes('const resolved = await resolver('), 'restore must pass through the conflict resolver');
assert.ok(restoreBody.includes("if (!resolved) {"), 'restore must support cancellation without applying data');
assert.ok(restoreBody.indexOf("if (!resolved) {") < restoreBody.indexOf('applyPayload(backup, resolved.state);'), 'restore must not apply before conflict resolution completes');
assert.ok(restoreBody.includes("msg('driveBackupMessage', '復元の競合確認をキャンセルしました。端末データは変更していません。', 'info');"), 'cancel path must explicitly leave terminal data unchanged');
assert.ok(restoreBody.includes('applyPayload(backup, resolved.state);'), 'restore must apply only the resolved state');
assert.ok(drive.includes("storageApi.saveRecoverySnapshot('before-drive-restore');"), 'apply path must retain a recovery snapshot');
assert.ok(restoreBody.includes('Google Driveにはまだバックアップしていません。内容を確認してください。'), 'restore must not silently resync Drive');
const parserStart = drive.indexOf('function parseDriveJsonText(raw)');
const parserEnd = drive.indexOf('async function readDrive(id)', parserStart);
assert.ok(parserStart >= 0 && parserEnd > parserStart, 'Drive JSON parser must exist before readDrive');
const parserSource = drive.slice(parserStart, parserEnd);
const parseDriveJsonText = new Function(`${parserSource}; return parseDriveJsonText;`)();
assert.deepEqual(
  parseDriveJsonText('\uFEFF  {"schema":"taxi-pay-drive-v3","data":{"state":{}}}  '),
  {schema:'taxi-pay-drive-v3', data:{state:{}}},
  'Drive JSON parser must accept a UTF-8 BOM and surrounding whitespace'
);
assert.throws(
  () => parseDriveJsonText('   '),
  /バックアップファイルが空です/,
  'empty Drive files must stop with a clear message'
);
assert.throws(
  () => parseDriveJsonText('{broken'),
  /バックアップJSONを読み取れませんでした/,
  'invalid Drive JSON must stop before restore'
);
const readDriveStart = drive.indexOf('async function readDrive(id)');
const readDriveEnd = drive.indexOf('function saveSafety()', readDriveStart);
const readDriveBody = drive.slice(readDriveStart, readDriveEnd);
assert.ok(readDriveBody.includes("'text'"), 'Drive media must be read as text before explicit parsing');
assert.ok(drive.includes("if (responseType === 'text') return response.text();"), 'api must support raw text responses');
assert.ok(readDriveBody.includes('return parseDriveJsonText(raw);'), 'Drive restore must use the guarded parser');

const ensureAccessStart = drive.indexOf('async function ensureDriveAccess()');
const ensureAccessEnd = drive.indexOf('function storageApiSnapshot()', ensureAccessStart);
const ensureAccessBody = drive.slice(ensureAccessStart, ensureAccessEnd);
assert.ok(ensureAccessBody.includes('sessionStorage.getItem(TOKEN_KEY)'), 'Drive access must reuse only the dedicated Drive token');
assert.ok(
  !drive.includes("sessionStorage.getItem('taxipay:google-api-access-token')"),
  'ordinary Google login tokens must never be treated as Drive-authorized tokens'
);
const bindStart = drive.indexOf('function bind()');
const bindEnd = drive.indexOf("document.readyState === 'loading'", bindStart);
const bindBody = drive.slice(bindStart, bindEnd);
assert.ok(bindBody.includes('sessionStorage.getItem(TOKEN_KEY)'), 'initial Drive state must use the dedicated token key');
assert.ok(drive.includes('/insufficient authentication scopes/i'), 'Drive scope errors must be recognized explicitly');
assert.ok(
  drive.includes('Google Driveの利用権限が不足しています。'),
  'Drive scope errors must be translated into a clear Japanese message'
);

console.log('Phase 12 Drive safety regression: SUCCESS');
