(function(){
  'use strict';
  const meta=window.TAXI_PAY_APP_META||{};
  const PREFIX='taxi-pay-';
  const LAST_EXPLICIT_CACHE_VERSION_KEY='taxiPayLastExplicitCacheVersionV2';
  const PENDING_CACHE_VERSION_KEY='taxiPayPendingCacheVersionV2';
  let reloading=false;

  async function clearAppCaches(){
    if(!('caches' in window)) return;
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith(PREFIX)).map(k=>caches.delete(k)));
  }

  async function fetchLatestMeta(){
    const url=new URL('./app-meta.json',location.href);
    url.searchParams.set('_',Date.now());
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok) throw new Error(`app-meta.json ${res.status}`);
    return res.json();
  }

  function ensureUpdateBanner(){
    let bar=document.getElementById('cacheUpdateBannerV14');
    if(bar) return bar;
    bar=document.createElement('div');
    bar.id='cacheUpdateBannerV14';
    bar.hidden=true;
    bar.setAttribute('role','status');
    bar.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;padding:12px 14px;border-radius:12px;background:#fff;border:2px solid #c45100;box-shadow:0 4px 18px rgba(0,0,0,.2);display:flex;gap:12px;align-items:center;justify-content:space-between;font-size:14px;';
    bar.innerHTML='<strong>キャッシュ更新</strong><span id="cacheUpdateTextV14" style="flex:1">新しいバージョンがあります。</span><button type="button" id="applyCacheUpdateV14">更新する</button>';
    document.body.appendChild(bar);
    return bar;
  }

  function showUpdateBanner(text='新しいバージョンがあります。'){
    const bar=ensureUpdateBanner();
    const msg=document.getElementById('cacheUpdateTextV14');
    if(msg) msg.textContent=text;
    bar.hidden=false;
    bar.style.display='flex';
    return bar;
  }

  function hideUpdateBanner(){
    const bar=document.getElementById('cacheUpdateBannerV14');
    if(!bar) return;
    bar.hidden=true;
    bar.style.display='none';
  }

  async function ensureServiceWorker(){
    if(!('serviceWorker' in navigator)) return null;
    const swUrl=new URL('./sw.js',location.href);
    swUrl.searchParams.set('_',Date.now());
    let reg=await navigator.serviceWorker.getRegistration('./');
    if(!reg){
      reg=await navigator.serviceWorker.register(swUrl.toString(),{scope:'./',updateViaCache:'none'});
    }else{
      await reg.update();
    }
    return reg;
  }

  function reloadForBuild(build){
    const url=new URL(location.href);
    url.searchParams.set('_appbuild',String(build||Date.now()));
    location.replace(url.toString());
  }

  async function applyCacheUpdate(){
    const button=document.getElementById('applyCacheUpdateV14');
    if(button){button.disabled=true;button.textContent='更新中…';}
    try{
      const latest=await fetchLatestMeta().catch(()=>meta);
      const targetVersion=String(latest.cacheVersion||meta.cacheVersion||'');
      if(targetVersion) localStorage.setItem(PENDING_CACHE_VERSION_KEY,targetVersion);
      await clearAppCaches();
      const reg=await ensureServiceWorker();
      if(reg?.waiting){
        await new Promise(resolve=>{
          const timer=setTimeout(resolve,3000);
          navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
          reg.waiting.postMessage({type:'SKIP_WAITING'});
        });
      }
      hideUpdateBanner();
      if(!reloading){reloading=true;reloadForBuild(latest.build||meta.build);}
    }catch(err){
      console.warn('cache update failed',err);
      localStorage.removeItem(PENDING_CACHE_VERSION_KEY);
      const msg=document.getElementById('cacheUpdateTextV14');
      if(msg) msg.textContent='更新に失敗しました。もう一度お試しください。';
      if(button){button.disabled=false;button.textContent='更新する';}
    }
  }

  async function checkForUpdate(){
    try{
      const latest=await fetchLatestMeta();
      const currentVersion=String(meta.cacheVersion||'');
      const latestVersion=String(latest.cacheVersion||'');
      const pending=String(localStorage.getItem(PENDING_CACHE_VERSION_KEY)||'');
      let applied=String(localStorage.getItem(LAST_EXPLICIT_CACHE_VERSION_KEY)||'');

      // 「更新する」を押した直後の再読込で、実際に対象Buildが読み込めた時だけ
      // 明示更新済みとして確定する。旧V1の自動記録は参照しない。
      if(pending && pending===latestVersion && currentVersion===pending){
        localStorage.setItem(LAST_EXPLICIT_CACHE_VERSION_KEY,pending);
        localStorage.removeItem(PENDING_CACHE_VERSION_KEY);
        applied=pending;
      }

      // 完全な初回訪問でService Workerにも未制御なら、現在Buildを初期基準値にする。
      // 既存端末では旧V1記録を移行せず、必ず一度明示更新を要求する。
      if(!applied && !pending && !navigator.serviceWorker?.controller && currentVersion && currentVersion===latestVersion){
        localStorage.setItem(LAST_EXPLICIT_CACHE_VERSION_KEY,currentVersion);
        applied=currentVersion;
      }

      if(latestVersion && applied!==latestVersion){
        showUpdateBanner(`Build ${latest.build||''} の更新があります。`);
      }else{
        hideUpdateBanner();
      }
    }catch(err){
      console.warn('cache update check failed',err);
    }
  }

  function wireUpdateButton(){
    const bar=ensureUpdateBanner();
    const button=bar.querySelector('#applyCacheUpdateV14');
    if(button && !button.dataset.bound){
      button.dataset.bound='1';
      button.addEventListener('click',applyCacheUpdate);
    }
  }

  window.TaxiPayPhase75={meta,clearAppCaches,fetchLatestMeta,ensureServiceWorker,checkForUpdate,applyCacheUpdate,developNoCache:false};
  document.addEventListener('DOMContentLoaded',async()=>{
    wireUpdateButton();
    await ensureServiceWorker().catch(err=>console.warn('service worker setup failed',err));
    await checkForUpdate();
  });
})();
