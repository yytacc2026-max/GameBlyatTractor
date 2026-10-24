import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LEVELS } from './data/levels';
import { TECH_TREE_NODES } from './data/techTree';
import {
  calculateStarRating,
  createInitialWorld,
  SimulationWorld,
} from './engine/farmSimulation';
import { createPythonSimulationRunner, StepEvent } from './engine/pythonInterpreter';
import { SavedProgress, TechNode, TileData } from './types/game';
import { FarmViewport3D } from './components/FarmViewport3D';
import { PythonCodeEditor } from './components/PythonCodeEditor';
import { MachineStatusHUD } from './components/MachineStatusHUD';
import { TechTreeModal } from './components/TechTreeModal';
import { ApiDocsModal } from './components/ApiDocsModal';
import { ThesisReportModal } from './components/ThesisReportModal';
import { soundEngine } from './audio/soundEngine';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Cpu,
  BookOpen,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Award,
  ArrowRight,
  Eye,
  Code2,
  CheckCircle2,
  Lock,
  Columns,
  Maximize2,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'agrocode_skripsi_progress_v2';

// Exact script from PDF Page 1 Screenshot (Combine_A - VE01)
const PDF_PAGE1_DEMO_SCRIPT = `# FIELD OPERATIONS SCRIPT v2.1 (Combine_A - VE01)
# Adapted from PDF Page 1 Concept Diagram

while True:
    # 1. Inspect ground status at VE01's current position
    ground_info = sensor.inspect(VE01.position)

    # 2. State-based agricultural actions
    if ground_info.type == Grounds.Untilled:
        if attachment.till_unit.is_ready() and attachment.till_unit.activate():
            VE01.till()

    elif ground_info.type == Grounds.Tilled:
        if not VE01.detect_crop(ground_info.crop) and VE01.inventory.seeds['Carrot'] > 0:
            if attachment.seeder_unit.activate():
                VE01.plant(Entities.Carrot)

    elif ground_info.type == Grounds.MatureCrop:
        if attachment.harvester_unit.activate():
            VE01.harvest()

    # 3. Movement and Energy / Diesel Fuel Management
    if VE01.energy_level > 18:
        next_coord = path_finder.get_next_tile(VE01.current_path_pattern)
        VE01.move_to(next_coord)
    else:
        VE01.set_path('charge_station')
`;

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        completedLevels: parsed.completedLevels || {},
        unlockedTechIds: parsed.unlockedTechIds || ['tech_basic_implements'],
        cropBank: parsed.cropBank || { wortel: 8, gandum: 4, jagung: 2 },
        savedCodeByLevel: parsed.savedCodeByLevel || {},
        unlockAllThesisMode: Boolean(parsed.unlockAllThesisMode),
      };
    }
  } catch {
    // fallback
  }
  return {
    completedLevels: {},
    unlockedTechIds: ['tech_basic_implements'],
    cropBank: { wortel: 8, gandum: 4, jagung: 2 },
    savedCodeByLevel: {},
    unlockAllThesisMode: true,
  };
}

