'use strict';
(() => {
  const IS_DEVELOP=!!window.TaxiPayStorageSafety?.isDevelop;
  const TOKEN_KEY = IS_DEVELOP?'taxiPayDevelopDriveTokenV1':'taxiPayDriveTokenV1';
  const META_KEY = IS_DEVELOP?'taxiPayDevelopDriveMetaV2':'taxiPayDriveMetaV2';
  const DEVICE_KEY = 'taxiPayDeviceNameV2';
  const SAFETY_KEY = IS_DEVELOP?'taxiPayDevelopBeforeRestoreV1':'taxiPayBeforeRestoreV1';
  const SALES_TARGET_PREFIX=IS_DEVELOP?'taxiPayDevelopSalesTarget:v1:':'taxiPaySalesTarget:v1:';
  const LAST_IMPORTED_KEY=IS_DEVELOP?'taxiPayDevelopLastImportedAtJst':'taxiPayLastImportedAtJst';
  const FOLDER_NAME = '給与シミュレーター';
  const RETENTION_DAYS = 90;

  let accessToken = '';
  let folderId = '';
  let syncing = false;

  const $ = id => document.getElementById(id);

  const jstParts = (date = new Date()) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(date).map(x => [x.type, x.value])
    );

  const jstNow = () => {
    const p = jstParts();
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`;
  };

  const jstStamp = () => {
    const p = jstParts();
    return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}-JST`;
  };

  const formatJst = value => value
    ? new Date(value).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' JST'
    : '—';

  const formatBytes = value => {
    const n = Number(value || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
    return `${(n / 1024 ** 2).toFixed(1)} MB`;
  };

  const esc = value => String(value ?? '').replace(
    /[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );

  function meta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveMeta(patch) {
    localStorage.setItem(META_KEY, JSON.stringify({...meta(), ...patch}));
    renderStatus();
  }

  function msg(id, text = '', kind = 'info') {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function deviceName() {
    return String(window.TaxiPayDeviceRegistry?.getCurrent?.().deviceName || localStorage.getItem(DEVICE_KEY) || '').trim();
  }
  function requireDeviceName() {
    if (deviceName()) return true;
    window.TaxiPayDeviceRegistry?.requireNamedDevice?.();
    msg('driveSyncMessage', 'Google Driveを利用する前に「利用者情報」でこの端末の名前を設定してください。', 'error');
    return false;
  }

  function payload() {
    const storageApi = window.TaxiPayStorageSafety;
    const state = storageApi?.getPrimaryRaw() || (storageApi?.getHealth().sourceKey ? localStorage.getItem(storageApi.getHealth().sourceKey) : null);
    if (!state) {
      throw new Error('端末に保存された給与シミュレーターデータがありません。');
    }

    const salesTargets = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SALES_TARGET_PREFIX)) {
        salesTargets[key] = localStorage.getItem(key);
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(state);
    } catch {
      throw new Error('端末データを読み取れませんでした。');
    }

    return {
      schema: 'taxi-pay-drive-v3',
      savedAtJst: jstNow(),
      deviceName: deviceName(),
      deviceId: window.TaxiPayDataIntegrity?.deviceId?.() || '',
      browser: window.TaxiPayDataIntegrity?.browserName?.() || '',
      appVersion: window.TAXI_PAY_APP_META?.version || '',
      appBuild: window.TAXI_PAY_APP_META?.build || '',
      data: {
        state: window.TaxiPayDataIntegrity?.ensureState?.(parsed) || parsed,
        salesTargets
      }
    };
  }

  function normalizedBackupState(backup) {
    if (!backup?.data?.state || typeof backup.data.state !== 'object' ||
        !Array.isArray(backup.data.state.entries) || !Array.isArray(backup.data.state.history)) {
      throw new Error('給与シミュレーターのバックアップ形式ではありません。');
    }
    // v1/v2など旧Driveバックアップは、新しい保全配列がなくても空配列として読み込む。
    return window.TaxiPayDataIntegrity?.ensureState?.(backup.data.state) || backup.data.state;
  }

  function applyPayload(backup, stateOverride = null) {
    const restoredState = stateOverride || normalizedBackupState(backup);
    const storageApi = window.TaxiPayStorageSafety;
    if (!storageApi) throw new Error('保存保護機能を読み込めませんでした。');
    storageApi.saveRecoverySnapshot('before-drive-restore');
    storageApi.save(restoredState, 'drive-restore');

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SALES_TARGET_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    Object.entries(backup.data.salesTargets || {}).forEach(([key, value]) => {
      localStorage.setItem(key, String(value));
    });

    localStorage.setItem(LAST_IMPORTED_KEY, jstNow());
  }

  function summary(backup) {
    const state = backup?.data?.state || {};
    const entries = Array.isArray(state.entries) ? state.entries : [];
    const history = Array.isArray(state.history) ? state.history : [];
    const dates = entries.map(x => x.date).filter(Boolean).sort();

    return {
      daily: entries.length,
      monthly: history.length,
      period: dates.length ? `${dates[0]} ～ ${dates.at(-1)}` : '—'
    };
  }

  function renderStatus() {
    const m = meta();
    const connected = !!accessToken;

    if ($('driveConnectionStatus')) {
      $('driveConnectionStatus').textContent = connected
        ? 'この画面で利用可能'
        : (m.driveScopeGranted ? 'バックアップ時に自動確認' : '初回バックアップ時に権限確認');
    }

    if ($('driveLastSync')) {
      $('driveLastSync').textContent = m.lastSyncAt ? formatJst(m.lastSyncAt) : '—';
    }

    if ($('driveSyncNow')) $('driveSyncNow').disabled = syncing;
    if ($('driveRefreshBackups')) $('driveRefreshBackups').disabled = syncing;
  }

  function clearDriveSession() {
    accessToken = '';
    folderId = '';
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem('taxipay:google-api-access-token');
    renderStatus();
  }

  function driveApiErrorMessage(status, errorData = {}) {
    const errors = Array.isArray(errorData.error?.errors)
      ? errorData.error.errors
      : [];
    const reasons = errors.map(item => String(item?.reason || ''));
    const apiMessage = String(errorData.error?.message || '');
    const hasReason = (...targets) => targets.some(reason => reasons.includes(reason));

    if (
      status === 403 &&
      /insufficient authentication scopes/i.test(apiMessage)
    ) {
      return {
        clearSession: true,
        message:
          'Google Driveの利用権限が不足しています。' +
          'もう一度［バックアップ一覧を更新］を押して、Google Driveの利用を許可してください。'
      };
    }

    if (status === 403 && hasReason('storageQuotaExceeded')) {
      return {
        clearSession: false,
        message: 'Google Driveの保存容量が不足しています。Driveの空き容量を確認してください。'
      };
    }

    if (
      status === 429 ||
      hasReason(
        'rateLimitExceeded',
        'userRateLimitExceeded',
        'sharingRateLimitExceeded',
        'downloadQuotaExceeded'
      )
    ) {
      return {
        clearSession: false,
        message: 'Google Driveの利用回数制限に達しました。時間をおいてから、もう一度お試しください。'
      };
    }

    if (status === 400) {
      return {
        clearSession: false,
        message: 'Google Driveへの要求を処理できませんでした。アプリを更新してから、もう一度お試しください。'
      };
    }

    if (status === 403) {
      return {
        clearSession: false,
        message: 'Google Driveへのアクセスが許可されていません。選択したGoogleアカウントとDriveの権限を確認してください。'
      };
    }

    if (status === 404) {
      return {
        clearSession: false,
        message: '選択したGoogle Driveのバックアップが見つかりませんでした。一覧を更新してください。'
      };
    }

    if (status === 409) {
      return {
        clearSession: false,
        message: 'Google Drive上で更新が競合しました。一覧を更新してから、もう一度お試しください。'
      };
    }

    if (status >= 500) {
      return {
        clearSession: false,
        message: 'Google Drive側で一時的な障害が発生しています。時間をおいてから、もう一度お試しください。'
      };
    }

    return {
      clearSession: false,
      message: `Google Driveとの処理に失敗しました（エラー ${status}）。時間をおいてから、もう一度お試しください。`
    };
  }

  async function api(url, options = {}, responseType = 'json') {
    if (!accessToken) {
      throw new Error('Google Driveの利用権限がありません。［Google Driveにバックアップ］を押してください。');
    }

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(options.headers || {})
        }
      });
    } catch (error) {
      console.error('Google Drive network error:', error);
      throw Object.assign(
        new Error(
          'Google Driveと通信できませんでした。通信状態を確認して、もう一度お試しください。'
        ),
        {code: 'drive/network-error'}
      );
    }

    if (response.status === 401) {
      clearDriveSession();
      throw Object.assign(
        new Error('Google Driveの認証期限が切れました。もう一度［Google Driveにバックアップ］を押してください。'),
        {code: 'drive/session-expired'}
      );
    }

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch {
        // JSONでないエラー応答はステータスだけを表示する。
      }
      const translated = driveApiErrorMessage(response.status, errorData);
      if (translated.clearSession) clearDriveSession();
      throw Object.assign(
        new Error(translated.message),
        {code: 'drive/api-error'}
      );
    }

    if (response.status === 204) return null;
    if (responseType === 'text') return response.text();
    return response.json();
  }

  async function ensureFolder() {
    if (folderId) return folderId;

    const query = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );

    const found = await api(
      `https://www.googleapis.com/drive/v3/files?q=${query}` +
      '&spaces=drive&fields=files(id,name)&pageSize=10'
    );

    folderId = found.files?.[0]?.id || '';

    if (!folderId) {
      const created = await api('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      folderId = created.id;
    }

    return folderId;
  }

  async function findFile(name) {
    const fid = await ensureFolder();
    const safeName = String(name).replace(/'/g, "\\'");
    const query = encodeURIComponent(
      `name='${safeName}' and '${fid}' in parents and trashed=false`
    );

    const data = await api(
      `https://www.googleapis.com/drive/v3/files?q=${query}` +
      '&spaces=drive&fields=files(id,name,createdTime,modifiedTime,size)&pageSize=10'
    );

    return data.files?.[0] || null;
  }

  async function uploadJson(name, backup, existingId = '') {
    const metadata = {
      name,
      mimeType: 'application/json'
    };

    if (!existingId) {
      metadata.parents = [await ensureFolder()];
    }

    const boundary =
      'taxipay-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      `${JSON.stringify(backup)}\r\n` +
      `--${boundary}--`;

    const url = existingId
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    return api(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: {'Content-Type': `multipart/related; boundary=${boundary}`},
      body
    });
  }

  async function listBackups() {
    const fid = await ensureFolder();
    const query = encodeURIComponent(
      `'${fid}' in parents and name contains 'backup-' and trashed=false`
    );

    const files = [];
    let pageToken = '';

    do {
      const tokenPart = pageToken
        ? `&pageToken=${encodeURIComponent(pageToken)}`
        : '';

      const data = await api(
        `https://www.googleapis.com/drive/v3/files?q=${query}` +
        '&spaces=drive' +
        '&fields=nextPageToken,files(id,name,createdTime,modifiedTime,size)' +
        '&orderBy=createdTime%20desc&pageSize=1000' +
        tokenPart
      );

      files.push(...(data.files || []));
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    return {files};
  }

  async function deleteFile(id) {
    if (!id) throw new Error('削除するバックアップを特定できませんでした。');
    return api(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
      {method: 'DELETE'}
    );
  }

  async function cleanupOld(files) {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const file of files || []) {
      const stamp = file.createdTime || file.modifiedTime;
      const time = stamp ? new Date(stamp).getTime() : NaN;
      if (Number.isFinite(time) && time < cutoff) {
        await deleteFile(file.id);
        removed += 1;
      }
    }

    return removed;
  }

  async function ensureDriveAccess() {
    if (accessToken) return true;

    // 通常ログインのGoogle APIトークンにはDrive権限がないため流用しない。
    accessToken = sessionStorage.getItem(TOKEN_KEY) || '';

    if (accessToken) {
      sessionStorage.setItem(TOKEN_KEY, accessToken);
      saveMeta({
        driveScopeGranted: true,
        driveAuthorizationPending: false
      });
      await ensureFolder();
      renderStatus();
      return true;
    }

    if (typeof window.TaxiPayRequestDriveAuthorization !== 'function') {
      throw new Error(
        'Google認証機能の準備が完了していません。ページを再読み込みしてから、もう一度お試しください。'
      );
    }

    saveMeta({driveAuthorizationPending: true});
    msg('driveSyncMessage', 'Google Driveの利用権限を確認しています…', 'info');

    try {
      accessToken = await window.TaxiPayRequestDriveAuthorization();

      if (!accessToken) {
        throw new Error('Google Driveの利用権限を取得できませんでした。');
      }

      sessionStorage.setItem(TOKEN_KEY, accessToken);
      saveMeta({
        driveScopeGranted: true,
        driveAuthorizationPending: false,
        connectedAt: jstNow()
      });

      await ensureFolder();
      renderStatus();
      return true;

    } catch (error) {
      saveMeta({driveAuthorizationPending: false});
      renderStatus();

      if (
        error?.code === 'drive/network-error' ||
        error?.code === 'drive/session-expired' ||
        error?.code === 'drive/api-error'
      ) {
        throw error;
      }
      if (error?.code === 'auth/popup-closed-by-user') {
        throw new Error('Google Driveの権限確認がキャンセルされました。');
      }
      if (error?.code === 'auth/popup-blocked') {
        throw new Error(
          'Googleの権限確認画面がブラウザにブロックされました。ポップアップを許可して再試行してください。'
        );
      }
      if (error?.code === 'auth/user-mismatch') {
        throw new Error(
          '現在ログインしているGoogleアカウントと異なるアカウントが選択されました。ログイン中のGoogleアカウントを選択してください。'
        );
      }
      if (error?.code === 'drive/not-signed-in') {
        throw new Error(
          'Googleログイン状態を確認できません。いったんログアウトして、もう一度Googleログインしてください。'
        );
      }
      if (error?.code === 'drive/no-access-token') {
        throw new Error(
          'Google Driveの認証情報を取得できませんでした。もう一度権限確認を行ってください。'
        );
      }
      if (error?.code === 'auth/network-request-failed') {
        throw new Error(
          'Googleの認証サービスと通信できませんでした。通信状態を確認して、もう一度お試しください。'
        );
      }
      if (error?.code === 'auth/too-many-requests') {
        throw new Error(
          'Google認証の試行回数が多すぎます。時間をおいてから、もう一度お試しください。'
        );
      }
      if (error?.code === 'auth/unauthorized-domain') {
        throw new Error(
          'このアプリの公開URLではGoogle認証を利用できません。管理者へお知らせください。'
        );
      }

      console.error('Google Drive authorization failed:', error);
      throw new Error(
        'Google Driveの認証に失敗しました。時間をおいてから、もう一度お試しください。'
      );
    }
  }

  function storageApiSnapshot() {
    try { return window.TaxiPayStorageSafety?.getPrimaryRaw?.() ?? null; } catch { return null; }
  }

  async function syncNow() {
    if (syncing) return;
    if (!requireDeviceName()) return;

    syncing = true;
    renderStatus();

    try {
      await ensureDriveAccess();

      const currentPayload = payload();
      const currentMeta = meta();

      if (!currentMeta.everSynced) {
        const s = summary(currentPayload);
        const accepted = confirm(
          `Google Driveへの初回バックアップです。\n\n` +
          `この端末の本人データ一式を保存します。\n` +
          `日次データ：${s.daily}件\n` +
          `月次データ：${s.monthly}件\n` +
          `対象期間：${s.period}\n\n` +
          `管理者には勤務実績（売上や個人の給与に関わる設定等の全て）は送信されません。\n\n` +
          `バックアップしますか？`
        );
        if (!accepted) return;
      }

      // Drive current.json がある場合は、上書き前に端末データと比較・統合する。
      // 日時だけで勝者を決めず、内容が異なる競合は利用者が選択する。
      const currentFile = await findFile('current.json');
      if (currentFile && window.TaxiPayRecoveryV14?.resolveStates) {
        const remote = await readDrive(currentFile.id);
        if (remote?.data?.state) {
          const resolved = await window.TaxiPayRecoveryV14.resolveStates(
            currentPayload.data.state,
            remote.data.state,
            {local: deviceName() || 'この端末', remote: remote.deviceName || 'Google Drive'}
          );
          if (!resolved) {
            msg('driveSyncMessage', '競合確認がキャンセルされたため、Google Driveは変更していません。', 'info');
            return;
          }
          const before = storageApiSnapshot();
          try {
            window.TaxiPayStorageSafety.save(resolved.state, 'drive-merge');
          } catch (mergeError) {
            if (before !== null) localStorage.setItem(window.TaxiPayStorageSafety.primaryKey, before);
            throw mergeError;
          }
        }
      }

      // 利用者が競合を解決した後の端末状態を、今回の確定スナップショットとする。
      const snapshot = JSON.parse(JSON.stringify(payload()));

      // 1回のバックアップにつき1世代を作成。
      const backupName = `backup-${jstStamp()}.json`;
      await uploadJson(backupName, snapshot);

      // current.json は統合済み最新版として上書き。
      await uploadJson('current.json', snapshot, currentFile?.id || '');

      // 90日超の世代を整理。
      const backupData = await listBackups();
      const removed = await cleanupOld(backupData.files || []);

      saveMeta({
        lastSyncAt: snapshot.savedAtJst,
        everSynced: true,
        lastDeviceName: snapshot.deviceName
      });

      msg(
        'driveSyncMessage',
        `Google Driveにバックアップしました。1世代を保存しました。` +
        (removed ? ` 90日を超えた${removed}件を自動削除しました。` : ''),
        'success'
      );

      await refreshBackups();

    } catch (error) {
      msg(
        'driveSyncMessage',
        `Google Driveへのバックアップに失敗しました。端末には保存されています。` +
        (meta().lastSyncAt ? ` 最終バックアップ：${formatJst(meta().lastSyncAt)}` : '') +
        ` ${error.message}`,
        'error'
      );
    } finally {
      syncing = false;
      renderStatus();
    }
  }

  async function refreshBackups() {
    const root = $('driveBackupList');
    if (!requireDeviceName()) return;
    if (!root) return;

    try {
      await ensureDriveAccess();
      let data = await listBackups();
      let rows = data.files || [];

      const removed = await cleanupOld(rows);
      if (removed) {
        data = await listBackups();
        rows = data.files || [];
      }

      const total = rows.reduce((sum, file) => sum + Number(file.size || 0), 0);

      if ($('driveBackupSummary')) {
        $('driveBackupSummary').textContent =
          `過去バックアップ：${rows.length}世代・合計 ${formatBytes(total)}（90日保存）`;
      }

      root.innerHTML = rows.length
        ? rows.map(file => `
            <div class="drive-backup-row">
              <div>
                <strong>${esc(formatJst(file.createdTime || file.modifiedTime))}</strong>
                <span>容量：${esc(formatBytes(file.size))}</span>
              </div>
              <div class="actions">
                <button class="secondary" data-drive-restore="${file.id}" type="button">復元</button>
                <button class="ghost" data-drive-delete="${file.id}"
                  data-drive-label="${esc(formatJst(file.createdTime || file.modifiedTime))}"
                  type="button">削除</button>
              </div>
            </div>
          `).join('')
        : '<p class="note">バックアップはまだありません。</p>';

    } catch (error) {
      root.innerHTML = '<p class="note">一覧を取得できませんでした。</p>';
      msg('driveBackupMessage', error.message, 'error');
    }
  }

  function parseDriveJsonText(raw) {
    const text = String(raw ?? '').replace(/^\uFEFF/, '').trim();
    if (!text) {
      throw new Error('Google Driveのバックアップファイルが空です。');
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        'Google DriveのバックアップJSONを読み取れませんでした。' +
        'ファイルが破損しているか、対応していない形式の可能性があります。'
      );
    }
  }

  async function readDrive(id) {
    const raw = await api(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
      {},
      'text'
    );
    return parseDriveJsonText(raw);
  }

  function saveSafety() {
    localStorage.setItem(
      SAFETY_KEY,
      JSON.stringify({
        savedAtJst: jstNow(),
        deviceName: deviceName(),
        payload: payload()
      })
    );

    if ($('restoreSafetyButton')) {
      $('restoreSafetyButton').hidden = false;
    }
  }

  async function restoreDrive(id) {
    if (!requireDeviceName()) return;
    const accepted = confirm(
      '選択したバックアップをこの端末へ復元します。\n' +
      '現在の端末データは端末内に退避します。\n' +
      'Google Driveは自動で上書きしません。\n\n' +
      '続行しますか？'
    );
    if (!accepted) return;

    try {
      saveSafety();
      const backup = await readDrive(id);
      const remoteState = normalizedBackupState(backup);
      const localState = window.TaxiPayDataIntegrity?.ensureState?.(JSON.parse(storageApiSnapshot() || '{}')) || {};
      const resolver = window.TaxiPayRecoveryV14?.resolveStates;
      if (typeof resolver !== 'function') throw new Error('競合比較機能を利用できません。');
      const resolved = await resolver(
        localState,
        remoteState,
        {local: deviceName() || 'この端末', remote: backup.deviceName || 'Google Driveバックアップ'}
      );
      if (!resolved) {
        msg('driveBackupMessage', '復元の競合確認をキャンセルしました。端末データは変更していません。', 'info');
        return;
      }
      applyPayload(backup, resolved.state);
      msg(
        'driveBackupMessage',
        '競合確認後のデータを端末へ復元・統合しました。Google Driveにはまだバックアップしていません。内容を確認してください。',
        'success'
      );
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      msg('driveBackupMessage', error.message, 'error');
    }
  }

  function restoreSafety() {
    if (!requireDeviceName()) return;
    try {
      const saved = JSON.parse(localStorage.getItem(SAFETY_KEY) || 'null');

      if (!saved?.payload) {
        throw new Error('復元前データがありません。');
      }

      const accepted = confirm(
        `復元前の端末データ（${formatJst(saved.savedAtJst)}）へ戻しますか？`
      );
      if (!accepted) return;

      applyPayload(saved.payload);
      msg(
        'driveBackupMessage',
        '復元前の端末データへ戻しました。',
        'success'
      );
      setTimeout(() => location.reload(), 500);

    } catch (error) {
      msg('driveBackupMessage', error.message, 'error');
    }
  }

  async function removeBackup(id, label) {
    const accepted = confirm(
      `${label}\nこのバックアップを削除しますか？\n` +
      '削除すると、この世代からは復元できません。'
    );
    if (!accepted) return;

    try {
      await deleteFile(id);
      msg(
        'driveBackupMessage',
        '選択したバックアップを削除しました。',
        'success'
      );
      await refreshBackups();
    } catch (error) {
      msg('driveBackupMessage', error.message, 'error');
    }
  }

  async function checkConflict() {
    const box = $('driveConflictBox');
    if (!box) return;

    try {
      const current = await findFile('current.json');

      if (!current) {
        box.hidden = true;
        return;
      }

      const remote = await readDrive(current.id);
      const local = payload();

      if (JSON.stringify(remote.data) === JSON.stringify(local.data)) {
        box.hidden = true;
        return;
      }

      const localSummary = summary(local);
      const remoteSummary = summary(remote);

      box.hidden = false;
      box.innerHTML = `
        <strong>端末とGoogle Driveのデータが異なります</strong>
        <div class="drive-compare">
          <div>
            <b>この端末：${esc(deviceName())}</b>
            <span>更新：${esc(formatJst(local.savedAtJst))}</span>
            <span>日次 ${localSummary.daily}件 / 月次 ${localSummary.monthly}件</span>
            <span>${esc(localSummary.period)}</span>
          </div>
          <div>
            <b>Drive保存元：${esc(remote.deviceName || '不明')}</b>
            <span>バックアップ：${esc(formatJst(remote.savedAtJst || current.modifiedTime))}</span>
            <span>日次 ${remoteSummary.daily}件 / 月次 ${remoteSummary.monthly}件</span>
            <span>${esc(remoteSummary.period)}</span>
          </div>
        </div>
        <p class="note">
          新しい日時を自動採用しません。
          Driveデータを使う場合は過去バックアップ一覧から復元してください。
          この端末を正とする場合は［Google Driveにバックアップ］を押してください。
        </p>
      `;

    } catch {
      // 競合表示の取得失敗だけでアプリ全体を止めない。
      box.hidden = true;
    }
  }

  function bind() {
    // 通常ログインのGoogle APIトークンにはDrive権限がないため流用しない。
    accessToken = sessionStorage.getItem(TOKEN_KEY) || '';

    renderStatus();

    if ($('restoreSafetyButton')) {
      $('restoreSafetyButton').hidden = !localStorage.getItem(SAFETY_KEY);
    }

    $('driveSyncNow')?.addEventListener('click', syncNow);
    $('driveRefreshBackups')?.addEventListener('click', refreshBackups);
    $('restoreSafetyButton')?.addEventListener('click', restoreSafety);

    $('driveBackupList')?.addEventListener('click', event => {
      const restoreButton = event.target.closest('[data-drive-restore]');
      const deleteButton = event.target.closest('[data-drive-delete]');

      if (restoreButton) restoreDrive(restoreButton.dataset.driveRestore);
      if (deleteButton) {
        removeBackup(
          deleteButton.dataset.driveDelete,
          deleteButton.dataset.driveLabel
        );
      }
    });

    // 既にこのタブ内に有効なDriveトークンがある場合だけ一覧を読み込む。
    // 自動バックアップはしない。
    if (accessToken) {
      ensureFolder()
        .then(() => Promise.all([refreshBackups(), checkConflict()]))
        .catch(() => {
          clearDriveSession();
        });
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', bind)
    : bind();
})();
