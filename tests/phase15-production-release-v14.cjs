'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');

const index = read('index.html');
const serviceWorker = read('sw.js');
const metaScript = read('app-meta.js');
const metaJson = JSON.parse(read('app-meta.json'));
const manifest = JSON.parse(read('manifest.json'));
const storage = read('storage-safety.js');
const phase7 = read('phase7-ui.js');
const workflow = read('.github/workflows/production-release.yml');
const history = read('IMPLEMENTATION_HISTORY_v1.4beta.md');
const rootEntries = fs.readdirSync(root);

function metaScriptField(name) {
  const match = metaScript.match(new RegExp(`${name}:\\s*'([^']+)'`));
  assert.ok(match, `app-meta.js must define ${name}`);
  return match[1];
}

for (const field of ['version', 'build', 'cacheVersion', 'releasedAtJst']) {
  assert.equal(metaScriptField(field), metaJson[field], `metadata mismatch: ${field}`);
}
assert.equal(metaJson.environment, 'PRODUCTION');
assert.match(metaJson.build, /^\d{8}-\d{2}$/);
assert.match(metaJson.releasedAtJst, /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} JST$/);
assert.ok(metaJson.cacheVersion.includes(metaJson.build.slice(0, 8)));
assert.equal(serviceWorker.match(/const CACHE = '([^']+)'/)?.[1], metaJson.cacheVersion);
assert.equal(manifest.name, 'タクシー給与シミュレーター');
assert.equal(manifest.short_name, '給与');
assert.equal(manifest.description, 'タクシー乗務員向け給与概算シミュレーター');
assert.doesNotMatch(JSON.stringify(manifest), /DEVELOP|Develop/);

assert.ok(index.includes('<title>タクシー給与シミュレーター</title>'));
assert.ok(!index.includes('Develop版'));
assert.ok(!phase7.includes('Develop版 タクシー給与シミュレーター'));
assert.ok(!phase7.includes("header.classList.add('develop-header')"));
assert.ok(!phase7.includes("get('phase11Test')"));
assert.ok(!phase7.includes("get('phase10DeviceTest')"));
for (const file of ['phase11-live-test.js', 'phase10-device-association-test.js']) {
  assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must not ship to Production`);
  assert.equal(serviceWorker.includes(file), false, `${file} must not be cached in Production`);
}

for (const file of rootEntries) {
  assert.ok(
    !/^IMPLEMENTATION_(?!HISTORY_v1\.4beta\.md$)/.test(file),
    `legacy implementation note must remain in Git history: ${file}`
  );
  assert.ok(!/^README-.+\.(?:md|txt)$/.test(file), `temporary README must remain in Git history: ${file}`);
  assert.ok(!/\.tmp$/.test(file), `temporary file must not ship to Production: ${file}`);
}
for (const file of ['menu.js', 'menu-v13beta.js', 'SPEC_v1.md', 'SYSTEM_SPEC_v1.md', 'UI_DESIGN_SPEC_v1.md']) {
  assert.equal(fs.existsSync(path.join(root, file)), false, `legacy file must remain in Git history: ${file}`);
}

assert.ok(storage.includes("const primaryKey = isDevelop ? 'taxiPayPwaDevelopStateV10' : 'taxiPayPwaStateV10';"));
assert.ok(storage.includes("const recoveryKey = isDevelop ? 'taxiPayDevelopRecoverySnapshotsV1' : 'taxiPayRecoverySnapshotsV1';"));
assert.ok(metaScript.includes("path.includes('taxi-pay-pwa-develop') ? 'DEVELOP' : 'PRODUCTION'"));

const requiredOrder = [
  'storage-safety.js',
  'data-integrity-v14.js',
  'app.js',
  'data-recovery-v14.js',
  'device-registry-v14.js',
  'phase56-drive-backup.js'
];
const positions = requiredOrder.map(file => index.indexOf(file));
assert.ok(positions.every(position => position >= 0), 'all protected runtime files must be loaded');
assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'protected runtime load order must remain stable');

const localAsset = value => {
  const clean = String(value || '').split(/[?#]/)[0];
  if (!clean || /^(?:https?:)?\/\//i.test(clean) || clean.startsWith('data:')) return '';
  return clean.replace(/^\.\//, '').replace(/^\//, '');
};
const assets = new Set();
for (const pattern of [/<script\b[^>]*\bsrc=["']([^"']+)["']/g, /<link\b[^>]*\bhref=["']([^"']+)["']/g]) {
  for (const match of index.matchAll(pattern)) {
    const asset = localAsset(match[1]);
    if (asset) assets.add(asset);
  }
}
for (const asset of assets) {
  assert.ok(fs.existsSync(path.join(root, asset)), `index asset must exist: ${asset}`);
  assert.ok(serviceWorker.includes(`'./${asset}'`), `index asset must be cached: ${asset}`);
}

for (const match of serviceWorker.matchAll(/'\.\/([^']+)'/g)) {
  assert.ok(fs.existsSync(path.join(root, match[1])), `Service Worker asset must exist: ${match[1]}`);
}
for (const htmlFile of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  const html = read(htmlFile);
  for (const pattern of [/<script\b[^>]*\bsrc=["']([^"']+)["']/g, /<link\b[^>]*\bhref=["']([^"']+)["']/g]) {
    for (const match of html.matchAll(pattern)) {
      const asset = localAsset(match[1]);
      if (asset) assert.ok(fs.existsSync(path.join(root, asset)), `${htmlFile} asset must exist: ${asset}`);
    }
  }
}

const expectedHashes = {
  'firebase-config.js': '7061c0146512a75377e5116aa82bbfd1dfccebff145c4b795f8c3f0d58db99cc',
  'firestore.rules': 'dca4213c4e37d8e7596bf6be93b6791b4ffcb883032648761430c137e25e12ee',
  'tax-table-2026.js': '81ae778d4e930542147e4edf2ba5a34ed0589565957f485bce91ee6a0d3787aa'
};
for (const [file, expected] of Object.entries(expectedHashes)) assert.equal(sha256(file), expected, `${file} changed from Production baseline`);

const testFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.cjs')).sort();
for (const testFile of testFiles) assert.ok(workflow.includes(`node tests/${testFile}`), `CI must run ${testFile}`);

assert.ok(history.includes('Develop実機確認合格・Production選別移植'));
assert.ok(history.includes('85597dca050d5dbe4c78cd00cc3e579ce30e6c13'));
assert.ok(history.includes('backup/production-pre-phase14-20261001'));
assert.ok(history.includes('Productionを1回開いて以前の作業データが残っていることだけ'));

console.log('Phase 15 Production release gate: SUCCESS');
