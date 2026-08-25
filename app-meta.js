(function(){
  const path = location.pathname || '';
  const environment = path.includes('taxi-pay-pwa-develop') ? 'DEVELOP' : 'PRODUCTION';
  window.TAXI_PAY_APP_META = Object.freeze({
    version: '1.4β',
    build: '20260825-12',
    environment,
    cacheVersion: 'taxi-pay-v1.4-beta-20260825-12-mobile-keypad',
    releasedAtJst: '2026/08/25 12:08:08 JST'
  });
})();
