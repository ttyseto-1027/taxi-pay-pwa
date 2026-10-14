(function(){
  const path = location.pathname || '';
  const environment = path.includes('taxi-pay-pwa-develop') ? 'DEVELOP' : 'PRODUCTION';
  window.TAXI_PAY_APP_META = Object.freeze({
    version: '1.4β',
    build: '20261014-01',
    environment,
    cacheVersion: 'taxi-pay-v1.4-beta-20261014-production-rc-01',
    releasedAtJst: '2026/10/14 22:38:40 JST'
  });
})();
