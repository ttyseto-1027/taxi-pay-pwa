'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const app=read('app.js');
const html=read('index.html');
const draft=read('v13-features.js');
const recovery=read('data-recovery-v14.js');
const sw=read('sw.js');
const meta=JSON.parse(read('app-meta.json'));

assert.equal((html.match(/id="dispatchFee"/g)||[]).length,1);
assert.ok(html.includes('－ その他（－）－ 配車手数料'));

const match=app.match(/function calculateAdjustedGross\(\)\{([\s\S]*?)\n\}/);
assert.ok(match,'calculateAdjustedGross must exist');
const values={grossRevenue:100000,otherPlus:500,otherMinus:1000,dispatchFee:300,idleA:2000,idleB:1500};
const $=id=>({value:values[id]??0});
const adjustmentValue=id=>Math.max(0,Number($(id)?.value||0));
const calculateAdjustedGross=new Function('$','adjustmentValue',`function calculateAdjustedGross(){${match[1]}\n}\nreturn calculateAdjustedGross;`)($,adjustmentValue);
assert.equal(calculateAdjustedGross(),95700);

assert.ok(app.includes('const dispatchFee=Number(e.dispatchFee||0)'));
assert.ok(app.includes('const adjustedGrossSales=Number(e.adjustedGrossSales ?? legacyGross)'));
assert.ok(app.includes('grossSales,otherPlus,otherMinus,dispatchFee,idleA,idleB'));
assert.ok(app.includes('otherMinus:0,dispatchFee:0,idleA:0'));
assert.ok(app.includes("$('dispatchFee').value=Number(e.dispatchFee||0)"));
assert.ok(draft.includes("dispatchFee:$('dispatchFee')?.value||'0'"));
assert.ok(draft.includes("'otherMinus','dispatchFee','idleA'"));
assert.ok(app.includes("'その他（－）','配車手数料','A空転'"));
assert.ok(app.includes('leave?0:Number(e.dispatchFee||0)'));
assert.ok(recovery.includes("dispatchFee:'配車手数料'"));
assert.ok(recovery.includes('gross|Plus|Minus|Fee|idle'));
assert.equal(meta.build,'20261114-01');
assert.equal(meta.environment,'PRODUCTION');
assert.ok(sw.includes(meta.cacheVersion));

for(const forbidden of ['payroll-rules.html','payroll-rules-admin.js','phase11-live-test.js','phase10-device-association-test.js']){
  assert.equal(fs.existsSync(path.join(root,forbidden)),false,`${forbidden} must not ship in Production`);
}

console.log('Phase 18 Production dispatch fee regression: PASS');
