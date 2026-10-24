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
  Layers,
  Eye,
  Code2,
  Compass,
  CheckCircle2,
  Lock,
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
    unlockAllThesisMode: true, // Default enabled so thesis examiners can test all 10 levels immediately
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

  // UI Dock & Panels Visibility
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [showCodePanelDesktop, setShowCodePanelDesktop] = useState<boolean>(true);
  const [showHudPanelDesktop, setShowHudPanelDesktop] = useState<boolean>(true);
  const [inspectedTile, setInspectedTile] = useState<TileData | null>(null);

  // Modals
  const [isTechModalOpen, setIsTechModalOpen] = useState<boolean>(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [isThesisModalOpen, setIsThesisModalOpen] = useState<boolean>(false);
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
  // 1. TITLE SCREEN SHELL (Full-Viewport 3D Live World + SVG Title Lockup)
  // ============================================================================
  if (gameScreen === 'TITLE') {
    const completedCount = Object.keys(progress.completedLevels).length;

    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#121518] select-none">
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E1114] via-[#0E1114]/65 to-transparent" />

        {/* Interactive Overlay Content */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-6 md:p-10 overflow-y-auto">
          {/* Top Minimal Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs font-mono text-emerald-400">
              <span>SIMULASI OTOMASI PERTANIAN DARAT · PYTHON 3</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTechModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181B20]/95 border border-[#2D333D] text-xs font-medium text-zinc-200 hover:bg-[#232830] transition-colors cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pohon Teknologi</span>
              </button>
              <button
                type="button"
                onClick={() => setIsApiModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181B20]/95 border border-[#2D333D] text-xs font-medium text-zinc-200 hover:bg-[#232830] transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Dokumentasi API</span>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 rounded-lg bg-[#181B20]/95 border border-[#2D333D] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Center-Left Hero Lockup & Level Curriculum Grid */}
          <div className="my-auto max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-6">
            {/* Bespoke SVG Title Lockup */}
            <div className="lg:col-span-6 space-y-5">
              <svg
                viewBox="0 0 460 110"
                className="w-full max-w-md h-auto drop-shadow-2xl"
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
                <g transform="translate(4, 14)">
                  <rect x="0" y="28" width="52" height="24" rx="5" fill="#22C55E" />
                  <rect x="8" y="6" width="26" height="24" rx="4" fill="#15803D" />
                  <rect x="12" y="10" width="18" height="14" rx="2" fill="#93C5FD" />
                  <rect x="40" y="12" width="5" height="16" rx="2" fill="#F59E0B" />
                  <circle cx="14" cy="54" r="13" fill="#18181B" stroke="#FACC15" strokeWidth="4" />
                  <circle cx="42" cy="57" r="9" fill="#18181B" stroke="#FACC15" strokeWidth="3" />
                </g>
                <text
                  x="72"
                  y="54"
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
                  y="82"
                  fill="#F4F4F5"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="600"
                  fontSize="14.5"
                  letterSpacing="1.8"
                >
                  LADANG OTOMATIS KENDARAAN DARAT
                </text>
              </svg>

              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl">
                Program armada <strong className="text-white">Traktor, Penabur, Pemanen, dan Pengangkut</strong> menggunakan bahasa{' '}
                <strong className="text-emerald-400 font-mono">Python</strong>. Kelola bahan bakar solar, medan berlumpur, pergantian alat tempel, bengkel, dan logistik gudang.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setGameScreen('PLAYING')}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Mulai Simulasi ({currentLevel.title.split(':')[0]})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsThesisModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#1E2229] hover:bg-[#282E38] border border-[#323946] text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span>Data Evaluasi Skripsi ({completedCount}/10)</span>
                </button>
              </div>
            </div>

            {/* 10-Level Selector Card */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-[#16191E]/95 border border-[#2A303C] shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                  Kurikulum 10 Level Simulasi
                </span>
                <span className="text-xs font-mono text-emerald-400 tabular-nums">
                  {completedCount}/10 Selesai
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[310px] overflow-y-auto pr-1">
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
                      className={`p-2.5 rounded-lg border text-left transition-all flex items-start justify-between gap-2 cursor-pointer disabled:opacity-45 ${
                        isSelected
                          ? 'bg-emerald-950/50 border-emerald-500/70 text-white'
                          : 'bg-[#1D2128] hover:bg-[#252A34] border-[#2C323D] text-zinc-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono text-zinc-400">
                          {lvl.stage}
                        </div>
                        <div className="text-xs font-bold truncate mt-0.5">
                          {lvl.title}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-mono text-xs">
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

          {/* Single Flat Control-Hint Line per Game Craft Guidelines */}
          <div className="text-center text-xs font-mono text-zinc-400">
            Enter / Space Mulai · Drag Mouse Putar Kamera 3D · Scroll Zoom · Esc Jeda Simulasi
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
  // 2. ACTIVE PLAY WORKSPACE (Responsive Desktop 3D + Collapsible Dock & Mobile Split)
  // ============================================================================
  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#121518] overflow-hidden select-none">
      {/* Top Perimeter Status & Level Bar */}
      <header className="h-12 px-3 sm:px-5 bg-[#181B20] border-b border-[#282D37] flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Brand & Level Selector */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              stopTimer();
              setGameScreen('TITLE');
            }}
            className="text-sm font-extrabold tracking-tight text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            AGROCODE
          </button>
          <span className="text-zinc-600">/</span>
          <select
            value={currentLevelId}
            onChange={(e) => switchLevel(Number(e.target.value))}
            className="bg-[#121518] border border-[#2E3440] rounded px-2.5 py-1 text-xs font-semibold text-zinc-100 focus:outline-none focus:border-emerald-500 truncate max-w-[220px] sm:max-w-xs cursor-pointer"
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

        {/* Center: Objective Summary on Desktop */}
        <div className="hidden xl:flex items-center gap-2 text-xs text-zinc-300 truncate max-w-md">
          <span className="text-zinc-500 font-mono">Misi:</span>
          <span className="truncate">{currentLevel.objective.description}</span>
        </div>

        {/* Right: Workspace Toggles & Modals */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCodePanelDesktop((v) => !v)}
            className={`hidden lg:flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
              showCodePanelDesktop
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#222730] border-[#303744] text-zinc-400'
            }`}
            title="Tampilkan / Sembunyikan Panel Kode Python"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHudPanelDesktop((v) => !v)}
            className={`hidden lg:flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
              showHudPanelDesktop
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#222730] border-[#303744] text-zinc-400'
            }`}
            title="Tampilkan / Sembunyikan Status Mesin"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Status</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTechModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#222730] hover:bg-[#2C323E] border border-[#303744] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Tech Tree</span>
          </button>

          <button
            type="button"
            onClick={() => setIsThesisModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#222730] hover:bg-[#2C323E] border border-[#303744] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Laporan & Ekspor Data Skripsi"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Data Skripsi</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 rounded bg-[#222730] hover:bg-[#2C323E] border border-[#303744] text-zinc-300 cursor-pointer"
            title={isMuted ? 'Suara Mati' : 'Suara Aktif'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Split / Full-Viewport Body (Supports Mobile Top-Bottom Split & Desktop Floating Overlay) */}
      <div className="relative flex-1 flex flex-col lg:block min-h-0 overflow-hidden">
        {/* 3D Farm Viewport (Top 46% on Mobile Portrait, 100% Full-Bleed on Desktop) */}
        <div className="relative w-full h-[45%] lg:h-full shrink-0">
          <FarmViewport3D
            world={world}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            onSelectTile={(t) => setInspectedTile(t)}
            cameraPreset={cameraPreset}
          />

          {/* Inspected Tile Mini Callout (Bottom-Left on Mobile / Top-Center-Right on Desktop) */}
          {inspectedTile && (
            <div className="absolute top-3 right-3 lg:right-[310px] z-10 px-3 py-1.5 rounded bg-[#181B20]/95 border border-[#2D333D] text-[11px] font-mono text-zinc-200 flex items-center gap-2 shadow-lg">
              <span>
                Petak ({inspectedTile.x}, {inspectedTile.z}):{' '}
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

        {/* Desktop Floating Left Panel OR Mobile Bottom Split: Python Code Editor */}
        {showCodePanelDesktop && (
          <div className="flex-1 lg:flex-none lg:absolute lg:top-3 lg:left-3 lg:bottom-20 lg:w-[430px] xl:w-[470px] z-10 p-2 lg:p-0 min-h-0 flex flex-col">
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

        {/* Desktop Floating Right Panel: Field Statistics & Machine Status (VE01) */}
        {showHudPanelDesktop && (
          <div className="hidden lg:block lg:absolute lg:top-3 lg:right-3 lg:w-[285px] z-10 pointer-events-auto">
            <MachineStatusHUD
              world={world}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
            />
          </div>
        )}

        {/* Collapsible Unified Bottom Control Dock (Follows Three.js Skill Section 5) */}
        <div
          className={`lg:absolute lg:bottom-3 lg:left-1/2 lg:-translate-x-1/2 z-20 w-full lg:max-w-[820px] px-2 transition-transform duration-200 ${
            isDockCollapsed ? 'lg:translate-y-[calc(100%-28px)]' : 'lg:translate-y-0'
          }`}
        >
          {/* Collapse / Expand Toggle Tab (Desktop) */}
          <div className="hidden lg:flex justify-center">
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

          {/* Main Dock Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#181B20]/95 border border-[#2D333D] shadow-2xl">
            {/* Primary Execution Controls */}
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
                title="Eksekusi 1 Langkah (Step-by-Step Debugging)"
              >
                <StepForward className="w-3.5 h-3.5 text-sky-400" />
                <span>Langkah</span>
              </button>

              <button
                type="button"
                onClick={resetSimulationWorld}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#242933] hover:bg-[#2E3542] text-zinc-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Reset Posisi Kendaraan & Ladang"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Live Status Log Ticker */}
            <div className="hidden md:flex items-center gap-2 min-w-0 flex-1 px-2 text-xs font-mono truncate">
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

            {/* Speed & Camera Presets */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Speed Selector */}
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

              {/* Camera View Selector */}
              <div className="hidden sm:flex items-center bg-[#121518] p-0.5 rounded border border-[#262B33]">
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
      </div>

      {/* Victory / Level Completed Modal */}
      {showVictoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl bg-[#181B20] border border-emerald-500/50 p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6 text-emerald-400" />
            </div>

            <div>
              <div className="text-xs font-mono text-emerald-400 uppercase">
                Simulasi Berhasil
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {currentLevel.title} Selesai!
              </h2>
              <div className="text-2xl text-amber-400 tracking-widest mt-2">
                {'★'.repeat(calculateStarRating(world))}
                {'☆'.repeat(3 - calculateStarRating(world))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-[#121518] border border-[#252A34] font-mono text-xs tabular-nums">
              <div>
                <div className="text-zinc-400 text-[10px]">Total Tick</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {world.metrics.ticks}
                </div>
              </div>
              <div>
                <div className="text-zinc-400 text-[10px]">Solar Terpakai</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">
                  {world.metrics.fuelUsed} L
                </div>
              </div>
              <div>
                <div className="text-zinc-400 text-[10px]">Total Panen</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {world.metrics.harvestedTotal}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVictoryModal(false)}
                className="px-4 py-2 rounded-lg bg-[#242933] hover:bg-[#2E3542] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
              >
                Tinjau Kode
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVictoryModal(false);
                  setIsTechModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-[#242933] hover:bg-[#2E3542] text-xs font-semibold text-amber-300 transition-colors cursor-pointer"
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
