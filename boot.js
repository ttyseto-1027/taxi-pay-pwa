(() => {
  'use strict';
  const D=window.TaxiPayDiagnostics;
  const I=window.TaxiPayInlineDiagnostic; I?.add('V17-BOOT-001','boot.js を開始しました。');
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
  I?.add('V17-MODULE-START','firebase-auth.js の読み込みを開始します。');
  import('./firebase-auth.js?v=20260804-phase7-r2').then(mod=>{ I?.add('V17-MODULE-OK','firebase-auth.js を読み込みました。');
    if(typeof mod.initializeTaxiPayAuth!=='function') throw new Error('initializeTaxiPayAuth が見つかりません。');
    return mod.initializeTaxiPayAuth();
  }).then(()=>{I?.add('V17-AUTH-READY','認証機能の準備が完了しました。'); return D.record('APP-READY','info','認証機能の準備完了');}).catch(err=>{ I?.add('V17-MODULE-FAIL','認証機能の読み込みに失敗しました。',err);
    D.notify('認証機能を読み込めませんでした。通信状態を確認して再読み込みしてください。','error','APP-MODULE-01',err?.stack||err);
    if(msg) msg.textContent='認証機能を読み込めませんでした。通信状態を確認して再読み込みしてください。';
  });
})();
