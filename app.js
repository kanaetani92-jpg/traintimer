(() => {
  'use strict';

  const STORAGE_KEY = 'denshaTimerSettings.v3';
  const DEFAULT_SETTINGS = {
    defaultSegments: 3,
    wakeLock: true,
    vibration: true,
    sound: true,
    reducedMotion: true,
    railColorMode: 'multi',
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CENTER = 130;
  const TRACK_RADIUS = 98;
  const STATION_RADIUS = 119;
  const TRAIN_RADIUS = 98;
  const SEGMENT_STROKE_WIDTH = 18;
  const MIN_SEGMENT_GAP_DEGREES = 3.2;
  const MAX_SEGMENT_GAP_DEGREES = 8.4;
  const SEGMENT_PALETTE = [
    { base: '#38bdf8', strong: '#0284c7' },
    { base: '#34d399', strong: '#059669' },
    { base: '#fbbf24', strong: '#d97706' },
    { base: '#fb7185', strong: '#e11d48' },
    { base: '#a78bfa', strong: '#7c3aed' },
    { base: '#f472b6', strong: '#db2777' },
    { base: '#2dd4bf', strong: '#0f766e' },
    { base: '#c084fc', strong: '#9333ea' },
    { base: '#fb923c', strong: '#ea580c' },
    { base: '#a3e635', strong: '#65a30d' },
    { base: '#60a5fa', strong: '#2563eb' },
    { base: '#facc15', strong: '#ca8a04' },
  ];

  const elements = {
    timerCard: document.getElementById('timerCard'),
    minutesInput: document.getElementById('minutesInput'),
    segmentsInput: document.getElementById('segmentsInput'),
    segmentSummary: document.getElementById('segmentSummary'),
    visualStatusBadge: document.getElementById('visualStatusBadge'),
    settingsToggle: document.getElementById('settingsToggle'),
    settingsCloseButton: document.getElementById('settingsCloseButton'),
    settingsPanel: document.getElementById('settingsPanel'),
    sheetBackdrop: document.getElementById('sheetBackdrop'),
    defaultSegmentsInput: document.getElementById('defaultSegmentsInput'),
    railColorModeInput: document.getElementById('railColorModeInput'),
    wakeLockInput: document.getElementById('wakeLockInput'),
    vibrationInput: document.getElementById('vibrationInput'),
    soundInput: document.getElementById('soundInput'),
    reducedMotionInput: document.getElementById('reducedMotionInput'),
    saveSettingsButton: document.getElementById('saveSettingsButton'),
    railLayer: document.getElementById('railLayer'),
    segmentLayer: document.getElementById('segmentLayer'),
    stationLayer: document.getElementById('stationLayer'),
    trainLayer: document.getElementById('trainLayer'),
    timeText: document.getElementById('timeText'),
    stateText: document.getElementById('stateText'),
    screenReaderStatus: document.getElementById('screenReaderStatus'),
    currentSegment: document.getElementById('currentSegment'),
    segmentLeft: document.getElementById('segmentLeft'),
    progressPercent: document.getElementById('progressPercent'),
    startPauseButton: document.getElementById('startPauseButton'),
    resetButton: document.getElementById('resetButton'),
  };

  let settings = loadSettings();
  let currentSegmentCount = settings.defaultSegments;
  let totalSeconds = 600;
  let totalMs = totalSeconds * 1000;
  let remainingMs = totalMs;
  let isRunning = false;
  let timerId = null;
  let expectedEndTime = 0;
  let lastSegmentIndex = 0;
  let wakeLock = null;

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
  }

  function clampInteger(value, min, max, fallback) {
    return Math.round(clampNumber(value, min, max, fallback));
  }

  function normalizeRailColorMode(value) {
    return value === 'single' || value === 'multi' ? value : DEFAULT_SETTINGS.railColorMode;
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
        || localStorage.getItem('denshaTimerSettings.v2')
        || localStorage.getItem('mobileCircleTimerSettings.v2')
        || localStorage.getItem('mobileCircleTimerSettings.v1');
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        defaultSegments: clampInteger(parsed.defaultSegments, 1, 12, DEFAULT_SETTINGS.defaultSegments),
        wakeLock: typeof parsed.wakeLock === 'boolean' ? parsed.wakeLock : DEFAULT_SETTINGS.wakeLock,
        vibration: typeof parsed.vibration === 'boolean' ? parsed.vibration : DEFAULT_SETTINGS.vibration,
        sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_SETTINGS.sound,
        reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
        railColorMode: normalizeRailColorMode(parsed.railColorMode),
      };
    } catch (error) {
      console.warn('設定の読み込みに失敗しました。初期設定を使用します。', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function persistSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function syncSettingsInputs() {
    elements.defaultSegmentsInput.value = String(settings.defaultSegments);
    elements.railColorModeInput.value = settings.railColorMode;
    elements.wakeLockInput.checked = settings.wakeLock;
    elements.vibrationInput.checked = settings.vibration;
    elements.soundInput.checked = settings.sound;
    elements.reducedMotionInput.checked = settings.reducedMotion;
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  }

  function syncCurrentSegmentInput() {
    elements.segmentsInput.value = String(currentSegmentCount);
    setSelectedChip('segments', String(currentSegmentCount));
  }

  function saveSettings() {
    settings = {
      defaultSegments: clampInteger(elements.defaultSegmentsInput.value, 1, 12, DEFAULT_SETTINGS.defaultSegments),
      railColorMode: normalizeRailColorMode(elements.railColorModeInput.value),
      wakeLock: elements.wakeLockInput.checked,
      vibration: elements.vibrationInput.checked,
      sound: elements.soundInput.checked,
      reducedMotion: elements.reducedMotionInput.checked,
    };
    persistSettings();
    syncSettingsInputs();
    updateDisplay();

    if (!hasStarted()) {
      currentSegmentCount = settings.defaultSegments;
      syncCurrentSegmentInput();
      resetTimer(false);
    }

    elements.saveSettingsButton.textContent = '保存しました';
    announce('設定を保存しました。');
    window.setTimeout(() => {
      elements.saveSettingsButton.textContent = '設定を保存';
    }, 1200);
  }

  function readTotalSeconds({ normalize = false } = {}) {
    const raw = elements.minutesInput.value;
    if (raw === '' && !normalize) return null;
    const minutes = clampNumber(raw, 0.5, 600, 10);
    if (normalize) {
      elements.minutesInput.value = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
      setSelectedChip('minutes', elements.minutesInput.value);
    }
    return Math.round(minutes * 60);
  }

  function readSegmentCount({ normalize = false } = {}) {
    const raw = elements.segmentsInput.value;
    if (raw === '' && !normalize) return null;
    const segmentCount = clampInteger(raw, 1, 12, settings.defaultSegments);
    if (normalize) {
      elements.segmentsInput.value = String(segmentCount);
      setSelectedChip('segments', String(segmentCount));
    }
    return segmentCount;
  }

  function applyInputsToTimer({ normalize = false } = {}) {
    const nextTotalSeconds = readTotalSeconds({ normalize });
    const nextSegmentCount = readSegmentCount({ normalize });
    if (nextTotalSeconds === null || nextSegmentCount === null) return false;

    totalSeconds = nextTotalSeconds;
    totalMs = totalSeconds * 1000;
    remainingMs = totalMs;
    currentSegmentCount = nextSegmentCount;
    lastSegmentIndex = 0;
    updateDisplay();
    return true;
  }

  function formatTimeFromMs(ms) {
    const safeSeconds = Math.max(0, Math.ceil(ms / 1000));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function formatDurationText(seconds) {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    if (secs === 0) return `${mins}分`;
    if (mins === 0) return `${secs}秒`;
    return `${mins}分${secs}秒`;
  }

  function describeMinutes(seconds) {
    const minutes = seconds / 60;
    return Number.isInteger(minutes) ? `${minutes}分` : `${minutes.toFixed(1)}分`;
  }

  function polarToCartesian(cx, cy, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy + radius * Math.sin(angleInRadians),
    };
  }

  function describeArc(cx, cy, radius, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M', start.x.toFixed(3), start.y.toFixed(3),
      'A', radius, radius, 0, largeArcFlag, 0, end.x.toFixed(3), end.y.toFixed(3),
    ].join(' ');
  }

  function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  }

  function getSegmentPalette(index) {
    return SEGMENT_PALETTE[index % SEGMENT_PALETTE.length];
  }

  function getSegmentColorStyle(index) {
    const palette = settings.railColorMode === 'single'
      ? SEGMENT_PALETTE[0]
      : getSegmentPalette(index);
    return `--segment-color: ${palette.base}; --segment-strong-color: ${palette.strong};`;
  }

  function createArc(className, startAngle, endAngle, strokeWidth, radius = TRACK_RADIUS, attributes = {}) {
    return createSvgElement('path', {
      class: className,
      d: describeArc(CENTER, CENTER, radius, startAngle, endAngle),
      'stroke-width': strokeWidth,
      ...attributes,
    });
  }

  function createCircle(className, point, radius) {
    return createSvgElement('circle', {
      class: className,
      cx: point.x.toFixed(3),
      cy: point.y.toFixed(3),
      r: radius,
    });
  }

  function getProgressMetrics() {
    const elapsedMs = Math.min(totalMs, Math.max(0, totalMs - remainingMs));
    const safeSegmentCount = Math.max(1, currentSegmentCount);
    const segmentMs = totalMs / safeSegmentCount;
    const activeIndex = remainingMs <= 0
      ? safeSegmentCount - 1
      : Math.min(safeSegmentCount - 1, Math.floor(elapsedMs / segmentMs));
    return { elapsedMs, segmentMs, activeIndex, safeSegmentCount };
  }

  function renderRail() {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(createCircle('rail-base', { x: CENTER, y: CENTER }, TRACK_RADIUS));
    fragment.appendChild(createArc('rail-line outer', 0, 359.99, 3.2, TRACK_RADIUS + 13));
    fragment.appendChild(createArc('rail-line inner', 0, 359.99, 3.2, TRACK_RADIUS - 13));

    for (let index = 0; index < 36; index += 1) {
      const angle = index * 10;
      const inner = polarToCartesian(CENTER, CENTER, TRACK_RADIUS - 15, angle);
      const outer = polarToCartesian(CENTER, CENTER, TRACK_RADIUS + 15, angle);
      fragment.appendChild(createSvgElement('line', {
        class: 'sleeper',
        x1: inner.x.toFixed(3),
        y1: inner.y.toFixed(3),
        x2: outer.x.toFixed(3),
        y2: outer.y.toFixed(3),
      }));
    }
    elements.railLayer.replaceChildren(fragment);
  }

  function createStation(index, point, status, isStart, isGoal) {
    const group = createSvgElement('g', { class: `station station-${status}` });
    group.appendChild(createCircle('station-platform', point, isGoal ? 15 : 12));
    if (status === 'next') {
      group.appendChild(createCircle('station-ring', point, 12));
    }
    const className = [
      'station-dot',
      status,
      isStart ? 'start' : '',
      isGoal ? 'goal' : '',
    ].filter(Boolean).join(' ');
    group.appendChild(createCircle(className, point, status === 'next' ? 9.5 : isGoal ? 10 : 8));

    if (isGoal || isStart) {
      const sign = createSvgElement('text', {
        class: 'goal-flag',
        x: point.x.toFixed(3),
        y: (point.y - 20).toFixed(3),
      });
      sign.textContent = isGoal ? '🏁' : '🚉';
      group.appendChild(sign);
    }

    group.dataset.stationIndex = String(index);
    return group;
  }

  function renderStations() {
    const { elapsedMs, segmentMs, activeIndex, safeSegmentCount } = getProgressMetrics();
    const fragment = document.createDocumentFragment();
    const nextStationIndex = remainingMs <= 0 ? -1 : (activeIndex + 1) % safeSegmentCount;

    for (let index = 0; index < safeSegmentCount; index += 1) {
      const angle = (360 / safeSegmentCount) * index;
      const point = polarToCartesian(CENTER, CENTER, STATION_RADIUS, angle);
      const isStart = index === 0 && remainingMs > 0;
      const isGoal = index === 0 && remainingMs <= 0;
      const boundaryMs = segmentMs * index;
      const isPassed = isStart || isGoal || (index > 0 && elapsedMs >= boundaryMs);
      const status = index === nextStationIndex ? 'next' : isPassed ? 'passed' : 'future';
      fragment.appendChild(createStation(index, point, status, isStart, isGoal));
    }

    elements.stationLayer.replaceChildren(fragment);
  }

  function getSegmentGapDegrees(segmentCount) {
    return Math.min(MAX_SEGMENT_GAP_DEGREES, Math.max(MIN_SEGMENT_GAP_DEGREES, 26 / segmentCount));
  }

  function createSplitCut(angle) {
    const inner = polarToCartesian(CENTER, CENTER, TRACK_RADIUS - 14, angle);
    const outer = polarToCartesian(CENTER, CENTER, TRACK_RADIUS + 14, angle);
    return createSvgElement('line', {
      class: 'split-cut',
      x1: inner.x.toFixed(3),
      y1: inner.y.toFixed(3),
      x2: outer.x.toFixed(3),
      y2: outer.y.toFixed(3),
    });
  }

  function createSplitCap(angle, status, index) {
    const point = polarToCartesian(CENTER, CENTER, TRACK_RADIUS, angle);
    const group = createSvgElement('g', {
      class: `split-cap split-cap-${status}`,
      style: getSegmentColorStyle(index),
    });
    group.appendChild(createCircle('split-cap-outer', point, 8.2));
    group.appendChild(createCircle('split-cap-inner', point, 4.8));
    return group;
  }

  function renderTrain() {
    const { elapsedMs } = getProgressMetrics();
    const progressAngle = remainingMs <= 0 ? 360 : (elapsedMs / totalMs) * 360;
    const point = polarToCartesian(CENTER, CENTER, TRAIN_RADIUS, progressAngle);
    const fragment = document.createDocumentFragment();

    fragment.appendChild(createCircle('train-halo', point, 16));
    const train = createSvgElement('text', {
      class: 'train-icon',
      x: point.x.toFixed(3),
      y: point.y.toFixed(3),
      transform: `rotate(${progressAngle.toFixed(2)} ${point.x.toFixed(3)} ${point.y.toFixed(3)})`,
    });
    train.textContent = '🚃';
    fragment.appendChild(train);
    elements.trainLayer.replaceChildren(fragment);
  }

  function renderSegments() {
    const elapsedMs = Math.min(totalMs, Math.max(0, totalMs - remainingMs));
    const segmentMs = totalMs / currentSegmentCount;
    const gapDegrees = getSegmentGapDegrees(currentSegmentCount);
    const strokeWidth = SEGMENT_STROKE_WIDTH;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < currentSegmentCount; index += 1) {
      const startAngle = (360 / currentSegmentCount) * index + gapDegrees / 2;
      const endAngle = (360 / currentSegmentCount) * (index + 1) - gapDegrees / 2;
      const sweep = endAngle - startAngle;
      const segmentStartMs = segmentMs * index;
      const segmentEndMs = segmentMs * (index + 1);

      const segmentStyle = getSegmentColorStyle(index);
      // 進行前から見える固定の分割ガイド。各区間に別の色をつけ、
      // タイマー開始前・停止中・リセット後も消さない。
      fragment.appendChild(createArc('segment-arc guide', startAngle, endAngle, strokeWidth, TRACK_RADIUS, { style: segmentStyle }));

      if (elapsedMs >= segmentEndMs || remainingMs <= 0) {
        fragment.appendChild(createArc('segment-arc done', startAngle, endAngle, strokeWidth, TRACK_RADIUS, { style: segmentStyle }));
        continue;
      }

      if (elapsedMs > segmentStartMs && elapsedMs < segmentEndMs) {
        const progress = (elapsedMs - segmentStartMs) / segmentMs;
        const activeEndAngle = startAngle + Math.max(0.01, sweep * progress);
        fragment.appendChild(createArc('segment-arc active', startAngle, activeEndAngle, strokeWidth, TRACK_RADIUS, { style: segmentStyle }));
      }
    }

    for (let index = 0; index < currentSegmentCount; index += 1) {
      const boundaryAngle = (360 / currentSegmentCount) * index;
      const boundaryMs = segmentMs * index;
      const isNext = remainingMs > 0 && ((Math.floor(elapsedMs / segmentMs) + 1) % currentSegmentCount) === index;
      const isPassed = remainingMs <= 0 || index === 0 || (index > 0 && elapsedMs >= boundaryMs);
      const status = isNext ? 'next' : isPassed ? 'passed' : 'future';
      fragment.appendChild(createSplitCut(boundaryAngle));
      fragment.appendChild(createSplitCap(boundaryAngle, status, index));
    }

    elements.segmentLayer.replaceChildren(fragment);
    renderStations();
    renderTrain();
  }

  function getStatusLabel() {
    if (remainingMs <= 0) return 'ゴール！';
    if (isRunning) return 'しゅっぱつ中';
    if (!hasStarted()) return 'しゅっぱつ まえ';
    return 'とまっています';
  }

  function getStatusIcon() {
    if (remainingMs <= 0) return '🏁';
    if (isRunning) return '🚃';
    if (!hasStarted()) return '🚉';
    return '🛑';
  }

  function hasStarted() {
    return remainingMs > 0 && remainingMs < totalMs;
  }

  function updateCardState() {
    elements.timerCard.classList.toggle('is-running', isRunning);
    elements.timerCard.classList.toggle('is-finished', remainingMs <= 0);
  }

  function updateDisplay() {
    const elapsedMs = Math.min(totalMs, Math.max(0, totalMs - remainingMs));
    const segmentMs = totalMs / currentSegmentCount;
    const activeIndex = remainingMs <= 0
      ? currentSegmentCount - 1
      : Math.min(currentSegmentCount - 1, Math.floor(elapsedMs / segmentMs));
    const segmentElapsedMs = elapsedMs - activeIndex * segmentMs;
    const currentSegmentLeftMs = remainingMs <= 0 ? 0 : Math.max(0, segmentMs - segmentElapsedMs);
    const percent = totalMs === 0 ? 0 : Math.round((elapsedMs / totalMs) * 100);

    elements.timeText.textContent = formatTimeFromMs(remainingMs);
    elements.stateText.textContent = getStatusLabel();
    elements.visualStatusBadge.textContent = getStatusIcon();
    elements.currentSegment.textContent = `${Math.min(currentSegmentCount, activeIndex + 1)} / ${currentSegmentCount}`;
    elements.segmentLeft.textContent = formatTimeFromMs(currentSegmentLeftMs);
    elements.progressPercent.textContent = `${Math.min(100, Math.max(0, percent))}%`;
    elements.segmentSummary.textContent = `${describeMinutes(totalSeconds)}・${currentSegmentCount}分割：1駅 ${formatDurationText(totalSeconds / currentSegmentCount)}`;
    updateCardState();
    renderSegments();
  }

  function announce(message) {
    elements.screenReaderStatus.textContent = message;
  }

  function setSelectedChip(type, value) {
    const selector = type === 'minutes' ? '[data-minutes]' : '[data-segments]';
    document.querySelectorAll(selector).forEach((button) => {
      const buttonValue = type === 'minutes' ? button.dataset.minutes : button.dataset.segments;
      button.classList.toggle('is-selected', buttonValue === value);
    });
  }

  function updateInteractivity() {
    const lockInputs = isRunning || hasStarted();
    elements.minutesInput.disabled = lockInputs;
    elements.segmentsInput.disabled = lockInputs;
    document.querySelectorAll('[data-minutes], [data-segments]').forEach((button) => {
      button.disabled = lockInputs;
    });
  }

  async function requestWakeLock() {
    if (!settings.wakeLock || !('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (error) {
      console.info('Wake Lockはこの環境では利用できません。', error);
    }
  }

  async function releaseWakeLock() {
    if (!wakeLock) return;
    try {
      await wakeLock.release();
    } catch (error) {
      console.info('Wake Lockの解除に失敗しました。', error);
    } finally {
      wakeLock = null;
    }
  }

  function vibrate(pattern) {
    if (settings.vibration && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  function playTone(sequence = 'finish') {
    if (!settings.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioContext = new AudioContext();
      const gain = audioContext.createGain();
      gain.connect(audioContext.destination);

      const notes = sequence === 'station'
        ? [{ hz: 660, start: 0, duration: 0.12 }, { hz: 880, start: 0.14, duration: 0.14 }]
        : [{ hz: 880, start: 0, duration: 0.16 }, { hz: 660, start: 0.18, duration: 0.16 }, { hz: 990, start: 0.36, duration: 0.22 }];

      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + notes.at(-1).start + notes.at(-1).duration + 0.04);

      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(note.hz, audioContext.currentTime + note.start);
        oscillator.connect(gain);
        oscillator.start(audioContext.currentTime + note.start);
        oscillator.stop(audioContext.currentTime + note.start + note.duration);
      });

      window.setTimeout(() => audioContext.close(), 900);
    } catch (error) {
      console.info('音を再生できませんでした。', error);
    }
  }

  function triggerStationArrival() {
    if (!settings.reducedMotion) {
      elements.timerCard.classList.remove('station-arrival');
      void elements.timerCard.offsetWidth;
      elements.timerCard.classList.add('station-arrival');
      window.setTimeout(() => elements.timerCard.classList.remove('station-arrival'), 520);
    }
    vibrate([70]);
    playTone('station');
  }

  function tick() {
    remainingMs = Math.max(0, expectedEndTime - Date.now());

    const elapsedMs = totalMs - remainingMs;
    const currentSegmentIndex = Math.min(currentSegmentCount - 1, Math.floor(elapsedMs / (totalMs / currentSegmentCount)));
    if (currentSegmentIndex !== lastSegmentIndex && remainingMs > 0) {
      lastSegmentIndex = currentSegmentIndex;
      triggerStationArrival();
      announce(`${currentSegmentIndex + 1}つめの駅に着きました。`);
    }

    updateDisplay();

    if (remainingMs <= 0) {
      finishTimer();
    }
  }

  async function startTimer() {
    if (isRunning) return;
    if (!hasStarted()) {
      const applied = applyInputsToTimer({ normalize: true });
      if (!applied) return;
    }

    expectedEndTime = Date.now() + remainingMs;
    isRunning = true;
    elements.startPauseButton.textContent = 'とまる';
    updateInteractivity();
    updateDisplay();
    announce('でんしゃがしゅっぱつしました。');
    await requestWakeLock();
    tick();
    timerId = window.setInterval(tick, 100);
  }

  function pauseTimer() {
    if (!isRunning) return;
    remainingMs = Math.max(0, expectedEndTime - Date.now());
    window.clearInterval(timerId);
    timerId = null;
    isRunning = false;
    elements.startPauseButton.textContent = 'またすすむ';
    releaseWakeLock();
    updateInteractivity();
    updateDisplay();
    announce('でんしゃが止まりました。');
  }

  function finishTimer() {
    window.clearInterval(timerId);
    timerId = null;
    remainingMs = 0;
    isRunning = false;
    elements.startPauseButton.textContent = 'しゅっぱつ';
    releaseWakeLock();
    updateInteractivity();
    updateDisplay();
    vibrate([120, 80, 120]);
    playTone('finish');
    announce('ゴール駅に着きました。');
  }

  function resetTimer(announceReset = true) {
    window.clearInterval(timerId);
    timerId = null;
    isRunning = false;
    applyInputsToTimer({ normalize: true });
    elements.startPauseButton.textContent = 'しゅっぱつ';
    releaseWakeLock();
    updateInteractivity();
    updateDisplay();
    if (announceReset) announce('でんしゃをはじめに戻しました。');
  }

  function openSettings() {
    elements.settingsPanel.hidden = false;
    elements.sheetBackdrop.hidden = false;
    document.body.classList.add('sheet-open');
    elements.settingsToggle.setAttribute('aria-expanded', 'true');
    elements.settingsCloseButton.focus();
  }

  function closeSettings() {
    elements.settingsPanel.hidden = true;
    elements.sheetBackdrop.hidden = true;
    document.body.classList.remove('sheet-open');
    elements.settingsToggle.setAttribute('aria-expanded', 'false');
    elements.settingsToggle.focus();
  }

  function toggleSettings() {
    if (elements.settingsPanel.hidden) {
      openSettings();
    } else {
      closeSettings();
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((error) => {
          console.info('Service Workerを登録できませんでした。', error);
        });
      });
    }
  }

  function bindEvents() {
    elements.minutesInput.addEventListener('input', () => {
      if (hasStarted() || isRunning) return;
      const nextTotalSeconds = readTotalSeconds({ normalize: false });
      if (nextTotalSeconds === null) return;
      totalSeconds = nextTotalSeconds;
      totalMs = totalSeconds * 1000;
      remainingMs = totalMs;
      setSelectedChip('minutes', elements.minutesInput.value);
      updateDisplay();
    });

    elements.minutesInput.addEventListener('blur', () => {
      if (!isRunning && !hasStarted()) applyInputsToTimer({ normalize: true });
    });

    elements.segmentsInput.addEventListener('input', () => {
      if (hasStarted() || isRunning) return;
      const nextSegmentCount = readSegmentCount({ normalize: false });
      if (nextSegmentCount === null) return;
      currentSegmentCount = nextSegmentCount;
      setSelectedChip('segments', elements.segmentsInput.value);
      updateDisplay();
    });

    elements.segmentsInput.addEventListener('blur', () => {
      if (!isRunning && !hasStarted()) applyInputsToTimer({ normalize: true });
    });

    document.querySelectorAll('[data-minutes]').forEach((button) => {
      button.addEventListener('click', () => {
        elements.minutesInput.value = button.dataset.minutes;
        setSelectedChip('minutes', button.dataset.minutes);
        if (!isRunning && !hasStarted()) applyInputsToTimer({ normalize: true });
      });
    });

    document.querySelectorAll('[data-segments]').forEach((button) => {
      button.addEventListener('click', () => {
        elements.segmentsInput.value = button.dataset.segments;
        currentSegmentCount = clampInteger(button.dataset.segments, 1, 12, settings.defaultSegments);
        setSelectedChip('segments', button.dataset.segments);
        if (!isRunning && !hasStarted()) applyInputsToTimer({ normalize: true });
      });
    });

    elements.startPauseButton.addEventListener('click', () => {
      if (isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    });

    elements.resetButton.addEventListener('click', () => resetTimer());
    elements.settingsToggle.addEventListener('click', toggleSettings);
    elements.settingsCloseButton.addEventListener('click', closeSettings);
    elements.sheetBackdrop.addEventListener('click', closeSettings);
    elements.railColorModeInput.addEventListener('change', () => {
      settings.railColorMode = normalizeRailColorMode(elements.railColorModeInput.value);
      updateDisplay();
    });

    elements.reducedMotionInput.addEventListener('change', () => {
      settings.reducedMotion = elements.reducedMotionInput.checked;
      document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    });

    elements.saveSettingsButton.addEventListener('click', saveSettings);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.settingsPanel.hidden) closeSettings();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isRunning) {
        requestWakeLock();
        tick();
      }
    });
  }

  function init() {
    syncSettingsInputs();
    currentSegmentCount = settings.defaultSegments;
    syncCurrentSegmentInput();
    renderRail();
    applyInputsToTimer({ normalize: true });
    bindEvents();
    registerServiceWorker();
    updateInteractivity();
    updateDisplay();
  }

  init();
})();
