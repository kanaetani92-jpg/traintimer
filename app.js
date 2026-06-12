(() => {
  'use strict';

  const VERSION = 40;

  const EMOJI_CATEGORIES = [
    { key: 'common', label: 'よく使う', icons: ['🏠', '👕', '🪥', '🍚', '🎒', '👟', '🛁', '🌙', '⭐', '🎉'] },
    { key: 'morning', label: '朝の支度', icons: ['🏠', '☀️', '👕', '🪥', '🍚', '🥛', '🎒', '👟', '🧢', '🚻'] },
    { key: 'move', label: '移動', icons: ['🚶', '🚗', '🚲', '🚌', '🚃', '✈️', '🚪', '🏫', '🏡', '🛤️'] },
    { key: 'school', label: '学校・園', icons: ['🏫', '📛', '📚', '✏️', '🎨', '🎵', '⚽', '🍱', '🧃', '🧑‍🏫'] },
    { key: 'life', label: '生活', icons: ['🛁', '🧴', '🧺', '🍽️', '🧸', '📺', '📖', '💤', '🌙', '🛏️'] },
    { key: 'reward', label: 'ごほうび', icons: ['⭐', '🎉', '💎', '🏆', '🍪', '🎈', '🧁', '🌈', '💮', '👏'] }
  ];

  function emojiOptionsMarkup(station, stationIndex) {
    const currentIcon = station?.icon || '⭐';
    const categories = EMOJI_CATEGORIES.map(category => {
      const buttons = category.icons.map(icon => {
        const selected = icon === currentIcon ? ' selected' : '';
        const pressed = icon === currentIcon ? 'true' : 'false';
        return `<button class="emoji-choice${selected}" type="button" data-station-index="${stationIndex}" data-emoji="${escapeHtml(icon)}" aria-pressed="${pressed}" aria-label="${escapeHtml(icon)}を選ぶ">${escapeHtml(icon)}</button>`;
      }).join('');
      return `<section class="emoji-category" aria-label="${escapeHtml(category.label)}"><h4>${escapeHtml(category.label)}</h4><div class="emoji-choice-grid">${buttons}</div></section>`;
    }).join('');
    return `<div class="emoji-picker" id="emojiPicker-${stationIndex}">${categories}</div>`;
  }


  const STORAGE_KEY = 'oshitakuTrainNoPhotoStateV40';
  const LEGACY_KEYS = [
    'oshitakuTrainNoPhotoStateV39',
    'oshitakuTrainNoPhotoStateV38',
    'oshitakuTrainNoPhotoStateV37',
    'oshitakuTrainNoPhotoStateV36',
    'oshitakuTrainNoPhotoStateV35',
    'oshitakuTrainNoPhotoStateV34',
    'oshitakuTrainNoPhotoStateV33',
    'oshitakuTrainNoPhotoStateV32',
    'oshitakuTrainNoPhotoStateV31',
    'oshitakuTrainNoPhotoStateV30',
    'oshitakuTrainNoPhotoStateV29',
    'oshitakuTrainNoPhotoStateV28',
    'oshitakuTrainNoPhotoStateV27',
    'oshitakuTrainNoPhotoStateV26',
    'oshitakuTrainNoPhotoStateV25',
    'oshitakuTrainNoPhotoStateV24',
    'oshitakuTrainNoPhotoStateV23',
    'oshitakuTrainNoPhotoStateV22',
    'oshitakuTrainNoPhotoStateV21',
    'oshitakuTrainNoPhotoStateV20',
    'oshitakuTrainNoPhotoStateV19',
    'oshitakuTrainNoPhotoStateV18',
    'oshitakuTrainNoPhotoState'
  ];
  const MODES = ['timer'];
  const $ = (selector) => document.querySelector(selector);
  const byId = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const nowMs = () => Date.now();
  const dataLayer = window.TrainDataLayer || null;

  const presets = [
    {
      id: 'morning', label: '朝の支度', title: '朝の支度', vehicle: '🚃', stations: [
        { id: 'm1', name: 'おうち', icon: '🏠', minutes: 5, arrive: '07:30', depart: '07:35' },
        { id: 'm2', name: 'きがえ', icon: '👕', minutes: 5, arrive: '07:35', depart: '07:40' },
        { id: 'm3', name: 'あさごはん', icon: '🍚', minutes: 10, arrive: '07:40', depart: '07:50' },
        { id: 'm4', name: 'はみがき', icon: '🪥', minutes: 5, arrive: '07:50', depart: '07:55' },
        { id: 'm5', name: 'しゅっぱつ', icon: '🎒', minutes: 0, arrive: '07:55', depart: '07:55' }
      ]
    },
    {
      id: 'bedtime', label: '寝る前', title: '寝る前', vehicle: '🚄', stations: [
        { id: 'b1', name: 'おふろ', icon: '🛁', minutes: 10, arrive: '20:00', depart: '20:10' },
        { id: 'b2', name: 'パジャマ', icon: '👕', minutes: 5, arrive: '20:10', depart: '20:15' },
        { id: 'b3', name: 'はみがき', icon: '🪥', minutes: 5, arrive: '20:15', depart: '20:20' },
        { id: 'b4', name: 'えほん', icon: '📖', minutes: 10, arrive: '20:20', depart: '20:30' },
        { id: 'b5', name: 'おやすみ', icon: '🌙', minutes: 0, arrive: '20:30', depart: '20:30' }
      ]
    },
    {
      id: 'study', label: 'べんきょう', title: 'べんきょう', vehicle: '✈️', stations: [
        { id: 's1', name: 'スタート', icon: '✏️', minutes: 5, arrive: '16:00', depart: '16:05' },
        { id: 's2', name: 'こくご', icon: '📘', minutes: 10, arrive: '16:05', depart: '16:15' },
        { id: 's3', name: 'さんすう', icon: '📝', minutes: 10, arrive: '16:15', depart: '16:25' },
        { id: 's4', name: '見直し', icon: '⭐', minutes: 5, arrive: '16:25', depart: '16:30' },
        { id: 's5', name: 'ゴール', icon: '🏁', minutes: 0, arrive: '16:30', depart: '16:30' }
      ]
    }
  ];

  const DEFAULT_SETTINGS = Object.freeze({
    fontSize: 'normal',
    cardSize: 'normal',
    appearance: 'light',
    contrast: 'standard',
    reduceMotion: false,
    timelineMode: 'horizontal',
    timelineScope: 'all',
    showTopCards: true,
    showUpcoming: false,
    showNumbers: true,
    arrivalSound: true,
    speech: false,
    speechRate: 1,
    quietMode: false,
    doneButtonSize: 'normal',
    showPreviousButton: true,
    mistakePrevention: false,
    editorLock: false,
    lateBehavior: 'display',
    lateGraceMin: 2
  });

  const SETTING_ENUMS = Object.freeze({
    fontSize: ['normal', 'large', 'xlarge'],
    cardSize: ['normal', 'large'],
    appearance: ['light', 'dark'],
    contrast: ['standard', 'high'],
    timelineMode: ['horizontal'],
    timelineScope: ['all', 'currentNext'],
    doneButtonSize: ['normal', 'large'],
    lateBehavior: ['display', 'wait']
  });


  function defaultAccountAuth() {
    return {
      status: 'guest',
      email: '',
      otpHash: '',
      otpDemoCode: '',
      otpExpiresAt: 0,
      otpAttempts: 0,
      otpIssuedAt: 0,
      dataChoice: '',
      signedInAt: '',
      lastAuthAt: '',
      provider: 'local_otp_stub',
      cloudConnected: false
    };
  }

  function normalizeAccountAuth(value) {
    const base = defaultAccountAuth();
    if (!value || typeof value !== 'object') return base;
    const status = ['guest', 'otp_pending', 'signed_in'].includes(value.status) ? value.status : 'guest';
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value.email || '')) ? String(value.email || '').slice(0, 120) : '';
    const dataChoice = ['upload', 'download', 'merge', 'later'].includes(value.dataChoice) ? value.dataChoice : '';
    return {
      ...base,
      ...value,
      status: email ? status : 'guest',
      email,
      otpHash: typeof value.otpHash === 'string' ? value.otpHash : '',
      otpDemoCode: typeof value.otpDemoCode === 'string' ? value.otpDemoCode : '',
      otpExpiresAt: Number.isFinite(Number(value.otpExpiresAt)) ? Number(value.otpExpiresAt) : 0,
      otpAttempts: Math.max(0, Math.min(10, Number.isFinite(Number(value.otpAttempts)) ? Number(value.otpAttempts) : 0)),
      otpIssuedAt: Number.isFinite(Number(value.otpIssuedAt)) ? Number(value.otpIssuedAt) : 0,
      dataChoice,
      signedInAt: typeof value.signedInAt === 'string' ? value.signedInAt : '',
      lastAuthAt: typeof value.lastAuthAt === 'string' ? value.lastAuthAt : '',
      provider: 'local_otp_stub',
      cloudConnected: false
    };
  }

  const defaults = {
    schemaVersion: VERSION,
    uiMode: 'edit',
    currentPage: 'schedule',
    mode: 'timer',
    title: '朝の支度',
    vehicle: '🚃',
    stations: clone(presets[0].stations),
    presets: clone(presets),
    currentPresetId: 'morning',
    todos: [],
    settings: clone(DEFAULT_SETTINGS),
    doneIndex: -1,
    running: false,
    startedAt: null,
    elapsedMs: 0,
    accountAuth: defaultAccountAuth()
  };

  let state = loadState();
  let tickHandle = null;
  let menuOpen = false;
  let focusBeforeMenu = null;
  let previewing = false;
  let pendingUndo = null;
  let undoHandle = null;
  let previousActionLocked = false;
  let audioContext = null;
  let lastTickIndex = null;
  let autoEndSoundPlayed = false;
  let deferredInstallPrompt = null;
  let serviceWorkerRegistration = null;
  let serviceWorkerRefreshing = false;
  let pendingServiceWorker = null;

  function safeJSON(raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('保存データを解析できませんでした', error);
      return null;
    }
  }

  function validTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : '';
  }

  function normalizeSettings(source) {
    const incoming = source && typeof source === 'object' ? source : {};
    const legacy = {
      timelineMode: 'horizontal',
      showTopCards: incoming.showTopCards,
      showUpcoming: incoming.showBottomCards,
      showNumbers: incoming.showNumbers,
      arrivalSound: incoming.sound,
      speech: incoming.voice,
      lateBehavior: incoming.lateBehavior,
      lateGraceMin: incoming.lateGraceMin
    };
    const merged = { ...clone(DEFAULT_SETTINGS), ...legacy, ...incoming };
    Object.entries(SETTING_ENUMS).forEach(([key, values]) => {
      if (!values.includes(merged[key])) merged[key] = DEFAULT_SETTINGS[key];
    });
    [
      'reduceMotion', 'showTopCards', 'showUpcoming', 'showNumbers',
      'arrivalSound', 'speech', 'quietMode', 'showPreviousButton',
      'mistakePrevention', 'editorLock'
    ].forEach((key) => {
      merged[key] = typeof merged[key] === 'boolean' ? merged[key] : DEFAULT_SETTINGS[key];
    });
    merged.speechRate = Math.max(0.6, Math.min(1.4, Number(merged.speechRate) || 1));
    merged.lateGraceMin = Math.max(0, Math.min(30, Math.round(Number(merged.lateGraceMin) || 0)));
    return merged;
  }

  function normalizeStation(station, index) {
    const oldMinutes = Number(
      station?.minutes ??
      station?.timerIntervalMin ??
      station?.autoIntervalMin ??
      station?.intervalMin ??
      station?.minute ??
      5
    );
    const arrive = validTime(station?.clockStart || station?.arrive) || '07:30';
    const normalized = {
      id: String(station?.id || `station-${Date.now()}-${index}`),
      name: String(station?.name || '駅').slice(0, 18),
      icon: String(station?.icon || '⭐'),
      minutes: Math.max(0, Math.min(240, Number.isFinite(oldMinutes) ? oldMinutes : 5)),
      arrive,
      depart: validTime(station?.clockEnd || station?.depart) || arrive
    };
    return dataLayer ? dataLayer.attachEntityMeta(normalized, station, 'station') : normalized;
  }

  function normalizePreset(preset, index) {
    if (!preset || typeof preset !== 'object') return null;
    const stations = Array.isArray(preset.stations) && preset.stations.length
      ? preset.stations.map(normalizeStation)
      : clone(presets[0].stations);
    const normalized = {
      id: String(preset.id || `preset-${index}`),
      label: String(preset.label || preset.title || '予定').slice(0, 18),
      title: String(preset.title || preset.label || '予定').slice(0, 28),
      vehicle: String(preset.vehicle || '🚃'),
      stations
    };
    return dataLayer ? dataLayer.attachEntityMeta(normalized, preset, 'preset') : normalized;
  }

  function loadState() {
    let source = null;
    for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        source = safeJSON(raw);
        if (source) break;
      } catch (error) {
        console.warn('保存データを読めませんでした', error);
      }
    }

    if (!source) {
      const fresh = clone(defaults);
      normalizeIntervalDurations(fresh.stations);
      return dataLayer ? dataLayer.prepareState(fresh) : fresh;
    }

    const mode = 'timer';
    const migrated = {
      ...clone(defaults),
      ...source,
      schemaVersion: VERSION,
      mode,
      uiMode: ['view', 'edit'].includes(source.uiMode) ? source.uiMode : 'edit',
      currentPage: ['schedule', 'todo', 'settings', 'account'].includes(source.currentPage) ? source.currentPage : 'schedule'
    };

    migrated.accountAuth = normalizeAccountAuth(source.accountAuth);

    migrated.presets = (Array.isArray(source.presets) ? source.presets : presets)
      .map(normalizePreset)
      .filter(Boolean);
    if (!migrated.presets.length) migrated.presets = clone(presets);

    migrated.stations = (
      Array.isArray(source.stations) && source.stations.length
        ? source.stations
        : migrated.presets[0].stations
    ).map(normalizeStation);
    normalizeIntervalDurations(migrated.stations);

    migrated.todos = (Array.isArray(source.todos) ? source.todos : [])
      .map((todo, index) => {
        const normalized = {
          id: String(todo.id || `todo-${index}`),
          text: String(todo.text || todo.name || '').slice(0, 24),
          minutes: Math.max(1, Number(todo.minutes) || 5)
        };
        return dataLayer ? dataLayer.attachEntityMeta(normalized, todo, 'todo') : normalized;
      })
      .filter((todo) => todo.text);

    migrated.settings = normalizeSettings(source.settings || source);
    migrated.settings.lateBehavior = ['display', 'wait'].includes(migrated.settings.lateBehavior) ? migrated.settings.lateBehavior : 'display';
    migrated.mode = 'timer';

    migrated.doneIndex = Math.max(
      -1,
      Math.min(
        migrated.stations.length - 1,
        Number.isInteger(source.doneIndex)
          ? source.doneIndex
          : (Number.isInteger(source.doneUntilIndex) ? source.doneUntilIndex : -1)
      )
    );
    migrated.running = Boolean(source.autoRunning ?? source.running);
    migrated.startedAt = Number(source.autoStartedAt ?? source.timerStartedAt) || null;
    migrated.elapsedMs = Math.max(
      0,
      Number(source.autoPausedElapsedMs ?? source.pausedElapsedMs ?? source.elapsedMs) || 0
    );
    if (migrated.running && !migrated.startedAt) migrated.running = false;
    return dataLayer ? dataLayer.prepareState(migrated) : migrated;
  }

  function saveState(reason = 'app-save') {
    try {
      state.schemaVersion = VERSION;
      const plan = dataLayer ? dataLayer.planStateSave(state, { reason }) : null;
      if (plan) state = plan.state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (plan) {
        dataLayer.commitPlan(plan)
          .then(refreshDataLayerStatus)
          .catch((error) => console.warn('同期準備データを記録できませんでした。', error));
      }
      setText('saveStatus', '✓ この端末に自動保存しました');
      return true;
    } catch (error) {
      console.error('保存できませんでした', error);
      showError('端末内へ保存できませんでした。ブラウザの保存設定を確認してください。');
      return false;
    }
  }

  function showError(message) {
    const element = byId('errorBanner');
    if (!element) return;
    element.textContent = message;
    element.classList.remove('hidden');
  }

  function setText(id, text) {
    const element = byId(id);
    if (element && element.textContent !== String(text)) element.textContent = String(text);
  }

  function announce(text) {
    setText('liveStatus', text);
  }

  function safeOn(target, event, handler, options) {
    const element = typeof target === 'string' ? byId(target) : target;
    if (!element) {
      console.warn(`要素が見つかりません: ${target}`);
      return false;
    }
    element.addEventListener(event, (eventObject) => {
      try {
        handler(eventObject);
      } catch (error) {
        console.error(`操作中にエラー: ${target}`, error);
        showError('一部の操作で問題が発生しました。ほかの操作は続けられます。');
      }
    }, options);
    return true;
  }



  async function refreshDataLayerStatus() {
    const badge = byId('syncLayerStatusBadge');
    if (!dataLayer) {
      setText('syncLayerStatusText', '端末内データ層を読み込めませんでした。基本機能は引き続き利用できます。');
      setText('syncStorageText', '未使用');
      badge?.classList.add('warning');
      if (badge) badge.textContent = '利用不可';
      return;
    }
    try {
      const status = await dataLayer.getStatus();
      const shortDeviceId = status.deviceId.length > 24
        ? `${status.deviceId.slice(0, 12)}…${status.deviceId.slice(-6)}`
        : status.deviceId;
      setText('deviceIdText', shortDeviceId);
      setText('localDataVersionText', `V${status.localDataVersion}`);
      setText('pendingChangeCount', String(status.pendingCount));
      setText('syncStorageText', status.storage === 'indexeddb' ? 'IndexedDB' : '予備保存');
      setText('syncLayerStatusText', status.pendingCount
        ? `${status.pendingCount}件の変更を、この端末内で同期準備中です。`
        : '端末内データは整理済みです。クラウドには接続していません。');
      if (badge) {
        badge.textContent = 'クラウド未接続';
        badge.classList.remove('warning');
        badge.classList.add('ready');
      }
    } catch (error) {
      console.warn('端末内データ層の状態を確認できませんでした。', error);
      setText('syncLayerStatusText', '状態を確認できませんでした。予定データはlocalStorageに保持されています。');
      setText('syncStorageText', '確認エラー');
      if (badge) {
        badge.textContent = '確認エラー';
        badge.classList.remove('ready');
        badge.classList.add('warning');
      }
    }
  }

  function rebuildLocalSyncPreparation() {
    if (!dataLayer) return;
    if (!window.confirm('端末内の同期準備データを、現在の予定から作り直しますか？予定そのものは削除されません。')) return;
    (async () => {
      state = await dataLayer.rebuildQueue(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      await refreshDataLayerStatus();
      setText('settingsSaveStatus', '✓ 同期準備データを再作成しました。');
    })().catch((error) => {
      console.error(error);
      setText('settingsSaveStatus', '同期準備データを再作成できませんでした。');
    });
  }

  function exportLocalDataSummary() {
    if (!dataLayer) return;
    (async () => {
      const summary = await dataLayer.exportSummary(state);
      downloadJson('oshitaku-train-local-data-summary.json', summary);
      setText('settingsSaveStatus', '✓ 個人情報を含まない診断情報を書き出しました。');
    })().catch((error) => {
      console.error(error);
      setText('settingsSaveStatus', '診断情報を書き出せませんでした。');
    });
  }


  function isSecurePwaContext() {
    return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  function updateConnectionStatus() {
    const online = navigator.onLine;
    const status = byId('connectionStatus');
    if (status) {
      status.classList.toggle('offline', !online);
      status.classList.toggle('online', online);
      status.innerHTML = `<span aria-hidden="true">●</span><span>${online ? 'オンライン' : 'オフラインで利用中'}</span>`;
    }
    const pwaText = byId('pwaStatusText');
    if (pwaText) {
      if (!('serviceWorker' in navigator)) {
        pwaText.textContent = 'このブラウザはオフラインアプリ機能に対応していません。';
      } else if (!isSecurePwaContext()) {
        pwaText.textContent = 'オフライン利用にはHTTPSまたはlocalhostで開く必要があります。';
      } else if (!online) {
        pwaText.textContent = 'オフラインで利用中です。端末内に保存済みの機能を使用できます。';
      } else if (navigator.serviceWorker.controller) {
        pwaText.textContent = 'オフライン利用の準備ができています。';
      } else {
        pwaText.textContent = '初回のオフライン準備を行っています。';
      }
    }
    const badge = byId('pwaStatusBadge');
    if (badge) {
      const ready = Boolean(navigator.serviceWorker?.controller);
      badge.textContent = !online ? 'オフライン' : (ready ? '準備完了' : '準備中');
      badge.classList.toggle('ready', ready);
      badge.classList.toggle('offline', !online);
    }
  }

  function showUpdateBanner(worker) {
    pendingServiceWorker = worker || serviceWorkerRegistration?.waiting || null;
    const banner = byId('updateBanner');
    banner?.classList.remove('hidden');
  }

  function hideUpdateBanner() {
    byId('updateBanner')?.classList.add('hidden');
  }

  async function applyAvailableUpdate() {
    saveState();
    const worker = pendingServiceWorker || serviceWorkerRegistration?.waiting;
    if (!worker) {
      setText('pwaStatusText', '現在利用できる更新はありません。');
      hideUpdateBanner();
      return;
    }
    setText('pwaStatusText', '新しいバージョンへ更新しています。');
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  async function checkForPwaUpdate() {
    if (!serviceWorkerRegistration) {
      setText('pwaStatusText', isSecurePwaContext()
        ? 'オフライン機能の準備中です。少し待ってから再度お試しください。'
        : '更新確認にはHTTPSまたはlocalhostが必要です。');
      return;
    }
    try {
      setText('pwaStatusText', '更新を確認しています。');
      await serviceWorkerRegistration.update();
      if (serviceWorkerRegistration.waiting) showUpdateBanner(serviceWorkerRegistration.waiting);
      else setText('pwaStatusText', '最新バージョンを使用しています。');
    } catch (error) {
      console.warn('更新を確認できませんでした', error);
      setText('pwaStatusText', navigator.onLine
        ? '更新を確認できませんでした。時間をおいて再度お試しください。'
        : 'オフラインのため更新確認はできません。');
    }
  }

  async function installPwa() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } finally {
      deferredInstallPrompt = null;
      byId('installAppButton')?.classList.add('hidden');
    }
  }

  async function registerPwa() {
    updateConnectionStatus();
    if (!('serviceWorker' in navigator) || !isSecurePwaContext()) return;
    try {
      serviceWorkerRegistration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
      await navigator.serviceWorker.ready;
      updateConnectionStatus();

      if (serviceWorkerRegistration.waiting) showUpdateBanner(serviceWorkerRegistration.waiting);
      serviceWorkerRegistration.addEventListener('updatefound', () => {
        const installing = serviceWorkerRegistration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') {
            if (navigator.serviceWorker.controller) showUpdateBanner(installing);
            updateConnectionStatus();
          }
        });
      });
    } catch (error) {
      console.warn('オフライン機能を登録できませんでした', error);
      setText('pwaStatusText', 'オフライン機能を準備できませんでした。通常のWebアプリとして利用できます。');
    }
  }

  function activeIndex() {
    return Math.min(state.doneIndex + 1, state.stations.length - 1);
  }

  function totalMinutes() {
    return state.stations.slice(0, -1).reduce(
      (sum, station) => sum + Math.max(0, Number(station.minutes) || 0),
      0
    );
  }

  function currentElapsed() {
    return state.elapsedMs + (state.running && state.startedAt ? nowMs() - state.startedAt : 0);
  }

  function autoIndex() {
    const minutes = currentElapsed() / 60000;
    let accumulated = 0;
    for (let index = 0; index < state.stations.length - 1; index += 1) {
      accumulated += Math.max(0, Number(state.stations[index].minutes) || 0);
      if (minutes < accumulated) return index;
    }
    return state.stations.length - 1;
  }

  function clockMinutes(time) {
    const [hours, minutes] = String(time || '00:00').split(':').map(Number);
    return hours * 60 + minutes;
  }

  function clockIndex() {
    const date = new Date();
    const now = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
    let index = 0;
    state.stations.forEach((station, stationIndex) => {
      if (clockMinutes(station.arrive) <= now) index = stationIndex;
    });
    return index;
  }

  function progressElapsedMs() {
    const index = activeIndex();
    const completedBaseline = durationBefore(index) * 60000;
    return Math.max(currentElapsed(), completedBaseline);
  }

  function remainingMs() {
    return Math.max(0, totalMinutes() * 60000 - progressElapsedMs());
  }

  function formatDuration(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }


  function intervalMinutes(index) {
    if (!state.stations[index]) return 0;
    const currentMinutes = Math.max(0, Number(state.stations[index].minutes) || 0);
    if (currentMinutes > 0) return currentMinutes;

    // Safety net for older data: if the first station was saved as 0 and the next station has time,
    // treat the next station's minutes as the first interval.
    if (index === 0 && isLikelyLegacyDestinationDuration(state.stations)) {
      return Math.max(0, Number(state.stations[1]?.minutes) || 0);
    }
    return currentMinutes;
  }


  function durationBefore(index) {
    return state.stations.slice(0, index).reduce(
      (sum, _station, stationIndex) => sum + intervalMinutes(stationIndex),
      0
    );
  }



  function isLikelyLegacyDestinationDuration(stations) {
    if (!Array.isArray(stations) || stations.length < 3) return false;
    const first = Number(stations[0]?.minutes) || 0;
    const second = Number(stations[1]?.minutes) || 0;
    const last = Number(stations[stations.length - 1]?.minutes) || 0;
    return first === 0 && second > 0 && last === 0;
  }

  function normalizeIntervalDurations(stations) {
    if (!Array.isArray(stations)) return stations;
    if (!isLikelyLegacyDestinationDuration(stations)) return stations;

    for (let index = 0; index < stations.length - 1; index += 1) {
      stations[index].minutes = Math.max(0, Number(stations[index + 1]?.minutes) || 0);
      stations[index].updatedAt = new Date().toISOString();
    }
    stations[stations.length - 1].minutes = 0;
    stations[stations.length - 1].updatedAt = new Date().toISOString();
    return stations;
  }


  function isCurrentStationLate(index = activeIndex()) {
    if (state.mode !== 'timer' || !state.running || index >= state.stations.length - 1) return false;
    const deadline = (durationBefore(index + 1) + state.settings.lateGraceMin) * 60000;
    return currentElapsed() > deadline;
  }

  function displayModeActive() {
    return state.uiMode === 'view' || previewing;
  }


  function effectiveTimelineMode() {
    return 'horizontal';
  }

  function applySettings() {
    state.settings = normalizeSettings(state.settings);
    state.settings.timelineMode = 'horizontal';
    const root = document.documentElement;
    root.dataset.fontSize = state.settings.fontSize;
    root.dataset.cardSize = state.settings.cardSize;
    root.dataset.appearance = state.settings.appearance;
    root.dataset.contrast = state.settings.contrast;
    root.dataset.doneButtonSize = state.settings.doneButtonSize;
    document.body.classList.toggle('reduce-motion', state.settings.reduceMotion);
    document.body.classList.toggle('hide-top-cards', !state.settings.showTopCards);
    document.body.classList.toggle('hide-upcoming', !state.settings.showUpcoming);
    document.body.classList.toggle('hide-numbers', !state.settings.showNumbers);
    document.body.classList.toggle('timeline-current-next', state.settings.timelineScope === 'currentNext');
    const timelineMode = effectiveTimelineMode();
    document.body.classList.toggle('timeline-horizontal', timelineMode === 'horizontal');
    document.body.classList.toggle('timeline-vertical', timelineMode === 'vertical');
    const track = byId('track');
    if (track) track.style.setProperty('--station-count', String(state.stations.length));
  }

  function updateSetting(key, value, { renderNow = true } = {}) {
    if (!(key in DEFAULT_SETTINGS)) return false;
    if (SETTING_ENUMS[key] && !SETTING_ENUMS[key].includes(value)) return false;
    if (typeof DEFAULT_SETTINGS[key] === 'boolean') value = Boolean(value);
    if (key === 'speechRate') value = Math.max(0.6, Math.min(1.4, Number(value) || 1));
    if (key === 'lateGraceMin') value = Math.max(0, Math.min(30, Math.round(Number(value) || 0)));
    state.settings[key] = value;
    saveState();
    applySettings();
    renderSettings();
    if (renderNow) render();
    setText('settingsSaveStatus', '✓ 変更をこの端末に保存しました。');
    return true;
  }

  function renderSettings() {
    if (!state.settings) state.settings = clone(DEFAULT_SETTINGS);
    document.querySelectorAll('[data-setting][data-value]').forEach((button) => {
      const selected = String(state.settings[button.dataset.setting]) === button.dataset.value;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(selected));
      button.classList.toggle('selected', selected);
    });
    const toggles = {
      reduceMotionToggle: 'reduceMotion',
      showTopCardsToggle: 'showTopCards',
      showNumbersToggle: 'showNumbers',
      arrivalSoundToggle: 'arrivalSound',
      speechToggle: 'speech',
      quietModeToggle: 'quietMode',
      showPreviousButtonToggle: 'showPreviousButton',
      mistakePreventionToggle: 'mistakePrevention',
      editorLockToggle: 'editorLock',
      autoEndSoundToggle: 'autoEndSound'
    };
    Object.entries(toggles).forEach(([id, key]) => {
      const input = byId(id);
      if (input) input.checked = Boolean(state.settings[key]);
    });
    if (byId('speechRateRange')) byId('speechRateRange').value = String(state.settings.speechRate);
    setText('speechRateValue', `${Number(state.settings.speechRate).toFixed(1)}倍`);
    if (byId('lateGraceInput')) byId('lateGraceInput').value = String(state.settings.lateGraceMin);
    setText('appVersionText', String(VERSION));
    updateConnectionStatus();
  }

  function playTone(kind = 'arrival') {
    if (state.settings.quietMode) return;
    if (kind === 'arrival' && !state.settings.arrivalSound) return;
    if (kind === 'complete' && !state.settings.autoEndSound) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ||= new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = kind === 'complete' ? 740 : 560;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.26);
    } catch (error) {
      console.warn('音を再生できませんでした', error);
    }
  }

  function speakText(text, force = false) {
    if (!force && (!state.settings.speech || state.settings.quietMode)) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = 'ja-JP';
    utterance.rate = state.settings.speechRate;
    window.speechSynthesis.speak(utterance);
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const parsed = safeJSON(reader.result);
        parsed ? resolve(parsed) : reject(new Error('JSON形式ではありません'));
      });
      reader.addEventListener('error', () => reject(reader.error || new Error('ファイルを読めませんでした')));
      reader.readAsText(file, 'utf-8');
    });
  }

  function render() {
    try {
      const displayMode = displayModeActive();
      applySettings();
      document.body.classList.toggle('view-mode', state.uiMode === 'view');
      document.body.classList.toggle('edit-mode', state.uiMode === 'edit');
      document.body.classList.toggle('preview-mode', false);

      const viewToggle = byId('viewEditToggle');
      if (viewToggle) {
        setText('viewEditToggle', state.uiMode === 'view' ? '編集画面' : '子ども画面');
        viewToggle.setAttribute('aria-pressed', String(displayMode));
      }
      byId('schedulePage')?.classList.toggle('active', state.currentPage === 'schedule');
      byId('todoPage')?.classList.toggle('active', state.currentPage === 'todo');
      byId('settingsPage')?.classList.toggle('active', state.currentPage === 'settings');
      viewToggle?.classList.toggle('hidden', state.currentPage !== 'schedule');

      setText('displayTitle', state.title);
      const index = activeIndex();
      renderCurrentCard(index);
      renderTimeInformation(index);
      renderTrack(index);
      renderEditor();
      renderTodos();
      renderPresets();
      renderSettings();

      const childViewActive = state.currentPage === 'schedule' && state.uiMode === 'view';
      const doneHidden = !childViewActive || index >= state.stations.length - 1;
      const previousHidden = !childViewActive || !state.settings.showPreviousButton;
      const previousDisabled = index <= 0 || previousActionLocked;

      byId('doneBtn')?.classList.toggle('hidden', doneHidden);
      const previousButton = byId('previousStationBtn');
      if (previousButton) {
        previousButton.classList.toggle('hidden', previousHidden);
        previousButton.disabled = previousDisabled;
        previousButton.setAttribute('aria-disabled', String(previousDisabled));
        previousButton.title = index <= 0 ? '最初の駅です' : '一つ前の駅にもどります';
      }
      const actionRow = byId('actionRow');
      if (actionRow) {
        actionRow.classList.toggle('hidden', doneHidden && previousHidden);
        actionRow.classList.toggle('single-action', !previousHidden && doneHidden);
      }

      const timerControls = byId('viewTimerControls');
      if (timerControls) timerControls.classList.toggle('hidden', !childViewActive);
      const startButton = byId('startBtn');
      const pauseButton = byId('pauseBtn');
      const resetButton = byId('resetBtn');
      const atGoal = index >= state.stations.length - 1;
      if (startButton) {
        startButton.disabled = !childViewActive || state.running || atGoal;
        startButton.setAttribute('aria-disabled', String(startButton.disabled));
      }
      if (pauseButton) {
        pauseButton.disabled = !childViewActive || !state.running;
        pauseButton.setAttribute('aria-disabled', String(pauseButton.disabled));
      }
      if (resetButton) {
        resetButton.disabled = !childViewActive && state.uiMode !== 'edit';
        resetButton.setAttribute('aria-disabled', String(resetButton.disabled));
      }

      byId('completion')?.classList.toggle('hidden', index < state.stations.length - 1);
    } catch (error) {
      console.error('描画エラー', error);
      showError('画面の一部を表示できませんでした。');
    }
  }

  function renderCurrentCard(index) {
    const station = state.stations[index];
    setText('currentIcon', station?.icon || '⭐');
    setText('currentName', station?.name || '予定');
  }

  function renderTimeInformation(index) {
    const current = state.stations[index];
    const next = state.stations[index + 1];
    const late = isCurrentStationLate(index);
    const lateMessage = state.settings.lateBehavior === 'wait'
      ? 'ゆっくりでだいじょうぶ。できたら次へ進みます。'
      : 'ゆっくりでだいじょうぶ。';
    setText('nextBox', late ? lateMessage : (next ? `つぎは「${next.name}」です` : 'ゴールです'));
    byId('nextBox')?.classList.toggle('late', late);
    setText('nowMetric', current?.name || '予定');

    const elapsedInCurrent = Math.max(0, progressElapsedMs() - durationBefore(index) * 60000);
    const currentRemaining = next
      ? Math.max(0, intervalMinutes(index) * 60000 - elapsedInCurrent)
      : 0;
    setText('nextMetric', next ? formatDuration(currentRemaining) : 'ゴール');

    const completed = Math.max(0, state.doneIndex + 1);
    setText('percentMetric', `${completed}/${state.stations.length}`);
  }

  function renderTrack(index) {
    const track = byId('track');
    if (!track) return;
    [...track.querySelectorAll('.station-dot')].forEach((element) => element.remove());

    const last = Math.max(1, state.stations.length - 1);
    state.stations.forEach((station, stationIndex) => {
      const dot = document.createElement('div');
      const distant = state.settings.timelineScope === 'currentNext' && ![index, index + 1].includes(stationIndex);
      dot.className = `station-dot${stationIndex <= index ? ' done' : ''}${distant ? ' is-distant' : ''}`;
      const position = stationIndex / last * 100;
      dot.style.left = `${position}%`;
      dot.style.setProperty('--station-position', `${position}%`);
      dot.textContent = station.icon;

      const label = document.createElement('span');
      label.className = 'station-label';
      label.textContent = station.name;
      dot.append(label);
      track.append(dot);
    });

    const progress = index / last * 100;
    track.style.setProperty('--track-progress', `${progress}%`);
    track.style.setProperty('--station-count', String(state.stations.length));
    track.style.height = '';
    if (byId('vehicle')) {
      byId('vehicle').style.left = `${progress}%`;
      byId('vehicle').style.top = '';
    }
    if (byId('trackDone')) {
      byId('trackDone').style.width = `${progress}%`;
      byId('trackDone').style.height = '';
    }
    setText('vehicle', state.vehicle);
  }

  function upcomingTimeLabel(station) {
    if (state.mode === 'clock') return `${station.arrive}から`;
    const minutes = Math.max(0, Number(station.minutes) || 0);
    return minutes > 0 ? `${minutes}分` : 'ゴール';
  }

  function renderUpcoming(index) {
    const box = byId('upcomingCards');
    if (box) box.replaceChildren();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }

  function renderEditor() {
    if (byId('titleInput')) byId('titleInput').value = state.title;
    if (byId('vehicleSelect')) byId('vehicleSelect').value = state.vehicle;

    MODES.forEach((mode) => {
      const button = $(`[data-mode="${mode}"]`);
      if (!button) return;
      button.classList.toggle('active', state.mode === mode);
      button.setAttribute('aria-pressed', String(state.mode === mode));
    });

    const editor = byId('stationEditor');
    if (!editor) return;
    editor.replaceChildren();

    state.stations.forEach((station, index) => {
      const isLast = index === state.stations.length - 1;
      const stationMinutes = intervalMinutes(index);
      const row = document.createElement('article');
      row.className = 'station-edit-card improved-station-card';
      row.dataset.stationIndex = String(index);
      row.innerHTML = `
        <div class="station-card-head">
          <div class="station-number-badge">${index + 1}</div>
          <div>
            <h3>${isLast ? 'ゴール駅' : `${index + 1}番目の駅`}</h3>
            <p>${isLast ? '最後の駅です。時間は設定しません。' : 'この駅から次の駅までの絵と時間を決めます。'}</p>
          </div>
        </div>

        <div class="station-visual-preview" aria-label="子ども画面での見え方">
          <span class="station-preview-caption">子ども画面ではこう見えます</span>
          <div class="station-preview-card">
            <span class="station-preview-icon">${escapeHtml(station.icon || '⭐')}</span>
            <strong>${escapeHtml(station.name || '予定')}</strong>
            ${isLast ? '<small>ゴール</small>' : `<small>次まで ${stationMinutes}分</small>`}
          </div>
        </div>

        <div class="station-edit-fields">
          <label>駅の名前
            <input data-field="name" data-index="${index}" value="${escapeHtml(station.name || '')}" aria-label="駅名" placeholder="例：はみがき">
          </label>

          <div class="emoji-select-block">
            <div class="emoji-select-head">
              <span>絵文字を選ぶ</span>
              <strong class="selected-emoji-preview">${escapeHtml(station.icon || '⭐')}</strong>
            </div>
            ${emojiOptionsMarkup(station, index)}
          </div>

          <label class="${isLast ? 'hidden' : ''}">この駅から次の駅までの時間
            <div class="minutes-input-row">
              <input data-field="minutes" data-index="${index}" type="number" min="1" max="120" value="${stationMinutes || 5}" aria-label="所要時間（分）">
              <span>分</span>
            </div>
          </label>
        </div>

        <div class="station-actions station-card-actions">
          <button type="button" class="btn tiny" data-move="up" data-index="${index}" aria-label="上へ" ${index === 0 ? 'disabled' : ''}>↑ 上へ</button>
          <button type="button" class="btn tiny" data-move="down" data-index="${index}" aria-label="下へ" ${isLast ? 'disabled' : ''}>↓ 下へ</button>
          <button type="button" class="btn tiny danger-soft" data-delete="${index}" aria-label="削除" ${state.stations.length <= 2 ? 'disabled' : ''}>削除</button>
        </div>`;
      editor.append(row);
    });
  }

  function renderPresets() {
    const box = byId('presetList');
    if (!box) return;
    box.replaceChildren();

    state.presets.forEach((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `preset-button${state.currentPresetId === preset.id ? ' active' : ''}`;
      button.dataset.preset = preset.id;
      button.innerHTML = `
        <span class="preset-button-copy">
          <strong>${escapeHtml(preset.label)}</strong>
          <small>画面表示：${escapeHtml(preset.title)}</small>
        </span>
        <span class="preset-vehicle" aria-hidden="true">${escapeHtml(preset.vehicle)}</span>`;
      box.append(button);
    });
  }

  function renderTodos() {
    const box = byId('todoList');
    if (!box) return;
    box.replaceChildren();
    if (!state.todos.length) {
      box.innerHTML = '<p>まだTo Doはありません。</p>';
      return;
    }

    state.todos.forEach((todo) => {
      const item = document.createElement('div');
      item.className = 'todo-item';
      item.innerHTML = `
        <span><strong>${escapeHtml(todo.text)}</strong><small>${todo.minutes}分</small></span>
        <button class="btn danger" type="button" data-delete-todo="${escapeHtml(todo.id)}">削除</button>`;
      box.append(item);
    });
  }

  function hideUndo() {
    if (undoHandle) {
      clearTimeout(undoHandle);
      undoHandle = null;
    }
    pendingUndo = null;
    const snackbar = byId('undoSnackbar');
    snackbar?.classList.add('hidden');
    snackbar?.setAttribute('aria-hidden', 'true');
  }

  function showUndo(message, snapshot) {
    if (undoHandle) clearTimeout(undoHandle);
    pendingUndo = snapshot;
    setText('undoMessage', message);
    const snackbar = byId('undoSnackbar');
    snackbar?.classList.remove('hidden');
    snackbar?.setAttribute('aria-hidden', 'false');
    undoHandle = setTimeout(hideUndo, 5000);
  }

  function restorePreviousAction() {
    if (!pendingUndo) return;
    const snapshot = pendingUndo;
    if (undoHandle) clearTimeout(undoHandle);
    undoHandle = null;
    pendingUndo = null;

    state.mode = snapshot.mode;
    state.doneIndex = snapshot.doneIndex;
    state.elapsedMs = snapshot.elapsedMs;
    state.running = snapshot.running;
    state.startedAt = snapshot.running ? nowMs() : null;
    saveState();
    byId('undoSnackbar')?.classList.add('hidden');
    byId('undoSnackbar')?.setAttribute('aria-hidden', 'true');
    render();
    announce('前の駅にもどる操作を元に戻しました。');
  }

  function previousStation() {
    if (previousActionLocked || previewing || state.uiMode !== 'view') return;
    const currentIndex = activeIndex();
    if (currentIndex <= 0) {
      announce('いまは最初の駅です。');
      return;
    }

    if (state.settings.mistakePrevention && !window.confirm('一つ前の駅にもどりますか？')) return;

    previousActionLocked = true;
    const snapshot = {
      mode: 'timer',
      doneIndex: state.doneIndex,
      elapsedMs: currentElapsed(),
      running: state.running,
      startedAt: state.startedAt
    };
    const targetIndex = currentIndex - 1;
    const target = state.stations[targetIndex];
    const wasRunning = state.running;

    state.mode = 'timer';
    state.doneIndex = targetIndex - 1;
    state.elapsedMs = durationBefore(targetIndex) * 60000;
    state.running = wasRunning;
    state.startedAt = wasRunning ? nowMs() : null;

    saveState();
    render();
    const stationName = `${target?.name || '前の予定'}${String(target?.name || '').endsWith('駅') ? '' : '駅'}`;
    showUndo(`${stationName}にもどりました。`, snapshot);
    announce(`${stationName}にもどりました。`);

    setTimeout(() => {
      previousActionLocked = false;
      render();
    }, 650);
  }

  function setMode(mode) {
    hideUndo();
    previewing = false;
    pauseTimer(false);
    state.mode = 'timer';
    state.doneIndex = -1;
    state.elapsedMs = 0;
    state.startedAt = null;
    lastTickIndex = null;
    saveState();
    startTick();
    render();
    announce('できたタイマーにしました。');
  }

  function startTimer() {
    state.mode = 'timer';
    if (state.currentPage !== 'schedule') state.currentPage = 'schedule';
    if (state.uiMode !== 'view') state.uiMode = 'view';
    if (!state.running) {
      state.running = true;
      state.startedAt = nowMs();
      saveState();
      startTick();
      render();
    }
  }

  function pauseTimer(doRender = true) {
    if (state.running) {
      state.elapsedMs = currentElapsed();
      state.running = false;
      state.startedAt = null;
      saveState();
    }
    if (doRender) render();
  }

  function resetTimer() {
    hideUndo();
    state.running = false;
    state.startedAt = null;
    state.elapsedMs = 0;
    state.doneIndex = -1;
    lastTickIndex = null;
    autoEndSoundPlayed = false;
    saveState();
    render();
  }

  function startTick() {
    if (tickHandle) return;
    lastTickIndex = activeIndex();
    tickHandle = setInterval(() => {
      if (!state.running) return;
      render();
    }, 500);
  }

  function stopTickIfIdle() {
    if (tickHandle && !state.running) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function done() {
    if (state.settings.mistakePrevention && !window.confirm('「できた！」で次の予定へ進みますか？')) return;
    hideUndo();

    const wasRunning = state.running;
    const beforeElapsed = currentElapsed();
    state.doneIndex = Math.min(state.doneIndex + 1, state.stations.length - 1);

    const newActiveIndex = activeIndex();
    const completedBaseline = durationBefore(newActiveIndex) * 60000;
    state.elapsedMs = Math.max(beforeElapsed, completedBaseline);
    state.startedAt = wasRunning ? nowMs() : null;
    state.running = wasRunning && state.doneIndex < state.stations.length - 1;

    const next = state.stations[state.doneIndex + 1];
    playTone(state.doneIndex >= state.stations.length - 1 ? 'complete' : 'arrival');
    if (next) speakText(next.name);
    saveState();
    render();
    announce(`${state.stations[state.doneIndex]?.name || '予定'}ができました`);
  }

  function enterPreview() {
    previewing = false;
    state.uiMode = 'view';
    state.currentPage = 'schedule';
    closeMenu();
    saveState();
    render();
    announce('子ども画面へ移りました。');
  }

  function returnToEdit() {
    previewing = false;
    state.uiMode = 'edit';
    state.currentPage = 'schedule';
    saveState();
    render();
    requestAnimationFrame(() => byId('viewEditToggle')?.focus());
    announce('編集画面へ戻りました。');
  }

  function toggleView() {
    if (state.uiMode === 'view') {
      if (state.settings.editorLock && !window.confirm('保護者用の編集画面へ戻りますか？')) return;
      state.uiMode = 'edit';
      pauseTimer(false);
      saveState();
      render();
      announce('編集画面へ戻りました。');
      return;
    }

    previewing = false;
    state.uiMode = 'view';
    state.currentPage = 'schedule';
    closeMenu();
    saveState();
    render();
    announce('子ども画面へ移りました。出発ボタンでタイマーを始められます。');
  }

  function startPlan() {
    hideUndo();
    previewing = false;
    state.mode = 'timer';
    state.uiMode = 'view';
    state.currentPage = 'schedule';
    pauseTimer(false);
    state.running = false;
    state.startedAt = null;
    saveState();
    stopTickIfIdle();
    render();
    announce('子ども画面へ移りました。出発ボタンでタイマーを始められます。');
  }

  function showPage(page) {
    if (!['schedule', 'todo', 'settings', 'account'].includes(page)) return;
    hideUndo();
    previewing = false;
    state.currentPage = page;
      if (page === 'account' && typeof renderAccountAuth === 'function') renderAccountAuth();
    closeMenu();
    saveState();
    render();
  }

  function openMenu() {
    if (menuOpen) return;
    const menu = byId('appMenu');
    const backdrop = byId('menuBackdrop');
    const button = byId('menuButton');
    if (!menu || !backdrop || !button) return;

    focusBeforeMenu = document.activeElement;
    menuOpen = true;
    menu.classList.add('open');
    backdrop.classList.add('open');
    menu.removeAttribute('inert');
    menu.setAttribute('aria-hidden', 'false');
    backdrop.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => byId('menuCloseButton')?.focus());
  }

  function closeMenu() {
    const menu = byId('appMenu');
    const backdrop = byId('menuBackdrop');
    const button = byId('menuButton');

    menuOpen = false;
    menu?.classList.remove('open');
    backdrop?.classList.remove('open');
    menu?.setAttribute('aria-hidden', 'true');
    menu?.setAttribute('inert', '');
    backdrop?.setAttribute('aria-hidden', 'true');
    button?.setAttribute('aria-expanded', 'false');
    focusBeforeMenu?.focus?.();
  }

  function applyPreset(id) {
    hideUndo();
    const preset = state.presets.find((item) => item.id === id);
    if (!preset) return;
    previewing = false;
    pauseTimer(false);
    state.currentPresetId = id;
    state.title = preset.title;
    state.vehicle = preset.vehicle;
    state.stations = clone(preset.stations).map(normalizeStation);
    state.doneIndex = -1;
    state.elapsedMs = 0;
    saveState();
    render();
  }

  function createPresetId() {
    return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function saveAsPreset() {
    const input = byId('presetNameInput');
    const message = byId('presetSaveMessage');
    const label = String(input?.value || '').trim().slice(0, 18);

    if (!label) {
      if (message) {
        message.textContent = 'プリセット一覧の名前を入力してください。';
        message.classList.add('error');
      }
      input?.focus();
      return;
    }

    const preset = normalizePreset({
      id: createPresetId(),
      label,
      title: state.title,
      vehicle: state.vehicle,
      stations: clone(state.stations)
    }, state.presets.length);

    state.presets.push(preset);
    state.currentPresetId = preset.id;
    if (input) input.value = '';
    if (message) {
      message.textContent = `「${label}」として保存しました。`;
      message.classList.remove('error');
    }
    saveState();
    renderPresets();
    announce(`${label}として保存しました。`);
  }

  function addStation() {
    state.stations.push(normalizeStation({
      name: '新しい駅',
      icon: '⭐',
      minutes: 5,
      arrive: '07:30',
      depart: '07:35'
    }, state.stations.length));
    saveState();
    render();
  }

  function updateStation(target) {
    const index = Number(target.dataset.index);
    const field = target.dataset.field;
    if (!Number.isInteger(index) || !state.stations[index] || !field) return;
    if (field === 'minutes') {
      state.stations[index][field] = Math.max(0, Math.min(240, Number(target.value) || 0));
    } else {
      state.stations[index][field] = String(target.value).slice(0, 18);
    }
    saveState();
    render();
  }

  function moveStation(index, delta) {
    const nextIndex = index + delta;
    if (
      index < 0 || nextIndex < 0 ||
      index >= state.stations.length || nextIndex >= state.stations.length
    ) return;
    [state.stations[index], state.stations[nextIndex]] = [
      state.stations[nextIndex],
      state.stations[index]
    ];
    saveState();
    render();
  }

  function deleteStation(index) {
    if (state.stations.length <= 2) return;
    state.stations.splice(index, 1);
    state.doneIndex = Math.min(state.doneIndex, state.stations.length - 1);
    saveState();
    render();
  }

  function bind() {
    safeOn('menuButton', 'click', openMenu);
    safeOn('menuCloseButton', 'click', closeMenu);
    safeOn('menuBackdrop', 'click', closeMenu);
    safeOn('viewEditToggle', 'click', toggleView);
    safeOn('todoBackButton', 'click', () => showPage('schedule'));
    safeOn('settingsBackButton', 'click', () => showPage('schedule'));
    safeOn('doneBtn', 'click', done);
    safeOn('previousStationBtn', 'click', previousStation);
    safeOn('undoButton', 'click', restorePreviousAction);
    safeOn('undoCloseButton', 'click', hideUndo);
    safeOn('startBtn', 'click', startTimer);
    safeOn('pauseBtn', 'click', () => {
      pauseTimer();
      stopTickIfIdle();
    });
    safeOn('resetBtn', 'click', resetTimer);
    safeOn('startPlanBtn', 'click', startPlan);
    safeOn('savePresetBtn', 'click', saveAsPreset);
    safeOn('addStationBtn', 'click', addStation);
    safeOn('installAppButton', 'click', installPwa);
    safeOn('checkUpdateButton', 'click', checkForPwaUpdate);
    safeOn('applyUpdateButton', 'click', applyAvailableUpdate);
    safeOn('dismissUpdateButton', 'click', hideUpdateBanner);
    safeOn('refreshSyncStatusButton', 'click', refreshDataLayerStatus);
    safeOn('exportSyncSummaryButton', 'click', exportLocalDataSummary);
    safeOn('rebuildSyncQueueButton', 'click', rebuildLocalSyncPreparation);

    window.addEventListener('online', () => { updateConnectionStatus(); refreshDataLayerStatus(); });
    window.addEventListener('offline', () => { updateConnectionStatus(); refreshDataLayerStatus(); });
    window.addEventListener('train-data-status-change', refreshDataLayerStatus);
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      byId('installAppButton')?.classList.remove('hidden');
      setText('pwaStatusText', 'この端末へアプリとしてインストールできます。');
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      byId('installAppButton')?.classList.add('hidden');
      setText('pwaStatusText', '端末へのインストールが完了しました。');
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (serviceWorkerRefreshing) return;
        serviceWorkerRefreshing = true;
        saveState();
        location.reload();
      });
    }

    MODES.forEach((mode) => safeOn(`${mode}ModeBtn`, 'click', () => setMode(mode)));

    const toggleSettings = {
      reduceMotionToggle: 'reduceMotion',
      showTopCardsToggle: 'showTopCards',
      showNumbersToggle: 'showNumbers',
      arrivalSoundToggle: 'arrivalSound',
      speechToggle: 'speech',
      quietModeToggle: 'quietMode',
      showPreviousButtonToggle: 'showPreviousButton',
      mistakePreventionToggle: 'mistakePrevention',
      editorLockToggle: 'editorLock',
      autoEndSoundToggle: 'autoEndSound'
    };
    Object.entries(toggleSettings).forEach(([id, key]) => {
      safeOn(id, 'change', (event) => updateSetting(key, event.target.checked));
    });
    safeOn('speechRateRange', 'input', (event) => updateSetting('speechRate', event.target.value, { renderNow: false }));
    safeOn('lateGraceInput', 'change', (event) => updateSetting('lateGraceMin', event.target.value));
    safeOn('speechTestButton', 'click', () => speakText('つぎは、きがえです。', true));
    safeOn('exportSettingsButton', 'click', () => downloadJson('oshitaku-train-settings.json', { type: 'oshitaku-train-settings', version: VERSION, settings: state.settings }));
    safeOn('exportPresetsButton', 'click', () => downloadJson('oshitaku-train-presets.json', { type: 'oshitaku-train-presets', version: VERSION, presets: state.presets }));
    safeOn('importSettingsButton', 'click', () => byId('settingsImportFile')?.click());
    safeOn('importPresetsButton', 'click', () => byId('presetsImportFile')?.click());
    safeOn('settingsImportFile', 'change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const imported = await readJsonFile(file);
        state.settings = normalizeSettings(imported.settings || imported);
        saveState();
        render();
        setText('settingsSaveStatus', '✓ 設定を読み込みました。');
      } catch (error) {
        console.error(error);
        setText('settingsSaveStatus', '設定ファイルを読み込めませんでした。');
      } finally {
        event.target.value = '';
      }
    });
    safeOn('presetsImportFile', 'change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const imported = await readJsonFile(file);
        const sourcePresets = Array.isArray(imported.presets) ? imported.presets : imported;
        if (!Array.isArray(sourcePresets) || !sourcePresets.length) throw new Error('プリセットがありません');
        const normalized = sourcePresets.map(normalizePreset).filter(Boolean);
        if (!normalized.length) throw new Error('有効なプリセットがありません');
        state.presets = normalized;
        saveState();
        render();
        setText('settingsSaveStatus', `✓ ${normalized.length}件のプリセットを読み込みました。`);
      } catch (error) {
        console.error(error);
        setText('settingsSaveStatus', 'プリセットファイルを読み込めませんでした。');
      } finally {
        event.target.value = '';
      }
    });
    safeOn('resetSettingsButton', 'click', () => {
      if (!window.confirm('表示・音・操作の設定だけを初期状態へ戻しますか？予定とプリセットは残ります。')) return;
      state.settings = clone(DEFAULT_SETTINGS);
      saveState();
      render();
      setText('settingsSaveStatus', '✓ 設定を初期状態へ戻しました。');
    });
    safeOn('resetAllDataButton', 'click', () => {
      if (!window.confirm('予定・プリセット・To Do・設定をすべて初期化します。元に戻せません。続けますか？')) return;
      (async () => {
        if (dataLayer) await dataLayer.resetLocalData({ keepDeviceId: true });
        state = clone(defaults);
        if (dataLayer) state = dataLayer.prepareState(state);
        previewing = false;
        hideUndo();
        saveState('full-reset');
        render();
        announce('すべてのデータを初期化しました。');
      })().catch((error) => {
        console.error(error);
        showError('データを初期化できませんでした。');
      });
    });

    safeOn('titleInput', 'input', (event) => {
      state.title = event.target.value.slice(0, 28);
      saveState();
      setText('displayTitle', state.title);
    });
    safeOn('vehicleSelect', 'change', (event) => {
      state.vehicle = event.target.value;
      saveState();
      setText('vehicle', state.vehicle);
    });

    safeOn('todoForm', 'submit', (event) => {
      event.preventDefault();
      const text = byId('todoText')?.value.trim();
      if (!text) return;
      const todo = {
        id: `todo-${Date.now()}`,
        text: text.slice(0, 24),
        minutes: Math.max(1, Number(byId('todoMinutes')?.value) || 5)
      };
      state.todos.push(dataLayer ? dataLayer.attachEntityMeta(todo, {}, 'todo') : todo);
      byId('todoText').value = '';
      saveState();
      render();
    });

    document.addEventListener('click', (event) => {
      const option = event.target.closest('[data-setting][data-value]');
      if (option) updateSetting(option.dataset.setting, option.dataset.value);

      const page = event.target.closest('[data-page]')?.dataset.page;
      if (page) showPage(page);

      const presetId = event.target.closest('[data-preset]')?.dataset.preset;
      if (presetId) applyPreset(presetId);

      const emojiButton = event.target.closest('[data-emoji]');
      if (emojiButton) {
        const stationIndex = Number(emojiButton.dataset.stationIndex);
        const emoji = emojiButton.dataset.emoji || '⭐';
        if (Number.isFinite(stationIndex) && state.stations[stationIndex]) {
          state.stations[stationIndex].icon = emoji;
          state.stations[stationIndex].updatedAt = new Date().toISOString();
          saveState();
          render();
          announce(`${state.stations[stationIndex].name || '駅'}の絵を${emoji}にしました。`);
        }
        return;
      }

      const deleteIndex = event.target.closest('[data-delete]')?.dataset.delete;
      if (deleteIndex !== undefined) deleteStation(Number(deleteIndex));

      const moveButton = event.target.closest('[data-move]');
      if (moveButton) {
        moveStation(
          Number(moveButton.dataset.index),
          moveButton.dataset.move === 'up' ? -1 : 1
        );
      }

      const todoId = event.target.closest('[data-delete-todo]')?.dataset.deleteTodo;
      if (todoId) {
        state.todos = state.todos.filter((todo) => todo.id !== todoId);
        saveState();
        render();
      }
    });

    document.addEventListener('change', (event) => {
      if (event.target.matches('#stationEditor [data-field]')) updateStation(event.target);
    });

    document.addEventListener('input', (event) => {
      if (event.target.matches('#stationEditor [data-field]')) updateStation(event.target);
    });


    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (menuOpen) closeMenu();
        else if (previewing) returnToEdit();
      }
    });

    window.addEventListener('resize', () => {
      render();
    });

    window.addEventListener('error', (event) => {
      console.error('未処理エラー', event.error || event.message);
      showError('予期しない問題が発生しました。ページを再読み込みしても予定データは保持されます。');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('未処理Promiseエラー', event.reason);
      showError('一部の処理を完了できませんでした。');
    });
  }

  function selfTest() {
    const results = [];
    const check = (label, condition) => {
      results.push(`${condition ? 'PASS' : 'FAIL'} ${label}`);
    };

    const originalSnapshot = clone(state);
    try {
      state.mode = 'timer';
      state.uiMode = 'view';
      state.currentPage = 'schedule';
      state.doneIndex = -1;
      state.elapsedMs = 0;
      state.running = false;
      state.startedAt = null;
      previewing = false;
      previousActionLocked = false;
      hideUndo();
      render();

      check('これからすること表示なし', !document.body.textContent.includes('これからすること'));
      check('ゴールまで時間表示なし', !document.body.textContent.includes('ゴールまで') && !byId('childRemainingText') && !byId('remainingText'));
      const beforeRemaining = remainingMs();
      done();
      const afterRemaining = remainingMs();
      check('内部の残り時間計算は進む', afterRemaining < beforeRemaining);

      previousStation();
      check('前の駅へ戻る', activeIndex() === 0);

      state = originalSnapshot;
      previousActionLocked = false;
      previewing = false;
      hideUndo();
      saveState();
      render();
    } catch (error) {
      results.push(`FAIL 例外: ${error.message}`);
    }

    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }

    const output = byId('selfTestResult');
    if (output) output.textContent = results.join('|');
    document.title = results.some((result) => result.startsWith('FAIL'))
      ? 'SELFTEST_FAIL'
      : 'SELFTEST_PASS';
    console.log(results.join('\n'));
  }

  const initialPage = new URLSearchParams(location.search).get('page');
  if (['schedule', 'todo', 'settings'].includes(initialPage)) state.currentPage = initialPage;
  bind();
applySettings();
  startTick();
  render();
  saveState();
  registerPwa();
  refreshDataLayerStatus();
  if (new URLSearchParams(location.search).get('selftest') === '1') {
    setTimeout(selfTest, 80);
  }
})();
