'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('index.html');
const helpLogic = read('phase7-ui.js');
const styles = read('styles.css');
const manual = read('MANUAL_user.md');

const expectedTopics = [
  'start',
  'login',
  'work',
  'monthly',
  'paidleave',
  'deductions',
  'storage',
  'drive',
  'restore',
  'update',
  'support'
];
const actualTopics = [...html.matchAll(/data-help-topic="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(actualTopics, expectedTopics, 'help topics must remain complete and ordered');

for (const id of ['helpSearch', 'helpExpandAll', 'helpCollapseAll', 'helpSearchStatus', 'helpTopicList', 'helpEmpty']) {
  assert.ok(html.includes(`id="${id}"`), `help control must exist: ${id}`);
}

assert.ok(html.includes('通常のGoogleログインだけでは、勤務実績を個人のGoogle Driveへ保存しません。'));
assert.ok(html.includes('自動バックアップではありません。ボタンを押した時点のデータだけが保存されます。'));
assert.ok(html.includes('個人のGoogle Drive内の「給与シミュレーター」フォルダへ保存されます。'));
assert.ok(html.includes('管理者へ勤務実績、売上、個人の給与設定は送信されません。'));
assert.ok(html.includes('診断情報には給与額や勤務実績は含まれません。'));

for (const match of html.matchAll(/data-help-view="([^"]+)"/g)) {
  const view = match[1];
  assert.ok(html.includes(`data-view="${view}"`), `help destination menu must exist: ${view}`);
  assert.ok(html.includes(`data-view-panel="${view}"`), `help destination panel must exist: ${view}`);
}

for (const marker of [
  "helpSearch?.addEventListener('input', filterHelp)",
  "document.getElementById('helpExpandAll')",
  "document.getElementById('helpCollapseAll')",
  "document.querySelectorAll('[data-help-view]')",
  'terms.every(term => haystack.includes(term))',
  'helpEmpty.hidden = visible !== 0'
]) {
  assert.ok(helpLogic.includes(marker), `help behavior must exist: ${marker}`);
}

for (const selector of ['.help-search-card', '.help-topic-list', '.help-topic-body', '.help-data-map', '.help-callout']) {
  assert.ok(styles.includes(selector), `help styling must exist: ${selector}`);
}

assert.ok(manual.includes('# 利用者マニュアル Version 1.4β'));
assert.ok(manual.includes('事前登録済みのGoogleアカウント'));
assert.ok(manual.includes('Google Driveへのバックアップは自動ではありません。'));
assert.ok(manual.includes('通常のGoogleログインだけでは、個人のGoogle Driveへデータを保存しません。'));
assert.doesNotMatch(manual, /本人専用のログインパスワード|β版無料利用コード|「新規登録」を選びます/);

console.log('Phase 16 help center regression: 11/11 topics PASS');
