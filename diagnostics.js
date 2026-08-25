(() => {
  'use strict';
  const LOG_KEY = 'taxiPayV13Diagnostics';
  const MAX_LOGS = 100;
  const now = () => new Date().toISOString();
  const logs = (() => { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } })();

  function serializeError(error, fallback = {}) {
    const err = error || {};
    return {
      name: err.name || fallback.name || '',
      message: err.message || fallback.message || String(err || ''),
      code: err.code || fallback.code || '',
      filename: fallback.filename || err.fileName || '',
      lineno: fallback.lineno ?? err.lineNumber ?? '',
      colno: fallback.colno ?? err.columnNumber ?? '',
      stack: typeof err.stack === 'string' ? err.stack : ''
    };
  }

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
    if(kind === 'error' && (String(code).startsWith('AUTH-') || code === 'APP-MODULE-01')){
      window.dispatchEvent(new CustomEvent('taxipay:auth-failure',{
        detail:{message,code,detail:String(detail||''),at:item.at}
      }));
    }
    return item;
  }
  function compatible(){
    const required=[['Promise',!!window.Promise],['fetch',!!window.fetch],['crypto.subtle',!!window.crypto?.subtle],['TextEncoder',!!window.TextEncoder],['modules','noModule' in document.createElement('script')],['localStorage',(()=>{try{localStorage.setItem('__tp','1');localStorage.removeItem('__tp');return true}catch{return false}})()]];
    return {ok:required.every(x=>x[1]),required};
  }
  window.TaxiPayDiagnostics={record,notify,compatible,getLogs:()=>logs.slice(),clear:()=>{logs.length=0;persist();}};
  window.addEventListener('error',e=>{
    const detail=serializeError(e.error,{
      message:e.message,
      filename:e.filename,
      lineno:e.lineno,
      colno:e.colno
    });
    notify(
      '予期しないエラーが発生しました。再読み込み後も続く場合は管理者へお知らせください。',
      'error',
      'APP-JS-01',
      JSON.stringify(detail)
    );
  });
  window.addEventListener('unhandledrejection',e=>{
    const detail=serializeError(e.reason,{
      message:typeof e.reason==='string'?e.reason:''
    });
    notify(
      '処理中に予期しないエラーが発生しました。再読み込み後も続く場合は管理者へお知らせください。',
      'error',
      'APP-PROMISE-01',
      JSON.stringify(detail)
    );
  });
})();
