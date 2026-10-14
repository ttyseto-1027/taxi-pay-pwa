(() => {
  'use strict';
  const D=window.TaxiPayDiagnostics;
  const I=window.TaxiPayInlineDiagnostic; I?.add('V17-BOOT-001','boot.js を開始しました。');

  // Phase 11: data-recovery-v14.js の後段で、退避データ復元UIだけを追加する。
  // 認証処理とは独立しており、読み込み失敗時もログイン処理は継続する。
  try{
    const phase11=document.createElement('script');
    phase11.src='phase11-archive-restore.js?v=20261014-01';
    phase11.async=true;
    phase11.onerror=()=>I?.add('PHASE11-LOAD-FAIL','Phase 11退避復元モジュールを読み込めませんでした。');
    document.head.appendChild(phase11);
  }catch(e){I?.add('PHASE11-LOAD-FAIL','Phase 11退避復元モジュールの読み込み準備に失敗しました。',e);}

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
  import('./firebase-auth.js?v=20261014-01').then(mod=>{ I?.add('V17-MODULE-OK','firebase-auth.js を読み込みました。');
    if(typeof mod.initializeTaxiPayAuth!=='function') throw new Error('initializeTaxiPayAuth が見つかりません。');
    return mod.initializeTaxiPayAuth();
  }).then(()=>{I?.add('V17-AUTH-READY','認証機能の準備が完了しました。'); return D.record('APP-READY','info','認証機能の準備完了');}).catch(err=>{ I?.add('V17-MODULE-FAIL','認証機能の読み込みに失敗しました。',err);
    D.notify('認証機能を読み込めませんでした。通信状態を確認して再読み込みしてください。','error','APP-MODULE-01',err?.stack||err);
    if(msg) msg.textContent='認証機能を読み込めませんでした。通信状態を確認して再読み込みしてください。';
  });
})();
