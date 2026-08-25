(function(){
  const path = location.pathname || '';
  const environment = path.includes('taxi-pay-pwa-develop') ? 'DEVELOP' : 'PRODUCTION';
  window.TAXI_PAY_APP_META = Object.freeze({
    version: '1.4β',
    build: '20260825-11',
    environment,
    cacheVersion: 'taxi-pay-v1.4-beta-20260825-11-axis-ticks',
    releasedAtJst: '2026/08/25 02:43:59 JST'
  });
})();
