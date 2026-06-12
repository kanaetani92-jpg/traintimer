(() => {
  'use strict';

  const LOCAL_DATA_VERSION = 1;
  const DEVICE_KEY = 'oshitakuTrainDeviceIdV1';
  const FINGERPRINT_KEY = 'oshitakuTrainEntityFingerprintsV1';
  const FALLBACK_QUEUE_KEY = 'oshitakuTrainSyncQueueFallbackV1';
  const DB_NAME = 'oshitakuTrainLocalV1';
  const DB_VERSION = 1;
  const QUEUE_STORE = 'syncQueue';
  const META_STORE = 'meta';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isoNow = () => new Date().toISOString();

  function safeParse(raw, fallback) {
    if (!raw) return clone(fallback);
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('端末内データ層のJSONを読み込めませんでした。', error);
      return clone(fallback);
    }
  }

  function randomPart() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function createId(prefix = 'entity') {
    return `ot-${prefix}-${randomPart()}`;
  }

  function getDeviceId() {
    try {
      const current = localStorage.getItem(DEVICE_KEY);
      if (current) return current;
      const created = createId('device');
      localStorage.setItem(DEVICE_KEY, created);
      return created;
    } catch (error) {
      console.warn('端末IDを保存できませんでした。', error);
      return createId('temporary-device');
    }
  }

  function validIso(value) {
    const text = String(value || '');
    return Number.isFinite(Date.parse(text)) ? text : '';
  }

  function attachEntityMeta(target, source = {}, type = 'entity') {
    const output = target && typeof target === 'object' ? target : {};
    const original = source && typeof source === 'object' ? source : {};
    const createdAt = validIso(original.createdAt) || validIso(output.createdAt) || isoNow();
    output.syncId = String(original.syncId || output.syncId || createId(type));
    output.revision = Math.max(0, Math.trunc(Number(original.revision ?? output.revision) || 0));
    output.createdAt = createdAt;
    output.updatedAt = validIso(original.updatedAt) || validIso(output.updatedAt) || createdAt;
    output.deletedAt = original.deletedAt == null && output.deletedAt == null
      ? null
      : (validIso(original.deletedAt ?? output.deletedAt) || null);
    return output;
  }

  function prepareState(state) {
    const target = state && typeof state === 'object' ? state : {};
    const deviceId = getDeviceId();
    const existingSync = target.sync && typeof target.sync === 'object' ? target.sync : {};
    target.sync = {
      ...existingSync,
      localDataVersion: LOCAL_DATA_VERSION,
      deviceId,
      activePlan: attachEntityMeta({}, existingSync.activePlan, 'active-plan'),
      settings: attachEntityMeta({}, existingSync.settings, 'settings')
    };

    target.presets = (Array.isArray(target.presets) ? target.presets : []).map((preset) => {
      const preparedPreset = attachEntityMeta(preset, preset, 'preset');
      preparedPreset.stations = (Array.isArray(preparedPreset.stations) ? preparedPreset.stations : [])
        .map((station) => attachEntityMeta(station, station, 'station'));
      return preparedPreset;
    });

    target.stations = (Array.isArray(target.stations) ? target.stations : [])
      .map((station) => attachEntityMeta(station, station, 'active-station'));
    target.todos = (Array.isArray(target.todos) ? target.todos : [])
      .map((todo) => attachEntityMeta(todo, todo, 'todo'));
    return target;
  }

  function withoutMeta(value) {
    if (Array.isArray(value)) return value.map(withoutMeta);
    if (!value || typeof value !== 'object') return value;
    const output = {};
    Object.keys(value).sort().forEach((key) => {
      if (['syncId', 'revision', 'createdAt', 'updatedAt', 'deletedAt'].includes(key)) return;
      output[key] = withoutMeta(value[key]);
    });
    return output;
  }

  function stableStringify(value) {
    return JSON.stringify(withoutMeta(value));
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function readFingerprints() {
    try {
      const value = safeParse(localStorage.getItem(FINGERPRINT_KEY), {});
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.warn('変更履歴の比較情報を読み込めませんでした。', error);
      return {};
    }
  }

  function collectEntities(state) {
    const entities = [];
    const add = (entityType, ref, payload) => {
      const entityId = String(ref.syncId);
      entities.push({
        entityType,
        entityId,
        entityKey: `${entityType}:${entityId}`,
        ref,
        payload
      });
    };

    add('activePlan', state.sync.activePlan, {
      title: state.title,
      vehicle: state.vehicle,
      mode: state.mode,
      currentPresetId: state.currentPresetId || '',
      stations: withoutMeta(state.stations || [])
    });
    add('settings', state.sync.settings, withoutMeta(state.settings || {}));

    (state.presets || []).forEach((preset) => {
      add('preset', preset, {
        id: preset.id,
        label: preset.label,
        title: preset.title,
        vehicle: preset.vehicle,
        favorite: Boolean(preset.favorite),
        defaultMode: preset.defaultMode || null,
        stationOrder: (preset.stations || []).map((station) => station.syncId)
      });
      (preset.stations || []).forEach((station) => {
        add('station', station, {
          presetSyncId: preset.syncId,
          ...withoutMeta(station)
        });
      });
    });

    (state.todos || []).forEach((todo) => add('todo', todo, withoutMeta(todo)));
    return entities;
  }

  function planStateSave(inputState, options = {}) {
    const state = prepareState(inputState);
    const previous = readFingerprints();
    const entities = collectEntities(state);
    const nextFingerprints = {};
    const operations = [];
    const timestamp = isoNow();
    const reason = String(options.reason || 'app-save');

    entities.forEach((entity) => {
      const previousRecord = previous[entity.entityKey];
      const initialFingerprint = hashText(stableStringify(entity.payload));
      const changed = !previousRecord || previousRecord.fingerprint !== initialFingerprint;
      const previousRevision = Math.max(0, Number(previousRecord?.revision) || 0);

      if (changed) {
        entity.ref.revision = Math.max(previousRevision, Number(entity.ref.revision) || 0) + 1;
        entity.ref.updatedAt = timestamp;
        entity.ref.createdAt = validIso(entity.ref.createdAt) || timestamp;
        operations.push({
          operationId: createId('operation'),
          entityKey: entity.entityKey,
          entityType: entity.entityType,
          entityId: entity.entityId,
          operation: previousRecord ? 'update' : 'create',
          baseRevision: previousRevision,
          newRevision: entity.ref.revision,
          payload: clone(entity.payload),
          deviceId: state.sync.deviceId,
          reason,
          status: 'pending',
          retryCount: 0,
          createdAt: timestamp
        });
      } else {
        entity.ref.revision = previousRevision;
        if (previousRecord.updatedAt) entity.ref.updatedAt = previousRecord.updatedAt;
      }

      nextFingerprints[entity.entityKey] = {
        entityType: entity.entityType,
        entityId: entity.entityId,
        fingerprint: initialFingerprint,
        revision: entity.ref.revision,
        updatedAt: entity.ref.updatedAt
      };
    });

    Object.entries(previous).forEach(([entityKey, previousRecord]) => {
      if (nextFingerprints[entityKey]) return;
      operations.push({
        operationId: createId('operation'),
        entityKey,
        entityType: previousRecord.entityType || 'entity',
        entityId: previousRecord.entityId || entityKey.split(':').slice(1).join(':'),
        operation: 'delete',
        baseRevision: Math.max(0, Number(previousRecord.revision) || 0),
        newRevision: Math.max(0, Number(previousRecord.revision) || 0) + 1,
        payload: null,
        deviceId: state.sync.deviceId,
        reason,
        status: 'pending',
        retryCount: 0,
        createdAt: timestamp
      });
    });

    state.sync.updatedAt = timestamp;
    return { state, operations, nextFingerprints };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'entityKey' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error || new Error('IndexedDBを開けませんでした')));
      request.addEventListener('blocked', () => reject(new Error('IndexedDBの更新がブロックされました')));
    });
  }

  function readFallbackQueue() {
    try {
      const value = safeParse(localStorage.getItem(FALLBACK_QUEUE_KEY), {});
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      return {};
    }
  }

  function saveFallbackQueue(queue) {
    try {
      localStorage.setItem(FALLBACK_QUEUE_KEY, JSON.stringify(queue));
      return true;
    } catch (error) {
      console.error('同期準備キューを保存できませんでした。', error);
      return false;
    }
  }

  async function putOperationsInIndexedDB(operations) {
    if (!operations.length) return;
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([QUEUE_STORE, META_STORE], 'readwrite');
      const queue = transaction.objectStore(QUEUE_STORE);
      const meta = transaction.objectStore(META_STORE);
      operations.forEach((operation) => queue.put(operation));
      meta.put({ key: 'lastQueueWriteAt', value: isoNow() });
      transaction.addEventListener('complete', resolve);
      transaction.addEventListener('abort', () => reject(transaction.error || new Error('同期準備キューを更新できませんでした')));
      transaction.addEventListener('error', () => reject(transaction.error || new Error('同期準備キューを更新できませんでした')));
    });
    db.close();
  }

  async function enqueueOperations(operations) {
    if (!operations.length) return { queued: 0, storage: 'indexeddb' };
    try {
      await putOperationsInIndexedDB(operations);
      const fallback = readFallbackQueue();
      operations.forEach((operation) => delete fallback[operation.entityKey]);
      saveFallbackQueue(fallback);
      return { queued: operations.length, storage: 'indexeddb' };
    } catch (error) {
      console.warn('IndexedDBを利用できないため、localStorageへ同期準備データを保存します。', error);
      const fallback = readFallbackQueue();
      operations.forEach((operation) => { fallback[operation.entityKey] = operation; });
      saveFallbackQueue(fallback);
      return { queued: operations.length, storage: 'localStorage-fallback' };
    }
  }

  function dispatchStatusChange() {
    try {
      globalThis.dispatchEvent(new CustomEvent('train-data-status-change'));
    } catch (error) {
      // CustomEventがないテスト環境では通知を省略します。
    }
  }

  async function commitPlan(plan) {
    try {
      localStorage.setItem(FINGERPRINT_KEY, JSON.stringify(plan.nextFingerprints));
    } catch (error) {
      console.warn('変更比較情報を保存できませんでした。', error);
    }
    const result = await enqueueOperations(plan.operations);
    dispatchStatusChange();
    return result;
  }

  async function countIndexedDBQueue() {
    const db = await openDatabase();
    const count = await new Promise((resolve, reject) => {
      const transaction = db.transaction(QUEUE_STORE, 'readonly');
      const request = transaction.objectStore(QUEUE_STORE).count();
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
    db.close();
    return count;
  }

  async function getStatus() {
    const fallbackCount = Object.keys(readFallbackQueue()).length;
    let indexedDbCount = 0;
    let storage = 'indexeddb';
    try {
      indexedDbCount = await countIndexedDBQueue();
    } catch (error) {
      storage = 'localStorage-fallback';
    }
    return {
      localDataVersion: LOCAL_DATA_VERSION,
      deviceId: getDeviceId(),
      pendingCount: indexedDbCount + fallbackCount,
      indexedDbCount,
      fallbackCount,
      storage,
      cloudConnected: false
    };
  }

  async function clearIndexedDBQueue() {
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(QUEUE_STORE, 'readwrite');
        transaction.objectStore(QUEUE_STORE).clear();
        transaction.addEventListener('complete', resolve);
        transaction.addEventListener('abort', () => reject(transaction.error));
      });
      db.close();
    } catch (error) {
      console.warn('IndexedDBの同期準備キューを初期化できませんでした。', error);
    }
  }

  async function rebuildQueue(state) {
    await clearIndexedDBQueue();
    try {
      localStorage.removeItem(FINGERPRINT_KEY);
      localStorage.removeItem(FALLBACK_QUEUE_KEY);
    } catch (error) {
      console.warn('同期準備情報を初期化できませんでした。', error);
    }
    const plan = planStateSave(state, { reason: 'manual-rebuild' });
    await commitPlan(plan);
    return plan.state;
  }

  async function resetLocalData(options = {}) {
    try {
      localStorage.removeItem(FINGERPRINT_KEY);
      localStorage.removeItem(FALLBACK_QUEUE_KEY);
      if (!options.keepDeviceId) localStorage.removeItem(DEVICE_KEY);
    } catch (error) {
      console.warn('端末内データ層を初期化できませんでした。', error);
    }
    await clearIndexedDBQueue();
    dispatchStatusChange();
  }

  async function exportSummary(state) {
    const status = await getStatus();
    const prepared = prepareState(state);
    return {
      type: 'oshitaku-train-local-data-summary',
      generatedAt: isoNow(),
      localDataVersion: LOCAL_DATA_VERSION,
      deviceId: status.deviceId,
      storage: status.storage,
      cloudConnected: false,
      pendingCount: status.pendingCount,
      counts: {
        presets: prepared.presets.length,
        presetStations: prepared.presets.reduce((sum, preset) => sum + (preset.stations?.length || 0), 0),
        activeStations: prepared.stations.length,
        todos: prepared.todos.length
      },
      note: '予定名やTo Do本文は含まれません。クラウドへの送信も行っていません。'
    };
  }

  globalThis.TrainDataLayer = Object.freeze({
    localDataVersion: LOCAL_DATA_VERSION,
    createId,
    getDeviceId,
    attachEntityMeta,
    prepareState,
    planStateSave,
    commitPlan,
    getStatus,
    rebuildQueue,
    resetLocalData,
    exportSummary,
    __test: Object.freeze({ stableStringify, hashText, collectEntities, readFingerprints })
  });
})();
