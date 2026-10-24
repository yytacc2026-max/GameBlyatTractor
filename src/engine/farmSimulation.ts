import {
  CropInventory,
  CropType,
  Direction,
  ImplementType,
  LevelDefinition,
  SimulationLogEntry,
  SimulationMetrics,
  TileData,
  TerrainType,
  VehicleState,
} from '../types/game';

export interface SimulationWorld {
  level: LevelDefinition;
  width: number;
  height: number;
  tiles: TileData[][]; // [z][x]
  vehicles: Record<string, VehicleState>;
  metrics: SimulationMetrics;
  logs: SimulationLogEntry[];
  unlockedTechIds: string[];
  activeLine: number | null;
  status: 'idle' | 'running' | 'paused' | 'victory' | 'failed';
  failureReason: string | null;
}

const CHAR_TO_TERRAIN: Record<string, TerrainType> = {
  '.': 'tanah_biasa',
  '~': 'tanah_biasa',
  M: 'lumpur',
  R: 'batu',
  '=': 'jalan',
  F: 'pom_bensin',
  W: 'gudang',
  B: 'bengkel',
};

export function createInitialWorld(
  level: LevelDefinition,
  unlockedTechIds: string[] = []
): SimulationWorld {
  const hasExtraFuel = unlockedTechIds.includes('tech_fuel_tank_1');
  const hasExtraCargo = unlockedTechIds.includes('tech_cargo_silo_1');
  const hasMultiSync = unlockedTechIds.includes('tech_multi_vehicle_sync');

  const tiles: TileData[][] = [];
  for (let z = 0; z < level.gridHeight; z++) {
    const row: TileData[] = [];
    const rowStr = level.layout[z] || '.'.repeat(level.gridWidth);
    for (let x = 0; x < level.gridWidth; x++) {
      const ch = rowStr[x] || '.';
      const terrain = CHAR_TO_TERRAIN[ch] || 'tanah_biasa';
      row.push({
        x,
        z,
        terrain,
        soil: ch === '~' ? 'sudah_dibajak' : 'belum_dibajak',
        crop: 'kosong',
        growth: 0,
      });
    }
    tiles.push(row);
  }

  if (level.initialCrops) {
    for (const c of level.initialCrops) {
      if (tiles[c.z] && tiles[c.z][c.x]) {
        tiles[c.z][c.x].crop = c.crop;
        tiles[c.z][c.x].growth = c.growth;
        tiles[c.z][c.x].soil = c.soil || 'sudah_dibajak';
      }
    }
  }

  const vehicles: Record<string, VehicleState> = {};
  for (const v of level.vehicles) {
    const bonusFuel = hasExtraFuel ? 40 : 0;
    const bonusCargo = hasExtraCargo ? 10 : 0;
    const seedMultiplier = hasMultiSync ? 1.5 : 1;

    // Level 7 starts with damaged tractor to teach repair workshop
    const initialCondition = level.id === 7 && v.id === 'traktor' ? 35 : 95;

    vehicles[v.id] = {
      id: v.id,
      codeAlias: v.codeAlias,
      name: v.name,
      role: v.role,
      x: v.x,
      z: v.z,
      direction: v.direction,
      fuel: v.fuel + (v.fuel === v.maxFuel ? bonusFuel : 0),
      maxFuel: v.maxFuel + bonusFuel,
      condition: initialCondition,
      toolCondition: {
        bajak: initialCondition,
        penabur: initialCondition,
        pemanen: initialCondition,
      },
      implement: v.implement,
      cargo: { wortel: 0, gandum: 0, jagung: 0 },
      maxCargo: v.maxCargo + bonusCargo,
      seeds: {
        wortel: Math.round(v.seeds.wortel * seedMultiplier),
        gandum: Math.round(v.seeds.gandum * seedMultiplier),
        jagung: Math.round(v.seeds.jagung * seedMultiplier),
      },
      actionLabel: null,
      actionTimer: 0,
    };
  }

  return {
    level,
    width: level.gridWidth,
    height: level.gridHeight,
    tiles,
    vehicles,
    unlockedTechIds,
    activeLine: null,
    status: 'idle',
    failureReason: null,
    logs: [
      {
        tick: 0,
        line: 0,
        vehicleId: 'sistem',
        message: `Siap menjalankan ${level.title}. Target: ${level.objective.description}`,
        type: 'info',
      },
    ],
    metrics: {
      ticks: 0,
      fuelUsed: 0,
      tilledCount: 0,
      plantedCount: 0,
      harvestedTotal: 0,
      harvestedByCrop: { wortel: 0, gandum: 0, jagung: 0 },
      warehouseDeliveredTotal: 0,
      warehouseByCrop: { wortel: 0, gandum: 0, jagung: 0 },
      toolSwitches: 0,
      repairsCount: 0,
      refuelsCount: 0,
      mudTilesCrossed: 0,
      roadTilesCrossed: 0,
      collisionsCount: 0,
    },
  };
}