export default function App() {
  const [gameScreen, setGameScreen] = useState<'TITLE' | 'PLAYING'>('TITLE');
  const [progress, setProgress] = useState<SavedProgress>(loadProgress);
  const [currentLevelId, setCurrentLevelId] = useState<number>(1);

  const currentLevel = LEVELS.find((l) => l.id === currentLevelId) || LEVELS[0];
  const effectiveTechIds = progress.unlockAllThesisMode
    ? TECH_TREE_NODES.map((t) => t.id)
    : progress.unlockedTechIds;

  const [world, setWorld] = useState<SimulationWorld>(() =>
    createInitialWorld(currentLevel, effectiveTechIds)
  );
  const [code, setCode] = useState<string>(
    () => progress.savedCodeByLevel[currentLevel.id] ?? currentLevel.starterCode
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    currentLevel.vehicles[0]?.id || 'traktor'
  );
  const [cameraPreset, setCameraPreset] = useState<'isometric' | 'top' | 'follow'>('isometric');
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 4>(2);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Adaptive View Mode for Android Portrait, Android Landscape & Desktop:
  // 'split' = 3D + Code side-by-side (landscape) or top-bottom (portrait)
  // '3d'    = Full-viewport 3D Farm with bottom execution controls
  // 'code'  = Full-viewport Python Editor with bottom execution controls
  const [viewMode, setViewMode] = useState<'split' | '3d' | 'code'>('split');
  const [showHudPanelDesktop, setShowHudPanelDesktop] = useState<boolean>(true);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [inspectedTile, setInspectedTile] = useState<TileData | null>(null);

  // Detect compact landscape (e.g. Android phone in landscape: width > height and height < 560)
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    const onResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isDesktopLarge = viewportSize.w >= 1024 && viewportSize.h >= 600;
  const isLandscapeCompact = !isDesktopLarge && viewportSize.w > viewportSize.h;

  // Modals
  const [isTechModalOpen, setIsTechModalOpen] = useState<boolean>(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [isThesisModalOpen, setIsThesisModalOpen] = useState<boolean>(false);
  const [isMobileStatusOpen, setIsMobileStatusOpen] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);

  // Generator runner ref
  const runnerRef = useRef<Generator<StepEvent, void, unknown> | null>(null);
  const timerRef = useRef<number | null>(null);

  // Save progress to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore quota errors
    }
  }, [progress]);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const switchLevel = useCallback(
    (lvlId: number) => {
      stopTimer();
      runnerRef.current = null;
      const lvl = LEVELS.find((l) => l.id === lvlId) || LEVELS[0];
      setCurrentLevelId(lvl.id);
      const techs = progress.unlockAllThesisMode
        ? TECH_TREE_NODES.map((t) => t.id)
        : progress.unlockedTechIds;
      const freshWorld = createInitialWorld(lvl, techs);
      setWorld(freshWorld);
      setSelectedVehicleId(lvl.vehicles[0]?.id || 'traktor');
      setCode(progress.savedCodeByLevel[lvl.id] ?? lvl.starterCode);
      setShowVictoryModal(false);
      setInspectedTile(null);
    },
    [progress.savedCodeByLevel, progress.unlockAllThesisMode, progress.unlockedTechIds, stopTimer]
  );

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    setProgress((prev) => ({
      ...prev,
      savedCodeByLevel: {
        ...prev.savedCodeByLevel,
        [currentLevelId]: newCode,
      },
    }));
  };

  const playStepSound = (soundType?: StepEvent['soundType']) => {
    switch (soundType) {
      case 'move':
        soundEngine.playMove(false, false);
        break;
      case 'mud':
        soundEngine.playMove(true, false);
        break;
      case 'road':
        soundEngine.playMove(false, true);
        break;
      case 'turn':
        soundEngine.playTurn();
        break;
      case 'till':
        soundEngine.playTill();
        break;
      case 'plant':
        soundEngine.playPlant();
        break;
      case 'harvest':
        soundEngine.playHarvest();
        break;
      case 'refuel':
        soundEngine.playRefuel();
        break;
      case 'repair':
        soundEngine.playRepair();
        break;
      case 'error':
        soundEngine.playError();
        break;
    }
  };

  const handleVictoryRecord = useCallback((finalWorld: SimulationWorld) => {
    const stars = calculateStarRating(finalWorld);
    const lvlId = finalWorld.level.id;
    const m = finalWorld.metrics;

    setProgress((prev) => {
      const existing = prev.completedLevels[lvlId];
      const bestStars = existing ? Math.max(existing.stars, stars) : stars;
      const bestTicks = existing ? Math.min(existing.bestTicks, m.ticks) : m.ticks;
      const bestFuel = existing ? Math.min(existing.bestFuel, m.fuelUsed) : m.fuelUsed;

      return {
        ...prev,
        completedLevels: {
          ...prev.completedLevels,
          [lvlId]: {
            stars: bestStars,
            bestTicks,
            bestFuel,
            completedAt: new Date().toISOString(),
          },
        },
        cropBank: {
          wortel: prev.cropBank.wortel + m.harvestedByCrop.wortel + 2,
          gandum: prev.cropBank.gandum + m.harvestedByCrop.gandum + 1,
          jagung: prev.cropBank.jagung + m.harvestedByCrop.jagung + 1,
        },
      };
    });

    setShowVictoryModal(true);
  }, []);

  const executeSingleStep = useCallback(() => {
    if (!runnerRef.current) {
      const fresh = createInitialWorld(currentLevel, effectiveTechIds);
      runnerRef.current = createPythonSimulationRunner(code, fresh);
    }

    const res = runnerRef.current.next();
    if (!res.done && res.value) {
      const { world: nextWorld, soundType } = res.value;
      playStepSound(soundType);
      setWorld(nextWorld);

      if (nextWorld.status === 'victory') {
        stopTimer();
        runnerRef.current = null;
        handleVictoryRecord(nextWorld);
      } else if (nextWorld.status === 'failed') {
        stopTimer();
        runnerRef.current = null;
      }
    } else {
      stopTimer();
      runnerRef.current = null;
    }
  }, [code, currentLevel, effectiveTechIds, handleVictoryRecord, stopTimer]);

  const startAutoRun = useCallback(() => {
    stopTimer();
    const fresh = createInitialWorld(currentLevel, effectiveTechIds);
    fresh.status = 'running';
    setWorld(fresh);
    setShowVictoryModal(false);
    runnerRef.current = createPythonSimulationRunner(code, fresh);

    const intervalMs = simSpeed === 4 ? 110 : simSpeed === 2 ? 230 : 420;
    timerRef.current = window.setInterval(() => {
      executeSingleStep();
    }, intervalMs);
  }, [code, currentLevel, effectiveTechIds, executeSingleStep, simSpeed, stopTimer]);

  const pauseSimulation = () => {
    stopTimer();
    setWorld((prev) => ({ ...prev, status: 'paused' }));
  };

  const resumeSimulation = () => {
    if (!runnerRef.current) {
      startAutoRun();
      return;
    }
    setWorld((prev) => ({ ...prev, status: 'running' }));
    const intervalMs = simSpeed === 4 ? 110 : simSpeed === 2 ? 230 : 420;
    timerRef.current = window.setInterval(() => {
      executeSingleStep();
    }, intervalMs);
  };

  const resetSimulationWorld = useCallback(() => {
    stopTimer();
    runnerRef.current = null;
    setShowVictoryModal(false);
    setWorld(createInitialWorld(currentLevel, effectiveTechIds));
  }, [currentLevel, effectiveTechIds, stopTimer]);

  // Update interval if speed changes while running
  useEffect(() => {
    if (world.status === 'running' && timerRef.current !== null) {
      stopTimer();
      const intervalMs = simSpeed === 4 ? 110 : simSpeed === 2 ? 230 : 420;
      timerRef.current = window.setInterval(() => {
        executeSingleStep();
      }, intervalMs);
    }
  }, [simSpeed, world.status, executeSingleStep, stopTimer]);

  // Keyboard shortcuts for Title Screen (Enter/Space to start) & Escape to pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameScreen === 'TITLE' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setGameScreen('PLAYING');
      } else if (gameScreen === 'PLAYING' && e.key === 'Escape') {
        if (world.status === 'running') {
          pauseSimulation();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameScreen, world.status]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.muted = next;
  };

  const handleUnlockTech = (node: TechNode) => {
    setProgress((prev) => {
      if (prev.unlockedTechIds.includes(node.id)) return prev;
      return {
        ...prev,
        unlockedTechIds: [...prev.unlockedTechIds, node.id],
        cropBank: {
          wortel: prev.cropBank.wortel - (node.cost.wortel || 0),
          gandum: prev.cropBank.gandum - (node.cost.gandum || 0),
          jagung: prev.cropBank.jagung - (node.cost.jagung || 0),
        },
      };
    });
  };

  const toggleThesisMode = () => {
    setProgress((prev) => ({
      ...prev,
      unlockAllThesisMode: !prev.unlockAllThesisMode,
    }));
  };

  const isRunning = world.status === 'running';
  const latestLog = world.logs[world.logs.length - 1];

  // ============================================================================
  // 1. TITLE SCREEN SHELL (Responsive for Android Portrait, Landscape & Desktop)
  // ============================================================================
  if (gameScreen === 'TITLE') {
    const completedCount = Object.keys(progress.completedLevels).length;

    return (
      <div className="relative w-screen h-dvh overflow-hidden bg-[#121518] select-none">
        {/* Live 3D Isometric Farm Diorama Background */}
        <div className="absolute inset-0 opacity-85">
          <FarmViewport3D
            world={world}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            cameraPreset="isometric"
          />
        </div>

        {/* Measured Gradient Scrim for 4.5:1 Contrast */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E1114] via-[#0E1114]/70 to-[#0E1114]/30" />

        {/* Interactive Overlay Content */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-3 sm:p-6 md:p-8 overflow-y-auto">
          {/* Top Minimal Bar */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-emerald-400 truncate">
              <span>SIMULASI OTOMASI PERTANIAN · PYTHON 3</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsTechModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181B20]/95 border border-[#2D333D] text-[11px] sm:text-xs font-medium text-zinc-200 hover:bg-[#232830] transition-colors cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xs:inline">Pohon Teknologi</span>
                <span className="xs:hidden">Tech</span>
              </button>
              <button
                type="button"
                onClick={() => setIsApiModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181B20]/95 border border-[#2D333D] text-[11px] sm:text-xs font-medium text-zinc-200 hover:bg-[#232830] transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>API Python</span>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 sm:p-2 rounded-lg bg-[#181B20]/95 border border-[#2D333D] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Center-Left Hero Lockup & Level Curriculum Grid */}
          <div className="my-auto max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center py-2 sm:py-4">
            {/* Bespoke SVG Title Lockup */}
            <div className="md:col-span-6 space-y-2.5 sm:space-y-4">
              <svg
                viewBox="0 0 460 105"
                className="w-full max-w-[260px] sm:max-w-md h-auto drop-shadow-2xl"
                aria-label="AgroCode Ladang Otomatis"
              >
                <defs>
                  <linearGradient id="agroGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22C55E" />
                    <stop offset="60%" stopColor="#84CC16" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                </defs>
                {/* Tractor Icon Emblem */}
                <g transform="translate(4, 12)">
                  <rect x="0" y="28" width="52" height="24" rx="5" fill="#22C55E" />
                  <rect x="8" y="6" width="26" height="24" rx="4" fill="#15803D" />
                  <rect x="12" y="10" width="18" height="14" rx="2" fill="#93C5FD" />
                  <rect x="40" y="12" width="5" height="16" rx="2" fill="#F59E0B" />
                  <circle cx="14" cy="54" r="13" fill="#18181B" stroke="#FACC15" strokeWidth="4" />
                  <circle cx="42" cy="57" r="9" fill="#18181B" stroke="#FACC15" strokeWidth="3" />
                </g>
                <text
                  x="72"
                  y="52"
                  fill="url(#agroGrad)"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  fontWeight="800"
                  fontSize="46"
                  letterSpacing="-1"
                >
                  AGROCODE
                </text>
                <text
                  x="74"
                  y="80"
                  fill="#F4F4F5"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="600"
                  fontSize="14.5"
                  letterSpacing="1.8"
                >
                  LADANG OTOMATIS KENDARAAN DARAT
                </text>
              </svg>

              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-xl">
                Program armada <strong className="text-white">Tractor, Harvester, dan Hauler</strong> menggunakan sintaks{' '}
                <strong className="text-emerald-400 font-mono">Python</strong> berbahasa Inggris standar. Kelola bahan bakar solar, lumpur, bengkel, dan logistik gudang.
              </p>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setGameScreen('PLAYING')}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-xl transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Mulai Simulasi ({currentLevel.title.split(':')[0]})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsThesisModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1E2229] hover:bg-[#282E38] border border-[#323946] text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                  <span>Data Skripsi ({completedCount}/10)</span>
                </button>
              </div>
            </div>

            {/* 10-Level Selector Card */}
            <div className="md:col-span-6 p-3 sm:p-4 rounded-xl bg-[#16191E]/95 border border-[#2A303C] shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] sm:text-xs font-bold text-zinc-100 uppercase tracking-wider">
                  Kurikulum 10 Level Simulasi
                </span>
                <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
                  {completedCount}/10 Selesai
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 max-h-[180px] sm:max-h-[270px] overflow-y-auto pr-1">
                {LEVELS.map((lvl) => {
                  const rec = progress.completedLevels[lvl.id];
                  const isUnlocked =
                    progress.unlockAllThesisMode ||
                    lvl.id === 1 ||
                    Boolean(progress.completedLevels[lvl.id - 1]);
                  const isSelected = lvl.id === currentLevelId;

                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => {
                        switchLevel(lvl.id);
                        setGameScreen('PLAYING');
                      }}
                      className={`p-2 rounded-lg border text-left transition-all flex items-start justify-between gap-2 cursor-pointer disabled:opacity-45 ${
                        isSelected
                          ? 'bg-emerald-950/50 border-emerald-500/70 text-white'
                          : 'bg-[#1D2128] hover:bg-[#252A34] border-[#2C323D] text-zinc-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono text-zinc-400 truncate">
                          {lvl.stage}
                        </div>
                        <div className="text-[11px] sm:text-xs font-bold truncate mt-0.5">
                          {lvl.title}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-mono text-[11px]">
                        {rec ? (
                          <span className="text-amber-400">{'★'.repeat(rec.stars)}</span>
                        ) : isUnlocked ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-zinc-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Single Flat Control-Hint Line */}
          <div className="text-center text-[10px] sm:text-xs font-mono text-zinc-400 shrink-0 pt-1">
            Geser Layar Putar Kamera 3D · Cubit / Tombol +/- untuk Zoom · Pilih Level untuk Mulai
          </div>
        </div>

        {/* Modals */}
        <TechTreeModal
          isOpen={isTechModalOpen}
          onClose={() => setIsTechModalOpen(false)}
          unlockedTechIds={progress.unlockedTechIds}
          cropBank={progress.cropBank}
          onUnlockTech={handleUnlockTech}
          unlockAllThesisMode={progress.unlockAllThesisMode}
          onToggleThesisMode={toggleThesisMode}
        />
        <ApiDocsModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />
        <ThesisReportModal
          isOpen={isThesisModalOpen}
          onClose={() => setIsThesisModalOpen(false)}
          world={world}
          progress={progress}
          currentCode={code}
        />
      </div>
    );
  }

  // ============================================================================
  // 2. ACTIVE PLAY WORKSPACE (Optimized for Android Landscape, Portrait & Desktop)
  // ============================================================================
  const show3DPane = viewMode === 'split' || viewMode === '3d';
  const showCodePane = viewMode === 'split' || viewMode === 'code';

  return (
    <div className="relative w-screen h-dvh flex flex-col bg-[#121518] overflow-hidden select-none">
      {/* Compact Top Perimeter Bar (40px on Android, 44px on Desktop) */}
      <header className="h-10 sm:h-11 px-2 sm:px-4 bg-[#181B20] border-b border-[#282D37] flex items-center justify-between gap-1.5 shrink-0 z-30">
        {/* Left: Brand & Level Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              stopTimer();
              setGameScreen('TITLE');
            }}
            className="text-xs sm:text-sm font-extrabold tracking-tight text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            AGROCODE
          </button>
          <span className="text-zinc-600 text-xs">/</span>
          <select
            value={currentLevelId}
            onChange={(e) => switchLevel(Number(e.target.value))}
            className="bg-[#121518] border border-[#2E3440] rounded px-1.5 sm:px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-zinc-100 focus:outline-none focus:border-emerald-500 truncate max-w-[135px] xs:max-w-[180px] sm:max-w-xs cursor-pointer"
          >
            {LEVELS.map((lvl) => {
              const rec = progress.completedLevels[lvl.id];
              const starsStr = rec ? ` (${'★'.repeat(rec.stars)})` : '';
              return (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.title}
                  {starsStr}
                </option>
              );
            })}
          </select>
        </div>

        {/* Center: Objective Summary on Wide Desktop */}
        <div className="hidden xl:flex items-center gap-2 text-xs text-zinc-300 truncate max-w-md">
          <span className="text-zinc-500 font-mono">Misi:</span>
          <span className="truncate">{currentLevel.objective.description}</span>
        </div>

        {/* Right: Adaptive View Mode Switcher (Split / 3D / Kode) & Modals */}
        <div className="flex items-center gap-1 shrink-0">
          {/* View Mode Pill Group (Works on all Android & Desktop screens) */}
          <div className="flex items-center bg-[#121518] p-0.5 rounded border border-[#2C323E]">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Tampilan Belah Layar (Ladang 3D + Editor Python)"
            >
              <Columns className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Layar Penuh Ladang 3D"
            >
              <Maximize2 className="w-3 h-3" />
              <span>3D</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                viewMode === 'code'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Layar Penuh Editor Kode Python"
            >
              <Code2 className="w-3 h-3" />
              <span>Kode</span>
            </button>
          </div>

          {/* Status Button (Toggles desktop HUD or opens Mobile Status Sheet) */}
          <button
            type="button"
            onClick={() => {
              if (isDesktopLarge) {
                setShowHudPanelDesktop((v) => !v);
              } else {
                setIsMobileStatusOpen(true);
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
              isDesktopLarge && showHudPanelDesktop
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#222730] border-[#303744] text-zinc-200 hover:bg-[#2C323E]'
            }`}
            title="Status Mesin & Misi"
          >
            <Eye className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Status</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTechModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#222730] hover:bg-[#2C323E] border border-[#303744] text-[11px] font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Pohon Teknologi"
          >
            <Cpu className="w-3 h-3 text-emerald-400" />
            <span className="hidden md:inline">Tech</span>
          </button>

          <button
            type="button"
            onClick={() => setIsThesisModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#222730] hover:bg-[#2C323E] border border-[#303744] text-[11px] font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Laporan & Ekspor Data Skripsi"
          >
            <FileSpreadsheet className="w-3 h-3 text-amber-400" />
            <span className="hidden md:inline">Skripsi</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="p-1 rounded bg-[#222730] hover:bg-[#2C323E] border border-[#303744] text-zinc-300 cursor-pointer"
            title={isMuted ? 'Suara Mati' : 'Suara Aktif'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* ========================================================================
          MAIN WORKSPACE BODY:
          - Desktop Large (>=1024x600): Full-bleed 3D canvas + floating overlays
          - Android Landscape (width > height): Side-by-side 50%/50% flex-row
          - Android Portrait (height >= width): Top 40% 3D / Bottom 60% Code flex-col
         ======================================================================== */}
      <div
        className={`relative flex-1 min-h-0 overflow-hidden ${
          isDesktopLarge
            ? 'block'
            : isLandscapeCompact
            ? 'flex flex-row'
            : 'flex flex-col'
        }`}
      >
        {/* 1. 3D FARM VIEWPORT PANE */}
        {show3DPane && (
          <div
            className={
              isDesktopLarge
                ? 'relative w-full h-full'
                : viewMode === '3d'
                ? 'relative flex-1 w-full h-full min-h-0'
                : isLandscapeCompact
                ? 'relative w-[48%] h-full shrink-0 border-r border-[#282D37]'
                : 'relative w-full h-[38%] shrink-0 border-b border-[#282D37]'
            }
          >
            <FarmViewport3D
              world={world}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              onSelectTile={(t) => setInspectedTile(t)}
              cameraPreset={cameraPreset}
              onChangeCameraPreset={setCameraPreset}
              onOpenMobileStatus={() => setIsMobileStatusOpen(true)}
            />

            {/* Inspected Tile Mini Callout */}
            {inspectedTile && (
              <div className="absolute bottom-2 left-2 z-20 px-2.5 py-1 rounded bg-[#181B20]/95 border border-[#2D333D] text-[10px] font-mono text-zinc-200 flex items-center gap-1.5 shadow-lg">
                <span>
                  ({inspectedTile.x},{inspectedTile.z}){' '}
                  <strong className="text-emerald-400">{inspectedTile.terrain}</strong>
                </span>
                <span>·</span>
                <span>{inspectedTile.soil}</span>
                {inspectedTile.crop !== 'kosong' && (
                  <>
                    <span>·</span>
                    <span className="text-amber-300">
                      {inspectedTile.crop} ({inspectedTile.growth}%)
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setInspectedTile(null)}
                  className="text-zinc-400 hover:text-white ml-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. PYTHON CODE EDITOR PANE */}
        {showCodePane && (
          <div
            className={
              isDesktopLarge
                ? viewMode === 'code'
                  ? 'absolute inset-3 bottom-16 z-20 flex flex-col'
                  : 'absolute top-3 left-3 bottom-16 w-[430px] xl:w-[470px] z-10 flex flex-col'
                : 'flex-1 min-w-0 min-h-0 flex flex-col p-1 sm:p-1.5 bg-[#121518]'
            }
          >
            <PythonCodeEditor
              code={code}
              onChange={handleCodeChange}
              activeLine={world.activeLine}
              errorLine={world.status === 'failed' ? world.activeLine : null}
              errorMessage={world.failureReason}
              isRunning={isRunning}
              levelTitle={currentLevel.title}
              onResetCode={() => handleCodeChange(currentLevel.starterCode)}
              onLoadSolution={() => handleCodeChange(currentLevel.solutionCode)}
              onLoadPdfDemoScript={() => handleCodeChange(PDF_PAGE1_DEMO_SCRIPT)}
              onOpenApiDocs={() => setIsApiModalOpen(true)}
            />
          </div>
        )}

        {/* 3. DESKTOP FLOATING RIGHT PANEL: Machine Status HUD */}
        {isDesktopLarge && showHudPanelDesktop && viewMode !== 'code' && (
          <div className="absolute top-3 right-3 w-[285px] z-10 pointer-events-auto">
            <MachineStatusHUD
              world={world}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
            />
          </div>
        )}

        {/* 4. DESKTOP FLOATING COLLAPSIBLE BOTTOM CONTROL DOCK */}
        {isDesktopLarge && (
          <div
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-[820px] px-2 transition-transform duration-200 ${
              isDockCollapsed ? 'translate-y-[calc(100%-26px)]' : 'translate-y-0'
            }`}
          >
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setIsDockCollapsed((c) => !c)}
                className="flex items-center gap-1 px-3 py-0.5 rounded-t-md bg-[#181B20] border border-b-0 border-[#2D333D] text-[11px] font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                {isDockCollapsed ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    <span>Tampilkan Kontrol Simulasi</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    <span>Sembunyikan Kontrol</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#181B20]/95 border border-[#2D333D] shadow-2xl">
              <div className="flex items-center gap-1.5">
                {!isRunning ? (
                  <button
                    type="button"
                    onClick={world.status === 'paused' ? resumeSimulation : startAutoRun}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{world.status === 'paused' ? 'Lanjutkan' : 'Jalankan Kode'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pauseSimulation}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Jeda</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isRunning}
                  onClick={executeSingleStep}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#242933] hover:bg-[#2E3542] disabled:opacity-40 text-zinc-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <StepForward className="w-3.5 h-3.5 text-sky-400" />
                  <span>Langkah</span>
                </button>

                <button
                  type="button"
                  onClick={resetSimulationWorld}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#242933] hover:bg-[#2E3542] text-zinc-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="flex items-center gap-2 min-w-0 flex-1 px-2 text-xs font-mono truncate">
                <span className="text-zinc-500 shrink-0">[Log]</span>
                <span
                  className={`truncate ${
                    latestLog?.type === 'error'
                      ? 'text-red-400'
                      : latestLog?.type === 'success'
                      ? 'text-emerald-400'
                      : 'text-zinc-300'
                  }`}
                >
                  {latestLog ? latestLog.message : 'Siap menjalankan kode Python.'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-[#121518] p-0.5 rounded border border-[#262B33]">
                  {([1, 2, 4] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSimSpeed(spd)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                        simSpeed === spd
                          ? 'bg-emerald-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                <div className="flex items-center bg-[#121518] p-0.5 rounded border border-[#262B33]">
                  {(
                    [
                      { id: 'isometric', label: '3D Iso' },
                      { id: 'top', label: 'Atas' },
                      { id: 'follow', label: 'Ikuti' },
                    ] as const
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => setCameraPreset(cam.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        cameraPreset === cam.id
                          ? 'bg-[#282E38] text-emerald-300'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================
          ANDROID / MOBILE COMPACT BOTTOM EXECUTION BAR (Single-line 38px)
         ======================================================================== */}
      {!isDesktopLarge && (
        <div className="h-10 px-2 bg-[#181B20] border-t border-[#282D37] flex items-center justify-between gap-1.5 shrink-0 z-30">
          {/* Left: Run / Step / Reset */}
          <div className="flex items-center gap-1 shrink-0">
            {!isRunning ? (
              <button
                type="button"
                onClick={world.status === 'paused' ? resumeSimulation : startAutoRun}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{world.status === 'paused' ? 'Lanjut' : 'Jalankan'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseSimulation}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pause className="w-3 h-3 fill-current" />
                <span>Jeda</span>
              </button>
            )}

            <button
              type="button"
              disabled={isRunning}
              onClick={executeSingleStep}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#242933] hover:bg-[#2E3542] disabled:opacity-40 text-zinc-200 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <StepForward className="w-3 h-3 text-sky-400" />
              <span>Langkah</span>
            </button>

            <button
              type="button"
              onClick={resetSimulationWorld}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#242933] hover:bg-[#2E3542] text-zinc-300 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden xs:inline">Reset</span>
            </button>
          </div>

          {/* Middle: Live Log Ticker */}
          <div className="flex-1 min-w-0 px-1.5 text-[10px] font-mono truncate text-center sm:text-left">
            <span
              className={`truncate ${
                latestLog?.type === 'error'
                  ? 'text-red-400'
                  : latestLog?.type === 'success'
                  ? 'text-emerald-400'
                  : 'text-zinc-400'
              }`}
            >
              {latestLog ? latestLog.message : currentLevel.objective.description}
            </span>
          </div>

          {/* Right: Speed 1x/2x/4x */}
          <div className="flex items-center bg-[#121518] p-0.5 rounded border border-[#262B33] shrink-0">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                  simSpeed === spd
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================
          ANDROID / MOBILE MACHINE STATUS & MISSION DRAWER MODAL
         ======================================================================== */}
      {isMobileStatusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl bg-[#181B20] border border-[#2D333D] p-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#262B33]">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                Telemetri Kendaraan & Misi Level {currentLevel.id}
              </span>
              <button
                type="button"
                onClick={() => setIsMobileStatusOpen(false)}
                className="p-1 rounded bg-[#232832] text-zinc-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <MachineStatusHUD
              world={world}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
            />
          </div>
        </div>
      )}

      {/* Victory / Level Completed Modal */}
      {showVictoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-xl bg-[#181B20] border border-emerald-500/50 p-4 sm:p-6 shadow-2xl text-center space-y-3 sm:space-y-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>

            <div>
              <div className="text-[11px] font-mono text-emerald-400 uppercase">
                Simulasi Berhasil
              </div>
              <h2 className="text-base sm:text-xl font-bold text-white mt-0.5">
                {currentLevel.title} Selesai!
              </h2>
              <div className="text-xl sm:text-2xl text-amber-400 tracking-widest mt-1">
                {'★'.repeat(calculateStarRating(world))}
                {'☆'.repeat(3 - calculateStarRating(world))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#121518] border border-[#252A34] font-mono text-xs tabular-nums">
              <div>
                <div className="text-zinc-400 text-[10px]">Total Tick</div>
                <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                  {world.metrics.ticks}
                </div>
              </div>
              <div>
                <div className="text-zinc-400 text-[10px]">Solar Terpakai</div>
                <div className="text-xs sm:text-sm font-bold text-amber-400 mt-0.5">
                  {world.metrics.fuelUsed} L
                </div>
              </div>
              <div>
                <div className="text-zinc-400 text-[10px]">Total Panen</div>
                <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-0.5">
                  {world.metrics.harvestedTotal}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowVictoryModal(false)}
                className="px-3.5 py-2 rounded-lg bg-[#242933] hover:bg-[#2E3542] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
              >
                Tinjau Kode
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVictoryModal(false);
                  setIsTechModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-[#242933] hover:bg-[#2E3542] text-xs font-semibold text-amber-300 transition-colors cursor-pointer"
              >
                Pohon Teknologi
              </button>
              {currentLevelId < LEVELS.length && (
                <button
                  type="button"
                  onClick={() => switchLevel(currentLevelId + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  <span>Level {currentLevelId + 1}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <TechTreeModal
        isOpen={isTechModalOpen}
        onClose={() => setIsTechModalOpen(false)}
        unlockedTechIds={progress.unlockedTechIds}
        cropBank={progress.cropBank}
        onUnlockTech={handleUnlockTech}
        unlockAllThesisMode={progress.unlockAllThesisMode}
        onToggleThesisMode={toggleThesisMode}
      />
      <ApiDocsModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />
      <ThesisReportModal
        isOpen={isThesisModalOpen}
        onClose={() => setIsThesisModalOpen(false)}
        world={world}
        progress={progress}
        currentCode={code}
      />
    </div>
  );
}
