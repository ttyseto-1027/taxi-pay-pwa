const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'phase56-drive-backup.js'),
  'utf8'
);

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function responseJson(data, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

function responseText(text, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => JSON.parse(text),
    text: async () => text
  };
}

function createElement(id) {
  return {
    id,
    hidden: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    dataset: {},
    listeners: new Map(),
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }
  };
}

function createState(marker) {
  return {
    entries: [{id: marker, date: '2026-09-26', grossSales: 50000}],
    history: [],
    dataArchive: [],
    conflictHistory: [],
    deletionHistory: [],
    recordTombstones: []
  };
}

function createHarness({
  fetchImpl,
  initialSession = {},
  authorizeToken = 'drive-token',
  authorizeError = null
} = {}) {
  const ids = [
    'driveConnectionStatus',
    'driveLastSync',
    'driveSyncNow',
    'driveRefreshBackups',
    'restoreSafetyButton',
    'driveBackupList',
    'driveBackupSummary',
    'driveBackupMessage',
    'driveSyncMessage',
    'driveConflictBox'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, createElement(id)]));
  const localState = createState('local-entry');
  const localStorage = new MemoryStorage({
    taxiPayDeviceNameV2: 'iPhoneテスト端末'
  });
  const sessionStorage = new MemoryStorage(initialSession);
  const requests = [];
  const saves = [];
  const recoverySnapshots = [];
  const diagnostics = [];
  let authorizationCalls = 0;
  let reloads = 0;

  const storageApi = {
    isDevelop: false,
    primaryKey: 'taxiPayPwaStateV10',
    getPrimaryRaw: () => JSON.stringify(localState),
    getHealth: () => ({sourceKey: 'taxiPayPwaStateV10'}),
    saveRecoverySnapshot(label) {
      recoverySnapshots.push(label);
    },
    save(state, label) {
      saves.push({state: JSON.parse(JSON.stringify(state)), label});
    }
  };

  const document = {
    readyState: 'complete',
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener() {}
  };

  const window = {
    TaxiPayStorageSafety: storageApi,
    TaxiPayDeviceRegistry: {
      getCurrent: () => ({deviceName: 'iPhoneテスト端末'}),
      requireNamedDevice() {
        throw new Error('device name should already exist');
      }
    },
    TaxiPayDataIntegrity: {
      ensureState: state => state,
      deviceId: () => 'device-test',
      browserName: () => 'Safari'
    },
    TaxiPayRecoveryV14: {
      resolveStates: async (_local, remote) => ({state: remote})
    },
    TAXI_PAY_APP_META: {
      version: '1.4β',
      build: 'test-build'
    },
    async TaxiPayRequestDriveAuthorization() {
      authorizationCalls += 1;
      if (authorizeError) throw authorizeError;
      return authorizeToken;
    }
  };

  const context = {
    window,
    document,
    localStorage,
    sessionStorage,
    confirm: () => true,
    fetch: async (url, options = {}) => {
      requests.push({url: String(url), options});
      return fetchImpl(String(url), options);
    },
    location: {
      reload() {
        reloads += 1;
      }
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
    console: {
      log: console.log,
      warn: (...args) => diagnostics.push({level: 'warn', args}),
      error: (...args) => diagnostics.push({level: 'error', args})
    },
    Intl,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    RegExp
  };

  vm.runInNewContext(source, context, {filename: 'phase56-drive-backup.js'});

  return {
    elements,
    localStorage,
    sessionStorage,
    requests,
    saves,
    recoverySnapshots,
    diagnostics,
    get authorizationCalls() {
      return authorizationCalls;
    },
    get reloads() {
      return reloads;
    }
  };
}

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail(`timed out: ${label}`);
}

function restoreClickTarget(id) {
  return {
    closest(selector) {
      if (selector === '[data-drive-restore]') {
        return {dataset: {driveRestore: id}};
      }
      return null;
    }
  };
}

