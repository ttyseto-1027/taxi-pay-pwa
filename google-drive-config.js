// Google Cloud Consoleで作成した「ウェブ アプリケーション」のOAuth 2.0クライアントIDを設定します。
// Firebase Web APIキーやFirebase appIdではありません。
window.TAXI_PAY_GOOGLE_DRIVE_CONFIG = {
  clientId: ''
};

// iOS等でFirebaseの永続ログイン復元より先にDrive操作が始まった場合、
// auth.currentUser が一時的にnullとなる競合だけを吸収する。
// Drive認証方式・保存処理・保存キーは変更しない。
(() => {
  const INSTALL_TIMEOUT_MS = 15000;
  const AUTH_RESTORE_TIMEOUT_MS = 10000;
  const RETRY_INTERVAL_MS = 250;
  const startedAt = Date.now();

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function install() {
    if (window.TaxiPayDriveAuthRestoreGuardInstalled) return;

    const original = window.TaxiPayRequestDriveAuthorization;
    if (typeof original !== 'function') {
      if (Date.now() - startedAt < INSTALL_TIMEOUT_MS) setTimeout(install, 100);
      return;
    }

    window.TaxiPayDriveAuthRestoreGuardInstalled = true;
    window.TaxiPayRequestDriveAuthorization = async function(...args) {
      const deadline = Date.now() + AUTH_RESTORE_TIMEOUT_MS;
      let lastError;

      do {
        try {
          return await original.apply(this, args);
        } catch (error) {
          lastError = error;
          if (error?.code !== 'drive/not-signed-in') throw error;
          if (Date.now() >= deadline) throw error;
          await sleep(RETRY_INTERVAL_MS);
        }
      } while (Date.now() < deadline);

      throw lastError;
    };
  }

  install();
})();
