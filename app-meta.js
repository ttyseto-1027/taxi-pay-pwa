(function(){
  const path = location.pathname || '';
  const environment = path.includes('taxi-pay-pwa-develop') ? 'DEVELOP' : 'PRODUCTION';
  window.TAXI_PAY_APP_META = Object.freeze({
    version: '1.4β',
    build: '20260825-13',
    environment,
    cacheVersion: 'taxi-pay-v1.4-beta-20260825-13-production-title',
    releasedAtJst: '2026/08/25 12:15:51 JST'
  });
})();
