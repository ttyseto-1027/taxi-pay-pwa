(() => {
  'use strict';
  const LOG_KEY = 'taxiPayV13Diagnostics';
  const MAX_LOGS = 100;
  const now = () => new Date().toISOString();
  const logs = (() => { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } })();
  function persist(){ try { localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-MAX_LOGS))); } catch {} }
  function record(code, level='info', message='', detail=''){
    const item={code,level,message,detail:String(detail||''),at:now(),url:location.href,userAgent:navigator.userAgent};
    logs.push(item); persist(); console[level==='error'?'error':'log']('[TaxiPay]', item); return item;
  }
  function notify(message, kind='info', code='APP-READY', detail=''){
    let center=document.getElementById('notificationCenter');
    if(!center){ center=document.createElement('div'); center.id='notificationCenter'; center.className='notification-center no-print'; center.setAttribute('aria-live','polite'); document.body.appendChild(center); }
    const item=record(code,kind==='error'?'error':'info',message,detail);
    const box=document.createElement('div'); box.className=`app-notification ${kind}`;
    box.innerHTML=`<strong>${message}</strong><small>${code}／${new Date(item.at).toLocaleString('ja-JP')}</small>`;
    center.appendChild(box);
    const duration = kind === 'error' ? 12000 : (code === 'AUTH-SIGNIN-OK' || code === 'AUTH-SIGNOUT-OK' ? 1000 : 4500);
    setTimeout(()=>box.remove(), duration);
    return item;
  }
  function compatible(){
    const required=[['Promise',!!window.Promise],['fetch',!!window.fetch],['crypto.subtle',!!window.crypto?.subtle],['TextEncoder',!!window.TextEncoder],['modules','noModule' in document.createElement('script')],['localStorage',(()=>{try{localStorage.setItem('__tp','1');localStorage.removeItem('__tp');return true}catch{return false}})()]];
    return {ok:required.every(x=>x[1]),required};
  }
  window.TaxiPayDiagnostics={record,notify,compatible,getLogs:()=>logs.slice(),clear:()=>{logs.length=0;persist();}};
  window.addEventListener('error',e=>notify('予期しないエラーが発生しました。再読み込み後も続く場合は管理者へお知らせください。','error','APP-JS-01',e.message));
  window.addEventListener('unhandledrejection',e=>notify('処理を完了できませんでした。通信状態を確認して再試行してください。','error','APP-JS-01',e.reason?.message||e.reason));
})();
