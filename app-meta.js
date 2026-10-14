(function(){
  const path = location.pathname || '';
  const environment = path.includes('taxi-pay-pwa-develop') ? 'DEVELOP' : 'PRODUCTION';
  window.TAXI_PAY_APP_META = Object.freeze({
    version: '1.4β',
    build: '20261015-01',
    environment,
    cacheVersion: 'taxi-pay-v1.4-beta-20261015-production-help-01',
    releasedAtJst: '2026/10/15 01:31:22 JST'
  });
})();