async function testAuthorizedListAndBomRestore() {
  const remoteState = createState('remote-entry');
  const backup = {
    schema: 'taxi-pay-drive-v3',
    savedAtJst: '2026-09-26T01:57:56+09:00',
    deviceName: 'iPhone',
    data: {
      state: remoteState,
      salesTargets: {}
    }
  };
  const createdTime = new Date().toISOString();

  const harness = createHarness({
    initialSession: {
      'taxipay:google-api-access-token': 'ordinary-login-token'
    },
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(url);
      if (url.includes('backup-1?alt=media')) {
        return responseText('\uFEFF  ' + JSON.stringify(backup) + '  ');
      }
      if (decoded.includes("mimeType='application/vnd.google-apps.folder'")) {
        return responseJson({files: [{id: 'folder-1', name: '給与シミュレーター'}]});
      }
      if (decoded.includes("name contains 'backup-'")) {
        return responseJson({
          files: [{
            id: 'backup-1',
            name: 'backup-20260926-015756-JST.json',
            createdTime,
            modifiedTime: createdTime,
            size: '4096'
          }]
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }
  });

  const refresh = harness.elements.driveRefreshBackups.listeners.get('click');
  assert.equal(typeof refresh, 'function');
  await refresh();

  assert.equal(harness.authorizationCalls, 1, 'missing Drive token must request Drive authorization once');
  assert.equal(
    harness.sessionStorage.getItem('taxiPayDriveTokenV1'),
    'drive-token',
    'Drive-authorized token must be stored under the environment-specific key'
  );
  assert.ok(
    harness.requests.every(request => request.options.headers.Authorization === 'Bearer drive-token'),
    'ordinary Google login token must never be sent to Drive'
  );
  assert.match(harness.elements.driveBackupSummary.textContent, /1世代/);
  assert.match(harness.elements.driveBackupList.innerHTML, /data-drive-restore="backup-1"/);

  const listClick = harness.elements.driveBackupList.listeners.get('click');
  assert.equal(typeof listClick, 'function');
  listClick({target: restoreClickTarget('backup-1')});

  await waitUntil(
    () => harness.elements.driveBackupMessage.dataset.kind === 'success',
    'BOM backup restore'
  );

  assert.deepEqual(harness.recoverySnapshots, ['before-drive-restore']);
  assert.equal(harness.saves.length, 1);
  assert.equal(harness.saves[0].label, 'drive-restore');
  assert.equal(harness.saves[0].state.entries[0].id, 'remote-entry');
  assert.ok(
    harness.localStorage.getItem('taxiPayBeforeRestoreV1'),
    'pre-restore terminal snapshot must be retained'
  );
  assert.equal(harness.reloads, 1);
}

async function testScopeFailureIsJapaneseAndClearsSession() {
  const harness = createHarness({
    initialSession: {
      'taxipay:google-api-access-token': 'ordinary-login-token'
    },
    fetchImpl: async () => responseJson({
      error: {message: 'Request had insufficient authentication scopes.'}
    }, 403)
  });

  const refresh = harness.elements.driveRefreshBackups.listeners.get('click');
  await refresh();

  assert.equal(harness.authorizationCalls, 1);
  assert.equal(
    harness.sessionStorage.getItem('taxiPayDriveTokenV1'),
    null,
    'rejected Drive token must be cleared'
  );
  assert.equal(
    harness.sessionStorage.getItem('taxipay:google-api-access-token'),
    null,
    'rejected shared Google token must also be cleared'
  );
  assert.equal(harness.elements.driveBackupMessage.dataset.kind, 'error');
  assert.match(
    harness.elements.driveBackupMessage.textContent,
    /Google Driveの利用権限が不足しています/
  );
  assert.doesNotMatch(
    harness.elements.driveBackupMessage.textContent,
    /insufficient authentication scopes/i,
    'raw English API errors must not be shown for insufficient scope'
  );
}

async function testInvalidJsonStopsBeforeApply() {
  const createdTime = new Date().toISOString();
  const harness = createHarness({
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(url);
      if (url.includes('broken-backup?alt=media')) {
        return responseText('{broken');
      }
      if (decoded.includes("mimeType='application/vnd.google-apps.folder'")) {
        return responseJson({files: [{id: 'folder-1'}]});
      }
      if (decoded.includes("name contains 'backup-'")) {
        return responseJson({
          files: [{
            id: 'broken-backup',
            name: 'backup-broken.json',
            createdTime,
            modifiedTime: createdTime,
            size: '12'
          }]
        });
      }
      throw new Error(`unexpected request: ${url}`);
    }
  });

  await harness.elements.driveRefreshBackups.listeners.get('click')();
  harness.elements.driveBackupList.listeners.get('click')({
    target: restoreClickTarget('broken-backup')
  });

  await waitUntil(
    () => harness.elements.driveBackupMessage.dataset.kind === 'error',
    'invalid JSON rejection'
  );

  assert.match(
    harness.elements.driveBackupMessage.textContent,
    /バックアップJSONを読み取れませんでした/
  );
  assert.equal(harness.saves.length, 0, 'invalid JSON must never reach terminal save');
  assert.equal(harness.recoverySnapshots.length, 0, 'invalid JSON must stop before applyPayload');
  assert.ok(
    harness.localStorage.getItem('taxiPayBeforeRestoreV1'),
    'pre-restore safety copy must still be created before remote read'
  );
  assert.equal(harness.reloads, 0);
}

async function testExternalErrorsStayJapanese() {
  const serverFailure = createHarness({
    fetchImpl: async () => responseJson({
      error: {message: 'Backend Error'}
    }, 503)
  });

  await serverFailure.elements.driveRefreshBackups.listeners.get('click')();
  assert.match(
    serverFailure.elements.driveBackupMessage.textContent,
    /Google Drive側で一時的な障害が発生しています/
  );
  assert.doesNotMatch(
    serverFailure.elements.driveBackupMessage.textContent,
    /Backend Error/i
  );

  const networkFailure = createHarness({
    fetchImpl: async () => {
      throw new Error('Load failed');
    }
  });

  await networkFailure.elements.driveRefreshBackups.listeners.get('click')();
  assert.match(
    networkFailure.elements.driveBackupMessage.textContent,
    /Google Driveと通信できませんでした/
  );
  assert.doesNotMatch(
    networkFailure.elements.driveBackupMessage.textContent,
    /Load failed/i
  );
  assert.equal(networkFailure.diagnostics[0]?.level, 'error');

  const authError = Object.assign(
    new Error('An internal authentication error has occurred.'),
    {code: 'auth/internal-error'}
  );
  const authFailure = createHarness({
    authorizeError: authError,
    fetchImpl: async url => {
      throw new Error(`fetch must not run after auth failure: ${url}`);
    }
  });

  await authFailure.elements.driveRefreshBackups.listeners.get('click')();
  assert.match(
    authFailure.elements.driveBackupMessage.textContent,
    /Google Driveの認証に失敗しました/
  );
  assert.doesNotMatch(
    authFailure.elements.driveBackupMessage.textContent,
    /internal authentication error/i
  );
}

(async () => {
  await testAuthorizedListAndBomRestore();
  await testScopeFailureIsJapaneseAndClearsSession();
  await testInvalidJsonStopsBeforeApply();
  await testExternalErrorsStayJapanese();
  console.log('Phase 12 Drive flow simulation: SUCCESS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
