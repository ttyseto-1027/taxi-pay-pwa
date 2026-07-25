(() => {
  'use strict';
  const D=window.TaxiPayDiagnostics;
  const button=document.getElementById('googleLoginButton');
  const msg=document.getElementById('authMessage');
  if(button) button.disabled=true;
  if(msg){msg.textContent='認証機能を準備しています…';msg.dataset.kind='info';}
  const c=D.compatible();
  if(!c.ok){
    D.notify('この端末のOSまたはブラウザには対応していません。iOS・Safariを更新してください。','error','APP-COMPAT-01',JSON.stringify(c.required));
    if(msg) msg.textContent='この端末のOSまたはブラウザには対応していません。iOS・Safariを更新してください。';
    return;
  }
  import('./firebase-auth.js').then(mod=>{
    if(typeof mod.initializeTaxiPayAuth!=='function') throw new Error('initializeTaxiPayAuth が見つかりません。');
    return mod.initializeTaxiPayAuth();
  }).then(()=>D.record('APP-READY','info','認証機能の準備完了')).catch(err=>{
    D.notify('認証機能を読み込めませんでした。通信状態を確認して再読み込みしてください。','error','APP-MODULE-01',err?.stack||err);
    if(msg) msg.textContent='認証機能を読み込めませんでした。通信状態を確認して再読み込みしてください。';
  });
})();