export function cloneWorld(world: SimulationWorld): SimulationWorld {
  return {
    ...world,
    tiles: world.tiles.map((row) => row.map((t) => ({ ...t }))),
    vehicles: Object.fromEntries(
      Object.entries(world.vehicles).map(([k, v]) => [
        k,
        {
          ...v,
          toolCondition: { ...v.toolCondition },
          cargo: { ...v.cargo },
          seeds: { ...v.seeds },
        },
      ])
    ),
    metrics: {
      ...world.metrics,
      harvestedByCrop: { ...world.metrics.harvestedByCrop },
      warehouseByCrop: { ...world.metrics.warehouseByCrop },
    },
    logs: [...world.logs],
  };
}

export function getTotalCargo(cargo: CropInventory): number {
  return cargo.wortel + cargo.gandum + cargo.jagung;
}

export function getDirectionDelta(dir: Direction): { dx: number; dz: number } {
  switch (dir) {
    case 'utara':
      return { dx: 0, dz: -1 };
    case 'timur':
      return { dx: 1, dz: 0 };
    case 'selatan':
      return { dx: 0, dz: 1 };
    case 'barat':
      return { dx: -1, dz: 0 };
  }
}

export function rotateDirection(dir: Direction, turn: 'kanan' | 'kiri'): Direction {
  const order: Direction[] = ['utara', 'timur', 'selatan', 'barat'];
  const idx = order.indexOf(dir);
  if (turn === 'kanan') {
    return order[(idx + 1) % 4];
  }
  return order[(idx + 3) % 4];
}

export function advanceCropGrowth(world: SimulationWorld, growthDelta = 25) {
  for (let z = 0; z < world.height; z++) {
    for (let x = 0; x < world.width; x++) {
      const tile = world.tiles[z][x];
      if (tile.crop !== 'kosong' && tile.growth < 100) {
        tile.growth = Math.min(100, tile.growth + growthDelta);
      }
    }
  }
}

export function checkLevelObjectiveMet(world: SimulationWorld): boolean {
  const obj = world.level.objective;
  const m = world.metrics;

  if (obj.targetTilledCount !== undefined && m.tilledCount < obj.targetTilledCount) {
    return false;
  }
  if (obj.targetPlantedCount !== undefined && m.plantedCount < obj.targetPlantedCount) {
    return false;
  }
  if (obj.targetHarvestTotal !== undefined && m.harvestedTotal < obj.targetHarvestTotal) {
    return false;
  }
  if (
    obj.targetCrop !== undefined &&
    m.harvestedByCrop[obj.targetCrop.crop] < obj.targetCrop.count
  ) {
    return false;
  }
  if (
    obj.targetWarehouseTotal !== undefined &&
    m.warehouseDeliveredTotal < obj.targetWarehouseTotal
  ) {
    return false;
  }
  if (obj.maxFuelUsed !== undefined && m.fuelUsed > obj.maxFuelUsed) {
    return false;
  }
  if (obj.maxTicks !== undefined && m.ticks > obj.maxTicks) {
    return false;
  }

  return true;
}

export function calculateStarRating(world: SimulationWorld): number {
  if (!checkLevelObjectiveMet(world)) return 0;
  const { threeStarsTicks, twoStarsTicks, threeStarsFuel } = world.level.starThresholds;
  const { ticks, fuelUsed } = world.metrics;

  if (ticks <= threeStarsTicks && fuelUsed <= threeStarsFuel) {
    return 3;
  }
  if (ticks <= twoStarsTicks) {
    return 2;
  }
  return 1;
}

