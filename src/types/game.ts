export type TerrainType =
  | 'tanah_biasa'
  | 'lumpur'
  | 'batu'
  | 'jalan'
  | 'pom_bensin'
  | 'gudang'
  | 'bengkel';

export type SoilState = 'belum_dibajak' | 'sudah_dibajak';

export type CropType = 'kosong' | 'wortel' | 'gandum' | 'jagung';

export type Direction = 'utara' | 'timur' | 'selatan' | 'barat';

export type ImplementType = 'kosong' | 'bajak' | 'penabur' | 'pemanen';

export type VehicleRole = 'traktor' | 'pemanen' | 'pengangkut';

export interface TileData {
  x: number;
  z: number;
  terrain: TerrainType;
  soil: SoilState;
  crop: CropType;
  /** 0 to 100, ready to harvest at 100 */
  growth: number;
}

export interface ToolConditionMap {
  bajak: number;
  penabur: number;
  pemanen: number;
}

export interface SeedInventory {
  wortel: number;
  gandum: number;
  jagung: number;
}

export interface CropInventory {
  wortel: number;
  gandum: number;
  jagung: number;
}

export interface VehicleState {
  id: string; // e.g., 'traktor', 'pengangkut', 'pemanen'
  codeAlias: string; // e.g., 'VE01', 'VE02', 'VE03'
  name: string;
  role: VehicleRole;
  x: number;
  z: number;
  direction: Direction;
  fuel: number;
  maxFuel: number;
  condition: number; // 0..100 overall engine/chassis health
  toolCondition: ToolConditionMap;
  implement: ImplementType;
  cargo: CropInventory;
  maxCargo: number;
  seeds: SeedInventory;
  actionLabel: string | null; // e.g., 'Membajak', 'Menanam', 'Memanen', 'Isi Solar', 'Perbaikan'
  actionTimer: number;
}

export interface LevelObjective {
  description: string;
  targetHarvestTotal?: number;
  targetCrop?: { crop: Exclude<CropType, 'kosong'>; count: number };
  targetWarehouseTotal?: number;
  targetTilledCount?: number;
  targetPlantedCount?: number;
  maxFuelUsed?: number;
  maxTicks?: number;
}

export interface LevelDefinition {
  id: number;
  stage: 'Tahap Awal' | 'Tahap Menengah' | 'Tahap Akhir';
  title: string;
  subtitle: string;
  description: string;
  learningFocus: string[];
  gridWidth: number;
  gridHeight: number;
  layout: string[]; // ASCII map representation for clean level design
  initialCrops?: Array<{
    x: number;
    z: number;
    crop: Exclude<CropType, 'kosong'>;
    growth: number;
    soil?: SoilState;
  }>;
  vehicles: Array<{
    id: string;
    codeAlias: string;
    name: string;
    role: VehicleRole;
    x: number;
    z: number;
    direction: Direction;
    fuel: number;
    maxFuel: number;
    implement: ImplementType;
    maxCargo: number;
    seeds: SeedInventory;
  }>;
  objective: LevelObjective;
  starThresholds: {
    threeStarsTicks: number;
    twoStarsTicks: number;
    threeStarsFuel: number;
  };
  starterCode: string;
  solutionCode: string;
  hints: string[];
}

export interface TechNode {
  id: string;
  name: string;
  category: 'Alat Tempel' | 'Mesin & Roda' | 'Logistik' | 'API Python';
  description: string;
  effectText: string;
  cost: {
    wortel?: number;
    gandum?: number;
    jagung?: number;
  };
  prerequisiteId?: string;
}

export interface SimulationLogEntry {
  tick: number;
  line: number;
  vehicleId: string;
  message: string;
  type: 'info' | 'action' | 'warning' | 'error' | 'success';
}

export interface SimulationMetrics {
  ticks: number;
  fuelUsed: number;
  tilledCount: number;
  plantedCount: number;
  harvestedTotal: number;
  harvestedByCrop: CropInventory;
  warehouseDeliveredTotal: number;
  warehouseByCrop: CropInventory;
  toolSwitches: number;
  repairsCount: number;
  refuelsCount: number;
  mudTilesCrossed: number;
  roadTilesCrossed: number;
  collisionsCount: number;
}

export interface SavedProgress {
  completedLevels: Record<
    number,
    {
      stars: number;
      bestTicks: number;
      bestFuel: number;
      completedAt: string;
    }
  >;
  unlockedTechIds: string[];
  cropBank: CropInventory;
  savedCodeByLevel: Record<number, string>;
  unlockAllThesisMode: boolean;
}
