(function(){
  const path = location.pathname || '';
  const environment = path.includes('taxi-pay-pwa-develop') ? 'DEVELOP' : 'PRODUCTION';
  window.TAXI_PAY_APP_META = Object.freeze({
    version: '1.4β',
    build: '20261114-02',
    environment,
    cacheVersion: 'taxi-pay-v1.4-beta-20261114-production-dispatch-fee-02',
    releasedAtJst: '2026/11/14 00:26:56 JST'
  });
})();