/**
 * Dijkstra pathfinding on the farm grid that avoids rocks ('batu') and other vehicles,
 * while preferring paved roads ('jalan') and avoiding mud ('lumpur') where possible.
 */
export function findOptimalPath(
  world: SimulationWorld,
  vehicle: VehicleState,
  targetX: number,
  targetZ: number
): Array<{ x: number; z: number }> {
  const startX = vehicle.x;
  const startZ = vehicle.z;
  if (startX === targetX && startZ === targetZ) return [];

  const occupied = new Set<string>();
  for (const v of Object.values(world.vehicles)) {
    if (v.id !== vehicle.id) {
      occupied.add(`${v.x},${v.z}`);
    }
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, { x: number; z: number } | null> = {};
  const queue: Array<{ x: number; z: number; cost: number }> = [];

  const startKey = `${startX},${startZ}`;
  dist[startKey] = 0;
  prev[startKey] = null;
  queue.push({ x: startX, z: startZ, cost: 0 });

  const dirs = [
    { dx: 0, dz: -1 },
    { dx: 1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: -1, dz: 0 },
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const curr = queue.shift()!;
    if (curr.x === targetX && curr.z === targetZ) break;

    for (const d of dirs) {
      const nx = curr.x + d.dx;
      const nz = curr.z + d.dz;
      if (nx < 0 || nx >= world.width || nz < 0 || nz >= world.height) continue;

      const tile = world.tiles[nz][nx];
      if (tile.terrain === 'batu') continue;

      const nKey = `${nx},${nz}`;
      // Avoid colliding with another vehicle unless it's not blocking
      if (occupied.has(nKey)) continue;

      let stepCost = 1.0;
      if (tile.terrain === 'jalan') stepCost = 0.5;
      else if (tile.terrain === 'lumpur') stepCost = 2.8;

      const newCost = curr.cost + stepCost;
      if (dist[nKey] === undefined || newCost < dist[nKey]) {
        dist[nKey] = newCost;
        prev[nKey] = { x: curr.x, z: curr.z };
        queue.push({ x: nx, z: nz, cost: newCost });
      }
    }
  }

  const targetKey = `${targetX},${targetZ}`;
  if (prev[targetKey] === undefined) {
    return [];
  }

  const path: Array<{ x: number; z: number }> = [];
  let trace: { x: number; z: number } | null = { x: targetX, z: targetZ };
  while (trace && !(trace.x === startX && trace.z === startZ)) {
    path.unshift(trace);
    trace = prev[`${trace.x},${trace.z}`] || null;
  }
  return path;
}

export function findNearestTileByTerrain(
  world: SimulationWorld,
  fromX: number,
  fromZ: number,
  terrain: TerrainType
): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestDist = Infinity;

  for (let z = 0; z < world.height; z++) {
    for (let x = 0; x < world.width; x++) {
      if (world.tiles[z][x].terrain === terrain) {
        const d = Math.abs(x - fromX) + Math.abs(z - fromZ);
        if (d < bestDist) {
          bestDist = d;
          best = { x, z };
        }
      }
    }
  }
  return best;
}

export function normalizeCropName(raw: string): Exclude<CropType, 'kosong'> {
  const s = String(raw || 'carrot').toLowerCase().trim();
  if (s.includes('wheat') || s.includes('gandum')) return 'gandum';
  if (s.includes('corn') || s.includes('maize') || s.includes('jagung')) return 'jagung';
  return 'wortel';
}

export function normalizeImplementName(raw: string): ImplementType {
  const s = String(raw || '').toLowerCase().trim();
  if (s.includes('plow') || s.includes('till') || s.includes('bajak')) return 'bajak';
  if (s.includes('seed') || s.includes('plant') || s.includes('penabur') || s.includes('tanam')) return 'penabur';
  if (s.includes('harvest') || s.includes('cutter') || s.includes('pemanen') || s.includes('panen')) return 'pemanen';
  return 'kosong';
}

export function normalizeDirectionName(raw: string): Direction {
  const s = String(raw || '').toLowerCase().trim();
  if (s.includes('north') || s.includes('utara') || s === 'n' || s === 'u') return 'utara';
  if (s.includes('south') || s.includes('selatan') || s === 's') return 'selatan';
  if (s.includes('west') || s.includes('barat') || s === 'w' || s === 'b') return 'barat';
  return 'timur';
}
