(() => {
  "use strict";

  const TIMER_STATE = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    PAUSED: "paused",
    FINISHED: "finished"
  });

  const TRAIN_STATUS = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    PAUSED: "paused",
    ARRIVED: "arrived"
  });

  const MAX_ACTIVE_TRAINS = 20;

  const MIN_UNIT_MINUTES = 1;
  const MAX_UNIT_MINUTES = 180;
  const MAX_STATIONS = 10;
  const DISPLAY_UPDATE_INTERVAL_MS = 100;
  const UNIT_PRESETS = [1, 2, 3, 5, 10, 15];
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const ADDITION_TARGET = Object.freeze({
    CURRENT: "current",
    OVERALL: "overall"
  });
  const MAX_TIME_ADDITION_HISTORY = 30;
  const STORAGE_SCHEMA_VERSION = 9;
  const APP_VERSION = "1.17.5";
  const SERVICE_WORKER_URL = "sw.js";
  const DEFAULT_USER_PREFERENCES = Object.freeze({
    soundEnabled: true,
    stationSoundEnabled: true,
    goalSoundEnabled: true,
    actionSoundEnabled: true,
    soundVolume: 55,
    quietMode: false,
    fontSize: "normal",
    highContrast: false,
    reduceMotion: false,
    showCircleRemainingTime: true,
    remainingTimeDisplayMode: "overall",
    switchToNewTrainAfterCreate: false,
    childLockEnabled: false,
    keepAwakeEnabled: false
  });
  const STORAGE_KEY = "trainTimerAppData";
  const MAX_PRESET_NAME_LENGTH = 40;
  const MAX_PRESETS = 100;
  const CIRCLE_START_ANGLE_DEGREES = -72;
  const CIRCLE_TRAVEL_ANGLE_DEGREES = 324;
  const CIRCLE_CENTER = 160;
  const CIRCLE_TRACK_RADIUS = 112;

  const TRACK_SHAPES = Object.freeze({
    horizontal: {
      label: "横",
      heading: "横線路",
      badge: "横表示",
      direction: "→"
    },
    vertical: {
      label: "縦",
      heading: "縦線路",
      badge: "縦表示",
      direction: "↓"
    },
    circle: {
      label: "円",
      heading: "円形線路",
      badge: "円表示",
      direction: "↻"
    }
  });

  const NEW_TRAIN_EXAMPLES = Object.freeze({
    study25: { name: "勉強25分号", totalMinutes: 25, stationCount: 4, unitMinutes: 5, trackShape: "horizontal", sound: "default" },
    break5: { name: "休憩5分号", totalMinutes: 5, stationCount: 3, unitMinutes: 5, trackShape: "circle", sound: "goal-only" },
    cleanup10: { name: "お片付け10分号", totalMinutes: 10, stationCount: 4, unitMinutes: 5, trackShape: "horizontal", sound: "default" },
    morning15: { name: "朝の支度15分号", totalMinutes: 15, stationCount: 4, unitMinutes: 5, trackShape: "horizontal", sound: "default" },
    reading15: { name: "読書15分号", totalMinutes: 15, stationCount: 4, unitMinutes: 5, trackShape: "vertical", sound: "goal-only" }
  });

  const QUICK_ROUTE_DEFINITIONS = Object.freeze({
    break5: {
      name: "休憩5分号",
      totalMinutes: 5,
      unitMinutes: 1,
      trackShape: "circle",
      sound: "goal-only",
      stationNames: ["スタート", "休憩駅", "ゴール"]
    },
    cleanup10: {
      name: "お片付け10分号",
      totalMinutes: 10,
      unitMinutes: 1,
      trackShape: "horizontal",
      sound: "default",
      stationNames: ["スタート", "前半", "後半", "ゴール"]
    },
    morning15: {
      name: "朝の支度15分号",
      totalMinutes: 15,
      unitMinutes: 1,
      trackShape: "horizontal",
      sound: "default",
      stationNames: ["スタート", "準備", "確認", "ゴール"]
    },
    reading15: {
      name: "読書15分号",
      totalMinutes: 15,
      unitMinutes: 1,
      trackShape: "vertical",
      sound: "goal-only",
      stationNames: ["スタート", "前半", "後半", "ゴール"]
    },
    study25: {
      name: "勉強25分号",
      totalMinutes: 25,
      unitMinutes: 1,
      trackShape: "horizontal",
      sound: "default",
      stationNames: ["スタート", "集中1", "集中2", "まとめ", "ゴール"]
    }
  });

  const createId = (() => {
    let fallbackCounter = 0;

    return (prefix) => {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return `${prefix}-${window.crypto.randomUUID()}`;
      }

      fallbackCounter += 1;
      return `${prefix}-${Date.now()}-${fallbackCounter}`;
    };
  })();

  function createInitialConfiguration() {
    const startId = createId("station");
    const stationOneId = createId("station");
    const stationTwoId = createId("station");
    const goalId = createId("station");

    return {
      unitMinutes: 5,
      trackShape: "horizontal",
      stations: [
        { id: startId, name: "スタート", role: "start" },
        { id: stationOneId, name: "駅1", role: "normal" },
        { id: stationTwoId, name: "駅2", role: "normal" },
        { id: goalId, name: "ゴール", role: "goal" }
      ],
      segments: [
        {
          id: createId("segment"),
          fromStationId: startId,
          toStationId: stationOneId,
          units: 2,
          extraMinutes: 0
        },
        {
          id: createId("segment"),
          fromStationId: stationOneId,
          toStationId: stationTwoId,
          units: 1,
          extraMinutes: 0
        },
        {
          id: createId("segment"),
          fromStationId: stationTwoId,
          toStationId: goalId,
          units: 3,
          extraMinutes: 0
        }
      ]
    };
  }


  function createConfigurationFromDefinition({
    unitMinutes = 5,
    trackShape = "horizontal",
    stationNames = ["スタート", "ゴール"],
    segmentUnits = [1],
    segmentExtraMinutes = []
  }) {
    const safeStationNames =
      Array.isArray(stationNames) && stationNames.length >= 2
        ? stationNames.slice(0, 10)
        : ["スタート", "ゴール"];

    const stations = safeStationNames.map((name, index) => ({
      id: createId("station"),
      name: sanitizeStationName(
        name,
        index === 0
          ? "スタート"
          : index === safeStationNames.length - 1
            ? "ゴール"
            : `駅${index}`
      ),
      role:
        index === 0
          ? "start"
          : index === safeStationNames.length - 1
            ? "goal"
            : "normal"
    }));

    const segments = stations.slice(0, -1).map((station, index) => ({
      id: createId("segment"),
      fromStationId: station.id,
      toStationId: stations[index + 1].id,
      units: Math.max(
        1,
        Math.round(Number(segmentUnits[index]) || 1)
      ),
      extraMinutes: Math.max(
        0,
        Math.round(Number(segmentExtraMinutes[index]) || 0)
      )
    }));

    return {
      unitMinutes: sanitizeUnitMinutes(unitMinutes),
      trackShape: normalizeTrackShape(trackShape),
      stations,
      segments
    };
  }

  function createPresetRecord(name, sourceConfiguration, options = {}) {
    const now = new Date().toISOString();

    return {
      id: options.id || createId("preset"),
      name: sanitizePresetName(name, "名称未設定"),
      isBuiltIn: Boolean(options.isBuiltIn),
      createdAt: options.createdAt || now,
      updatedAt: options.updatedAt || now,
      configuration: cloneConfiguration(sourceConfiguration)
    };
  }

  function createInitialPresets() {
    return [
      createPresetRecord(
        "10分タイマー",
        createConfigurationFromDefinition({
          unitMinutes: 5,
          stationNames: ["スタート", "ゴール"],
          segmentUnits: [2]
        }),
        { isBuiltIn: true }
      ),
      createPresetRecord(
        "勉強30分",
        createConfigurationFromDefinition({
          unitMinutes: 5,
          stationNames: ["スタート", "準備", "集中", "ゴール"],
          segmentUnits: [2, 1, 3]
        }),
        { isBuiltIn: true }
      ),
      createPresetRecord(
        "片付け15分",
        createConfigurationFromDefinition({
          unitMinutes: 5,
          stationNames: ["スタート", "片付け", "ゴール"],
          segmentUnits: [2, 1]
        }),
        { isBuiltIn: true }
      ),
      createPresetRecord(
        "作業25分＋休憩5分",
        createConfigurationFromDefinition({
          unitMinutes: 5,
          stationNames: ["スタート", "作業", "ゴール"],
          segmentUnits: [5, 1]
        }),
        { isBuiltIn: true }
      ),
      createPresetRecord(
        "円形くり返しタイマー",
        createConfigurationFromDefinition({
          unitMinutes: 5,
          trackShape: "circle",
          stationNames: ["スタート", "1周目", "2周目", "ゴール"],
          segmentUnits: [1, 1, 1]
        }),
        { isBuiltIn: true }
      )
    ];
  }

  const elements = {
    body: document.body,
    timerCard: document.querySelector(".timer-card"),
    remainingTime: document.getElementById("remainingTime"),
    timerStateText: document.getElementById("timerStateText"),
    timerStateSummary: document.getElementById("timerStateSummary"),
    completionPanel: document.getElementById("completionPanel"),
    completionMessage: document.getElementById("completionMessage"),
    restartButton: document.getElementById("restartButton"),
    startButton: document.getElementById("startButton"),
    startButtonIcon: document.getElementById("startButtonIcon"),
    startButtonText: document.getElementById("startButtonText"),
    startOverButton: document.getElementById("startOverButton"),
    primaryControls: document.querySelector("#timerActionsSection .primary-controls"),
    pauseButton: document.getElementById("pauseButton"),
    resetButton: document.getElementById("resetButton"),
    addOneMinuteButton: document.getElementById("addOneMinuteButton"),
    addFiveMinutesButton: document.getElementById("addFiveMinutesButton"),
    timeAdditionHistoryCard: document.getElementById("timeAdditionHistoryCard"),
    timeAdditionHistoryList: document.getElementById("timeAdditionHistoryList"),
    undoTimeAdditionButton: document.getElementById("undoTimeAdditionButton"),
    timeAdditionBackdrop: document.getElementById("timeAdditionBackdrop"),
    timeAdditionDialog: document.getElementById("timeAdditionDialog"),
    timeAdditionDialogTitle: document.getElementById("timeAdditionDialogTitle"),
    closeTimeAdditionButton: document.getElementById("closeTimeAdditionButton"),
    cancelTimeAdditionButton: document.getElementById("cancelTimeAdditionButton"),
    confirmTimeAdditionButton: document.getElementById("confirmTimeAdditionButton"),
    additionTargetCurrent: document.getElementById("additionTargetCurrent"),
    additionTargetOverall: document.getElementById("additionTargetOverall"),
    currentAdditionTargetLabel: document.getElementById("currentAdditionTargetLabel"),
    overallAdditionTargetLabel: document.getElementById("overallAdditionTargetLabel"),
    finishedRestartNotice: document.getElementById("finishedRestartNotice"),
    railwayHeading: document.getElementById("railwayHeading"),
    trackShapeBadge: document.getElementById("trackShapeBadge"),
    trackShapeSwitcher: document.getElementById("trackShapeSwitcher"),
    trackShapeButtons: document.querySelectorAll(".track-shape-button"),
    railwayPreview: document.getElementById("railwayPreview"),
    railwayTrack: document.getElementById("railwayTrack"),
    routeTimePanel: document.getElementById("routeTimePanel"),
    routeTimeContent: document.getElementById("routeTimeContent"),
    routeTimerStateText: document.getElementById("routeTimerStateText"),
    stationPreviewList: null,
    trackSegmentList: null,
    trainPosition: null,
    arrivalNotice: document.getElementById("arrivalNotice"),
    currentSegmentName: document.getElementById("currentSegmentName"),
    nextStationName: document.getElementById("nextStationName"),
    nextStationTime: document.getElementById("nextStationTime"),
    journeyProgress: document.querySelector(".journey-progress"),
    journeyProgressText: document.getElementById("journeyProgressText"),
    journeyProgressBar: document.getElementById("journeyProgressBar"),
    segmentOverviewList: document.getElementById("segmentOverviewList"),
    summaryDuration: document.getElementById("summaryDuration"),
    summaryUnitMinutes: document.getElementById("summaryUnitMinutes"),
    summaryTotalUnits: document.getElementById("summaryTotalUnits"),
    summaryStationCount: document.getElementById("summaryStationCount"),
    summarySegmentCount: document.getElementById("summarySegmentCount"),
    summaryTrackShape: document.getElementById("summaryTrackShape"),
    summaryAddedMinutes: document.getElementById("summaryAddedMinutes"),

    presetSection: document.getElementById("presetSection"),
    activeTrainSummary: document.getElementById("activeTrainSummary"),
    activeTrainsList: document.getElementById("activeTrainsList"),
    activeTrainsCountBadge: document.getElementById("activeTrainsCountBadge"),
    addCurrentRouteTrainButton: document.getElementById("addCurrentRouteTrainButton"),
    openCreateTrainButton: document.getElementById("openCreateTrainButton"),
    createTrainBackdrop: document.getElementById("createTrainBackdrop"),
    createTrainPanel: document.getElementById("createTrainPanel"),
    closeCreateTrainButton: document.getElementById("closeCreateTrainButton"),
    cancelCreateTrainButton: document.getElementById("cancelCreateTrainButton"),
    createTrainForm: document.getElementById("createTrainForm"),
    newTrainNameInput: document.getElementById("newTrainNameInput"),
    newTrainTotalMinutesInput: document.getElementById("newTrainTotalMinutesInput"),
    newTrainStationCountInput: document.getElementById("newTrainStationCountInput"),
    newTrainUnitMinutesInput: document.getElementById("newTrainUnitMinutesInput"),
    newTrainTrackShapeSelect: document.getElementById("newTrainTrackShapeSelect"),
    newTrainSoundSelect: document.getElementById("newTrainSoundSelect"),
    newTrainAutoShowToggle: document.getElementById("newTrainAutoShowToggle"),
    newTrainAutoPreview: document.getElementById("newTrainAutoPreview"),
    createTrainExampleButtons: document.querySelectorAll("[data-example-train]"),
    quickRouteButtons: document.querySelectorAll("[data-quick-route]"),
    storageStatusBadge: document.getElementById("storageStatusBadge"),
    presetNameInput: document.getElementById("presetNameInput"),
    savePresetButton: document.getElementById("savePresetButton"),
    presetList: document.getElementById("presetList"),
    presetCountText: document.getElementById("presetCountText"),
    lastSavedText: document.getElementById("lastSavedText"),
    exportJsonButton: document.getElementById("exportJsonButton"),
    importJsonButton: document.getElementById("importJsonButton"),
    importJsonInput: document.getElementById("importJsonInput"),
    resetCurrentSettingsButton: document.getElementById("resetCurrentSettingsButton"),
    deleteAllPresetsButton: document.getElementById("deleteAllPresetsButton"),
    resetEntireAppButton: document.getElementById("resetEntireAppButton"),
    menuPresetsButton: document.getElementById("menuPresetsButton"),
    menuResetTimerButton: document.getElementById("menuResetTimerButton"),
    menuTimerButton: document.getElementById("menuTimerButton"),
    menuGuideButton: document.getElementById("menuGuideButton"),
    menuAboutButton: document.getElementById("menuAboutButton"),
    guideSection: document.getElementById("guideSection"),
    aboutSection: document.getElementById("aboutSection"),
    installAppButton: document.getElementById("installAppButton"),
    pwaStatusText: document.getElementById("pwaStatusText"),
    networkStatusBadge: document.getElementById("networkStatusBadge"),
    menuButton: document.getElementById("menuButton"),
    sideMenu: document.getElementById("sideMenu"),
    closeMenuButton: document.getElementById("closeMenuButton"),
    menuBackdrop: document.getElementById("menuBackdrop"),
    settingsButton: document.getElementById("settingsButton"),
    mobileSettingsButton: document.getElementById("mobileSettingsButton"),
    settingsPanel: document.getElementById("settingsPanel"),
    closeSettingsButton: document.getElementById("closeSettingsButton"),
    cancelSettingsButton: document.getElementById("cancelSettingsButton"),
    settingsBackdrop: document.getElementById("settingsBackdrop"),
    preferencesForm: document.getElementById("preferencesForm"),
    routeEditorForm: document.getElementById("routeEditorForm"),
    resetRouteEditorButton: document.getElementById("resetRouteEditorButton"),
    unitPresetSelect: document.getElementById("unitPresetSelect"),
    unitMinutesInput: document.getElementById("unitMinutesInput"),
    stationEditorList: document.getElementById("stationEditorList"),
    addStationButton: document.getElementById("addStationButton"),
    segmentEditorList: document.getElementById("segmentEditorList"),
    draftTotalUnits: document.getElementById("draftTotalUnits"),
    draftTotalMinutes: document.getElementById("draftTotalMinutes"),
    trackShapeRadios: document.querySelectorAll('input[name="trackShape"]'),
    soundToggle: document.getElementById("soundToggle"),
    stationSoundToggle: document.getElementById("stationSoundToggle"),
    goalSoundToggle: document.getElementById("goalSoundToggle"),
    actionSoundToggle: document.getElementById("actionSoundToggle"),
    soundVolumeRange: document.getElementById("soundVolumeRange"),
    soundVolumeOutput: document.getElementById("soundVolumeOutput"),
    soundDetailControls: document.getElementById("soundDetailControls"),
    quietModeToggle: document.getElementById("quietModeToggle"),
    childLockToggle: document.getElementById("childLockToggle"),
    keepAwakeToggle: document.getElementById("keepAwakeToggle"),
    wakeLockSupportText: document.getElementById("wakeLockSupportText"),
    childLockOverlay: document.getElementById("childLockOverlay"),
    unlockHoldButton: document.getElementById("unlockHoldButton"),
    unlockProgressBar: document.getElementById("unlockProgressBar"),
    fontSizeSelect: document.getElementById("fontSizeSelect"),
    highContrastToggle: document.getElementById("highContrastToggle"),
    reduceMotionToggle: document.getElementById("reduceMotionToggle"),
    circleRemainingTimeToggle:
      document.getElementById("circleRemainingTimeToggle"),
    remainingTimeDisplayModeSelect:
      document.getElementById("remainingTimeDisplayModeSelect"),

    openPreferencesPanelButton: document.getElementById("openPreferencesPanelButton"),
    statusMessage: document.getElementById("statusMessage")
  };

  let configuration = createInitialConfiguration();
  let draftConfiguration = null;
  let pendingAdditionMinutes = 0;
  let timeAdditionHistory = [];
  let lastUndoableAdditionId = null;
  let presets = [];
  let trainFleet = [];
  let activeTrainId = null;
  let trainFleetAnimationFrameId = null;
  let lastTrainFleetFrameTimeMs = 0;
  let lastGoalTonePlayedAt = 0;
  function createDefaultStoragePreferences() {
    return {
      defaultPresetId: null,
      lastPresetId: null,
      ...DEFAULT_USER_PREFERENCES
    };
  }

  let storagePreferences = createDefaultStoragePreferences();
  let draftPreferences = null;
  let audioContext = null;
  let deferredInstallPrompt = null;
  let storageAvailable = true;
  let lastSavedAt = null;
  let storageRecoveryNotice = "";
  let wakeLock = null;
  let unlockHoldTimerId = null;
  let unlockHoldStartMs = 0;
  let unlockProgressFrameId = null;

  const timer = {
    state: TIMER_STATE.IDLE,
    initialDurationMs: calculateTotalMinutes(configuration) * 60 * 1000,
    remainingMs: calculateTotalMinutes(configuration) * 60 * 1000,
    endTimeMs: null,
    animationFrameId: null,
    lastRenderedSecond: null,
    lastFrameTimeMs: 0,
    lastReachedStationIndex: 0,
    lastJourneyTextSecond: null,
    arrivalNoticeTimeoutId: null,
    adjustmentAnimation: null
  };

  const focusState = {
    menuTrigger: null,
    settingsTrigger: null,
    timeAdditionTrigger: null,
    createTrainTrigger: null
  };

  let activePageId = "timer";

  function addSafeListener(element, eventName, handler) {
    if (!element) {
      return;
    }

    element.addEventListener(eventName, handler);
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function sanitizePresetName(value, fallbackName = "名称未設定") {
    const normalized = String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_PRESET_NAME_LENGTH);

    return normalized || fallbackName;
  }

  function normalizeString(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function sanitizeTrainName(value, fallbackName = "いま見る電車") {
    return sanitizePresetName(value, fallbackName);
  }

  function normalizeTrainStatus(value) {
    return Object.values(TRAIN_STATUS).includes(value)
      ? value
      : TRAIN_STATUS.IDLE;
  }

  function normalizeFontSize(value) {
    return ["normal", "large", "xlarge"].includes(value)
      ? value
      : DEFAULT_USER_PREFERENCES.fontSize;
  }

  function normalizeRemainingTimeDisplayMode(value) {
    return ["overall", "segment", "both", "off"].includes(value)
      ? value
      : DEFAULT_USER_PREFERENCES.remainingTimeDisplayMode;
  }

  function normalizeUserPreferences(source = {}) {
    return {
      soundEnabled:
        typeof source.soundEnabled === "boolean"
          ? source.soundEnabled
          : DEFAULT_USER_PREFERENCES.soundEnabled,
      stationSoundEnabled:
        typeof source.stationSoundEnabled === "boolean"
          ? source.stationSoundEnabled
          : DEFAULT_USER_PREFERENCES.stationSoundEnabled,
      goalSoundEnabled:
        typeof source.goalSoundEnabled === "boolean"
          ? source.goalSoundEnabled
          : DEFAULT_USER_PREFERENCES.goalSoundEnabled,
      actionSoundEnabled:
        typeof source.actionSoundEnabled === "boolean"
          ? source.actionSoundEnabled
          : DEFAULT_USER_PREFERENCES.actionSoundEnabled,
      soundVolume: clamp(
        Math.round(Number(source.soundVolume) || DEFAULT_USER_PREFERENCES.soundVolume),
        0,
        100
      ),
      quietMode:
        typeof source.quietMode === "boolean"
          ? source.quietMode
          : DEFAULT_USER_PREFERENCES.quietMode,
      fontSize: normalizeFontSize(source.fontSize),
      highContrast: Boolean(source.highContrast),
      reduceMotion: Boolean(source.reduceMotion),
      showCircleRemainingTime:
        typeof source.showCircleRemainingTime === "boolean"
          ? source.showCircleRemainingTime
          : DEFAULT_USER_PREFERENCES.showCircleRemainingTime,
      remainingTimeDisplayMode: normalizeRemainingTimeDisplayMode(
        source.remainingTimeDisplayMode
      ),
      switchToNewTrainAfterCreate:
        typeof source.switchToNewTrainAfterCreate === "boolean"
          ? source.switchToNewTrainAfterCreate
          : DEFAULT_USER_PREFERENCES.switchToNewTrainAfterCreate,
      childLockEnabled:
        typeof source.childLockEnabled === "boolean"
          ? source.childLockEnabled
          : DEFAULT_USER_PREFERENCES.childLockEnabled,
      keepAwakeEnabled:
        typeof source.keepAwakeEnabled === "boolean"
          ? source.keepAwakeEnabled
          : DEFAULT_USER_PREFERENCES.keepAwakeEnabled
    };
  }

  function normalizeTrackShape(value) {
    return Object.prototype.hasOwnProperty.call(TRACK_SHAPES, value)
      ? value
      : "horizontal";
  }

  function getTrackShapeDetails(value) {
    return TRACK_SHAPES[normalizeTrackShape(value)];
  }

  function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS(SVG_NAMESPACE, tagName);

    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, String(value));
    });

    return element;
  }

  function cacheDynamicTrackElements() {
    elements.stationPreviewList =
      elements.railwayTrack?.querySelector(".station-list") ?? null;
    elements.trackSegmentList =
      elements.railwayTrack?.querySelector(".track-segment-list") ?? null;
    elements.trainPosition =
      elements.railwayTrack?.querySelector(".train-position") ?? null;
  }

  function getSegmentExtraMinutes(segment) {
    const parsed = Number(segment?.extraMinutes);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function getSegmentDurationMinutes(source, segment) {
    return (
      Math.max(1, Number(segment.units) || 1) * source.unitMinutes +
      getSegmentExtraMinutes(segment)
    );
  }

  function calculateAddedMinutes(source) {
    return source.segments.reduce(
      (total, segment) => total + getSegmentExtraMinutes(segment),
      0
    );
  }

  function getTimingSignature(source) {
    return JSON.stringify({
      unitMinutes: source.unitMinutes,
      stationIds: source.stations.map((station) => station.id),
      segments: source.segments.map((segment) => ({
        fromStationId: segment.fromStationId,
        toStationId: segment.toStationId,
        units: segment.units,
        extraMinutes: getSegmentExtraMinutes(segment)
      }))
    });
  }

  function cloneConfiguration(source) {
    return {
      unitMinutes: source.unitMinutes,
      trackShape: normalizeTrackShape(source.trackShape),
      stations: source.stations.map((station) => ({ ...station })),
      segments: source.segments.map((segment) => ({
        ...segment,
        extraMinutes: getSegmentExtraMinutes(segment)
      }))
    };
  }

  function calculateTotalUnits(source) {
    return source.segments.reduce((total, segment) => {
      const units = Number.isFinite(segment.units) ? segment.units : 1;
      return total + Math.max(1, Math.round(units));
    }, 0);
  }

  function calculateTotalMinutes(source) {
    return source.segments.reduce(
      (total, segment) => total + getSegmentDurationMinutes(source, segment),
      0
    );
  }

  function getStationById(source, stationId) {
    return source.stations.find((station) => station.id === stationId) || null;
  }

  function sanitizeUnitMinutes(value) {
    const parsed = Number.parseInt(String(value), 10);

    if (!Number.isFinite(parsed)) {
      return MIN_UNIT_MINUTES;
    }

    return clamp(parsed, MIN_UNIT_MINUTES, MAX_UNIT_MINUTES);
  }

  function sanitizeStationName(value, fallbackName) {
    const normalized = String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20);

    return normalized || fallbackName;
  }


  function normalizeConfigurationData(source) {
    if (!source || typeof source !== "object") {
      throw new Error("設定データがありません。");
    }

    const settings =
      source.settings && typeof source.settings === "object"
        ? source.settings
        : source;
    const rawStations = Array.isArray(source.stations)
      ? source.stations
      : Array.isArray(settings.stations)
        ? settings.stations
        : [];
    const rawSegments = Array.isArray(source.segments)
      ? source.segments
      : Array.isArray(settings.segments)
        ? settings.segments
        : [];

    if (rawStations.length < 2 || rawStations.length > 10) {
      throw new Error("駅の数が正しくありません。");
    }

    if (rawSegments.length !== rawStations.length - 1) {
      throw new Error("駅と区間の数が一致しません。");
    }

    const usedStationIds = new Set();
    const stations = rawStations.map((station, index) => {
      const fallbackName =
        index === 0
          ? "スタート"
          : index === rawStations.length - 1
            ? "ゴール"
            : `駅${index}`;
      let id =
        typeof station?.id === "string" && station.id.trim()
          ? station.id.trim().slice(0, 120)
          : createId("station");

      if (usedStationIds.has(id)) {
        id = createId("station");
      }
      usedStationIds.add(id);

      return {
        id,
        name: sanitizeStationName(station?.name, fallbackName),
        role:
          index === 0
            ? "start"
            : index === rawStations.length - 1
              ? "goal"
              : "normal"
      };
    });

    const usedSegmentIds = new Set();
    const segments = rawSegments.map((segment, index) => {
      let id =
        typeof segment?.id === "string" && segment.id.trim()
          ? segment.id.trim().slice(0, 120)
          : createId("segment");

      if (usedSegmentIds.has(id)) {
        id = createId("segment");
      }
      usedSegmentIds.add(id);

      return {
        id,
        fromStationId: stations[index].id,
        toStationId: stations[index + 1].id,
        units: clamp(
          Math.max(1, Math.round(Number(segment?.units) || 1)),
          1,
          999
        ),
        extraMinutes: clamp(
          Math.max(
            0,
            Math.round(Number(segment?.extraMinutes) || 0)
          ),
          0,
          100000
        )
      };
    });

    return {
      unitMinutes: sanitizeUnitMinutes(
        settings.unitMinutes ?? source.unitMinutes
      ),
      trackShape: normalizeTrackShape(
        settings.trackShape ?? source.trackShape
      ),
      stations,
      segments
    };
  }

  function serializeConfiguration(source) {
    const normalized = normalizeConfigurationData(source);

    return {
      settings: {
        unitMinutes: normalized.unitMinutes,
        trackShape: normalized.trackShape
      },
      stations: normalized.stations.map((station) => ({ ...station })),
      segments: normalized.segments.map((segment) => ({ ...segment }))
    };
  }

  function getTimerStatusForTrain() {
    if (timer.state === TIMER_STATE.RUNNING) {
      return TRAIN_STATUS.RUNNING;
    }
    if (timer.state === TIMER_STATE.PAUSED) {
      return TRAIN_STATUS.PAUSED;
    }
    if (timer.state === TIMER_STATE.FINISHED) {
      return TRAIN_STATUS.ARRIVED;
    }
    return TRAIN_STATUS.IDLE;
  }

  function normalizeTrainSoundSettings(source = {}) {
    const preferences = normalizeUserPreferences(source);

    return {
      soundEnabled: preferences.soundEnabled,
      stationSoundEnabled: preferences.stationSoundEnabled,
      goalSoundEnabled: preferences.goalSoundEnabled,
      actionSoundEnabled: preferences.actionSoundEnabled,
      soundVolume: preferences.soundVolume,
      quietMode: preferences.quietMode
    };
  }

  function createTrainRecordFromConfiguration(
    sourceConfiguration,
    options = {}
  ) {
    const normalizedConfiguration = normalizeConfigurationData(
      sourceConfiguration
    );
    const serialized = serializeConfiguration(normalizedConfiguration);
    const now = new Date().toISOString();
    const totalMinutes = calculateTotalMinutes(normalizedConfiguration);
    const totalMs = totalMinutes * 60 * 1000;

    return {
      id: options.id || createId("train"),
      name: sanitizeTrainName(options.name, "いま見る電車"),
      status: normalizeTrainStatus(options.status),
      settings: serialized.settings,
      stations: serialized.stations,
      segments: serialized.segments,
      totalMinutes,
      remainingMs: clamp(
        Number.isFinite(Number(options.remainingMs))
          ? Number(options.remainingMs)
          : totalMs,
        0,
        totalMs
      ),
      endTimeMs:
        normalizeTrainStatus(options.status) === TRAIN_STATUS.RUNNING &&
        Number.isFinite(Number(options.endTimeMs))
          ? Number(options.endTimeMs)
          : null,
      soundSettings: normalizeTrainSoundSettings(options.soundSettings),
      createdAt:
        typeof options.createdAt === "string" ? options.createdAt : now,
      updatedAt:
        typeof options.updatedAt === "string" ? options.updatedAt : now
    };
  }

  function normalizeTrainData(source, fallbackConfiguration) {
    if (!source || typeof source !== "object") {
      throw new Error("電車データが正しくありません。");
    }

    const configurationSource =
      source.configuration && typeof source.configuration === "object"
        ? source.configuration
        : source.stations && source.segments
          ? source
          : fallbackConfiguration;

    if (!configurationSource) {
      throw new Error("電車の経路データがありません。");
    }

    const normalizedConfiguration = normalizeConfigurationData(
      configurationSource
    );
    const safeStatus = normalizeTrainStatus(source.status);

    return createTrainRecordFromConfiguration(normalizedConfiguration, {
      id:
        typeof source.id === "string" && source.id.trim()
          ? source.id.trim().slice(0, 120)
          : createId("train"),
      name: sanitizeTrainName(source.name, "いま見る電車"),
      status: safeStatus,
      remainingMs: source.remainingMs,
      endTimeMs: source.endTimeMs,
      soundSettings: source.soundSettings,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt
    });
  }

  function serializeTrainRecord(train) {
    const normalized = normalizeTrainData(train);

    return {
      id: normalized.id,
      name: normalized.name,
      status: normalized.status,
      settings: normalized.settings,
      stations: normalized.stations.map((station) => ({ ...station })),
      segments: normalized.segments.map((segment) => ({ ...segment })),
      totalMinutes: normalized.totalMinutes,
      remainingMs: normalized.remainingMs,
      endTimeMs: normalized.endTimeMs,
      soundSettings: { ...normalized.soundSettings },
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt
    };
  }

  function getTrainTotalMs(train) {
    const configurationForTrain = getTrainConfiguration(train);
    return calculateTotalMinutes(configurationForTrain) * 60 * 1000;
  }

  function updateTrainRecordFromClock(train, nowMs = Date.now()) {
    const normalized = serializeTrainRecord(train);

    if (normalized.status !== TRAIN_STATUS.RUNNING) {
      normalized.endTimeMs = null;
      return normalized;
    }

    const totalMs = getTrainTotalMs(normalized);
    let endTimeMs = Number(normalized.endTimeMs);

    if (!Number.isFinite(endTimeMs) || endTimeMs <= 0) {
      endTimeMs = nowMs + clamp(normalized.remainingMs, 0, totalMs);
    }

    const remainingMs = clamp(endTimeMs - nowMs, 0, totalMs);

    normalized.remainingMs = remainingMs;
    normalized.endTimeMs = remainingMs > 0 ? endTimeMs : null;
    normalized.status = remainingMs > 0 ? TRAIN_STATUS.RUNNING : TRAIN_STATUS.ARRIVED;
    normalized.updatedAt = new Date(nowMs).toISOString();

    return normalized;
  }

  function pauseRunningTrainForRestore(train, nowMs = Date.now()) {
    const updated = updateTrainRecordFromClock(train, nowMs);

    if (updated.status === TRAIN_STATUS.RUNNING) {
      updated.status = TRAIN_STATUS.PAUSED;
      updated.endTimeMs = null;
      updated.updatedAt = new Date(nowMs).toISOString();
    }

    return updated;
  }

  function updateInactiveTrainFleetFromClock(nowMs = Date.now()) {
    const arrivedTrains = [];
    let changed = false;

    trainFleet = trainFleet.map((train) => {
      if (train.id === activeTrainId || normalizeTrainStatus(train.status) !== TRAIN_STATUS.RUNNING) {
        return train;
      }

      const beforeStatus = normalizeTrainStatus(train.status);
      const updated = updateTrainRecordFromClock(train, nowMs);

      if (
        beforeStatus === TRAIN_STATUS.RUNNING &&
        updated.status === TRAIN_STATUS.ARRIVED
      ) {
        arrivedTrains.push(updated);
      }

      if (
        updated.remainingMs !== train.remainingMs ||
        updated.status !== train.status ||
        updated.endTimeMs !== train.endTimeMs
      ) {
        changed = true;
      }

      return updated;
    });

    return { arrivedTrains, changed };
  }

  function hasAnyRunningTrain() {
    if (timer.state === TIMER_STATE.RUNNING) {
      return true;
    }

    return trainFleet.some(
      (train) => train.id !== activeTrainId && normalizeTrainStatus(train.status) === TRAIN_STATUS.RUNNING
    );
  }

  function playGoalArrivalTone() {
    const nowMs = Date.now();

    if (nowMs - lastGoalTonePlayedAt < 1200) {
      return;
    }

    lastGoalTonePlayedAt = nowMs;
    playToneSequence("goal");
  }

  function notifyInactiveTrainArrivals(arrivedTrains) {
    if (!Array.isArray(arrivedTrains) || arrivedTrains.length === 0) {
      return;
    }

    const message = arrivedTrains.length === 1
      ? `${arrivedTrains[0].name}が到着しました。`
      : `${arrivedTrains.length}本の電車が到着しました。`;

    showArrivalNotice(message);
    setStatusMessage(message);
    playGoalArrivalTone();
  }

  function trainFleetLoop(frameTimeMs) {
    const { arrivedTrains, changed } = updateInactiveTrainFleetFromClock(Date.now());

    if (arrivedTrains.length > 0) {
      notifyInactiveTrainArrivals(arrivedTrains);
      saveAppData();
      updateWakeLock();
    }

    if (
      changed &&
      (frameTimeMs - lastTrainFleetFrameTimeMs >= DISPLAY_UPDATE_INTERVAL_MS || lastTrainFleetFrameTimeMs === 0)
    ) {
      lastTrainFleetFrameTimeMs = frameTimeMs;
      renderActiveTrainsList();
    }

    if (hasAnyRunningTrain()) {
      trainFleetAnimationFrameId = window.requestAnimationFrame(trainFleetLoop);
    } else {
      trainFleetAnimationFrameId = null;
      lastTrainFleetFrameTimeMs = 0;
    }
  }

  function ensureTrainFleetLoop() {
    if (trainFleetAnimationFrameId !== null || !hasAnyRunningTrain()) {
      return;
    }

    trainFleetAnimationFrameId = window.requestAnimationFrame(trainFleetLoop);
  }

  function syncDisplayedTimerToActiveTrain() {
    if (!activeTrainId) {
      return null;
    }

    return upsertTrainRecord(getCurrentTrainSnapshot());
  }

  function getCurrentTrainSnapshot() {
    const existingTrain = trainFleet.find(
      (train) => train.id === activeTrainId
    );

    return createTrainRecordFromConfiguration(configuration, {
      id: activeTrainId || existingTrain?.id || createId("train"),
      name: existingTrain?.name || "いま見る電車",
      status: getTimerStatusForTrain(),
      remainingMs: timer.remainingMs,
      endTimeMs: timer.state === TIMER_STATE.RUNNING ? timer.endTimeMs : null,
      soundSettings: storagePreferences,
      createdAt: existingTrain?.createdAt,
      updatedAt: new Date().toISOString()
    });
  }

  function createTrainFleetForStorage() {
    const currentTrain = getCurrentTrainSnapshot();
    const existingTrains = Array.isArray(trainFleet) ? trainFleet : [];
    const storedTrains = existingTrains
      .filter((train) => train.id !== currentTrain.id)
      .slice(0, Math.max(0, MAX_ACTIVE_TRAINS - 1))
      .map((train) => serializeTrainRecord(train));

    return [currentTrain, ...storedTrains];
  }

  function createInitialTrainFleet() {
    const initialTrain = createTrainRecordFromConfiguration(
      configuration,
      {
        name: "いま見る電車",
        status: TRAIN_STATUS.IDLE
      }
    );

    activeTrainId = initialTrain.id;
    return [initialTrain];
  }

  function normalizePresetData(source) {
    if (!source || typeof source !== "object") {
      throw new Error("プリセットデータが正しくありません。");
    }

    const configurationSource =
      source.configuration && typeof source.configuration === "object"
        ? source.configuration
        : source;

    return {
      id:
        typeof source.id === "string" && source.id.trim()
          ? source.id.trim().slice(0, 120)
          : createId("preset"),
      name: sanitizePresetName(source.name, "名称未設定"),
      isBuiltIn: Boolean(source.isBuiltIn),
      createdAt:
        typeof source.createdAt === "string"
          ? source.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof source.updatedAt === "string"
          ? source.updatedAt
          : new Date().toISOString(),
      configuration: normalizeConfigurationData(configurationSource)
    };
  }

  function createStoragePayload() {
    const current = serializeConfiguration(configuration);
    const trains = createTrainFleetForStorage();
    activeTrainId = trains[0]?.id || activeTrainId;

    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      settings: current.settings,
      stations: current.stations,
      segments: current.segments,
      activeTrainId,
      trains: trains.map((train) => serializeTrainRecord(train)),
      preferences: {
        ...normalizeUserPreferences(storagePreferences),
        defaultPresetId: storagePreferences.defaultPresetId,
        lastPresetId: storagePreferences.lastPresetId
      },
      presets: presets.map((preset) => {
        const serialized = serializeConfiguration(preset.configuration);

        return {
          id: preset.id,
          name: preset.name,
          isBuiltIn: Boolean(preset.isBuiltIn),
          createdAt: preset.createdAt,
          updatedAt: preset.updatedAt,
          settings: serialized.settings,
          stations: serialized.stations,
          segments: serialized.segments
        };
      })
    };
  }

  function normalizeStoragePayload(rawPayload) {
    if (!rawPayload || typeof rawPayload !== "object") {
      throw new Error("保存データが正しくありません。");
    }

    const schemaVersion = Number(rawPayload.schemaVersion ?? 0);

    if (schemaVersion > STORAGE_SCHEMA_VERSION) {
      throw new Error(
        "このデータは新しいバージョンのアプリで作成されています。"
      );
    }

    const rawPresets = Array.isArray(rawPayload.presets)
      ? rawPayload.presets
      : [];
    const normalizedPresets = [];
    const usedPresetIds = new Set();

    rawPresets.slice(0, MAX_PRESETS).forEach((presetSource) => {
      try {
        const preset = normalizePresetData(presetSource);

        if (usedPresetIds.has(preset.id)) {
          preset.id = createId("preset");
        }

        usedPresetIds.add(preset.id);
        normalizedPresets.push(preset);
      } catch (error) {
        console.warn("読み込めないプリセットを除外しました。", error);
      }
    });

    let currentConfiguration = null;

    try {
      currentConfiguration = normalizeConfigurationData(rawPayload);
    } catch (currentError) {
      const defaultId = rawPayload.preferences?.defaultPresetId;
      const defaultPreset = normalizedPresets.find(
        (preset) => preset.id === defaultId
      );

      if (defaultPreset) {
        currentConfiguration = cloneConfiguration(
          defaultPreset.configuration
        );
      } else {
        throw currentError;
      }
    }

    const rawTrains = Array.isArray(rawPayload.trains)
      ? rawPayload.trains
      : [];
    const normalizedTrains = [];
    const usedTrainIds = new Set();

    rawTrains.slice(0, MAX_ACTIVE_TRAINS).forEach((trainSource) => {
      try {
        let train = normalizeTrainData(
          trainSource,
          currentConfiguration
        );
        train = pauseRunningTrainForRestore(train);

        if (usedTrainIds.has(train.id)) {
          train.id = createId("train");
        }

        usedTrainIds.add(train.id);
        normalizedTrains.push(train);
      } catch (error) {
        console.warn("読み込めない電車データを除外しました。", error);
      }
    });

    if (normalizedTrains.length === 0) {
      const fallbackTrain = createTrainRecordFromConfiguration(
        currentConfiguration,
        {
          name: "いま見る電車",
          status: TRAIN_STATUS.IDLE
        }
      );
      normalizedTrains.push(fallbackTrain);
    }

    const requestedActiveTrainId =
      typeof rawPayload.activeTrainId === "string"
        ? rawPayload.activeTrainId
        : null;
    const normalizedActiveTrainId = normalizedTrains.some(
      (train) => train.id === requestedActiveTrainId
    )
      ? requestedActiveTrainId
      : normalizedTrains[0].id;

    const requestedDefaultId =
      typeof rawPayload.preferences?.defaultPresetId === "string"
        ? rawPayload.preferences.defaultPresetId
        : null;
    const requestedLastId =
      typeof rawPayload.preferences?.lastPresetId === "string"
        ? rawPayload.preferences.lastPresetId
        : null;

    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      savedAt:
        typeof rawPayload.savedAt === "string"
          ? rawPayload.savedAt
          : null,
      configuration: currentConfiguration,
      activeTrainId: normalizedActiveTrainId,
      trains: normalizedTrains,
      presets: normalizedPresets,
      preferences: {
        ...normalizeUserPreferences(rawPayload.preferences),
        defaultPresetId: normalizedPresets.some(
          (preset) => preset.id === requestedDefaultId
        )
          ? requestedDefaultId
          : null,
        lastPresetId: normalizedPresets.some(
          (preset) => preset.id === requestedLastId
        )
          ? requestedLastId
          : null
      }
    };
  }

  function canUseLocalStorage() {
    try {
      const testKey = `${STORAGE_KEY}-test`;
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.warn("localStorageを利用できません。", error);
      return false;
    }
  }

  function updateStorageStatusDisplay() {
    if (elements.storageStatusBadge) {
      elements.storageStatusBadge.classList.remove(
        "is-warning",
        "is-error"
      );

      if (!storageAvailable) {
        elements.storageStatusBadge.textContent = "保存できません";
        elements.storageStatusBadge.classList.add("is-error");
      } else if (storageRecoveryNotice) {
        elements.storageStatusBadge.textContent = "初期値で復旧";
        elements.storageStatusBadge.classList.add("is-warning");
      } else {
        elements.storageStatusBadge.textContent = "自動保存中";
      }
    }

    if (elements.lastSavedText) {
      if (!storageAvailable) {
        elements.lastSavedText.textContent =
          "ブラウザ保存を利用できません";
      } else if (lastSavedAt) {
        const date = new Date(lastSavedAt);
        elements.lastSavedText.textContent =
          Number.isNaN(date.getTime())
            ? "保存済み"
            : `最終保存 ${new Intl.DateTimeFormat("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              }).format(date)}`;
      } else {
        elements.lastSavedText.textContent =
          "まだ保存されていません";
      }
    }
  }

  function saveAppData(options = {}) {
    const { announce = false } = options;

    if (!storageAvailable) {
      updateStorageStatusDisplay();

      if (announce) {
        setStatusMessage(
          "このブラウザでは設定を保存できません。"
        );
      }
      return false;
    }

    try {
      const payload = createStoragePayload();
      const json = JSON.stringify(payload);
      window.localStorage.setItem(STORAGE_KEY, json);
      lastSavedAt = payload.savedAt;
      storageRecoveryNotice = "";
      updateStorageStatusDisplay();

      if (announce) {
        setStatusMessage(
          "現在の設定とプリセットをこの端末に保存しました。"
        );
      }

      return true;
    } catch (error) {
      console.error("保存に失敗しました。", error);
      storageAvailable = false;
      updateStorageStatusDisplay();

      if (announce) {
        setStatusMessage(
          "保存容量またはブラウザ設定のため、データを保存できませんでした。"
        );
      }

      return false;
    }
  }

  function initializePersistence() {
    storageAvailable = canUseLocalStorage();

    if (!storageAvailable) {
      presets = createInitialPresets();
      trainFleet = createInitialTrainFleet();
      updateStorageStatusDisplay();
      return;
    }

    const rawJson = window.localStorage.getItem(STORAGE_KEY);

    if (!rawJson) {
      presets = createInitialPresets();
      storagePreferences = createDefaultStoragePreferences();
      trainFleet = createInitialTrainFleet();
      saveAppData();
      return;
    }

    try {
      const normalized = normalizeStoragePayload(JSON.parse(rawJson));
      configuration = cloneConfiguration(normalized.configuration);
      activeTrainId = normalized.activeTrainId;
      trainFleet = normalized.trains;
      presets = normalized.presets;
      storagePreferences = {
        ...createDefaultStoragePreferences(),
        ...normalized.preferences
      };
      lastSavedAt = normalized.savedAt;
    } catch (error) {
      console.error("保存データを読み込めませんでした。", error);
      configuration = createInitialConfiguration();
      presets = createInitialPresets();
      storagePreferences = createDefaultStoragePreferences();
      trainFleet = createInitialTrainFleet();
      const recoveryMessage =
        "保存データを読み込めなかったため初期値で起動しました。";
      storageRecoveryNotice = recoveryMessage;
      saveAppData();
      storageRecoveryNotice = recoveryMessage;
    }

    updateStorageStatusDisplay();
  }

  function formatDuration(milliseconds) {
    const safeMilliseconds = clamp(
      Number.isFinite(milliseconds) ? milliseconds : 0,
      0,
      Number.MAX_SAFE_INTEGER
    );
    const totalSeconds = Math.ceil(safeMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatAccessibleDuration(milliseconds) {
    const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0 && seconds > 0) {
      return `残り時間${minutes}分${seconds}秒`;
    }

    if (minutes > 0) {
      return `残り時間${minutes}分`;
    }

    return `残り時間${seconds}秒`;
  }


  function buildJourneyTimeline(source = configuration) {
    const totalUnits = Math.max(1, calculateTotalUnits(source));
    const segmentDurationsMs = source.segments.map(
      (segment) => getSegmentDurationMinutes(source, segment) * 60 * 1000
    );
    const totalMs = Math.max(
      1,
      segmentDurationsMs.reduce((total, durationMs) => total + durationMs, 0)
    );

    let cumulativeUnits = 0;
    let cumulativeMs = 0;

    const stations = source.stations.map((station, index) => {
      if (index > 0) {
        const previousSegment = source.segments[index - 1];
        cumulativeUnits += previousSegment.units;
        cumulativeMs += segmentDurationsMs[index - 1];
      }

      return {
        ...station,
        index,
        cumulativeUnits,
        cumulativeMs,
        positionPercent: (cumulativeMs / totalMs) * 100
      };
    });

    cumulativeUnits = 0;
    cumulativeMs = 0;

    const segments = source.segments.map((segment, index) => {
      const durationMs = segmentDurationsMs[index];
      const startUnits = cumulativeUnits;
      const startMs = cumulativeMs;
      cumulativeUnits += segment.units;
      cumulativeMs += durationMs;

      return {
        ...segment,
        extraMinutes: getSegmentExtraMinutes(segment),
        index,
        startUnits,
        endUnits: cumulativeUnits,
        startMs,
        endMs: cumulativeMs,
        durationMs,
        leftPercent: (startMs / totalMs) * 100,
        widthPercent: (durationMs / totalMs) * 100
      };
    });

    return {
      totalUnits,
      totalMs,
      stations,
      segments
    };
  }

  function getJourneySnapshot(remainingMs = timer.remainingMs) {
    const timeline = buildJourneyTimeline(configuration);
    const totalMs = Math.max(1, timeline.totalMs);
    const safeRemainingMs = clamp(remainingMs, 0, totalMs);
    const elapsedMs = clamp(totalMs - safeRemainingMs, 0, totalMs);
    const isFinished = elapsedMs >= totalMs || timer.state === TIMER_STATE.FINISHED;

    if (isFinished) {
      const lastSegmentIndex = Math.max(0, timeline.segments.length - 1);
      const lastStationIndex = Math.max(0, timeline.stations.length - 1);

      return {
        timeline,
        elapsedMs: totalMs,
        remainingMs: 0,
        overallProgress: 1,
        overallPercent: 100,
        currentSegmentIndex: lastSegmentIndex,
        segmentProgress: 1,
        reachedStationIndex: lastStationIndex,
        nextStationIndex: null,
        nextStationRemainingMs: 0,
        isFinished: true
      };
    }

    let currentSegmentIndex = timeline.segments.findIndex(
      (segment) => elapsedMs < segment.endMs
    );

    if (currentSegmentIndex < 0) {
      currentSegmentIndex = Math.max(0, timeline.segments.length - 1);
    }

    const currentSegment = timeline.segments[currentSegmentIndex];
    const segmentElapsedMs = clamp(
      elapsedMs - currentSegment.startMs,
      0,
      currentSegment.durationMs
    );
    const segmentProgress = currentSegment.durationMs > 0
      ? segmentElapsedMs / currentSegment.durationMs
      : 0;

    return {
      timeline,
      elapsedMs,
      remainingMs: safeRemainingMs,
      overallProgress: elapsedMs / totalMs,
      overallPercent: (elapsedMs / totalMs) * 100,
      currentSegmentIndex,
      segmentProgress,
      reachedStationIndex: currentSegmentIndex,
      nextStationIndex: currentSegmentIndex + 1,
      nextStationRemainingMs: Math.max(0, currentSegment.endMs - elapsedMs),
      isFinished: false
    };
  }

  function hideArrivalNotice() {
    if (timer.arrivalNoticeTimeoutId !== null) {
      window.clearTimeout(timer.arrivalNoticeTimeoutId);
      timer.arrivalNoticeTimeoutId = null;
    }

    if (!elements.arrivalNotice) {
      return;
    }

    elements.arrivalNotice.classList.remove("is-visible");
    elements.arrivalNotice.hidden = true;
  }

  function showArrivalNotice(message) {
    if (!elements.arrivalNotice) {
      return;
    }

    hideArrivalNotice();
    elements.arrivalNotice.textContent = message;
    elements.arrivalNotice.hidden = false;

    window.requestAnimationFrame(() => {
      elements.arrivalNotice?.classList.add("is-visible");
    });

    timer.arrivalNoticeTimeoutId = window.setTimeout(() => {
      hideArrivalNotice();
    }, 2200);
  }

  function announceNewStationArrivals(snapshot) {
    if (snapshot.reachedStationIndex <= timer.lastReachedStationIndex) {
      return;
    }

    const latestStation =
      snapshot.timeline.stations[snapshot.reachedStationIndex];

    timer.lastReachedStationIndex = snapshot.reachedStationIndex;

    if (!latestStation) {
      return;
    }

    const message = latestStation.role === "goal"
      ? "ゴールにつきました！"
      : `${latestStation.name}につきました`;

    showArrivalNotice(message);
    playToneSequence("station");
    setStatusMessage(message);
  }

  function updateJourneyStateClasses(snapshot) {
    const stationItems = elements.stationPreviewList
      ? elements.stationPreviewList.querySelectorAll(".station")
      : [];

    stationItems.forEach((item, index) => {
      item.classList.toggle("is-passed", index < snapshot.reachedStationIndex);
      item.classList.toggle(
        "is-current",
        index === snapshot.reachedStationIndex
      );
      item.classList.toggle(
        "is-next",
        snapshot.nextStationIndex !== null &&
          index === snapshot.nextStationIndex
      );
      item.classList.toggle(
        "is-future",
        snapshot.nextStationIndex !== null &&
          index > snapshot.nextStationIndex
      );
    });

    const trackSegments = elements.trackSegmentList
      ? elements.trackSegmentList.querySelectorAll(".track-segment")
      : [];

    trackSegments.forEach((segmentElement, index) => {
      const completed = snapshot.isFinished || index < snapshot.currentSegmentIndex;
      const active = !snapshot.isFinished && index === snapshot.currentSegmentIndex;

      segmentElement.classList.toggle("is-completed", completed);
      segmentElement.classList.toggle("is-active", active);
      segmentElement.classList.toggle(
        "is-future",
        !completed && !active
      );
    });

    const overviewItems = elements.segmentOverviewList
      ? elements.segmentOverviewList.querySelectorAll(".segment-overview-item")
      : [];

    overviewItems.forEach((item, index) => {
      const completed = snapshot.isFinished || index < snapshot.currentSegmentIndex;
      const active = !snapshot.isFinished && index === snapshot.currentSegmentIndex;

      item.classList.toggle("is-completed", completed);
      item.classList.toggle("is-active", active);
      item.classList.toggle("is-future", !completed && !active);
    });
  }

  function positionTrainForShape(snapshot) {
    if (!elements.trainPosition) {
      return;
    }

    const shape = normalizeTrackShape(configuration.trackShape);
    const percent = clamp(snapshot.overallPercent, 0, 100);

    elements.trainPosition.classList.toggle(
      "is-running",
      timer.state === TIMER_STATE.RUNNING
    );

    if (shape === "vertical") {
      elements.trainPosition.style.left = "var(--rail-x, 35%)";
      elements.trainPosition.style.top = `calc(var(--rail-y-start, 36px) + (100% - var(--rail-y-total-inset, 72px)) * ${percent / 100})`;
      return;
    }

    if (shape === "circle") {
      const point = getCirclePoint(snapshot.overallPercent, 36);

      elements.trainPosition.style.left = `${point.x}%`;
      elements.trainPosition.style.top = `${point.y}%`;
      return;
    }

    elements.trainPosition.style.left = `calc(var(--rail-x-inset, 34px) + (100% - var(--rail-x-total-inset, 68px)) * ${percent / 100})`;
    elements.trainPosition.style.top = "";
  }

  function updateCircleRemainingTimeDisplay(snapshot = getJourneySnapshot()) {
    const panel = elements.routeTimePanel;
    const content = elements.routeTimeContent;

    if (!panel || !content) {
      return;
    }

    const activePreferences = normalizeUserPreferences(
      draftPreferences || storagePreferences
    );
    const mode = activePreferences.remainingTimeDisplayMode;
    const isVisible = Boolean(
      activePreferences.showCircleRemainingTime
    ) && mode !== "off";

    panel.hidden = !isVisible;
    panel.classList.toggle("is-double", mode === "both");
    panel.dataset.displayMode = mode;

    if (!isVisible) {
      panel.setAttribute(
        "aria-label",
        "線路内の残り時間は非表示です"
      );
      return;
    }

    if (mode === "both") {
      content.innerHTML = `
        <div class="route-time-value-block">
          <small>全体</small>
          <strong>${formatDuration(snapshot.remainingMs)}</strong>
        </div>
        <div class="route-time-divider" aria-hidden="true"></div>
        <div class="route-time-value-block">
          <small>この区間</small>
          <strong>${formatDuration(snapshot.nextStationRemainingMs)}</strong>
        </div>
      `;
      panel.setAttribute(
        "aria-label",
        `線路内に、全体の${formatAccessibleDuration(snapshot.remainingMs)}と、この区間の${formatAccessibleDuration(snapshot.nextStationRemainingMs)}を表示しています`
      );
    } else if (mode === "segment") {
      content.innerHTML = `
        <div class="route-time-value-block">
          <small>この区間</small>
          <strong>${formatDuration(snapshot.nextStationRemainingMs)}</strong>
        </div>
      `;
      panel.setAttribute(
        "aria-label",
        `線路内に、この区間の${formatAccessibleDuration(snapshot.nextStationRemainingMs)}を表示しています`
      );
    } else {
      content.innerHTML = `
        <div class="route-time-value-block">
          <small>全体</small>
          <strong>${formatDuration(snapshot.remainingMs)}</strong>
        </div>
      `;
      panel.setAttribute(
        "aria-label",
        `線路内に、全体の${formatAccessibleDuration(snapshot.remainingMs)}を表示しています`
      );
    }
  }

  function renderJourneyProgress(options = {}) {
    const {
      announceArrivals = false,
      forceText = false
    } = options;

    const snapshot = getJourneySnapshot();

    positionTrainForShape(snapshot);

    if (elements.journeyProgressBar) {
      elements.journeyProgressBar.style.width = `${snapshot.overallPercent}%`;
    }

    if (elements.journeyProgress) {
      elements.journeyProgress.setAttribute(
        "aria-valuenow",
        String(Math.round(snapshot.overallPercent))
      );
    }

    updateJourneyStateClasses(snapshot);
    updateCircleRemainingTimeDisplay();

    const textSecond = Math.ceil(snapshot.elapsedMs / 1000);

    if (forceText || timer.lastJourneyTextSecond !== textSecond) {
      timer.lastJourneyTextSecond = textSecond;

      if (elements.journeyProgressText) {
        elements.journeyProgressText.textContent =
          `${Math.round(snapshot.overallPercent)}%`;
      }

      if (snapshot.isFinished) {
        if (elements.currentSegmentName) {
          elements.currentSegmentName.textContent = "ゴール";
        }

        if (elements.nextStationName) {
          elements.nextStationName.textContent = "とうちゃくしました";
        }

        if (elements.nextStationTime) {
          elements.nextStationTime.textContent = "ゴール";
        }
      } else {
        const currentSegment =
          snapshot.timeline.segments[snapshot.currentSegmentIndex];
        const fromStation = getStationById(
          configuration,
          currentSegment.fromStationId
        );
        const toStation = getStationById(
          configuration,
          currentSegment.toStationId
        );
        const nextStation =
          snapshot.timeline.stations[snapshot.nextStationIndex];

        if (elements.currentSegmentName) {
          elements.currentSegmentName.textContent =
            `${fromStation?.name ?? "駅"} → ${toStation?.name ?? "駅"}`;
        }

        if (elements.nextStationName) {
          elements.nextStationName.textContent =
            nextStation?.name ?? "ゴール";
        }

        if (elements.nextStationTime) {
          elements.nextStationTime.textContent =
            formatDuration(snapshot.nextStationRemainingMs);
        }
      }
    }

    if (announceArrivals) {
      announceNewStationArrivals(snapshot);
    }

    return snapshot;
  }



  function getTrainConfiguration(train) {
    return normalizeConfigurationData({
      settings: train.settings,
      stations: train.stations,
      segments: train.segments
    });
  }

  function upsertTrainRecord(trainRecord) {
    const normalized = serializeTrainRecord(trainRecord);
    const index = trainFleet.findIndex((train) => train.id === normalized.id);

    if (index >= 0) {
      trainFleet[index] = normalized;
    } else {
      trainFleet.unshift(normalized);
    }

    trainFleet = trainFleet.slice(0, MAX_ACTIVE_TRAINS);
    return normalized;
  }

  function syncActiveTrainToFleet() {
    const currentTrain = getCurrentTrainSnapshot();
    return upsertTrainRecord(currentTrain);
  }

  function getTrainFleetForDisplay() {
    syncActiveTrainToFleet();

    if (trainFleet.length === 0) {
      trainFleet = createInitialTrainFleet();
    }

    return trainFleet.map((train) => serializeTrainRecord(train));
  }

  function getTrainById(trainId) {
    return getTrainFleetForDisplay().find((train) => train.id === trainId) || null;
  }

  function getTrainStatusLabel(status) {
    const normalizedStatus = normalizeTrainStatus(status);

    if (normalizedStatus === TRAIN_STATUS.RUNNING) return "運転中";
    if (normalizedStatus === TRAIN_STATUS.PAUSED) return "停車中";
    if (normalizedStatus === TRAIN_STATUS.ARRIVED) return "到着";
    return "開始前";
  }

  function getTrainStatusClass(status) {
    const normalizedStatus = normalizeTrainStatus(status);

    if (normalizedStatus === TRAIN_STATUS.RUNNING) return "active-train-status--running";
    if (normalizedStatus === TRAIN_STATUS.PAUSED) return "active-train-status--paused";
    if (normalizedStatus === TRAIN_STATUS.ARRIVED) return "active-train-status--arrived";
    return "";
  }

  function createActiveTrainButton({ label, action, trainId, className = "", disabled = false }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `active-train-button ${className}`.trim();
    button.dataset.action = action;
    button.dataset.trainId = trainId;
    button.textContent = label;
    button.disabled = Boolean(disabled);
    button.setAttribute(
      "aria-label",
      disabled ? `${label}：この電車は現在表示中です` : `${label}`
    );
    return button;
  }

  function renderActiveTrainSummary() {
    const count = getTrainFleetForDisplay().length;
    const label = `運行中の電車：${count}本`;

    if (elements.activeTrainSummary) {
      elements.activeTrainSummary.textContent = label;
    }

    if (elements.activeTrainsCountBadge) {
      elements.activeTrainsCountBadge.textContent = `${count}本`;
    }
  }

  function renderActiveTrainsList() {
    if (!elements.activeTrainsList) {
      renderActiveTrainSummary();
      return;
    }

    updateInactiveTrainFleetFromClock(Date.now());
    const trains = getTrainFleetForDisplay();
    elements.activeTrainsList.textContent = "";

    trains.forEach((train) => {
      const isActive = train.id === activeTrainId;
      const status = isActive ? getTimerStatusForTrain() : normalizeTrainStatus(train.status);
      const remainingMs = isActive ? timer.remainingMs : train.remainingMs;
      const trainConfiguration = isActive ? configuration : getTrainConfiguration(train);
      const totalMs = calculateTotalMinutes(trainConfiguration) * 60 * 1000;
      const progressPercent = clamp(
        totalMs > 0 ? ((totalMs - remainingMs) / totalMs) * 100 : 0,
        0,
        100
      );
      const shapeLabel = getTrackShapeDetails(trainConfiguration.trackShape).label;
      const stationCount = trainConfiguration.stations.length;
      const item = document.createElement("article");
      item.className = "active-train-card";
      item.dataset.trainId = train.id;
      item.classList.toggle("is-active", isActive);
      item.classList.toggle("is-running", status === TRAIN_STATUS.RUNNING);
      item.classList.toggle("is-paused", status === TRAIN_STATUS.PAUSED);
      item.classList.toggle("is-arrived", status === TRAIN_STATUS.ARRIVED);

      const main = document.createElement("div");
      main.className = "active-train-main";

      const title = document.createElement("div");
      title.className = "active-train-title";

      const nameRow = document.createElement("div");
      nameRow.className = "active-train-name-row";

      const name = document.createElement("strong");
      name.className = "active-train-name";
      name.textContent = train.name;
      nameRow.append(name);

      if (isActive) {
        const badge = document.createElement("span");
        badge.className = "active-train-current-badge";
        badge.textContent = "いま見る電車";
        nameRow.append(badge);
      }

      const meta = document.createElement("div");
      meta.className = "active-train-meta";
      [`${shapeLabel}線路`, `${stationCount}駅`, `${train.totalMinutes}分`].forEach((text) => {
        const span = document.createElement("span");
        span.textContent = text;
        meta.append(span);
      });

      title.append(nameRow, meta);

      const time = document.createElement("div");
      time.className = "active-train-time";
      time.textContent = formatDuration(remainingMs);

      main.append(title, time);

      const progress = document.createElement("div");
      progress.className = "active-train-progress";
      progress.setAttribute("aria-hidden", "true");

      const progressBar = document.createElement("span");
      progressBar.style.width = `${progressPercent}%`;
      progress.append(progressBar);

      const statusLine = document.createElement("div");
      statusLine.className = "active-train-status-line";

      const statusBadge = document.createElement("span");
      statusBadge.className = `active-train-status ${getTrainStatusClass(status)}`.trim();
      statusBadge.textContent = getTrainStatusLabel(status);
      statusLine.append(statusBadge);

      const primaryAction = status === TRAIN_STATUS.RUNNING ? "pause-train" : "start-train";
      const primaryLabel = status === TRAIN_STATUS.RUNNING
        ? "一時停止"
        : status === TRAIN_STATUS.PAUSED
          ? "つづきから"
          : "はじめる";

      const actions = document.createElement("div");
      actions.className = "active-train-actions active-train-actions--multi";
      actions.append(
        createActiveTrainButton({
          label: primaryLabel,
          action: primaryAction,
          trainId: train.id,
          className: status === TRAIN_STATUS.RUNNING
            ? "active-train-button--pause"
            : "active-train-button--start"
        }),
        createActiveTrainButton({
          label: "はじめから",
          action: "restart-train",
          trainId: train.id,
          className: "active-train-button--restart"
        }),
        createActiveTrainButton({
          label: isActive ? "表示中" : "表示する",
          action: "show-train",
          trainId: train.id,
          className: "active-train-button--show",
          disabled: isActive
        }),
        createActiveTrainButton({
          label: "削除",
          action: "delete-train",
          trainId: train.id,
          className: "active-train-button--danger"
        })
      );

      item.append(main, progress, statusLine, actions);
      elements.activeTrainsList.append(item);
    });

    renderActiveTrainSummary();
  }

  function applyTrainRecordToMainTimer(trainRecord, options = {}) {
    const clockAdjustedTrain = updateTrainRecordFromClock(trainRecord);
    const normalizedTrain = serializeTrainRecord(clockAdjustedTrain);
    const nextConfiguration = getTrainConfiguration(normalizedTrain);
    const nextTotalMs = calculateTotalMinutes(nextConfiguration) * 60 * 1000;
    const nextStatus = normalizeTrainStatus(normalizedTrain.status);

    cancelTimerLoop();
    hideArrivalNotice();
    configuration = cloneConfiguration(nextConfiguration);
    activeTrainId = normalizedTrain.id;
    clearSessionTimeAdditionHistory();

    timer.initialDurationMs = nextTotalMs;
    timer.remainingMs = clamp(normalizedTrain.remainingMs, 0, nextTotalMs);
    timer.state =
      nextStatus === TRAIN_STATUS.ARRIVED || timer.remainingMs <= 0
        ? TIMER_STATE.FINISHED
        : nextStatus === TRAIN_STATUS.RUNNING
          ? TIMER_STATE.RUNNING
          : nextStatus === TRAIN_STATUS.PAUSED
            ? TIMER_STATE.PAUSED
            : TIMER_STATE.IDLE;
    timer.endTimeMs =
      timer.state === TIMER_STATE.RUNNING
        ? (Number.isFinite(Number(normalizedTrain.endTimeMs))
            ? Number(normalizedTrain.endTimeMs)
            : Date.now() + timer.remainingMs)
        : null;
    timer.lastRenderedSecond = null;
    timer.lastFrameTimeMs = 0;
    timer.lastReachedStationIndex = 0;
    timer.lastJourneyTextSecond = null;

    renderConfiguration();
    renderTimerState();
    renderRemainingTime(true);
    renderPersistenceUi();

    if (timer.state === TIMER_STATE.RUNNING) {
      timer.animationFrameId = window.requestAnimationFrame(timerLoop);
    }

    ensureTrainFleetLoop();
    updateWakeLock();

    if (options.announceMessage) {
      showArrivalNotice(options.announceMessage);
      setStatusMessage(options.announceMessage);
    }
  }

  function getSuggestedTrainName() {
    const trains = getTrainFleetForDisplay();
    const usedNames = new Set(
      trains.map((train) => normalizeString(train.name)).filter(Boolean)
    );
    const nameCandidates = [
      "朝の支度号",
      "勉強号",
      "休憩号",
      "お片付け号",
      "電車2"
    ];

    const candidate = nameCandidates.find(
      (name) => !usedNames.has(normalizeString(name))
    );

    if (candidate) {
      return candidate;
    }

    let index = trains.length + 1;
    let nextName = `電車${index}`;
    while (usedNames.has(normalizeString(nextName))) {
      index += 1;
      nextName = `電車${index}`;
    }

    return nextName;
  }

  function duplicateCurrentRouteAsTrain() {
    const trains = getTrainFleetForDisplay();

    if (trains.length >= MAX_ACTIVE_TRAINS) {
      setStatusMessage(
        `運行中の電車は${MAX_ACTIVE_TRAINS}本まで追加できます。使わない電車を削除してください。`
      );
      return;
    }

    const suggestedName = getSuggestedTrainName();
    const rawName = window.prompt(
      "今の経路をコピーして、新しい電車として追加します。\n電車名を入力してください。",
      suggestedName
    );

    if (rawName === null) {
      return;
    }

    const trainName = sanitizeTrainName(rawName, suggestedName);
    const newTrain = createTrainRecordFromConfiguration(configuration, {
      name: trainName,
      status: TRAIN_STATUS.IDLE,
      remainingMs: calculateTotalMinutes(configuration) * 60 * 1000,
      soundSettings: storagePreferences
    });

    const activeBeforeAdd = activeTrainId;
    syncActiveTrainToFleet();
    trainFleet = trainFleet.filter((train) => train.id !== newTrain.id);
    trainFleet.push(newTrain);
    trainFleet = trainFleet.slice(0, MAX_ACTIVE_TRAINS);
    activeTrainId = activeBeforeAdd;

    saveAppData();
    renderPersistenceUi();
    setStatusMessage(
      `${newTrain.name}を運行中の電車に追加しました。表示する場合は「表示する」を押してください。`
    );
  }

  function generateStationNamesForNewTrain(stationCount) {
    const safeStationCount = clamp(
      Math.round(Number(stationCount) || 4),
      2,
      MAX_STATIONS
    );

    if (safeStationCount === 2) {
      return ["スタート", "ゴール"];
    }

    return Array.from({ length: safeStationCount }, (_, index) => {
      if (index === 0) return "スタート";
      if (index === safeStationCount - 1) return "ゴール";
      return `駅${index}`;
    });
  }

  function distributeMinutesAcrossSegments(totalMinutes, segmentCount) {
    const safeSegmentCount = Math.max(1, Math.round(Number(segmentCount) || 1));
    const safeTotalMinutes = Math.max(
      safeSegmentCount,
      Math.round(Number(totalMinutes) || safeSegmentCount)
    );
    const base = Math.floor(safeTotalMinutes / safeSegmentCount);
    let remainder = safeTotalMinutes % safeSegmentCount;

    return Array.from({ length: safeSegmentCount }, () => {
      const minutes = base + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      return minutes;
    });
  }

  function createNewTrainConfiguration({
    totalMinutes,
    stationCount,
    unitMinutes,
    trackShape
  }) {
    const safeUnitMinutes = sanitizeUnitMinutes(unitMinutes);
    const stationNames = generateStationNamesForNewTrain(stationCount);
    const segmentMinutes = distributeMinutesAcrossSegments(
      Math.max(
        Math.round(Number(totalMinutes) || 1),
        (stationNames.length - 1) * safeUnitMinutes
      ),
      stationNames.length - 1
    );
    const segmentUnits = segmentMinutes.map((minutes) =>
      Math.max(1, Math.floor(minutes / safeUnitMinutes))
    );
    const segmentExtraMinutes = segmentMinutes.map((minutes, index) =>
      Math.max(0, minutes - segmentUnits[index] * safeUnitMinutes)
    );

    return createConfigurationFromDefinition({
      unitMinutes: safeUnitMinutes,
      trackShape: normalizeTrackShape(trackShape),
      stationNames,
      segmentUnits,
      segmentExtraMinutes
    });
  }

  function createQuickRouteConfiguration(definition) {
    const stationNames = Array.isArray(definition.stationNames) && definition.stationNames.length >= 2
      ? definition.stationNames
      : generateStationNamesForNewTrain(definition.stationCount || 4);
    const safeUnitMinutes = sanitizeUnitMinutes(definition.unitMinutes || 1);
    const segmentMinutes = distributeMinutesAcrossSegments(
      definition.totalMinutes,
      stationNames.length - 1
    );
    const segmentUnits = segmentMinutes.map((minutes) =>
      Math.max(1, Math.floor(minutes / safeUnitMinutes))
    );
    const segmentExtraMinutes = segmentMinutes.map((minutes, index) =>
      Math.max(0, minutes - segmentUnits[index] * safeUnitMinutes)
    );

    return createConfigurationFromDefinition({
      unitMinutes: safeUnitMinutes,
      trackShape: normalizeTrackShape(definition.trackShape),
      stationNames,
      segmentUnits,
      segmentExtraMinutes
    });
  }

  function addQuickRouteTrain(routeKey) {
    const definition = QUICK_ROUTE_DEFINITIONS[routeKey];

    if (!definition) {
      setStatusMessage("追加する路線が見つかりませんでした。");
      return;
    }

    const trains = getTrainFleetForDisplay();
    if (trains.length >= MAX_ACTIVE_TRAINS) {
      setStatusMessage(
        `運行中の電車は${MAX_ACTIVE_TRAINS}本まで追加できます。使わない電車を削除してください。`
      );
      return;
    }

    const activeBeforeAdd = activeTrainId;
    const configurationForRoute = createQuickRouteConfiguration(definition);
    const newTrain = createTrainRecordFromConfiguration(configurationForRoute, {
      name: definition.name,
      status: TRAIN_STATUS.IDLE,
      remainingMs: calculateTotalMinutes(configurationForRoute) * 60 * 1000,
      soundSettings: getSoundSettingsForNewTrain(definition.sound)
    });

    syncActiveTrainToFleet();
    trainFleet.push(newTrain);
    trainFleet = trainFleet.slice(0, MAX_ACTIVE_TRAINS);

    if (trains.length === 0) {
      applyTrainRecordToMainTimer(newTrain, {
        announceMessage: `${newTrain.name}を追加し、タイマー画面に表示しました。`
      });
    } else {
      activeTrainId = activeBeforeAdd;
      saveAppData();
      renderPersistenceUi();
      setStatusMessage(
        `${newTrain.name}を運行中の電車に追加しました。表示する場合は「表示する」を押してください。`
      );
    }

    playActionSound();
  }

  function getSoundSettingsForNewTrain(value) {
    const base = normalizeTrainSoundSettings(storagePreferences);

    if (value === "silent") {
      return {
        ...base,
        soundEnabled: false,
        stationSoundEnabled: false,
        goalSoundEnabled: false,
        actionSoundEnabled: false,
        quietMode: true
      };
    }

    if (value === "goal-only") {
      return {
        ...base,
        soundEnabled: true,
        stationSoundEnabled: false,
        goalSoundEnabled: true,
        actionSoundEnabled: false,
        quietMode: false
      };
    }

    return base;
  }

  function setCreateTrainFormValues(values = {}) {
    if (elements.newTrainNameInput) {
      elements.newTrainNameInput.value = sanitizeTrainName(
        values.name,
        "勉強25分号"
      );
    }
    if (elements.newTrainTotalMinutesInput) {
      elements.newTrainTotalMinutesInput.value = String(
        clamp(Math.round(Number(values.totalMinutes) || 25), 1, 180)
      );
    }
    if (elements.newTrainStationCountInput) {
      elements.newTrainStationCountInput.value = String(
        clamp(Math.round(Number(values.stationCount) || 4), 2, MAX_STATIONS)
      );
    }
    if (elements.newTrainUnitMinutesInput) {
      elements.newTrainUnitMinutesInput.value = String(
        sanitizeUnitMinutes(values.unitMinutes || 5)
      );
    }
    if (elements.newTrainTrackShapeSelect) {
      elements.newTrainTrackShapeSelect.value = normalizeTrackShape(values.trackShape);
    }
    if (elements.newTrainSoundSelect) {
      elements.newTrainSoundSelect.value = ["default", "goal-only", "silent"].includes(values.sound)
        ? values.sound
        : "default";
    }

    updateCreateTrainPreview();
  }

  function getCreateTrainFormValues() {
    const stationCount = clamp(
      Math.round(Number(elements.newTrainStationCountInput?.value) || 4),
      2,
      MAX_STATIONS
    );
    const unitMinutes = sanitizeUnitMinutes(
      elements.newTrainUnitMinutesInput?.value || 5
    );
    const minimumTotalMinutes = (stationCount - 1) * unitMinutes;

    return {
      name: sanitizeTrainName(
        elements.newTrainNameInput?.value,
        getSuggestedTrainName()
      ),
      totalMinutes: clamp(
        Math.max(
          minimumTotalMinutes,
          Math.round(Number(elements.newTrainTotalMinutesInput?.value) || 25)
        ),
        1,
        180
      ),
      stationCount,
      unitMinutes,
      trackShape: normalizeTrackShape(elements.newTrainTrackShapeSelect?.value),
      sound: elements.newTrainSoundSelect?.value || "default",
      autoShow: Boolean(elements.newTrainAutoShowToggle?.checked)
    };
  }

  function updateCreateTrainPreview() {
    if (!elements.newTrainAutoPreview) {
      return;
    }

    const stationCount = clamp(
      Math.round(Number(elements.newTrainStationCountInput?.value) || 4),
      2,
      MAX_STATIONS
    );
    const unitMinutes = sanitizeUnitMinutes(
      elements.newTrainUnitMinutesInput?.value || 5
    );
    const minimumTotalMinutes = (stationCount - 1) * unitMinutes;
    const inputTotalMinutes = Math.round(
      Number(elements.newTrainTotalMinutesInput?.value) || 25
    );
    const totalMinutes = Math.max(inputTotalMinutes, minimumTotalMinutes);
    const stationNames = generateStationNamesForNewTrain(stationCount);
    const shapeLabel = getTrackShapeDetails(
      elements.newTrainTrackShapeSelect?.value
    ).label;
    const adjustment = inputTotalMinutes < minimumTotalMinutes
      ? `（${stationCount}駅では最短${minimumTotalMinutes}分のため自動調整）`
      : "";

    elements.newTrainAutoPreview.textContent =
      `${stationNames.join(" → ")}、${shapeLabel}線路、全体${totalMinutes}分で作成します。${adjustment}`;
  }

  function openCreateTrainPanel() {
    if (!elements.createTrainPanel) {
      return;
    }

    closeMenu(false);
    closeSettings(false);
    closeTimeAdditionDialog(false);
    focusState.createTrainTrigger = document.activeElement;

    setCreateTrainFormValues(NEW_TRAIN_EXAMPLES.study25);
    if (elements.newTrainAutoShowToggle) {
      elements.newTrainAutoShowToggle.checked = Boolean(
        storagePreferences.switchToNewTrainAfterCreate
      );
    }

    elements.createTrainPanel.classList.add("is-open");
    elements.createTrainPanel.setAttribute("aria-hidden", "false");
    showBackdrop(elements.createTrainBackdrop);
    setBodyPanelState();

    window.setTimeout(() => {
      elements.newTrainNameInput?.focus();
      elements.newTrainNameInput?.select?.();
    }, 0);
  }

  function closeCreateTrainPanel(restoreFocus = true) {
    if (!elements.createTrainPanel) {
      return;
    }

    elements.createTrainPanel.classList.remove("is-open");
    elements.createTrainPanel.setAttribute("aria-hidden", "true");
    hideBackdrop(elements.createTrainBackdrop);
    setBodyPanelState();

    if (restoreFocus) {
      const target = focusState.createTrainTrigger instanceof HTMLElement
        ? focusState.createTrainTrigger
        : elements.openCreateTrainButton;
      target?.focus?.();
    }
  }

  function handleCreateTrainExampleClick(event) {
    const button = event.target.closest("[data-example-train]");

    if (!button) {
      return;
    }

    const example = NEW_TRAIN_EXAMPLES[button.dataset.exampleTrain];
    if (!example) {
      return;
    }

    setCreateTrainFormValues(example);
    playActionSound();
  }

  function handleCreateTrainSubmit(event) {
    event.preventDefault();

    const trains = getTrainFleetForDisplay();
    if (trains.length >= MAX_ACTIVE_TRAINS) {
      setStatusMessage(
        `運行中の電車は${MAX_ACTIVE_TRAINS}本まで追加できます。使わない電車を削除してください。`
      );
      return;
    }

    const values = getCreateTrainFormValues();
    const newConfiguration = createNewTrainConfiguration(values);
    const newTrain = createTrainRecordFromConfiguration(newConfiguration, {
      name: values.name,
      status: TRAIN_STATUS.IDLE,
      remainingMs: calculateTotalMinutes(newConfiguration) * 60 * 1000,
      soundSettings: getSoundSettingsForNewTrain(values.sound)
    });

    storagePreferences.switchToNewTrainAfterCreate = values.autoShow;
    syncActiveTrainToFleet();
    trainFleet.push(newTrain);
    trainFleet = trainFleet.slice(0, MAX_ACTIVE_TRAINS);

    if (values.autoShow) {
      applyTrainRecordToMainTimer(newTrain, {
        announceMessage: `${newTrain.name}を追加し、タイマー画面に表示しました。`
      });
      showPage("timer", { focusTarget: elements.startButton });
    } else {
      saveAppData();
      renderPersistenceUi();
      setStatusMessage(
        `${newTrain.name}を運行中の電車に追加しました。表示する場合は「表示する」を押してください。`
      );
    }

    saveAppData();
    closeCreateTrainPanel(false);
  }

  function showTrainInMainTimer(trainId) {
    if (!trainId || trainId === activeTrainId) {
      return;
    }

    if (timer.state === TIMER_STATE.RUNNING) {
      timer.remainingMs = calculateRemainingFromClock();
    }

    syncActiveTrainToFleet();
    const targetTrain = trainFleet.find((train) => train.id === trainId);

    if (!targetTrain) {
      setStatusMessage("表示する電車が見つかりませんでした。");
      return;
    }

    applyTrainRecordToMainTimer(targetTrain, {
      announceMessage: `${targetTrain.name}をタイマー画面に表示しました。`
    });
    saveAppData();
    showPage("timer", { focusTarget: elements.startButton });
  }

  function startTrainById(trainId) {
    if (!trainId) {
      return;
    }

    if (trainId === activeTrainId) {
      startTimer();
      return;
    }

    const trains = getTrainFleetForDisplay();
    const train = trains.find((item) => item.id === trainId);

    if (!train) {
      setStatusMessage("開始する電車が見つかりませんでした。");
      return;
    }

    const totalMs = getTrainTotalMs(train);
    const remainingMs = train.status === TRAIN_STATUS.ARRIVED || train.remainingMs <= 0
      ? totalMs
      : clamp(train.remainingMs, 0, totalMs);
    const updatedTrain = {
      ...train,
      status: TRAIN_STATUS.RUNNING,
      remainingMs,
      endTimeMs: Date.now() + remainingMs,
      updatedAt: new Date().toISOString()
    };

    upsertTrainRecord(updatedTrain);
    playActionSound();
    saveAppData();
    renderPersistenceUi();
    ensureTrainFleetLoop();
    updateWakeLock();
    setStatusMessage(`${updatedTrain.name}を出発しました。`);
  }

  function pauseTrainById(trainId) {
    if (!trainId) {
      return;
    }

    if (trainId === activeTrainId) {
      pauseTimer();
      return;
    }

    const trains = getTrainFleetForDisplay();
    const train = trains.find((item) => item.id === trainId);

    if (!train) {
      setStatusMessage("一時停止する電車が見つかりませんでした。");
      return;
    }

    const updatedTrain = updateTrainRecordFromClock(train);

    if (updatedTrain.status === TRAIN_STATUS.RUNNING) {
      updatedTrain.status = TRAIN_STATUS.PAUSED;
      updatedTrain.endTimeMs = null;
      updatedTrain.updatedAt = new Date().toISOString();
    }

    upsertTrainRecord(updatedTrain);
    playActionSound();
    saveAppData();
    renderPersistenceUi();
    updateWakeLock();
    setStatusMessage(`${updatedTrain.name}を一時停止しました。`);
  }

  function restartTrainById(trainId) {
    if (!trainId) {
      return;
    }

    if (trainId === activeTrainId) {
      restartTimer();
      return;
    }

    const trains = getTrainFleetForDisplay();
    const train = trains.find((item) => item.id === trainId);

    if (!train) {
      setStatusMessage("はじめから走らせる電車が見つかりませんでした。");
      return;
    }

    const totalMs = getTrainTotalMs(train);
    const updatedTrain = {
      ...train,
      status: TRAIN_STATUS.RUNNING,
      remainingMs: totalMs,
      endTimeMs: Date.now() + totalMs,
      updatedAt: new Date().toISOString()
    };

    upsertTrainRecord(updatedTrain);
    playActionSound();
    saveAppData();
    renderPersistenceUi();
    ensureTrainFleetLoop();
    updateWakeLock();
    setStatusMessage(`${updatedTrain.name}をはじめから出発しました。`);
  }

  function deleteTrainFromFleet(trainId) {
    const trains = getTrainFleetForDisplay();
    const targetTrain = trains.find((train) => train.id === trainId);

    if (!targetTrain) {
      setStatusMessage("削除する電車が見つかりませんでした。");
      return;
    }

    const confirmed = window.confirm(
      `「${targetTrain.name}」を削除しますか？\nこの操作は元に戻せません。`
    );

    if (!confirmed) {
      return;
    }

    trainFleet = trains.filter((train) => train.id !== trainId);

    if (trainFleet.length === 0) {
      const fallbackConfiguration = createInitialConfiguration();
      const fallbackTrain = createTrainRecordFromConfiguration(
        fallbackConfiguration,
        {
          name: "いま見る電車",
          status: TRAIN_STATUS.IDLE
        }
      );
      trainFleet = [fallbackTrain];
      applyTrainRecordToMainTimer(fallbackTrain, {
        announceMessage: "最後の電車を削除したため、初期設定の電車を作成しました。"
      });
    } else if (trainId === activeTrainId) {
      applyTrainRecordToMainTimer(trainFleet[0], {
        announceMessage: `${targetTrain.name}を削除し、別の電車を表示しました。`
      });
    } else {
      renderPersistenceUi();
      setStatusMessage(`${targetTrain.name}を削除しました。`);
    }

    saveAppData();
  }

  function handleActiveTrainsListClick(event) {
    const button = event.target.closest("button[data-action][data-train-id]");

    if (!button) {
      return;
    }

    const { action, trainId } = button.dataset;

    if (action === "show-train") {
      showTrainInMainTimer(trainId);
    } else if (action === "start-train") {
      startTrainById(trainId);
    } else if (action === "pause-train") {
      pauseTrainById(trainId);
    } else if (action === "restart-train") {
      restartTrainById(trainId);
    } else if (action === "delete-train") {
      deleteTrainFromFleet(trainId);
    }
  }

  function getPresetById(presetId) {
    return presets.find((preset) => preset.id === presetId) || null;
  }

  function getPresetMetaText(preset) {
    const totalMinutes = calculateTotalMinutes(preset.configuration);
    const totalUnits = calculateTotalUnits(preset.configuration);
    const shape = getTrackShapeDetails(
      preset.configuration.trackShape
    ).label;

    return {
      time: `${totalMinutes}分`,
      units: `${totalUnits}単位`,
      stations: `${preset.configuration.stations.length}駅`,
      shape
    };
  }

  function createPresetBadge(text, className = "") {
    const badge = document.createElement("span");
    badge.className = `preset-badge ${className}`.trim();
    badge.textContent = text;
    return badge;
  }

  function createPresetActionButton({
    label,
    icon,
    action,
    presetId,
    className = ""
  }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      `preset-action-button ${className}`.trim();
    button.dataset.action = action;
    button.dataset.presetId = presetId;
    button.setAttribute("aria-label", label);
    button.innerHTML =
      `<span aria-hidden="true">${icon}</span><span>${label}</span>`;

    return button;
  }

  function renderPresetList() {
    if (!elements.presetList || !elements.presetCountText) {
      return;
    }

    elements.presetList.textContent = "";
    elements.presetCountText.textContent = `${presets.length}件`;

    if (presets.length === 0) {
      const empty = document.createElement("div");
      empty.className = "preset-empty-state";
      empty.innerHTML =
        "<strong>保存済みプリセットはありません</strong>" +
        "<span>上の入力欄に名前を付けて、現在の設定を保存できます。</span>";
      elements.presetList.append(empty);
      return;
    }

    presets.forEach((preset) => {
      const item = document.createElement("article");
      item.className = "preset-item";
      item.dataset.presetId = preset.id;

      if (preset.id === storagePreferences.defaultPresetId) {
        item.classList.add("is-default");
      }

      if (preset.id === storagePreferences.lastPresetId) {
        item.classList.add("is-last-used");
      }

      const heading = document.createElement("div");
      heading.className = "preset-item-heading";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "preset-name-input";
      nameInput.maxLength = MAX_PRESET_NAME_LENGTH;
      nameInput.value = preset.name;
      nameInput.dataset.action = "rename";
      nameInput.dataset.presetId = preset.id;
      nameInput.setAttribute(
        "aria-label",
        `${preset.name}のプリセット名を変更`
      );

      const badgeGroup = document.createElement("div");
      badgeGroup.className = "preset-badge-group";

      if (preset.isBuiltIn) {
        badgeGroup.append(
          createPresetBadge("初期", "preset-badge--initial")
        );
      }

      if (preset.id === storagePreferences.defaultPresetId) {
        badgeGroup.append(
          createPresetBadge(
            "デフォルト",
            "preset-badge--default"
          )
        );
      }

      if (preset.id === storagePreferences.lastPresetId) {
        badgeGroup.append(createPresetBadge("前回使用"));
      }

      heading.append(nameInput, badgeGroup);

      const metaValues = getPresetMetaText(preset);
      const meta = document.createElement("div");
      meta.className = "preset-meta";
      Object.values(metaValues).forEach((value) => {
        const span = document.createElement("span");
        span.textContent = value;
        meta.append(span);
      });

      const actions = document.createElement("div");
      actions.className = "preset-actions";
      actions.append(
        createPresetActionButton({
          label: "読み込む",
          icon: "▶",
          action: "load",
          presetId: preset.id,
          className: "preset-action-button--load"
        }),
        createPresetActionButton({
          label: "複製",
          icon: "⧉",
          action: "duplicate",
          presetId: preset.id
        }),
        createPresetActionButton({
          label:
            preset.id === storagePreferences.defaultPresetId
              ? "デフォルト解除"
              : "デフォルト",
          icon: "★",
          action: "default",
          presetId: preset.id
        }),
        createPresetActionButton({
          label: "削除",
          icon: "🗑️",
          action: "delete",
          presetId: preset.id,
          className: "preset-action-button--danger"
        })
      );

      item.append(heading, meta, actions);
      elements.presetList.append(item);
    });
  }

  function renderPersistenceUi() {
    renderActiveTrainsList();
    renderPresetList();
    updateStorageStatusDisplay();
  }

  function clearSessionTimeAdditionHistory() {
    timeAdditionHistory = [];
    lastUndoableAdditionId = null;
    renderTimeAdditionHistory();
  }

  function applyConfigurationAsNewStart(
    sourceConfiguration,
    options = {}
  ) {
    const {
      presetId = null,
      announceMessage = ""
    } = options;

    cancelTimerLoop();
    hideArrivalNotice();
    configuration = cloneConfiguration(sourceConfiguration);
    clearSessionTimeAdditionHistory();

    storagePreferences.lastPresetId = presetId;
    timer.initialDurationMs =
      calculateTotalMinutes(configuration) * 60 * 1000;
    timer.state = TIMER_STATE.IDLE;
    timer.remainingMs = timer.initialDurationMs;
    timer.endTimeMs = null;
    timer.lastRenderedSecond = null;
    timer.lastFrameTimeMs = 0;
    timer.lastReachedStationIndex = 0;
    timer.lastJourneyTextSecond = null;

    renderConfiguration();
    renderTimerState();
    renderRemainingTime(true);
    renderPersistenceUi();
    saveAppData();

    if (announceMessage) {
      showArrivalNotice(announceMessage);
      setStatusMessage(announceMessage);
    }
  }

  function saveCurrentAsPreset() {
    if (!elements.presetNameInput) {
      return;
    }

    if (presets.length >= MAX_PRESETS) {
      setStatusMessage(
        `プリセットは最大${MAX_PRESETS}件まで保存できます。`
      );
      return;
    }

    const name = sanitizePresetName(
      elements.presetNameInput.value,
      ""
    );

    if (!name) {
      setStatusMessage("プリセット名を入力してください。");
      elements.presetNameInput.focus();
      return;
    }

    const preset = createPresetRecord(name, configuration);
    presets.push(preset);
    storagePreferences.lastPresetId = preset.id;
    elements.presetNameInput.value = "";

    renderPersistenceUi();
    saveAppData();
    showArrivalNotice(`${preset.name}を保存しました`);
    setStatusMessage(
      `${preset.name}を新しいプリセットとして保存しました。`
    );
  }

  function loadPreset(presetId) {
    const preset = getPresetById(presetId);

    if (!preset) {
      setStatusMessage("プリセットが見つかりませんでした。");
      return;
    }

    applyConfigurationAsNewStart(preset.configuration, {
      presetId: preset.id,
      announceMessage:
        `${preset.name}を読み込み、開始前へ戻しました。`
    });
  }

  function duplicatePreset(presetId) {
    const original = getPresetById(presetId);

    if (!original) {
      return;
    }

    if (presets.length >= MAX_PRESETS) {
      setStatusMessage(
        `プリセットは最大${MAX_PRESETS}件まで保存できます。`
      );
      return;
    }

    let copyName = `${original.name}のコピー`;
    let suffix = 2;

    while (presets.some((preset) => preset.name === copyName)) {
      copyName = `${original.name}のコピー${suffix}`;
      suffix += 1;
    }

    const duplicate = createPresetRecord(
      copyName,
      original.configuration
    );
    presets.push(duplicate);
    storagePreferences.lastPresetId = duplicate.id;

    renderPersistenceUi();
    saveAppData();
    setStatusMessage(`${duplicate.name}を作成しました。`);
  }

  function renamePreset(presetId, rawName, inputElement) {
    const preset = getPresetById(presetId);

    if (!preset) {
      return;
    }

    const nextName = sanitizePresetName(rawName, preset.name);
    preset.name = nextName;
    preset.updatedAt = new Date().toISOString();

    if (inputElement) {
      inputElement.value = nextName;
      inputElement.setAttribute(
        "aria-label",
        `${nextName}のプリセット名を変更`
      );
    }

    saveAppData();
    setStatusMessage(
      `プリセット名を${nextName}に変更しました。`
    );
  }

  function deletePreset(presetId) {
    const preset = getPresetById(presetId);

    if (!preset) {
      return;
    }

    const confirmed = window.confirm(
      `「${preset.name}」を削除しますか？\nこの操作は元に戻せません。`
    );

    if (!confirmed) {
      return;
    }

    presets = presets.filter(
      (candidate) => candidate.id !== presetId
    );

    if (storagePreferences.defaultPresetId === presetId) {
      storagePreferences.defaultPresetId = null;
    }

    if (storagePreferences.lastPresetId === presetId) {
      storagePreferences.lastPresetId = null;
    }

    renderPersistenceUi();
    saveAppData();
    setStatusMessage(`${preset.name}を削除しました。`);
  }

  function toggleDefaultPreset(presetId) {
    const preset = getPresetById(presetId);

    if (!preset) {
      return;
    }

    if (storagePreferences.defaultPresetId === presetId) {
      storagePreferences.defaultPresetId = null;
      setStatusMessage(
        `${preset.name}のデフォルト設定を解除しました。`
      );
    } else {
      storagePreferences.defaultPresetId = presetId;
      setStatusMessage(
        `${preset.name}をデフォルトプリセットに設定しました。`
      );
    }

    renderPersistenceUi();
    saveAppData();
  }

  function getConfigurationForReset() {
    const defaultPreset = getPresetById(
      storagePreferences.defaultPresetId
    );

    return defaultPreset
      ? cloneConfiguration(defaultPreset.configuration)
      : createInitialConfiguration();
  }

  function resetCurrentSettings() {
    const defaultPreset = getPresetById(
      storagePreferences.defaultPresetId
    );
    const resetSourceName = defaultPreset
      ? `デフォルトプリセット「${defaultPreset.name}」`
      : "初期設定";
    const confirmed = window.confirm(
      `現在の設定を${resetSourceName}へ戻しますか？\n保存済みプリセットは削除されません。`
    );

    if (!confirmed) {
      return;
    }

    applyConfigurationAsNewStart(getConfigurationForReset(), {
      presetId: defaultPreset?.id ?? null,
      announceMessage:
        `現在の設定を${resetSourceName}へ戻しました。`
    });
  }

  function deleteAllPresets() {
    if (presets.length === 0) {
      setStatusMessage("削除するプリセットはありません。");
      return;
    }

    const confirmed = window.confirm(
      `保存済みプリセット${presets.length}件をすべて削除しますか？\n現在のタイマー設定は残ります。`
    );

    if (!confirmed) {
      return;
    }

    presets = [];
    storagePreferences = createDefaultStoragePreferences();
    renderPersistenceUi();
    saveAppData();
    setStatusMessage(
      "保存済みプリセットをすべて削除しました。"
    );
  }

  function resetEntireApp() {
    const confirmed = window.confirm(
      "アプリの保存データ、プリセット、現在の設定をすべて初期状態へ戻しますか？\nこの操作は元に戻せません。"
    );

    if (!confirmed) {
      return;
    }

    if (storageAvailable) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn("保存データの削除に失敗しました。", error);
      }
    }

    presets = createInitialPresets();
    storagePreferences = createDefaultStoragePreferences();
    lastSavedAt = null;
    storageRecoveryNotice = "";

    applyConfigurationAsNewStart(
      createInitialConfiguration(),
      {
        announceMessage:
          "アプリ全体を初期状態へ戻しました。"
      }
    );
  }

  function exportJsonData() {
    try {
      const payload = createStoragePayload();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const date = new Date()
        .toISOString()
        .slice(0, 10);

      anchor.href = url;
      anchor.download =
        `train-timer-backup-${date}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      setStatusMessage(
        "設定とプリセットをJSONファイルに書き出しました。"
      );
    } catch (error) {
      console.error("JSON書き出しに失敗しました。", error);
      setStatusMessage(
        "JSONファイルを書き出せませんでした。"
      );
    }
  }

  async function importJsonData(file) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = normalizeStoragePayload(parsed);
      const confirmed = window.confirm(
        `JSONファイルから現在設定とプリセット${normalized.presets.length}件を読み込みますか？\n現在の保存データは置き換わります。`
      );

      if (!confirmed) {
        return;
      }

      presets = normalized.presets;
      storagePreferences = {
        ...createDefaultStoragePreferences(),
        ...normalized.preferences
      };
      lastSavedAt = normalized.savedAt;
      storageRecoveryNotice = "";

      applyConfigurationAsNewStart(
        normalized.configuration,
        {
          presetId: normalized.preferences.lastPresetId,
          announceMessage:
            "JSONファイルから設定とプリセットを読み込みました。"
        }
      );
    } catch (error) {
      console.error("JSON読み込みに失敗しました。", error);
      setStatusMessage(
        `JSONファイルを読み込めませんでした。${error.message || "形式を確認してください。"}`
      );
    } finally {
      if (elements.importJsonInput) {
        elements.importJsonInput.value = "";
      }
    }
  }

  function handlePresetListClick(event) {
    const button = event.target.closest(
      "button[data-action][data-preset-id]"
    );

    if (!button) {
      return;
    }

    const { action, presetId } = button.dataset;

    if (action === "load") {
      loadPreset(presetId);
    } else if (action === "duplicate") {
      duplicatePreset(presetId);
    } else if (action === "default") {
      toggleDefaultPreset(presetId);
    } else if (action === "delete") {
      deletePreset(presetId);
    }
  }

  function handlePresetNameChange(event) {
    if (
      !(event.target instanceof HTMLInputElement) ||
      event.target.dataset.action !== "rename"
    ) {
      return;
    }

    renamePreset(
      event.target.dataset.presetId,
      event.target.value,
      event.target
    );
  }

  function scrollToPresets() {
    closeMenu(false);
    elements.presetSection?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    window.setTimeout(() => {
      elements.presetNameInput?.focus({
        preventScroll: true
      });
    }, 350);
  }


  function getEffectiveReduceMotion(preferences = storagePreferences) {
    return Boolean(
      preferences.reduceMotion ||
      preferences.quietMode ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function applyUserPreferences() {
    const preferences = normalizeUserPreferences(storagePreferences);
    Object.assign(storagePreferences, preferences);

    document.documentElement.dataset.fontSize = preferences.fontSize;
    elements.body?.classList.toggle(
      "is-high-contrast",
      preferences.highContrast
    );
    elements.body?.classList.toggle(
      "is-reduced-motion",
      getEffectiveReduceMotion(preferences)
    );
    elements.body?.classList.toggle(
      "is-quiet-mode",
      preferences.quietMode
    );
    renderChildLockOverlay();
    updateWakeLock();
    updateCircleRemainingTimeDisplay();
  }

  function renderPreferenceControls() {
    const preferences = normalizeUserPreferences(
      draftPreferences || storagePreferences
    );

    if (elements.soundToggle) {
      elements.soundToggle.checked = preferences.soundEnabled;
    }
    if (elements.stationSoundToggle) {
      elements.stationSoundToggle.checked = preferences.stationSoundEnabled;
    }
    if (elements.goalSoundToggle) {
      elements.goalSoundToggle.checked = preferences.goalSoundEnabled;
    }
    if (elements.actionSoundToggle) {
      elements.actionSoundToggle.checked = preferences.actionSoundEnabled;
    }
    if (elements.soundVolumeRange) {
      elements.soundVolumeRange.value = String(preferences.soundVolume);
    }
    if (elements.soundVolumeOutput) {
      elements.soundVolumeOutput.textContent = `${preferences.soundVolume}%`;
    }
    if (elements.quietModeToggle) {
      elements.quietModeToggle.checked = preferences.quietMode;
    }
    if (elements.childLockToggle) {
      elements.childLockToggle.checked = preferences.childLockEnabled;
    }
    if (elements.keepAwakeToggle) {
      elements.keepAwakeToggle.checked = preferences.keepAwakeEnabled;
    }
    if (elements.wakeLockSupportText) {
      elements.wakeLockSupportText.textContent = canUseWakeLock()
        ? "対応ブラウザでは、運転中に画面が暗くなりにくくなります。"
        : "端末やブラウザによっては、画面が暗くなることがあります。";
    }
    if (elements.fontSizeSelect) {
      elements.fontSizeSelect.value = preferences.fontSize;
    }
    if (elements.highContrastToggle) {
      elements.highContrastToggle.checked = preferences.highContrast;
    }
    if (elements.reduceMotionToggle) {
      elements.reduceMotionToggle.checked = preferences.reduceMotion;
    }
    if (elements.circleRemainingTimeToggle) {
      elements.circleRemainingTimeToggle.checked =
        preferences.showCircleRemainingTime;
    }
    if (elements.remainingTimeDisplayModeSelect) {
      elements.remainingTimeDisplayModeSelect.value =
        preferences.remainingTimeDisplayMode;
    }

    updateSoundControlAvailability(preferences);
  }

  function updateSoundControlAvailability(preferences = null) {
    const source = preferences || {
      soundEnabled: Boolean(elements.soundToggle?.checked),
      quietMode: Boolean(elements.quietModeToggle?.checked)
    };
    const detailsEnabled = source.soundEnabled && !source.quietMode;

    elements.soundDetailControls?.classList.toggle(
      "is-disabled",
      !detailsEnabled
    );
    [
      elements.stationSoundToggle,
      elements.goalSoundToggle,
      elements.actionSoundToggle,
      elements.soundVolumeRange
    ].forEach((control) => {
      if (control) control.disabled = !detailsEnabled;
    });
  }

  function isChildLockActive() {
    return Boolean(storagePreferences.childLockEnabled);
  }

  function renderChildLockOverlay() {
    const locked = isChildLockActive();

    elements.body?.classList.toggle("is-child-locked", locked);

    if (!elements.childLockOverlay) {
      return;
    }

    elements.childLockOverlay.hidden = !locked;
    elements.childLockOverlay.setAttribute("aria-hidden", locked ? "false" : "true");

    if (locked) {
      cancelUnlockHold();
      window.setTimeout(() => {
        elements.unlockHoldButton?.focus?.({ preventScroll: true });
      }, 0);
    }
  }

  function warnChildLockActive() {
    if (!isChildLockActive()) {
      return false;
    }

    setStatusMessage("画面ロック中です。3秒長押しで解除できます。");
    return true;
  }

  function startUnlockHold(event) {
    if (!isChildLockActive()) {
      return;
    }

    event?.preventDefault?.();
    cancelUnlockHold();
    unlockHoldStartMs = performance.now();

    if (elements.unlockProgressBar) {
      elements.unlockProgressBar.style.width = "0%";
    }

    const updateProgress = () => {
      const elapsedMs = performance.now() - unlockHoldStartMs;
      const progress = clamp(elapsedMs / 3000, 0, 1);

      if (elements.unlockProgressBar) {
        elements.unlockProgressBar.style.width = `${Math.round(progress * 100)}%`;
      }

      if (progress >= 1) {
        unlockChildLock();
        return;
      }

      unlockProgressFrameId = window.requestAnimationFrame(updateProgress);
    };

    unlockHoldTimerId = window.setTimeout(unlockChildLock, 3000);
    unlockProgressFrameId = window.requestAnimationFrame(updateProgress);
  }

  function cancelUnlockHold() {
    if (unlockHoldTimerId !== null) {
      window.clearTimeout(unlockHoldTimerId);
      unlockHoldTimerId = null;
    }

    if (unlockProgressFrameId !== null) {
      window.cancelAnimationFrame(unlockProgressFrameId);
      unlockProgressFrameId = null;
    }

    unlockHoldStartMs = 0;

    if (elements.unlockProgressBar) {
      elements.unlockProgressBar.style.width = "0%";
    }
  }

  function unlockChildLock() {
    cancelUnlockHold();
    storagePreferences.childLockEnabled = false;

    if (draftPreferences) {
      draftPreferences.childLockEnabled = false;
    }

    if (elements.childLockToggle) {
      elements.childLockToggle.checked = false;
    }

    applyUserPreferences();
    saveAppData();
    setStatusMessage("画面ロックを解除しました。");
  }

  function canUseWakeLock() {
    return typeof navigator !== "undefined" && "wakeLock" in navigator && typeof navigator.wakeLock?.request === "function";
  }

  async function requestScreenWakeLock() {
    if (!storagePreferences.keepAwakeEnabled || !hasAnyRunningTrain() || document.visibilityState !== "visible") {
      return;
    }

    if (!canUseWakeLock()) {
      if (elements.wakeLockSupportText) {
        elements.wakeLockSupportText.textContent = "端末やブラウザによっては、画面が暗くなることがあります。";
      }
      return;
    }

    if (wakeLock) {
      return;
    }

    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
      if (elements.wakeLockSupportText) {
        elements.wakeLockSupportText.textContent = "運転中は画面をつけたままにする準備ができています。";
      }
    } catch (error) {
      console.warn("Wake Lockを有効にできませんでした。", error);
      wakeLock = null;
      if (elements.wakeLockSupportText) {
        elements.wakeLockSupportText.textContent = "端末やブラウザによっては、画面が暗くなることがあります。";
      }
    }
  }

  async function releaseScreenWakeLock() {
    if (!wakeLock) {
      return;
    }

    try {
      await wakeLock.release();
    } catch (error) {
      console.warn("Wake Lockを解除できませんでした。", error);
    } finally {
      wakeLock = null;
    }
  }

  function updateWakeLock() {
    if (storagePreferences.keepAwakeEnabled && hasAnyRunningTrain()) {
      requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }
  }

  function readPreferenceControls() {
    return normalizeUserPreferences({
      soundEnabled: Boolean(elements.soundToggle?.checked),
      stationSoundEnabled: Boolean(elements.stationSoundToggle?.checked),
      goalSoundEnabled: Boolean(elements.goalSoundToggle?.checked),
      actionSoundEnabled: Boolean(elements.actionSoundToggle?.checked),
      soundVolume: Number(elements.soundVolumeRange?.value ?? 55),
      quietMode: Boolean(elements.quietModeToggle?.checked),
      childLockEnabled: Boolean(elements.childLockToggle?.checked),
      keepAwakeEnabled: Boolean(elements.keepAwakeToggle?.checked),
      fontSize: elements.fontSizeSelect?.value,
      highContrast: Boolean(elements.highContrastToggle?.checked),
      reduceMotion: Boolean(elements.reduceMotionToggle?.checked),
      showCircleRemainingTime: Boolean(
        elements.circleRemainingTimeToggle?.checked
      ),
      remainingTimeDisplayMode:
        elements.remainingTimeDisplayModeSelect?.value
    });
  }

  function ensureAudioContext() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return null;
    }

    if (!audioContext) {
      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextConstructor();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }

  function canPlaySound(category) {
    if (
      storagePreferences.quietMode ||
      !storagePreferences.soundEnabled ||
      storagePreferences.soundVolume <= 0
    ) {
      return false;
    }

    if (category === "station") return storagePreferences.stationSoundEnabled;
    if (category === "goal") return storagePreferences.goalSoundEnabled;
    if (category === "action") return storagePreferences.actionSoundEnabled;
    return true;
  }

  function playToneSequence(category) {
    if (!canPlaySound(category)) return;
    const context = ensureAudioContext();
    if (!context) return;

    const volume = clamp(storagePreferences.soundVolume / 100, 0, 1);
    const patterns = {
      action: [{ frequency: 520, start: 0, duration: 0.055 }],
      station: [
        { frequency: 660, start: 0, duration: 0.11 },
        { frequency: 880, start: 0.13, duration: 0.14 }
      ],
      goal: [
        { frequency: 523.25, start: 0, duration: 0.16 },
        { frequency: 659.25, start: 0.18, duration: 0.16 },
        { frequency: 783.99, start: 0.36, duration: 0.24 }
      ]
    };

    (patterns[category] || patterns.action).forEach((tone) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + tone.start;
      const endAt = startAt + tone.duration;

      oscillator.type = category === "goal" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(tone.frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, volume * 0.16),
        startAt + 0.015
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    });
  }

  function playActionSound() { playToneSequence("action"); }

  function updateNetworkStatus() {
    const online = navigator.onLine;
    if (elements.networkStatusBadge) {
      elements.networkStatusBadge.textContent = online ? "オンライン" : "オフライン";
      elements.networkStatusBadge.classList.toggle("is-offline", !online);
    }
    if (elements.pwaStatusText) {
      elements.pwaStatusText.textContent = online
        ? "一度読み込むと、通信がない環境でも基本機能を利用できます。"
        : "オフラインで動作しています。設定とタイマーはこの端末内で利用できます。";
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") {
      if (elements.pwaStatusText) {
        elements.pwaStatusText.textContent =
          "PWA機能はHTTPSまたはlocalhostで公開すると有効になります。";
      }
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(
        SERVICE_WORKER_URL,
        { scope: "./" }
      );
      await navigator.serviceWorker.ready;
      if (elements.pwaStatusText) {
        elements.pwaStatusText.textContent =
          "オフライン利用の準備ができました。ホーム画面への追加にも対応しています。";
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setStatusMessage(
              "新しいバージョンがあります。ページを再読み込みすると更新されます。"
            );
          }
        });
      });
    } catch (error) {
      console.warn("Service Workerを登録できませんでした。", error);
      if (elements.pwaStatusText) {
        elements.pwaStatusText.textContent =
          "オフライン機能を準備できませんでした。オンラインでは通常どおり使えます。";
      }
    }
  }

  async function installApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (elements.installAppButton) elements.installAppButton.hidden = true;
  }

  function scrollToSection(section, focusTarget = null) {
    closeMenu(false);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      (focusTarget || section)?.focus?.({ preventScroll: true });
    }, 350);
  }

  function isTypingTarget(target) {
    return target instanceof HTMLElement && Boolean(
      target.closest("input, textarea, select, [contenteditable='true']")
    );
  }

  function getOpenFocusContainer() {
    if (elements.timeAdditionDialog?.classList.contains("is-open")) {
      return elements.timeAdditionDialog;
    }
    if (elements.createTrainPanel?.classList.contains("is-open")) {
      return elements.createTrainPanel;
    }
    if (elements.settingsPanel?.classList.contains("is-open")) {
      return elements.settingsPanel;
    }
    if (elements.sideMenu?.classList.contains("is-open")) {
      return elements.sideMenu;
    }
    return null;
  }

  function trapFocus(event) {
    if (event.key !== "Tab") return false;
    const container = getOpenFocusContainer();
    if (!container) return false;
    const focusables = [...container.querySelectorAll(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
    )].filter((element) => !element.hidden && element.offsetParent !== null);
    if (!focusables.length) return false;
    const first = focusables[0];
    const last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function setStatusMessage(message) {
    if (!elements.statusMessage) {
      return;
    }

    elements.statusMessage.textContent = "";

    window.setTimeout(() => {
      elements.statusMessage.textContent = message;
    }, 20);
  }

  function renderRemainingTime(force = false) {
    if (!elements.remainingTime) {
      return;
    }

    const displayedSecond = Math.ceil(timer.remainingMs / 1000);

    if (!force && timer.lastRenderedSecond === displayedSecond) {
      return;
    }

    timer.lastRenderedSecond = displayedSecond;
    elements.remainingTime.textContent = formatDuration(timer.remainingMs);
    elements.remainingTime.setAttribute(
      "aria-label",
      formatAccessibleDuration(timer.remainingMs)
    );
    elements.remainingTime.classList.toggle(
      "is-finished",
      timer.state === TIMER_STATE.FINISHED
    );

    document.title = timer.state === TIMER_STATE.RUNNING
      ? `${formatDuration(timer.remainingMs)}｜でんしゃタイマー`
      : "でんしゃタイマー";

    if (activePageId === "presets") {
      renderActiveTrainsList();
    }
  }

  function getStatePresentation() {
    switch (timer.state) {
      case TIMER_STATE.RUNNING:
        return {
          visibleText: "運転中です",
          summaryText: "動作中",
          startText: "運転中",
          startIcon: "▶",
          startAriaLabel: "タイマーは動作中です"
        };
      case TIMER_STATE.PAUSED:
        return {
          visibleText: "いったん停車しています",
          summaryText: "一時停止中",
          startText: "つづきから",
          startIcon: "▶",
          startAriaLabel: "一時停止したところからタイマーを再開する"
        };
      case TIMER_STATE.FINISHED:
        return {
          visibleText: "ゴールしました",
          summaryText: "終了",
          startText: "はじめる",
          startIcon: "▶",
          startAriaLabel: "タイマーをはじめる"
        };
      case TIMER_STATE.IDLE:
      default:
        return {
          visibleText: "出発前です",
          summaryText: "開始前",
          startText: "はじめる",
          startIcon: "▶",
          startAriaLabel: "タイマーをはじめる"
        };
    }
  }

  function renderTimerState() {
    const presentation = getStatePresentation();

    elements.timerCard?.setAttribute("data-timer-state", timer.state);

    if (elements.timerStateText) {
      elements.timerStateText.textContent = presentation.visibleText;
    }

    if (elements.routeTimerStateText) {
      elements.routeTimerStateText.textContent = presentation.visibleText;
    }

    elements.routeTimePanel?.setAttribute("data-timer-state", timer.state);

    if (elements.timerStateSummary) {
      elements.timerStateSummary.textContent = presentation.summaryText;
    }

    if (elements.startButtonText) {
      elements.startButtonText.textContent = presentation.startText;
    }

    if (elements.startButtonIcon) {
      elements.startButtonIcon.textContent = presentation.startIcon;
    }

    const showStartButton =
      timer.state === TIMER_STATE.IDLE || timer.state === TIMER_STATE.PAUSED;
    const showPauseButton = timer.state === TIMER_STATE.RUNNING;
    const showStartOverButton = timer.state === TIMER_STATE.PAUSED;
    const showResetButton = false;

    if (elements.startButton) {
      elements.startButton.hidden = !showStartButton;
      elements.startButton.disabled = !showStartButton;
      elements.startButton.setAttribute("aria-label", presentation.startAriaLabel);
    }

    if (elements.startOverButton) {
      elements.startOverButton.hidden = !showStartOverButton;
      elements.startOverButton.disabled = !showStartOverButton;
    }

    elements.primaryControls?.classList.toggle(
      "is-resume-choice",
      showStartOverButton
    );

    if (elements.pauseButton) {
      elements.pauseButton.hidden = !showPauseButton;
      elements.pauseButton.disabled = !showPauseButton;
    }

    if (elements.resetButton) {
      elements.resetButton.hidden = !showResetButton;
      elements.resetButton.disabled = !showResetButton;
    }

    if (elements.completionPanel) {
      elements.completionPanel.hidden = timer.state !== TIMER_STATE.FINISHED;
    }

    renderRemainingTime(true);
  }

  function cancelTimerLoop() {
    if (timer.animationFrameId !== null) {
      window.cancelAnimationFrame(timer.animationFrameId);
      timer.animationFrameId = null;
    }
  }

  function calculateRemainingFromClock() {
    if (timer.state !== TIMER_STATE.RUNNING || timer.endTimeMs === null) {
      return timer.remainingMs;
    }

    return Math.max(0, timer.endTimeMs - Date.now());
  }

  function finishTimer() {
    cancelTimerLoop();
    timer.state = TIMER_STATE.FINISHED;
    timer.remainingMs = 0;
    timer.endTimeMs = null;
    timer.lastRenderedSecond = null;
    timer.lastJourneyTextSecond = null;
    timer.lastReachedStationIndex = configuration.stations.length - 1;
    renderTimerState();
    renderJourneyProgress({ forceText: true });
    syncDisplayedTimerToActiveTrain();
    renderPersistenceUi();
    saveAppData();
    updateWakeLock();
    showArrivalNotice("ゴールにつきました！");
    playGoalArrivalTone();
    setStatusMessage("ゴールにつきました。タイマーが終了しました。");

    window.setTimeout(() => {
      elements.restartButton?.focus();
    }, 0);
  }

  function timerLoop(frameTimeMs) {
    if (timer.state !== TIMER_STATE.RUNNING) {
      cancelTimerLoop();
      return;
    }

    timer.remainingMs = calculateRemainingFromClock();

    if (timer.remainingMs <= 0) {
      finishTimer();
      return;
    }

    renderJourneyProgress({ announceArrivals: true });

    if (
      frameTimeMs - timer.lastFrameTimeMs >= DISPLAY_UPDATE_INTERVAL_MS ||
      timer.lastFrameTimeMs === 0
    ) {
      timer.lastFrameTimeMs = frameTimeMs;
      renderRemainingTime();
      renderActiveTrainsList();
    }

    timer.animationFrameId = window.requestAnimationFrame(timerLoop);
  }

  function startTimer() {
    if (warnChildLockActive()) {
      return;
    }

    if (timer.state === TIMER_STATE.RUNNING) {
      return;
    }

    if (timer.state === TIMER_STATE.FINISHED || timer.remainingMs <= 0) {
      timer.remainingMs = timer.initialDurationMs;
      timer.lastReachedStationIndex = 0;
      timer.lastJourneyTextSecond = null;
      hideArrivalNotice();
    }

    ensureAudioContext();
    playActionSound();
    timer.state = TIMER_STATE.RUNNING;
    timer.endTimeMs = Date.now() + timer.remainingMs;
    timer.lastFrameTimeMs = 0;
    timer.lastRenderedSecond = null;
    renderTimerState();
    renderJourneyProgress({ forceText: true });
    syncDisplayedTimerToActiveTrain();
    renderPersistenceUi();
    saveAppData();
    updateWakeLock();
    setStatusMessage("タイマーを開始しました。");
    cancelTimerLoop();
    timer.animationFrameId = window.requestAnimationFrame(timerLoop);
    ensureTrainFleetLoop();
  }

  function pauseTimer() {
    if (warnChildLockActive()) {
      return;
    }

    if (timer.state !== TIMER_STATE.RUNNING) {
      return;
    }

    timer.remainingMs = calculateRemainingFromClock();

    if (timer.remainingMs <= 0) {
      finishTimer();
      return;
    }

    cancelTimerLoop();
    playActionSound();
    timer.state = TIMER_STATE.PAUSED;
    timer.endTimeMs = null;
    timer.lastRenderedSecond = null;
    timer.lastJourneyTextSecond = null;
    renderTimerState();
    renderJourneyProgress({ forceText: true });
    syncDisplayedTimerToActiveTrain();
    renderPersistenceUi();
    saveAppData();
    updateWakeLock();
    setStatusMessage(`タイマーを一時停止しました。${formatAccessibleDuration(timer.remainingMs)}です。`);
  }

  function requestResetTimer() {
    if (warnChildLockActive()) {
      return;
    }

    const hasProgress =
      timer.state !== TIMER_STATE.IDLE ||
      timer.remainingMs < timer.initialDurationMs;

    if (
      hasProgress &&
      !window.confirm("タイマーを最初に戻しますか？")
    ) {
      return;
    }

    playActionSound();
    resetTimer();
  }

  function resetTimer(options = {}) {
    const { announce = true } = options;

    cancelTimerLoop();
    timer.state = TIMER_STATE.IDLE;
    timer.remainingMs = timer.initialDurationMs;
    timer.endTimeMs = null;
    timer.lastRenderedSecond = null;
    timer.lastFrameTimeMs = 0;
    timer.lastReachedStationIndex = 0;
    timer.lastJourneyTextSecond = null;
    hideArrivalNotice();
    renderTimerState();
    renderJourneyProgress({ forceText: true });
    syncDisplayedTimerToActiveTrain();
    renderPersistenceUi();
    saveAppData();
    updateWakeLock();

    if (announce) {
      const totalMinutes = calculateTotalMinutes(configuration);
      setStatusMessage(`タイマーを${totalMinutes}分にリセットしました。`);
    }
  }

  function restartTimer() {
    if (warnChildLockActive()) {
      return;
    }

    resetTimer({ announce: false });
    startTimer();
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== "visible") {
      releaseScreenWakeLock();
      return;
    }

    updateWakeLock();

    if (timer.state !== TIMER_STATE.RUNNING) {
      return;
    }

    timer.remainingMs = calculateRemainingFromClock();

    if (timer.remainingMs <= 0) {
      finishTimer();
      return;
    }

    renderRemainingTime(true);
    renderJourneyProgress({
      announceArrivals: true,
      forceText: true
    });

    if (timer.animationFrameId === null) {
      timer.animationFrameId = window.requestAnimationFrame(timerLoop);
    }
  }

  function createStationContents(stationPoint) {
    const marker = document.createElement("span");
    marker.className = "station-marker";
    marker.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "station-label";

    const name = document.createElement("span");
    name.className = "station-name";
    name.textContent = stationPoint.name;

    const time = document.createElement("span");
    time.className = "station-time";
    time.textContent = `${Math.round(stationPoint.cumulativeMs / 60000)}分`;

    label.append(name, time);

    return { marker, label };
  }

  function applyStationStateClasses(item, stationPoint) {
    if (stationPoint.role === "start") {
      item.classList.add("station--start");
    }

    if (stationPoint.role === "goal") {
      item.classList.add("station--goal");
    }

    item.dataset.stationIndex = String(stationPoint.index);
    item.setAttribute(
      "aria-label",
      `${stationPoint.index + 1}番目の駅、${stationPoint.name}、開始から${Math.round(stationPoint.cumulativeMs / 60000)}分`
    );
  }

  function createHorizontalStation(stationPoint) {
    const item = document.createElement("li");
    item.className = "station";
    item.style.left =
      `calc(var(--rail-x-inset, 34px) + (100% - var(--rail-x-total-inset, 68px)) * ${stationPoint.positionPercent / 100})`;

    applyStationStateClasses(item, stationPoint);
    const { marker, label } = createStationContents(stationPoint);
    item.append(marker, label);

    return item;
  }

  function createVerticalStation(stationPoint) {
    const item = document.createElement("li");
    item.className = "station";
    item.style.top =
      `calc(var(--rail-y-start, 36px) + (100% - var(--rail-y-total-inset, 72px)) * ${stationPoint.positionPercent / 100})`;

    applyStationStateClasses(item, stationPoint);
    const { marker, label } = createStationContents(stationPoint);
    item.append(marker, label);

    return item;
  }

  function getCircleAngle(positionPercent) {
    const safePercent = clamp(positionPercent, 0, 100);
    return (
      CIRCLE_START_ANGLE_DEGREES +
      CIRCLE_TRAVEL_ANGLE_DEGREES * (safePercent / 100)
    );
  }

  function getCirclePoint(positionPercent, radiusPercent = 36) {
    const angleDegrees = getCircleAngle(positionPercent);
    const angleRadians = angleDegrees * Math.PI / 180;

    return {
      angleDegrees,
      x: 50 + radiusPercent * Math.cos(angleRadians),
      y: 50 + radiusPercent * Math.sin(angleRadians)
    };
  }

  function getSvgCirclePoint(radius, angleDegrees) {
    const angleRadians = angleDegrees * Math.PI / 180;

    return {
      x: CIRCLE_CENTER + radius * Math.cos(angleRadians),
      y: CIRCLE_CENTER + radius * Math.sin(angleRadians)
    };
  }

  function createCircleArcPath(radius, startPercent = 0, endPercent = 100) {
    const startAngle = getCircleAngle(startPercent);
    const endAngle = getCircleAngle(endPercent);
    const startPoint = getSvgCirclePoint(radius, startAngle);
    const endPoint = getSvgCirclePoint(radius, endAngle);
    const arcDegrees = Math.max(0, endAngle - startAngle);
    const largeArcFlag = arcDegrees > 180 ? 1 : 0;

    return [
      `M ${startPoint.x.toFixed(3)} ${startPoint.y.toFixed(3)}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x.toFixed(3)} ${endPoint.y.toFixed(3)}`
    ].join(" ");
  }

  function createCircleStation(stationPoint) {
    const item = document.createElement("li");
    item.className = "station";
    const point = getCirclePoint(stationPoint.positionPercent, 39);

    item.style.left = `${point.x}%`;
    item.style.top = `${point.y}%`;

    applyStationStateClasses(item, stationPoint);
    const { marker, label } = createStationContents(stationPoint);
    item.append(marker, label);

    return item;
  }

  function getSegmentUnitLabel(segmentPoint) {
    const extraMinutes = getSegmentExtraMinutes(segmentPoint);
    return extraMinutes > 0
      ? `${segmentPoint.units}単位＋${extraMinutes}分`
      : `${segmentPoint.units}単位`;
  }

  function getSegmentOverviewTimeLabel(segmentPoint) {
    const durationMinutes = Math.round(segmentPoint.durationMs / 60000);
    return `${getSegmentUnitLabel(segmentPoint)}・${durationMinutes}分`;
  }

  function createHorizontalSegment(segmentPoint) {
    const segment = document.createElement("div");
    segment.className = "track-segment is-future";
    segment.dataset.segmentIndex = String(segmentPoint.index);
    segment.style.left = `${segmentPoint.leftPercent}%`;
    segment.style.width = `${segmentPoint.widthPercent}%`;

    const label = document.createElement("span");
    label.className = "track-segment-unit-label";
    label.textContent = getSegmentUnitLabel(segmentPoint);
    segment.append(label);

    return segment;
  }

  function createVerticalSegment(segmentPoint) {
    const segment = document.createElement("div");
    segment.className = "track-segment is-future";
    segment.dataset.segmentIndex = String(segmentPoint.index);
    segment.style.top = `${segmentPoint.leftPercent}%`;
    segment.style.height = `${segmentPoint.widthPercent}%`;

    const label = document.createElement("span");
    label.className = "track-segment-unit-label";
    label.textContent = getSegmentUnitLabel(segmentPoint);
    segment.append(label);

    return segment;
  }

  function createCircleSegment(segmentPoint) {
    const startPercent = segmentPoint.leftPercent;
    const endPercent =
      segmentPoint.leftPercent + segmentPoint.widthPercent;
    const segment = createSvgElement("path", {
      class: "track-segment is-future",
      d: createCircleArcPath(
        CIRCLE_TRACK_RADIUS,
        startPercent,
        endPercent
      )
    });

    segment.dataset.segmentIndex = String(segmentPoint.index);

    return segment;
  }

  function createSegmentOverviewItem(segmentPoint) {
    const fromStation = getStationById(
      configuration,
      segmentPoint.fromStationId
    );
    const toStation = getStationById(
      configuration,
      segmentPoint.toStationId
    );

    if (!fromStation || !toStation) {
      return null;
    }

    const item = document.createElement("li");
    item.className = "segment-overview-item is-future";
    item.dataset.segmentIndex = String(segmentPoint.index);

    const route = document.createElement("span");
    route.className = "segment-overview-route";
    route.textContent = `${fromStation.name} → ${toStation.name}`;

    const time = document.createElement("span");
    time.className = "segment-overview-time";
    time.textContent = getSegmentOverviewTimeLabel(segmentPoint);

    item.append(route, time);
    return item;
  }

  function createTrainElement() {
    const train = document.createElement("div");
    train.className = "train-position";
    train.setAttribute("aria-hidden", "true");

    const emoji = document.createElement("span");
    emoji.className = "train-emoji";
    emoji.textContent = "🚃";

    train.append(emoji);
    return train;
  }

  function renderHorizontalTrack(timeline) {
    const track = elements.railwayTrack;
    if (!track) {
      return;
    }

    track.className = "railway-track railway-track--horizontal";
    track.dataset.trackShape = "horizontal";
    track.textContent = "";

    const bed = document.createElement("div");
    bed.className = "track-bed";
    bed.setAttribute("aria-hidden", "true");

    const segmentList = document.createElement("div");
    segmentList.className = "track-segment-list";
    segmentList.setAttribute("aria-hidden", "true");

    timeline.segments.forEach((segmentPoint) => {
      segmentList.append(createHorizontalSegment(segmentPoint));
    });

    const stationList = document.createElement("ol");
    stationList.className = "station-list";

    timeline.stations.forEach((stationPoint) => {
      stationList.append(createHorizontalStation(stationPoint));
    });

    track.append(
      bed,
      segmentList,
      stationList,
      createTrainElement()
    );
  }

  function renderVerticalTrack(timeline) {
    const track = elements.railwayTrack;
    if (!track) {
      return;
    }

    track.className = "railway-track railway-track--vertical";
    track.dataset.trackShape = "vertical";
    track.textContent = "";

    const bed = document.createElement("div");
    bed.className = "track-bed";
    bed.setAttribute("aria-hidden", "true");

    const segmentList = document.createElement("div");
    segmentList.className = "track-segment-list";
    segmentList.setAttribute("aria-hidden", "true");

    timeline.segments.forEach((segmentPoint) => {
      segmentList.append(createVerticalSegment(segmentPoint));
    });

    const stationList = document.createElement("ol");
    stationList.className = "station-list";

    timeline.stations.forEach((stationPoint) => {
      stationList.append(createVerticalStation(stationPoint));
    });

    track.append(
      bed,
      segmentList,
      stationList,
      createTrainElement()
    );
  }

  function renderCircleTrack(timeline) {
    const track = elements.railwayTrack;
    if (!track) {
      return;
    }

    track.className = "railway-track railway-track--circle";
    track.dataset.trackShape = "circle";
    track.textContent = "";

    const svg = createSvgElement("svg", {
      class: "circle-track-svg",
      viewBox: "0 0 320 320",
      "aria-hidden": "true",
      focusable: "false"
    });

    const outerRail = createSvgElement("path", {
      class: "circle-track-rail-outer",
      d: createCircleArcPath(119)
    });
    const base = createSvgElement("path", {
      class: "circle-track-base",
      d: createCircleArcPath(CIRCLE_TRACK_RADIUS)
    });
    const innerRail = createSvgElement("path", {
      class: "circle-track-rail-inner",
      d: createCircleArcPath(105)
    });
    const segmentList = createSvgElement("g", {
      class: "track-segment-list"
    });

    timeline.segments.forEach((segmentPoint) => {
      segmentList.append(createCircleSegment(segmentPoint));
    });

    svg.append(outerRail, base, innerRail, segmentList);

    const stationList = document.createElement("ol");
    stationList.className = "station-list";

    timeline.stations.forEach((stationPoint) => {
      stationList.append(createCircleStation(stationPoint));
    });

    track.append(svg);


    track.append(
      stationList,
      createTrainElement()
    );
  }

  function updateTrackShapeControls() {
    const shape = normalizeTrackShape(configuration.trackShape);
    const details = getTrackShapeDetails(shape);

    if (elements.railwayHeading) {
      elements.railwayHeading.textContent = details.heading;
    }

    if (elements.trackShapeBadge) {
      elements.trackShapeBadge.textContent = details.badge;
    }

    if (elements.summaryTrackShape) {
      elements.summaryTrackShape.textContent = details.label;
    }

    elements.trackShapeButtons?.forEach((button) => {
      const selected = button.dataset.trackShape === shape;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    if (elements.railwayPreview) {
      elements.railwayPreview.dataset.trackShape = shape;
      elements.railwayPreview.classList.remove(
        "railway-preview--horizontal",
        "railway-preview--vertical",
        "railway-preview--circle"
      );
      elements.railwayPreview.classList.add(`railway-preview--${shape}`);
    }
  }

  function renderRoutePreview() {
    if (!elements.railwayTrack || !elements.segmentOverviewList) {
      return;
    }

    elements.segmentOverviewList.textContent = "";

    const timeline = buildJourneyTimeline(configuration);
    const shape = normalizeTrackShape(configuration.trackShape);
    const stationCount = timeline.stations.length;

    elements.railwayPreview?.classList.toggle(
      "is-compact",
      stationCount > 6
    );

    if (shape === "vertical") {
      renderVerticalTrack(timeline);
    } else if (shape === "circle") {
      renderCircleTrack(timeline);
    } else {
      renderHorizontalTrack(timeline);
    }

    cacheDynamicTrackElements();

    timeline.segments.forEach((segmentPoint) => {
      const overviewItem = createSegmentOverviewItem(segmentPoint);

      if (overviewItem) {
        elements.segmentOverviewList.append(overviewItem);
      }
    });

    updateTrackShapeControls();

    const stationNames = configuration.stations
      .map((station) => station.name)
      .join("、");

    const shapeDetails = getTrackShapeDetails(shape);
    elements.railwayPreview?.setAttribute(
      "aria-label",
      `${shapeDetails.heading}。${stationNames}を結び、区間の長さは使用する単位数に比例します。`
    );
  }

  function renderConfigurationSummary() {
    const totalUnits = calculateTotalUnits(configuration);
    const totalMinutes = calculateTotalMinutes(configuration);
    const shapeDetails = getTrackShapeDetails(configuration.trackShape);

    if (elements.summaryDuration) {
      elements.summaryDuration.textContent = `${totalMinutes}分`;
    }

    if (elements.summaryUnitMinutes) {
      elements.summaryUnitMinutes.textContent = `${configuration.unitMinutes}分`;
    }

    if (elements.summaryTotalUnits) {
      elements.summaryTotalUnits.textContent = `${totalUnits}単位`;
    }

    if (elements.summaryStationCount) {
      elements.summaryStationCount.textContent = `${configuration.stations.length}駅`;
    }

    if (elements.summarySegmentCount) {
      elements.summarySegmentCount.textContent = `${configuration.segments.length}区間`;
    }

    if (elements.summaryTrackShape) {
      elements.summaryTrackShape.textContent = shapeDetails.label;
    }

    if (elements.summaryAddedMinutes) {
      elements.summaryAddedMinutes.textContent =
        `${calculateAddedMinutes(configuration)}分`;
    }

    if (elements.completionMessage) {
      elements.completionMessage.textContent = `${totalMinutes}分のタイマーが終わりました。`;
    }
  }

  function renderConfiguration() {
    renderRoutePreview();
    renderConfigurationSummary();
    timer.lastJourneyTextSecond = null;
    renderJourneyProgress({ forceText: true });
  }

  function switchTrackShape(shape, options = {}) {
    const normalizedShape = normalizeTrackShape(shape);
    const { announce = true } = options;

    if (configuration.trackShape === normalizedShape) {
      updateTrackShapeControls();
      return;
    }

    if (timer.state === TIMER_STATE.RUNNING) {
      timer.remainingMs = calculateRemainingFromClock();

      if (timer.remainingMs <= 0) {
        finishTimer();
        return;
      }
    }

    configuration.trackShape = normalizedShape;
    renderConfiguration();

    if (draftConfiguration) {
      draftConfiguration.trackShape = normalizedShape;
      renderDraftTrackShapeControls();
    }

    saveAppData();
    updateWakeLock();

    if (announce) {
      const details = getTrackShapeDetails(normalizedShape);
      setStatusMessage(`${details.heading}に切り替えました。残り時間と現在位置はそのままです。`);
    }
  }

  function findMatchingPreset(unitMinutes) {
    return UNIT_PRESETS.includes(unitMinutes) ? String(unitMinutes) : "custom";
  }

  function renderDraftUnitControls() {
    if (!draftConfiguration) {
      return;
    }

    if (elements.unitMinutesInput) {
      elements.unitMinutesInput.value = String(draftConfiguration.unitMinutes);
    }

    if (elements.unitPresetSelect) {
      elements.unitPresetSelect.value = findMatchingPreset(
        draftConfiguration.unitMinutes
      );
    }
  }

  function getStationRoleLabel(station) {
    if (station.role === "start") {
      return "スタート駅・削除できません";
    }

    if (station.role === "goal") {
      return "ゴール駅・削除できません";
    }

    return "中間駅";
  }

  function renderStationEditors() {
    if (!elements.stationEditorList || !draftConfiguration) {
      return;
    }

    elements.stationEditorList.textContent = "";

    draftConfiguration.stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = "station-editor-item";

      const indexBadge = document.createElement("span");
      indexBadge.className = "station-index";
      indexBadge.textContent = String(index + 1);
      indexBadge.setAttribute("aria-hidden", "true");

      const inputWrapper = document.createElement("div");

      const input = document.createElement("input");
      input.className = "station-name-input";
      input.type = "text";
      input.maxLength = 20;
      input.value = station.name;
      input.dataset.stationId = station.id;
      input.setAttribute("aria-label", `${index + 1}番目の駅名`);

      const role = document.createElement("span");
      role.className = "station-role";
      role.textContent = getStationRoleLabel(station);

      inputWrapper.append(input, role);
      item.append(indexBadge, inputWrapper);

      if (station.role === "normal") {
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-station-button";
        deleteButton.type = "button";
        deleteButton.dataset.action = "delete-station";
        deleteButton.dataset.stationId = station.id;
        deleteButton.setAttribute("aria-label", `${station.name}を削除する`);
        deleteButton.innerHTML = '<span aria-hidden="true">🗑️</span>';
        item.append(deleteButton);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "delete-station-placeholder";
        placeholder.setAttribute("aria-hidden", "true");
        item.append(placeholder);
      }

      elements.stationEditorList.append(item);
    });

    if (elements.addStationButton) {
      const maximumReached = draftConfiguration.stations.length >= MAX_STATIONS;
      elements.addStationButton.disabled = maximumReached;
      elements.addStationButton.setAttribute(
        "aria-label",
        maximumReached
          ? `駅は最大${MAX_STATIONS}駅です`
          : "ゴールの前に新しい駅を追加する"
      );
    }
  }

  function renderSegmentEditors() {
    if (!elements.segmentEditorList || !draftConfiguration) {
      return;
    }

    elements.segmentEditorList.textContent = "";

    draftConfiguration.segments.forEach((segment) => {
      const fromStation = getStationById(
        draftConfiguration,
        segment.fromStationId
      );
      const toStation = getStationById(
        draftConfiguration,
        segment.toStationId
      );

      if (!fromStation || !toStation) {
        return;
      }

      const item = document.createElement("div");
      item.className = "segment-editor-item";

      const route = document.createElement("p");
      route.className = "segment-route";
      route.textContent = `${fromStation.name} → ${toStation.name}`;

      const controlRow = document.createElement("div");
      controlRow.className = "segment-control-row";

      const minusButton = document.createElement("button");
      minusButton.className = "segment-step-button";
      minusButton.type = "button";
      minusButton.dataset.action = "decrease-segment";
      minusButton.dataset.segmentId = segment.id;
      minusButton.disabled = segment.units <= 1;
      minusButton.setAttribute(
        "aria-label",
        `${fromStation.name}から${toStation.name}までの単位数を1減らす`
      );
      minusButton.textContent = "−";

      const unitDisplay = document.createElement("div");
      unitDisplay.className = "segment-unit-display";

      const unitStrong = document.createElement("strong");
      unitStrong.textContent = `${segment.units}単位`;

      const unitDetail = document.createElement("span");
      unitDetail.textContent = `1単位 ${draftConfiguration.unitMinutes}分`;

      unitDisplay.append(unitStrong, unitDetail);

      const extraMinutes = getSegmentExtraMinutes(segment);
      if (extraMinutes > 0) {
        const extra = document.createElement("span");
        extra.className = "segment-extra-time";
        extra.textContent = `追加 ＋${extraMinutes}分`;
        unitDisplay.append(extra);
      }

      const plusButton = document.createElement("button");
      plusButton.className = "segment-step-button";
      plusButton.type = "button";
      plusButton.dataset.action = "increase-segment";
      plusButton.dataset.segmentId = segment.id;
      plusButton.setAttribute(
        "aria-label",
        `${fromStation.name}から${toStation.name}までの単位数を1増やす`
      );
      plusButton.textContent = "＋";

      const minutes = document.createElement("span");
      minutes.className = "segment-minutes";
      minutes.textContent =
        `${getSegmentDurationMinutes(draftConfiguration, segment)}分`;

      controlRow.append(minusButton, unitDisplay, plusButton, minutes);
      item.append(route, controlRow);
      elements.segmentEditorList.append(item);
    });
  }

  function renderDraftTotals() {
    if (!draftConfiguration) {
      return;
    }

    const totalUnits = calculateTotalUnits(draftConfiguration);
    const totalMinutes = calculateTotalMinutes(draftConfiguration);

    if (elements.draftTotalUnits) {
      elements.draftTotalUnits.textContent = `${totalUnits}単位`;
    }

    if (elements.draftTotalMinutes) {
      elements.draftTotalMinutes.textContent = `${totalMinutes}分`;
    }
  }

  function renderDraftTrackShapeControls() {
    if (!draftConfiguration) {
      return;
    }

    const shape = normalizeTrackShape(draftConfiguration.trackShape);

    elements.trackShapeRadios?.forEach((radio) => {
      radio.checked = radio.value === shape;
    });
  }

  function renderDraftEditors() {
    renderDraftUnitControls();
    renderStationEditors();
    renderSegmentEditors();
    renderDraftTotals();
    renderDraftTrackShapeControls();
  }

  function normalizeDraftConfiguration() {
    if (!draftConfiguration) {
      return;
    }

    draftConfiguration.unitMinutes = sanitizeUnitMinutes(
      draftConfiguration.unitMinutes
    );
    draftConfiguration.trackShape = normalizeTrackShape(
      draftConfiguration.trackShape
    );

    draftConfiguration.stations = draftConfiguration.stations.map(
      (station, index) => {
        let fallbackName = `駅${index}`;

        if (station.role === "start") {
          fallbackName = "スタート";
        } else if (station.role === "goal") {
          fallbackName = "ゴール";
        }

        return {
          ...station,
          name: sanitizeStationName(station.name, fallbackName)
        };
      }
    );

    draftConfiguration.segments = draftConfiguration.segments.map((segment) => ({
      ...segment,
      units: Math.max(1, Math.round(Number(segment.units) || 1)),
      extraMinutes: Math.max(
        0,
        Math.round(Number(segment.extraMinutes) || 0)
      )
    }));
  }

  function updateDraftUnitMinutes(value) {
    if (!draftConfiguration) {
      return;
    }

    draftConfiguration.unitMinutes = sanitizeUnitMinutes(value);
    renderDraftUnitControls();
    renderSegmentEditors();
    renderDraftTotals();
  }

  function addStationToDraft() {
    if (
      !draftConfiguration ||
      draftConfiguration.stations.length >= MAX_STATIONS
    ) {
      return;
    }

    const goalIndex = draftConfiguration.stations.length - 1;
    const goalStation = draftConfiguration.stations[goalIndex];
    const previousStation = draftConfiguration.stations[goalIndex - 1];
    const previousSegmentIndex = draftConfiguration.segments.findIndex(
      (segment) =>
        segment.fromStationId === previousStation.id &&
        segment.toStationId === goalStation.id
    );

    if (previousSegmentIndex < 0) {
      return;
    }

    const previousSegment = draftConfiguration.segments[previousSegmentIndex];
    const normalStationCount = draftConfiguration.stations.filter(
      (station) => station.role === "normal"
    ).length;
    const newStation = {
      id: createId("station"),
      name: `駅${normalStationCount + 1}`,
      role: "normal"
    };

    draftConfiguration.stations.splice(goalIndex, 0, newStation);

    const replacementSegments = [
      {
        id: previousSegment.id,
        fromStationId: previousStation.id,
        toStationId: newStation.id,
        units: previousSegment.units,
        extraMinutes: getSegmentExtraMinutes(previousSegment)
      },
      {
        id: createId("segment"),
        fromStationId: newStation.id,
        toStationId: goalStation.id,
        units: 1,
        extraMinutes: 0
      }
    ];

    draftConfiguration.segments.splice(
      previousSegmentIndex,
      1,
      ...replacementSegments
    );

    renderDraftEditors();
    setStatusMessage(`${newStation.name}を追加しました。`);
  }

  function deleteStationFromDraft(stationId) {
    if (!draftConfiguration) {
      return;
    }

    const stationIndex = draftConfiguration.stations.findIndex(
      (station) => station.id === stationId
    );
    const station = draftConfiguration.stations[stationIndex];

    if (!station || station.role !== "normal") {
      return;
    }

    const previousStation = draftConfiguration.stations[stationIndex - 1];
    const nextStation = draftConfiguration.stations[stationIndex + 1];
    const incomingIndex = draftConfiguration.segments.findIndex(
      (segment) =>
        segment.fromStationId === previousStation.id &&
        segment.toStationId === station.id
    );
    const outgoingIndex = draftConfiguration.segments.findIndex(
      (segment) =>
        segment.fromStationId === station.id &&
        segment.toStationId === nextStation.id
    );

    if (incomingIndex < 0 || outgoingIndex < 0) {
      return;
    }

    const incomingSegment = draftConfiguration.segments[incomingIndex];
    const outgoingSegment = draftConfiguration.segments[outgoingIndex];
    const firstIndex = Math.min(incomingIndex, outgoingIndex);

    draftConfiguration.stations.splice(stationIndex, 1);
    draftConfiguration.segments.splice(firstIndex, 2, {
      id: incomingSegment.id,
      fromStationId: previousStation.id,
      toStationId: nextStation.id,
      units: incomingSegment.units + outgoingSegment.units,
      extraMinutes:
        getSegmentExtraMinutes(incomingSegment) +
        getSegmentExtraMinutes(outgoingSegment)
    });

    renderDraftEditors();
    setStatusMessage(
      `${station.name}を削除し、前後の区間を結合しました。`
    );
  }

  function changeDraftSegmentUnits(segmentId, difference) {
    if (!draftConfiguration) {
      return;
    }

    const segment = draftConfiguration.segments.find(
      (candidate) => candidate.id === segmentId
    );

    if (!segment) {
      return;
    }

    segment.units = Math.max(1, segment.units + difference);
    renderSegmentEditors();
    renderDraftTotals();
  }

  function setBodyPanelState() {
    if (!elements.body) {
      return;
    }

    const menuIsOpen = elements.sideMenu?.classList.contains("is-open");
    const settingsIsOpen = elements.settingsPanel?.classList.contains("is-open");
    const createTrainIsOpen =
      elements.createTrainPanel?.classList.contains("is-open");
    const timeAdditionIsOpen =
      elements.timeAdditionDialog?.classList.contains("is-open");

    elements.body.classList.toggle(
      "panel-open",
      Boolean(menuIsOpen || settingsIsOpen || createTrainIsOpen || timeAdditionIsOpen)
    );
  }

  function showBackdrop(backdrop) {
    if (!backdrop) {
      return;
    }

    backdrop.hidden = false;

    window.requestAnimationFrame(() => {
      backdrop.classList.add("is-visible");
    });
  }

  function hideBackdrop(backdrop) {
    if (!backdrop) {
      return;
    }

    backdrop.classList.remove("is-visible");

    window.setTimeout(() => {
      if (!backdrop.classList.contains("is-visible")) {
        backdrop.hidden = true;
      }
    }, 190);
  }


  function synchronizeTimerWithClock() {
    if (timer.state !== TIMER_STATE.RUNNING) {
      return true;
    }

    timer.remainingMs = calculateRemainingFromClock();

    if (timer.remainingMs <= 0) {
      finishTimer();
      return false;
    }

    return true;
  }

  function getSegmentRouteLabel(source, segment) {
    const fromStation = getStationById(source, segment?.fromStationId);
    const toStation = getStationById(source, segment?.toStationId);

    return `${fromStation?.name ?? "駅"} → ${toStation?.name ?? "駅"}`;
  }

  function getAdditionTargetSegment(target, snapshot = getJourneySnapshot()) {
    if (target === ADDITION_TARGET.OVERALL) {
      return configuration.segments.at(-1) ?? null;
    }

    const index = snapshot.isFinished
      ? configuration.segments.length - 1
      : snapshot.currentSegmentIndex;

    return configuration.segments[index] ?? configuration.segments.at(-1) ?? null;
  }

  function getSelectedAdditionTarget() {
    return elements.additionTargetOverall?.checked
      ? ADDITION_TARGET.OVERALL
      : ADDITION_TARGET.CURRENT;
  }

  function animateTrainFromPreviousPosition(previousRect) {
    const train = elements.trainPosition;

    if (
      !train ||
      !previousRect ||
      typeof train.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const nextRect = train.getBoundingClientRect();
    const deltaX =
      previousRect.left + previousRect.width / 2 -
      (nextRect.left + nextRect.width / 2);
    const deltaY =
      previousRect.top + previousRect.height / 2 -
      (nextRect.top + nextRect.height / 2);

    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
      return;
    }

    timer.adjustmentAnimation?.cancel();
    train.classList.add("is-time-adjusting");
    timer.adjustmentAnimation = train.animate(
      [
        { translate: `${deltaX}px ${deltaY}px` },
        { translate: "0 0" }
      ],
      {
        duration: 360,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    );

    timer.adjustmentAnimation.addEventListener(
      "finish",
      () => {
        train.classList.remove("is-time-adjusting");
        timer.adjustmentAnimation = null;
      },
      { once: true }
    );
  }

  function formatHistoryTime(date) {
    return new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  }

  function renderTimeAdditionHistory() {
    if (
      !elements.timeAdditionHistoryCard ||
      !elements.timeAdditionHistoryList ||
      !elements.undoTimeAdditionButton
    ) {
      return;
    }

    const visibleHistory = timeAdditionHistory.slice(
      -MAX_TIME_ADDITION_HISTORY
    );

    elements.timeAdditionHistoryCard.hidden = visibleHistory.length === 0;
    elements.timeAdditionHistoryList.textContent = "";

    [...visibleHistory].reverse().forEach((record) => {
      const item = document.createElement("li");
      item.className = "time-addition-history-item";

      if (record.undone) {
        item.classList.add("is-undone");
      }

      const minutes = document.createElement("span");
      minutes.className = "time-addition-history-minutes";
      minutes.textContent = `＋${record.minutes}分`;

      const copy = document.createElement("span");
      copy.className = "time-addition-history-copy";

      const title = document.createElement("strong");
      title.textContent = record.segmentLabel;

      const detail = document.createElement("small");
      detail.textContent =
        `${record.targetLabel}・${formatHistoryTime(record.addedAt)}`;

      copy.append(title, detail);

      const status = document.createElement("span");
      status.className = "time-addition-history-status";
      status.textContent = record.undone ? "取り消し済み" : "追加済み";

      item.append(minutes, copy, status);
      elements.timeAdditionHistoryList.append(item);
    });

    const canUndo = Boolean(
      lastUndoableAdditionId &&
      timeAdditionHistory.some(
        (record) =>
          record.id === lastUndoableAdditionId &&
          !record.undone &&
          configuration.segments.some(
            (segment) => segment.id === record.segmentId
          )
      )
    );

    elements.undoTimeAdditionButton.disabled = !canUndo;
    elements.undoTimeAdditionButton.setAttribute(
      "aria-label",
      canUndo
        ? "直前の時間追加を取り消す"
        : "取り消せる時間追加はありません"
    );
  }

  function invalidateTimeAdditionUndo() {
    lastUndoableAdditionId = null;
    renderTimeAdditionHistory();
  }

  function openTimeAdditionDialog(minutes, triggerElement) {
    if (warnChildLockActive()) {
      return;
    }

    if (
      !elements.timeAdditionDialog ||
      !elements.timeAdditionDialogTitle ||
      !elements.confirmTimeAdditionButton
    ) {
      return;
    }

    if (!synchronizeTimerWithClock()) {
      return;
    }

    closeMenu(false);
    closeSettings(false);
    closeCreateTrainPanel(false);

    pendingAdditionMinutes = minutes;
    focusState.timeAdditionTrigger =
      triggerElement instanceof HTMLElement
        ? triggerElement
        : document.activeElement;

    const snapshot = getJourneySnapshot();
    const currentSegment = getAdditionTargetSegment(
      ADDITION_TARGET.CURRENT,
      snapshot
    );
    const lastSegment = getAdditionTargetSegment(
      ADDITION_TARGET.OVERALL,
      snapshot
    );

    elements.timeAdditionDialogTitle.textContent =
      `＋${minutes}分を追加します`;

    if (elements.currentAdditionTargetLabel) {
      elements.currentAdditionTargetLabel.textContent =
        `${getSegmentRouteLabel(configuration, currentSegment)}に追加します`;
    }

    if (elements.overallAdditionTargetLabel) {
      elements.overallAdditionTargetLabel.textContent =
        `${getSegmentRouteLabel(configuration, lastSegment)}を延長します`;
    }

    if (elements.additionTargetCurrent) {
      elements.additionTargetCurrent.checked = true;
    }

    if (elements.additionTargetOverall) {
      elements.additionTargetOverall.checked = false;
    }

    const isFinished = timer.state === TIMER_STATE.FINISHED;

    if (elements.finishedRestartNotice) {
      elements.finishedRestartNotice.hidden = !isFinished;
    }

    elements.confirmTimeAdditionButton.textContent =
      isFinished ? "追加して再開" : "追加する";
    elements.confirmTimeAdditionButton.setAttribute(
      "aria-label",
      isFinished
        ? `${minutes}分追加してタイマーを再開する`
        : `${minutes}分追加する`
    );

    elements.timeAdditionDialog.classList.add("is-open");
    elements.timeAdditionDialog.setAttribute("aria-hidden", "false");
    showBackdrop(elements.timeAdditionBackdrop);
    setBodyPanelState();

    window.setTimeout(() => {
      elements.additionTargetCurrent?.focus();
    }, 0);
  }

  function closeTimeAdditionDialog(restoreFocus = true) {
    if (!elements.timeAdditionDialog) {
      return;
    }

    elements.timeAdditionDialog.classList.remove("is-open");
    elements.timeAdditionDialog.setAttribute("aria-hidden", "true");
    hideBackdrop(elements.timeAdditionBackdrop);
    setBodyPanelState();
    pendingAdditionMinutes = 0;

    if (restoreFocus) {
      const target =
        focusState.timeAdditionTrigger instanceof HTMLElement
          ? focusState.timeAdditionTrigger
          : elements.addOneMinuteButton;
      target?.focus();
    }
  }

  function applyTimeAddition() {
    if (warnChildLockActive()) {
      closeTimeAdditionDialog(false);
      return;
    }

    const minutes = Math.round(Number(pendingAdditionMinutes) || 0);

    if (minutes <= 0 || !synchronizeTimerWithClock()) {
      return;
    }

    const target = getSelectedAdditionTarget();
    const snapshotBefore = getJourneySnapshot();
    const targetSegment = getAdditionTargetSegment(target, snapshotBefore);

    if (!targetSegment) {
      setStatusMessage("時間を追加する区間が見つかりませんでした。");
      return;
    }

    const previousTrainRect =
      elements.trainPosition?.getBoundingClientRect() ?? null;
    const stateBefore = timer.state;
    const addedMilliseconds = minutes * 60 * 1000;

    targetSegment.extraMinutes =
      getSegmentExtraMinutes(targetSegment) + minutes;

    const totalMilliseconds =
      calculateTotalMinutes(configuration) * 60 * 1000;

    timer.initialDurationMs = totalMilliseconds;

    if (stateBefore === TIMER_STATE.IDLE) {
      timer.remainingMs = totalMilliseconds;
    } else {
      timer.remainingMs += addedMilliseconds;
    }

    if (stateBefore === TIMER_STATE.RUNNING) {
      timer.endTimeMs = Date.now() + timer.remainingMs;
    }

    if (stateBefore === TIMER_STATE.RUNNING) {
      cancelTimerLoop();
    }

    if (stateBefore === TIMER_STATE.FINISHED) {
      timer.state = TIMER_STATE.RUNNING;
      timer.remainingMs = addedMilliseconds;
      timer.endTimeMs = Date.now() + timer.remainingMs;
      timer.lastReachedStationIndex =
        Math.max(0, configuration.stations.length - 2);
      cancelTimerLoop();
    }

    timer.lastRenderedSecond = null;
    timer.lastJourneyTextSecond = null;

    const segmentLabel = getSegmentRouteLabel(
      configuration,
      targetSegment
    );
    const record = {
      id: createId("addition"),
      minutes,
      target,
      targetLabel:
        target === ADDITION_TARGET.CURRENT
          ? "現在の区間"
          : "全体時間",
      segmentId: targetSegment.id,
      segmentLabel,
      addedAt: new Date(),
      undone: false
    };

    timeAdditionHistory.push(record);
    lastUndoableAdditionId = record.id;

    renderConfiguration();
    renderTimerState();
    renderRemainingTime(true);
    renderTimeAdditionHistory();
    renderPersistenceUi();
    saveAppData();
    animateTrainFromPreviousPosition(previousTrainRect);

    const message =
      target === ADDITION_TARGET.CURRENT
        ? `${segmentLabel}に${minutes}分追加しました。`
        : `全体時間に${minutes}分追加し、${segmentLabel}を延長しました。`;

    playActionSound();
    showArrivalNotice(message);
    setStatusMessage(`${message}残り時間が${minutes}分増えました。`);
    closeTimeAdditionDialog(false);

    if (timer.state === TIMER_STATE.RUNNING) {
      timer.animationFrameId = window.requestAnimationFrame(timerLoop);
    }

    window.setTimeout(() => {
      const trigger =
        focusState.timeAdditionTrigger instanceof HTMLElement
          ? focusState.timeAdditionTrigger
          : elements.addOneMinuteButton;
      trigger?.focus();
    }, 0);
  }

  function undoLastTimeAddition() {
    if (!lastUndoableAdditionId || !synchronizeTimerWithClock()) {
      return;
    }

    const record = timeAdditionHistory.find(
      (candidate) =>
        candidate.id === lastUndoableAdditionId && !candidate.undone
    );

    if (!record) {
      invalidateTimeAdditionUndo();
      return;
    }

    const segment = configuration.segments.find(
      (candidate) => candidate.id === record.segmentId
    );

    if (!segment) {
      invalidateTimeAdditionUndo();
      setStatusMessage(
        "区間の設定が変更されているため、時間追加を取り消せませんでした。"
      );
      return;
    }

    const previousTrainRect =
      elements.trainPosition?.getBoundingClientRect() ?? null;
    const wasRunning = timer.state === TIMER_STATE.RUNNING;

    if (wasRunning) {
      cancelTimerLoop();
    }

    const oldTotalMilliseconds =
      calculateTotalMinutes(configuration) * 60 * 1000;
    const elapsedMilliseconds =
      timer.state === TIMER_STATE.IDLE
        ? 0
        : clamp(
            oldTotalMilliseconds - timer.remainingMs,
            0,
            oldTotalMilliseconds
          );

    segment.extraMinutes = Math.max(
      0,
      getSegmentExtraMinutes(segment) - record.minutes
    );

    const newTotalMilliseconds =
      calculateTotalMinutes(configuration) * 60 * 1000;
    timer.initialDurationMs = newTotalMilliseconds;

    if (timer.state === TIMER_STATE.IDLE) {
      timer.remainingMs = newTotalMilliseconds;
    } else {
      timer.remainingMs = Math.max(
        0,
        newTotalMilliseconds - elapsedMilliseconds
      );
    }

    if (timer.state === TIMER_STATE.RUNNING) {
      timer.endTimeMs = Date.now() + timer.remainingMs;
    }

    record.undone = true;
    lastUndoableAdditionId = null;
    timer.lastRenderedSecond = null;
    timer.lastJourneyTextSecond = null;

    if (
      timer.state !== TIMER_STATE.IDLE &&
      timer.remainingMs <= 0
    ) {
      renderConfiguration();
      renderTimeAdditionHistory();
      finishTimer();
      setStatusMessage(
        `直前の＋${record.minutes}分を取り消したため、タイマーはゴールしました。`
      );
      return;
    }

    renderConfiguration();
    renderTimerState();
    renderRemainingTime(true);
    renderTimeAdditionHistory();
    renderPersistenceUi();
    saveAppData();
    animateTrainFromPreviousPosition(previousTrainRect);

    playActionSound();
    showArrivalNotice(`＋${record.minutes}分を取り消しました`);
    setStatusMessage(
      `${record.segmentLabel}への＋${record.minutes}分を取り消しました。`
    );

    if (wasRunning) {
      timer.animationFrameId = window.requestAnimationFrame(timerLoop);
    }
  }

  function openMenu() {
    if (!elements.sideMenu || !elements.menuButton) {
      return;
    }

    closeSettings(false);
    closeTimeAdditionDialog(false);
    closeCreateTrainPanel(false);
    focusState.menuTrigger = document.activeElement;

    elements.sideMenu.classList.add("is-open");
    elements.sideMenu.setAttribute("aria-hidden", "false");
    elements.menuButton.setAttribute("aria-expanded", "true");
    showBackdrop(elements.menuBackdrop);
    setBodyPanelState();

    window.setTimeout(() => {
      elements.closeMenuButton?.focus();
    }, 0);
  }

  function closeMenu(restoreFocus = true) {
    if (!elements.sideMenu || !elements.menuButton) {
      return;
    }

    elements.sideMenu.classList.remove("is-open");
    elements.sideMenu.setAttribute("aria-hidden", "true");
    elements.menuButton.setAttribute("aria-expanded", "false");
    hideBackdrop(elements.menuBackdrop);
    setBodyPanelState();

    if (restoreFocus) {
      const target = focusState.menuTrigger instanceof HTMLElement
        ? focusState.menuTrigger
        : elements.menuButton;
      target.focus();
    }
  }

  function openSettings() {
    if (!elements.settingsPanel || !elements.settingsButton) {
      return;
    }

    closeMenu(false);
    closeTimeAdditionDialog(false);
    closeCreateTrainPanel(false);
    focusState.settingsTrigger = document.activeElement;
    draftPreferences = { ...storagePreferences };
    renderPreferenceControls();

    elements.settingsPanel.classList.add("is-open");
    elements.settingsPanel.setAttribute("aria-hidden", "false");
    elements.settingsButton.setAttribute("aria-expanded", "true");
    elements.mobileSettingsButton?.setAttribute("aria-expanded", "true");
    setMobileNavigationActive("settings");
    showBackdrop(elements.settingsBackdrop);
    setBodyPanelState();

    window.setTimeout(() => {
      elements.closeSettingsButton?.focus();
    }, 0);
  }

  function closeSettings(restoreFocus = true) {
    if (!elements.settingsPanel || !elements.settingsButton) {
      return;
    }

    elements.settingsPanel.classList.remove("is-open");
    elements.settingsPanel.setAttribute("aria-hidden", "true");
    elements.settingsButton.setAttribute("aria-expanded", "false");
    elements.mobileSettingsButton?.setAttribute("aria-expanded", "false");
    hideBackdrop(elements.settingsBackdrop);
    setBodyPanelState();
    draftPreferences = null;
    applyUserPreferences();

    if (restoreFocus) {
      const target = focusState.settingsTrigger instanceof HTMLElement
        ? focusState.settingsTrigger
        : elements.settingsButton;
      target.focus();
    }
  }

  function applyDraftConfiguration() {
    if (!draftConfiguration) {
      return false;
    }

    normalizeDraftConfiguration();

    if (
      draftConfiguration.stations.length < 2 ||
      draftConfiguration.segments.length !== draftConfiguration.stations.length - 1
    ) {
      setStatusMessage("駅と区間の設定を確認してください。");
      return false;
    }

    if (timer.state === TIMER_STATE.RUNNING) {
      timer.remainingMs = calculateRemainingFromClock();

      if (timer.remainingMs <= 0) {
        finishTimer();
        return false;
      }
    }

    const timingChanged =
      getTimingSignature(configuration) !==
      getTimingSignature(draftConfiguration);
    const previousState = timer.state;
    const previousEndTimeMs = timer.endTimeMs;
    const previousRemainingMs = timer.remainingMs;

    configuration = cloneConfiguration(draftConfiguration);
    const totalMinutes = calculateTotalMinutes(configuration);

    if (timingChanged) {
      invalidateTimeAdditionUndo();
      timer.initialDurationMs = totalMinutes * 60 * 1000;
      resetTimer({ announce: false });
      renderConfiguration();
      setStatusMessage(
        `設定を反映しました。時間構成が変わったため、合計${totalMinutes}分でスタートへ戻りました。`
      );
    } else {
      timer.initialDurationMs = totalMinutes * 60 * 1000;
      timer.state = previousState;
      timer.remainingMs = previousRemainingMs;
      timer.endTimeMs = previousEndTimeMs;
      renderConfiguration();
      renderTimerState();

      const shapeDetails = getTrackShapeDetails(configuration.trackShape);
      setStatusMessage(
        `${shapeDetails.heading}と駅名の設定を反映しました。残り時間と現在位置は維持しています。`
      );
    }

    renderPersistenceUi();
    saveAppData();

    return true;
  }

  function prepareRouteEditor() {
    draftConfiguration = cloneConfiguration(configuration);
    renderDraftEditors();
  }

  function resetRouteEditor() {
    prepareRouteEditor();
    setStatusMessage("未保存の経路変更を取り消しました。");
  }

  function handleRouteEditorSubmit(event) {
    event.preventDefault();

    if (applyDraftConfiguration()) {
      prepareRouteEditor();
      showArrivalNotice("経路の変更を反映しました");
    }
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();

    Object.assign(storagePreferences, readPreferenceControls());
    applyUserPreferences();
    renderPersistenceUi();
    saveAppData();
    setStatusMessage("表示・音・操作・画面ロックの設定を保存しました。");
    closeSettings();
  }

  function handleUnitPresetChange(event) {
    const selectedValue = event.target.value;

    if (selectedValue === "custom") {
      elements.unitMinutesInput?.focus();
      return;
    }

    updateDraftUnitMinutes(selectedValue);
  }

  function handleUnitMinutesInput(event) {
    if (!draftConfiguration) {
      return;
    }

    const rawValue = event.target.value;

    if (rawValue === "") {
      return;
    }

    updateDraftUnitMinutes(rawValue);
  }

  function handleUnitMinutesBlur(event) {
    updateDraftUnitMinutes(event.target.value);
  }

  function handleStationEditorInput(event) {
    if (
      !(event.target instanceof HTMLInputElement) ||
      !event.target.matches(".station-name-input") ||
      !draftConfiguration
    ) {
      return;
    }

    const station = getStationById(
      draftConfiguration,
      event.target.dataset.stationId
    );

    if (!station) {
      return;
    }

    station.name = event.target.value.slice(0, 20);
    renderSegmentEditors();
  }

  function handleStationEditorBlur(event) {
    if (
      !(event.target instanceof HTMLInputElement) ||
      !event.target.matches(".station-name-input") ||
      !draftConfiguration
    ) {
      return;
    }

    const station = getStationById(
      draftConfiguration,
      event.target.dataset.stationId
    );

    if (!station) {
      return;
    }

    const index = draftConfiguration.stations.findIndex(
      (candidate) => candidate.id === station.id
    );
    let fallbackName = `駅${index}`;

    if (station.role === "start") {
      fallbackName = "スタート";
    } else if (station.role === "goal") {
      fallbackName = "ゴール";
    }

    station.name = sanitizeStationName(event.target.value, fallbackName);
    event.target.value = station.name;
    renderSegmentEditors();
  }

  function handleStationEditorClick(event) {
    const button = event.target.closest("button[data-action='delete-station']");

    if (!button) {
      return;
    }

    deleteStationFromDraft(button.dataset.stationId);
  }

  function handleSegmentEditorClick(event) {
    const button = event.target.closest("button[data-action]");

    if (!button) {
      return;
    }

    if (button.dataset.action === "decrease-segment") {
      changeDraftSegmentUnits(button.dataset.segmentId, -1);
    }

    if (button.dataset.action === "increase-segment") {
      changeDraftSegmentUnits(button.dataset.segmentId, 1);
    }
  }

  function handleTrackShapeButtonClick(event) {
    const button = event.target.closest("button[data-track-shape]");

    if (!button) {
      return;
    }

    switchTrackShape(button.dataset.trackShape);
  }

  function handleTrackShapeRadioChange(event) {
    if (
      !(event.target instanceof HTMLInputElement) ||
      event.target.name !== "trackShape" ||
      !draftConfiguration
    ) {
      return;
    }

    draftConfiguration.trackShape = normalizeTrackShape(event.target.value);
  }

  function handlePreferencePreviewChange() {
    if (elements.soundVolumeOutput && elements.soundVolumeRange) {
      elements.soundVolumeOutput.textContent =
        `${elements.soundVolumeRange.value}%`;
    }

    if (draftPreferences) {
      draftPreferences = {
        ...draftPreferences,
        ...readPreferenceControls()
      };
    }

    updateCircleRemainingTimeDisplay(getJourneySnapshot());

    updateSoundControlAvailability();
  }

  function toggleSoundFromKeyboard() {
    storagePreferences.soundEnabled = !storagePreferences.soundEnabled;
    applyUserPreferences();
    saveAppData();
    setStatusMessage(
      storagePreferences.soundEnabled ? "音をオンにしました。" : "音をオフにしました。"
    );
  }

  function handleViewportChange() {
    renderJourneyProgress({ forceText: true });
  }

  function normalizePageId(value) {
    return ["timer", "edit", "presets", "settings"].includes(value)
      ? value
      : "timer";
  }

  function setMobileNavigationActive(targetId) {
    const pageId = normalizePageId(targetId);
    const items = document.querySelectorAll("[data-page-target]");

    items.forEach((item) => {
      const isActive = item.dataset.pageTarget === pageId;
      item.classList.toggle("is-active", isActive);

      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  }

  function showPage(pageId, options = {}) {
    const targetPageId = normalizePageId(pageId);
    const shouldScroll = options.scroll !== false;
    activePageId = targetPageId;
    elements.body?.classList.toggle(
      "page-timer-active",
      targetPageId === "timer"
    );

    document.querySelectorAll(".app-page").forEach((page) => {
      const isActive = page.dataset.page === targetPageId;
      page.hidden = !isActive;
      page.classList.toggle("is-active", isActive);
    });

    setMobileNavigationActive(targetPageId);

    if (targetPageId === "edit") {
      prepareRouteEditor();
    }

    if (shouldScroll) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const focusTarget = options.focusTarget;
    if (focusTarget && typeof focusTarget.focus === "function") {
      window.requestAnimationFrame(() => {
        focusTarget.focus({ preventScroll: true });
      });
    }
  }

  function initializeMobileNavigationObserver() {
    document.querySelectorAll("[data-page-target]").forEach((item) => {
      addSafeListener(item, "click", () => {
        const targetId = item.dataset.pageTarget;
        if (!targetId) {
          return;
        }

        showPage(targetId);

        if (elements.sideMenu?.classList.contains("is-open")) {
          closeMenu();
        }
      });
    });

    showPage(activePageId, { scroll: false });
  }

  function handleDocumentKeydown(event) {
    if (trapFocus(event)) return;

    if (event.key === "Escape") {
      if (elements.timeAdditionDialog?.classList.contains("is-open")) {
        closeTimeAdditionDialog();
        return;
      }
      if (elements.createTrainPanel?.classList.contains("is-open")) {
        closeCreateTrainPanel();
        return;
      }
      if (elements.settingsPanel?.classList.contains("is-open")) {
        closeSettings();
        return;
      }
      if (elements.sideMenu?.classList.contains("is-open")) {
        closeMenu();
        return;
      }
      if (isChildLockActive()) {
        cancelUnlockHold();
        warnChildLockActive();
      }
      return;
    }

    if (isTypingTarget(event.target) || getOpenFocusContainer()) return;

    if (isChildLockActive()) {
      event.preventDefault();
      warnChildLockActive();
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      timer.state === TIMER_STATE.RUNNING ? pauseTimer() : startTimer();
    } else if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      restartTimer();
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      toggleSoundFromKeyboard();
    }
  }

  function initialize() {
    addSafeListener(elements.startButton, "click", startTimer);
    addSafeListener(elements.startOverButton, "click", restartTimer);
    addSafeListener(elements.pauseButton, "click", pauseTimer);
    addSafeListener(elements.resetButton, "click", requestResetTimer);
    addSafeListener(elements.restartButton, "click", restartTimer);

    addSafeListener(elements.addOneMinuteButton, "click", (event) => {
      openTimeAdditionDialog(1, event.currentTarget);
    });
    addSafeListener(elements.addFiveMinutesButton, "click", (event) => {
      openTimeAdditionDialog(5, event.currentTarget);
    });
    addSafeListener(
      elements.closeTimeAdditionButton,
      "click",
      () => closeTimeAdditionDialog()
    );
    addSafeListener(
      elements.cancelTimeAdditionButton,
      "click",
      () => closeTimeAdditionDialog()
    );
    addSafeListener(
      elements.timeAdditionBackdrop,
      "click",
      () => closeTimeAdditionDialog()
    );
    addSafeListener(
      elements.confirmTimeAdditionButton,
      "click",
      applyTimeAddition
    );
    addSafeListener(
      elements.undoTimeAdditionButton,
      "click",
      undoLastTimeAddition
    );

    addSafeListener(
      elements.addCurrentRouteTrainButton,
      "click",
      duplicateCurrentRouteAsTrain
    );
    addSafeListener(elements.savePresetButton, "click", saveCurrentAsPreset);
    addSafeListener(elements.presetNameInput, "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveCurrentAsPreset();
      }
    });
    addSafeListener(elements.activeTrainsList, "click", handleActiveTrainsListClick);
    addSafeListener(elements.openCreateTrainButton, "click", openCreateTrainPanel);
    addSafeListener(elements.closeCreateTrainButton, "click", () => closeCreateTrainPanel());
    addSafeListener(elements.cancelCreateTrainButton, "click", () => closeCreateTrainPanel());
    addSafeListener(elements.createTrainBackdrop, "click", () => closeCreateTrainPanel());
    addSafeListener(elements.createTrainForm, "submit", handleCreateTrainSubmit);
    addSafeListener(elements.createTrainForm, "input", updateCreateTrainPreview);
    addSafeListener(elements.createTrainForm, "change", updateCreateTrainPreview);
    elements.createTrainExampleButtons?.forEach((button) => {
      addSafeListener(button, "click", handleCreateTrainExampleClick);
    });

    elements.quickRouteButtons?.forEach((button) => {
      addSafeListener(button, "click", () => addQuickRouteTrain(button.dataset.quickRoute));
    });
    addSafeListener(elements.presetList, "click", handlePresetListClick);
    addSafeListener(elements.presetList, "change", handlePresetNameChange);
    addSafeListener(elements.exportJsonButton, "click", exportJsonData);
    addSafeListener(elements.importJsonButton, "click", () => {
      elements.importJsonInput?.click();
    });
    addSafeListener(elements.importJsonInput, "change", (event) => {
      importJsonData(event.target.files?.[0]);
    });
    addSafeListener(
      elements.resetCurrentSettingsButton,
      "click",
      resetCurrentSettings
    );
    addSafeListener(
      elements.deleteAllPresetsButton,
      "click",
      deleteAllPresets
    );
    addSafeListener(
      elements.resetEntireAppButton,
      "click",
      resetEntireApp
    );
    addSafeListener(elements.menuPresetsButton, "click", () => { showPage("presets"); closeMenu(); });

    addSafeListener(elements.soundVolumeRange, "input", handlePreferencePreviewChange);
    addSafeListener(elements.soundToggle, "change", handlePreferencePreviewChange);
    addSafeListener(elements.quietModeToggle, "change", handlePreferencePreviewChange);
    addSafeListener(elements.childLockToggle, "change", handlePreferencePreviewChange);
    addSafeListener(elements.keepAwakeToggle, "change", handlePreferencePreviewChange);
    addSafeListener(
      elements.circleRemainingTimeToggle,
      "change",
      handlePreferencePreviewChange
    );
    addSafeListener(
      elements.remainingTimeDisplayModeSelect,
      "change",
      handlePreferencePreviewChange
    );
    addSafeListener(elements.installAppButton, "click", installApp);
    addSafeListener(elements.menuTimerButton, "click", () => {
      showPage("timer", { focusTarget: elements.startButton });
      closeMenu();
    });
    addSafeListener(elements.menuGuideButton, "click", () => {
      showPage("edit");
      closeMenu();
    });
    addSafeListener(elements.menuAboutButton, "click", () => {
      showPage("settings");
      closeMenu();
    });

    addSafeListener(elements.menuResetTimerButton, "click", () => {
      closeMenu(false);
      showPage("timer", { scroll: false });
      requestResetTimer();
    });

    addSafeListener(elements.menuButton, "click", openMenu);
    addSafeListener(elements.closeMenuButton, "click", () => closeMenu());
    addSafeListener(elements.menuBackdrop, "click", () => closeMenu());

    addSafeListener(elements.settingsButton, "click", openSettings);
    addSafeListener(elements.mobileSettingsButton, "click", () => showPage("settings"));
    addSafeListener(elements.openPreferencesPanelButton, "click", openSettings);
    addSafeListener(
      elements.trackShapeSwitcher,
      "click",
      handleTrackShapeButtonClick
    );
    addSafeListener(elements.closeSettingsButton, "click", () => closeSettings());
    addSafeListener(elements.cancelSettingsButton, "click", () => closeSettings());
    addSafeListener(elements.settingsBackdrop, "click", () => closeSettings());
    addSafeListener(elements.preferencesForm, "submit", handleSettingsSubmit);
    addSafeListener(elements.routeEditorForm, "submit", handleRouteEditorSubmit);
    addSafeListener(elements.resetRouteEditorButton, "click", resetRouteEditor);

    addSafeListener(elements.unitPresetSelect, "change", handleUnitPresetChange);
    addSafeListener(elements.unitMinutesInput, "input", handleUnitMinutesInput);
    addSafeListener(elements.unitMinutesInput, "blur", handleUnitMinutesBlur);
    addSafeListener(elements.addStationButton, "click", addStationToDraft);
    addSafeListener(elements.stationEditorList, "input", handleStationEditorInput);
    addSafeListener(elements.stationEditorList, "focusout", handleStationEditorBlur);
    addSafeListener(elements.stationEditorList, "click", handleStationEditorClick);
    addSafeListener(elements.segmentEditorList, "click", handleSegmentEditorClick);
    elements.trackShapeRadios?.forEach((radio) => {
      addSafeListener(radio, "change", handleTrackShapeRadioChange);
    });

    addSafeListener(elements.unlockHoldButton, "pointerdown", startUnlockHold);
    addSafeListener(elements.unlockHoldButton, "pointerup", cancelUnlockHold);
    addSafeListener(elements.unlockHoldButton, "pointerleave", cancelUnlockHold);
    addSafeListener(elements.unlockHoldButton, "pointercancel", cancelUnlockHold);
    addSafeListener(elements.unlockHoldButton, "contextmenu", (event) => event.preventDefault());

    document.addEventListener("keydown", handleDocumentKeydown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      if (elements.installAppButton) elements.installAppButton.hidden = false;
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      if (elements.installAppButton) elements.installAppButton.hidden = true;
      setStatusMessage("ホーム画面への追加が完了しました。");
    });

    initializePersistence();
    const startupActiveTrain =
      trainFleet.find((train) => train.id === activeTrainId) || trainFleet[0] || null;

    applyUserPreferences();

    if (startupActiveTrain) {
      applyTrainRecordToMainTimer(startupActiveTrain);
    } else {
      timer.initialDurationMs =
        calculateTotalMinutes(configuration) * 60 * 1000;
      timer.remainingMs = timer.initialDurationMs;
      renderConfiguration();
      resetTimer({ announce: false });
    }

    prepareRouteEditor();
    renderTimeAdditionHistory();
    renderPersistenceUi();
    updateNetworkStatus();
    initializeMobileNavigationObserver();
    ensureTrainFleetLoop();
    registerServiceWorker();

    if (storageRecoveryNotice) {
      setStatusMessage(storageRecoveryNotice);
    }
  }

  initialize();
})();
