(() => {
  'use strict';

  const PREFIX = 'taxi-pay-';
  let lastAuthFailure = null;

  const $ = id => document.getElementById(id);

  function meta(){
    return window.TAXI_PAY_APP_META || {};
  }

  function formatJst(value){
    if(!value) return '—';
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('ja-JP',{
      timeZone:'Asia/Tokyo',
      hour12:false
    });
  }

  async function serviceWorkerInfo(){
    if(!('serviceWorker' in navigator)){
      return {label:'非対応',state:'非対応',script:''};
    }
    try{
      const reg = await navigator.serviceWorker.getRegistration('./');
      if(!reg) return {label:'未登録',state:'未登録',script:''};
      const worker = reg.active || reg.waiting || reg.installing;
      const kind =
        reg.active === worker ? 'active' :
        reg.waiting === worker ? 'waiting' :
        reg.installing === worker ? 'installing' : 'registered';
      return {
        label:'登録済み',
        state:worker ? `${kind} / ${worker.state || '状態不明'}` : '登録済み',
        script:worker?.scriptURL || ''
      };
    }catch(err){
      return {label:'取得失敗',state:String(err?.message || err),script:''};
    }
  }

  async function cacheInfo(){
    if(!('caches' in window)) return {names:[],supported:false};
    try{
      const names = (await caches.keys()).filter(name=>name.startsWith(PREFIX));
      return {names,supported:true};
    }catch{
      return {names:[],supported:true};
    }
  }

  function recentDiagnostics(){
    try{
      return (window.TaxiPayDiagnostics?.getLogs?.() || []).slice(-20);
    }catch{
      return [];
    }
  }

  function authDiagnosticState(){
    try{
      return JSON.parse(localStorage.getItem('taxiPayAuthDiagnosticV17') || '{}');
    }catch{
      return {};
    }
  }

  async function buildReport(){
    const m = meta();
    const sw = await serviceWorkerInfo();
    const caches = await cacheInfo();
    const logs = recentDiagnostics();
    const authState = authDiagnosticState();

    const data = {
      generatedAtJst:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'}).replace(' ','T') + '+09:00',
      app:{
        version:m.version || '',
        build:m.build || '',
        environment:m.environment || '',
        releasedAtJst:m.releasedAtJst || '',
        cacheVersion:m.cacheVersion || ''
      },
      runtime:{
        serviceWorker:sw.state,
        cacheNames:caches.names,
        currentUrl:location.href,
        userAgent:navigator.userAgent,
        online:navigator.onLine,
        standalone:window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
          navigator.standalone === true
      },
      authFailure:lastAuthFailure ? {
        code:lastAuthFailure.code || '',
        message:lastAuthFailure.message || '',
        at:lastAuthFailure.at || ''
      } : null,
      authDiagnostic:{
        current:authState.current || '',
        lastError:authState.lastError || null,
        steps:Array.isArray(authState.steps) ? authState.steps.slice(-20) : []
      },
      recentLogs:logs.map(x=>({
        code:x.code,
        level:x.level,
        message:x.message,
        detail:x.detail || '',
        at:x.at
      }))
    };

    return [
      '【タクシー給与シミュレーター 診断情報】',
      JSON.stringify(data,null,2)
    ].join('\n');
  }

  async function copyReport(messageId){
    const message = $(messageId);
    try{
      const text = await buildReport();
      await navigator.clipboard.writeText(text);
      if(message) message.textContent = '診断情報をコピーしました。';
    }catch{
      const text = await buildReport();
      window.prompt('下の診断情報をコピーしてください。',text);
      if(message) message.textContent = '診断情報を表示しました。';
    }
  }

  async function copyText(text,messageId){
    const message=$(messageId);
    try{await navigator.clipboard.writeText(text);if(message)message.textContent='アカウント変更申請をコピーしました。';}
    catch{window.prompt('下の内容をコピーして管理者へお知らせください。',text);if(message)message.textContent='アカウント変更申請を表示しました。';}
  }

  async function copyAccountChangeRequest(){
    const email=String($('accountChangeNewEmail')?.value||'').trim();
    if(!/^\S+@\S+\.\S+$/.test(email)){const m=$('accountChangeMessage');if(m)m.textContent='変更先Googleアカウントのメールアドレスを確認してください。';return;}
    const p=window.TaxiPayCurrentProfile||{};
    const text=['【Googleアカウント変更申請】',`申請日時: ${new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})} JST`,`氏名: ${p.name||p.displayName||'—'}`,`乗務員番号: ${p.driverNumber||'—'}`,`現在のGoogleアカウント: ${p.email||'—'}`,`変更先Googleアカウント: ${email}`,'','※この申請だけでは変更されません。管理者による本人確認が必要です。'].join('\\n');
    await copyText(text,'accountChangeMessage');
  }

  async function copyLoginFailureChangeRequest(){
    const name=String($('diagChangeName')?.value||'').trim(),driver=String($('diagChangeDriverNumber')?.value||'').trim(),email=String($('diagChangeNewEmail')?.value||'').trim();
    const m=$('diagChangeMessage');
    if(!name||!driver||!/^\S+@\S+\.\S+$/.test(email)){if(m)m.textContent='氏名・乗務員番号・変更先Googleアカウントを確認してください。';return;}
    const report=await buildReport();
    const text=['【旧Googleアカウント ログイン不能・変更申請】',`申請日時: ${new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})} JST`,`氏名: ${name}`,`乗務員番号: ${driver}`,`変更先Googleアカウント: ${email}`,'','【診断ログ】',report,'','※管理者が本人へ「この端末からの変更申請で間違いないか」を確認した後に変更処理してください。'].join('\\n');
    await copyText(text,'diagChangeMessage');
  }

  async function rebuildCache(messageId){
    const message = $(messageId);
    if(message) message.textContent = 'PWAキャッシュを再構築しています…';
    try{
      if('caches' in window){
        const names = await caches.keys();
        await Promise.all(
          names.filter(name=>name.startsWith(PREFIX)).map(name=>caches.delete(name))
        );
      }

      if('serviceWorker' in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(async reg=>{
          try{
            if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
            await reg.update();
          }catch{}
        }));
      }

      if(message) message.textContent = 'PWAキャッシュを再構築しました。';
      await renderAppInfo();
    }catch(err){
      if(message) message.textContent = `再構築できませんでした：${err?.message || err}`;
    }
  }

  async function renderAppInfo(){
    const m = meta();
    const sw = await serviceWorkerInfo();

    const pairs = [
      ['profileAppVersion',m.version || '—'],
      ['profileAppBuild',m.build || '—'],
      ['profileAppReleasedAt',m.releasedAtJst || '—'],
      ['profileAppServiceWorker',sw.state],
      ['profileAppCacheVersion',m.cacheVersion || '—'],
      ['diagModeAppVersion',m.version || '—'],
      ['diagModeAppBuild',m.build || '—'],
      ['diagModeAppReleasedAt',m.releasedAtJst || '—'],
      ['diagModeServiceWorker',sw.state],
      ['diagModeCacheVersion',m.cacheVersion || '—']
    ];

    pairs.forEach(([id,value])=>{
      const node=$(id);
      if(node) node.textContent=value;
    });

    if($('diagModeAuthError')){
      $('diagModeAuthError').textContent = lastAuthFailure
        ? `${lastAuthFailure.code || 'AUTH'}：${lastAuthFailure.message || '認証を完了できませんでした。'}`
        : '—';
    }
  }

  function openDiagnosticMode(detail={}){
    lastAuthFailure = {
      code:detail.code || 'AUTH-UNKNOWN',
      message:detail.message || 'Googleログインを完了できませんでした。',
      at:detail.at || new Date().toISOString()
    };

    const gate=$('authGate');
    if(gate) gate.hidden=true;

    const mode=$('profileDiagnosticMode');
    if(mode) mode.hidden=false;

    document.body.classList.remove('auth-pending');

    if($('profileLoginFailureMessage')){
      $('profileLoginFailureMessage').textContent =
        detail.message || 'Googleログインを完了できませんでした。';
    }

    renderAppInfo();
    window.scrollTo({top:0,behavior:'auto'});
  }

  function closeDiagnosticMode(){
    const mode=$('profileDiagnosticMode');
    if(mode) mode.hidden=true;
    const gate=$('authGate');
    if(gate){
      gate.hidden=false;
      gate.removeAttribute('aria-hidden');
    }
    document.body.classList.add('auth-pending');
  }

  function retryLogin(){
    closeDiagnosticMode();
    const login=$('googleLoginButton');
    if(login && !login.disabled){
      login.click();
    }else{
      const message=$('authMessage');
      if(message) message.textContent='Googleログインボタンを押して再試行してください。';
    }
  }

  window.TaxiPayProfileDiagnostics = {
    openLoginFailure:openDiagnosticMode,
    render:renderAppInfo,
    copyReport,
    rebuildCache
  };

  window.addEventListener('taxipay:auth-failure',event=>{
    openDiagnosticMode(event.detail || {});
  });

  window.addEventListener('taxipay:app-ready',()=>{
    const mode=$('profileDiagnosticMode');
    if(mode) mode.hidden=true;
    renderAppInfo();
  });

  document.addEventListener('DOMContentLoaded',()=>{
    $('copyProfileDiagnostic')?.addEventListener('click',()=>copyReport('profileDiagnosticMessage'));
    $('copyLoginFailureDiagnostic')?.addEventListener('click',()=>copyReport('diagModeMessage'));
    $('rebuildProfileCache')?.addEventListener('click',()=>rebuildCache('profileDiagnosticMessage'));
    $('rebuildLoginFailureCache')?.addEventListener('click',()=>rebuildCache('diagModeMessage'));
    $('retryGoogleLogin')?.addEventListener('click',retryLogin);
    $('copyAccountChangeRequest')?.addEventListener('click',copyAccountChangeRequest);
    $('copyLoginFailureChangeRequest')?.addEventListener('click',copyLoginFailureChangeRequest);
    renderAppInfo();
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') renderAppInfo();
  });
})();