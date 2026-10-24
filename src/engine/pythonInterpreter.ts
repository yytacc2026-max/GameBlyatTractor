import {
  advanceCropGrowth,
  checkLevelObjectiveMet,
  cloneWorld,
  findNearestTileByTerrain,
  findOptimalPath,
  getDirectionDelta,
  getTotalCargo,
  normalizeCropName,
  normalizeDirectionName,
  normalizeImplementName,
  rotateDirection,
  SimulationWorld,
} from './farmSimulation';
import { soundEngine } from '../audio/soundEngine';
import { Direction, ImplementType, TerrainType, VehicleState } from '../types/game';

export interface StepEvent {
  world: SimulationWorld;
  line: number;
  soundType?: 'move' | 'mud' | 'road' | 'turn' | 'till' | 'plant' | 'harvest' | 'refuel' | 'repair' | 'error';
}

interface SourceLine {
  lineNumber: number; // 1-based
  indent: number;
  text: string;
}

type Stmt =
  | { type: 'expr'; line: number; expr: string }
  | { type: 'assign'; line: number; target: string; op: '=' | '+=' | '-='; expr: string }
  | { type: 'if'; line: number; branches: Array<{ line: number; cond: string | null; body: Stmt[] }> }
  | { type: 'while'; line: number; cond: string; body: Stmt[] }
  | { type: 'for'; line: number; varName: string; iterExpr: string; body: Stmt[] }
  | { type: 'def'; line: number; name: string; params: string[]; body: Stmt[] }
  | { type: 'return'; line: number; expr: string | null }
  | { type: 'break'; line: number }
  | { type: 'continue'; line: number }
  | { type: 'pass'; line: number };

export class PythonSyntaxError extends Error {
  public line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

export class SimulationRuntimeError extends Error {
  public line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

const TERRAIN_TO_EN: Record<TerrainType, string> = {
  tanah_biasa: 'soil',
  lumpur: 'mud',
  batu: 'rock',
  jalan: 'road',
  pom_bensin: 'fuel_station',
  gudang: 'warehouse',
  bengkel: 'workshop',
};

const DIR_TO_EN: Record<Direction, string> = {
  utara: 'north',
  timur: 'east',
  selatan: 'south',
  barat: 'west',
};

const IMPL_TO_EN: Record<ImplementType, string> = {
  kosong: 'none',
  bajak: 'plow',
  penabur: 'seeder',
  pemanen: 'harvester',
};

function preprocessLines(code: string): SourceLine[] {
  const rawLines = code.split(/\r?\n/);
  const result: SourceLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    let inSingle = false;
    let inDouble = false;
    let clean = '';
    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === '#' && !inSingle && !inDouble) {
        break;
      }
      clean += ch;
    }

    if (!clean.trim()) continue;

    let indent = 0;
    for (let c = 0; c < clean.length; c++) {
      if (clean[c] === ' ') indent += 1;
      else if (clean[c] === '\t') indent += 4;
      else break;
    }

    result.push({
      lineNumber: i + 1,
      indent,
      text: clean.trim(),
    });
  }

  return result;
}

function parseBlock(lines: SourceLine[], startIdx: number, baseIndent: number): { stmts: Stmt[]; nextIdx: number } {
  const stmts: Stmt[] = [];
  let i = startIdx;

  while (i < lines.length) {
    const current = lines[i];
    if (current.indent < baseIndent) {
      break;
    }
    if (current.indent > baseIndent) {
      throw new PythonSyntaxError(
        `IndentationError on line ${current.lineNumber}: unexpected indent in "${current.text}"`,
        current.lineNumber
      );
    }

    const txt = current.text;
    const ln = current.lineNumber;

    // 1. if / elif / else
    if (txt.startsWith('if ') || txt.startsWith('if(')) {
      if (!txt.endsWith(':')) {
        throw new PythonSyntaxError(`SyntaxError on line ${ln}: expected ':' at end of if statement`, ln);
      }
      const cond = txt.slice(2, -1).trim();
      i++;
      if (i >= lines.length || lines[i].indent <= baseIndent) {
        throw new PythonSyntaxError(`IndentationError on line ${ln}: expected an indented block after 'if'`, ln);
      }
      const firstBody = parseBlock(lines, i, lines[i].indent);
      const branches: Array<{ line: number; cond: string | null; body: Stmt[] }> = [
        { line: ln, cond, body: firstBody.stmts },
      ];
      i = firstBody.nextIdx;

      while (i < lines.length && lines[i].indent === baseIndent) {
        const nextTxt = lines[i].text;
        const nextLn = lines[i].lineNumber;
        if (nextTxt.startsWith('elif ') || nextTxt.startsWith('elif(')) {
          if (!nextTxt.endsWith(':')) {
            throw new PythonSyntaxError(`SyntaxError on line ${nextLn}: expected ':' after elif`, nextLn);
          }
          const elifCond = nextTxt.slice(4, -1).trim();
          i++;
          if (i >= lines.length || lines[i].indent <= baseIndent) {
            throw new PythonSyntaxError(`IndentationError on line ${nextLn}: expected an indented block after 'elif'`, nextLn);
          }
          const elifBody = parseBlock(lines, i, lines[i].indent);
          branches.push({ line: nextLn, cond: elifCond, body: elifBody.stmts });
          i = elifBody.nextIdx;
        } else if (nextTxt.startsWith('else:') || nextTxt === 'else :') {
          i++;
          if (i >= lines.length || lines[i].indent <= baseIndent) {
            throw new PythonSyntaxError(`IndentationError on line ${nextLn}: expected an indented block after 'else'`, nextLn);
          }
          const elseBody = parseBlock(lines, i, lines[i].indent);
          branches.push({ line: nextLn, cond: null, body: elseBody.stmts });
          i = elseBody.nextIdx;
          break;
        } else {
          break;
        }
      }

      stmts.push({ type: 'if', line: ln, branches });
      continue;
    }

    // 2. while
    if (txt.startsWith('while ') || txt.startsWith('while(')) {
      if (!txt.endsWith(':')) {
        throw new PythonSyntaxError(`SyntaxError on line ${ln}: expected ':' at end of while statement`, ln);
      }
      const cond = txt.slice(5, -1).trim();
      i++;
      if (i >= lines.length || lines[i].indent <= baseIndent) {
        throw new PythonSyntaxError(`IndentationError on line ${ln}: expected an indented block after 'while'`, ln);
      }
      const bodyRes = parseBlock(lines, i, lines[i].indent);
      stmts.push({ type: 'while', line: ln, cond, body: bodyRes.stmts });
      i = bodyRes.nextIdx;
      continue;
    }

    // 3. for ... in ...:
    if (txt.startsWith('for ')) {
      if (!txt.endsWith(':')) {
        throw new PythonSyntaxError(`SyntaxError on line ${ln}: expected ':' at end of for loop`, ln);
      }
      const m = txt.slice(4, -1).match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.+)$/);
      if (!m) {
        throw new PythonSyntaxError(
          `SyntaxError on line ${ln}: invalid for-loop syntax. Example: for i in range(5):`,
          ln
        );
      }
      const varName = m[1].trim();
      const iterExpr = m[2].trim();
      i++;
      if (i >= lines.length || lines[i].indent <= baseIndent) {
        throw new PythonSyntaxError(`IndentationError on line ${ln}: expected an indented block after 'for'`, ln);
      }
      const bodyRes = parseBlock(lines, i, lines[i].indent);
      stmts.push({ type: 'for', line: ln, varName, iterExpr, body: bodyRes.stmts });
      i = bodyRes.nextIdx;
      continue;
    }

    // 4. def name(params):
    if (txt.startsWith('def ')) {
      if (!txt.endsWith(':')) {
        throw new PythonSyntaxError(`SyntaxError on line ${ln}: expected ':' at end of function definition`, ln);
      }
      const m = txt.slice(4, -1).match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
      if (!m) {
        throw new PythonSyntaxError(`SyntaxError on line ${ln}: invalid def syntax`, ln);
      }
      const name = m[1].trim();
      const params = m[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
      if (i >= lines.length || lines[i].indent <= baseIndent) {
        throw new PythonSyntaxError(`IndentationError on line ${ln}: expected an indented block for function '${name}'`, ln);
      }
      const bodyRes = parseBlock(lines, i, lines[i].indent);
      stmts.push({ type: 'def', line: ln, name, params, body: bodyRes.stmts });
      i = bodyRes.nextIdx;
      continue;
    }

    // 5. Simple keywords
    if (txt === 'break') {
      stmts.push({ type: 'break', line: ln });
      i++;
      continue;
    }
    if (txt === 'continue') {
      stmts.push({ type: 'continue', line: ln });
      i++;
      continue;
    }
    if (txt === 'pass') {
      stmts.push({ type: 'pass', line: ln });
      i++;
      continue;
    }
    if (txt === 'return' || txt.startsWith('return ')) {
      const expr = txt === 'return' ? null : txt.slice(7).trim();
      stmts.push({ type: 'return', line: ln, expr });
      i++;
      continue;
    }

    // 6. Assignment (=, +=, -=) vs expression
    const assignMatch = matchAssignment(txt);
    if (assignMatch) {
      stmts.push({
        type: 'assign',
        line: ln,
        target: assignMatch.target,
        op: assignMatch.op,
        expr: assignMatch.expr,
      });
      i++;
      continue;
    }

    stmts.push({ type: 'expr', line: ln, expr: txt });
    i++;
  }

  return { stmts, nextIdx: i };
}

function matchAssignment(txt: string): { target: string; op: '=' | '+=' | '-='; expr: string } | null {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (depth === 0) {
        if (txt.slice(i, i + 2) === '+=') {
          return { target: txt.slice(0, i).trim(), op: '+=', expr: txt.slice(i + 2).trim() };
        }
        if (txt.slice(i, i + 2) === '-=') {
          return { target: txt.slice(0, i).trim(), op: '-=', expr: txt.slice(i + 2).trim() };
        }
        if (
          ch === '=' &&
          txt[i - 1] !== '=' &&
          txt[i - 1] !== '!' &&
          txt[i - 1] !== '<' &&
          txt[i - 1] !== '>' &&
          txt[i + 1] !== '='
        ) {
          return { target: txt.slice(0, i).trim(), op: '=', expr: txt.slice(i + 1).trim() };
        }
      }
    }
  }
  return null;
}

/**
 * Creates a step-by-step generator that runs the player's Python code on the farm world.
 * Primary API is idiomatic English Python (tractor.move_forward, tractor.till, etc.)
 * with full backward-compatibility for Indonesian aliases.
 */
export function* createPythonSimulationRunner(
  code: string,
  initialWorld: SimulationWorld,
  maxSteps = 450
): Generator<StepEvent, void, unknown> {
  const world = cloneWorld(initialWorld);
  world.status = 'running';

  let parsedStmts: Stmt[] = [];
  try {
    const lines = preprocessLines(code);
    if (lines.length === 0) {
      world.status = 'failed';
      world.failureReason = 'Python script is empty. Write commands for tractor to start.';
      world.logs.push({
        tick: 0,
        line: 1,
        vehicleId: 'system',
        message: world.failureReason,
        type: 'error',
      });
      yield { world: cloneWorld(world), line: 1, soundType: 'error' };
      return;
    }
    const res = parseBlock(lines, 0, lines[0].indent);
    parsedStmts = res.stmts;
  } catch (err) {
    const line = err instanceof PythonSyntaxError ? err.line : 1;
    const msg = err instanceof Error ? err.message : 'Python SyntaxError';
    world.status = 'failed';
    world.failureReason = msg;
    world.activeLine = line;
    world.logs.push({
      tick: world.metrics.ticks,
      line,
      vehicleId: 'python',
      message: `${msg}`,
      type: 'error',
    });
    yield { world: cloneWorld(world), line, soundType: 'error' };
    return;
  }

  let stepCount = 0;
  const hasLowMudCost = world.unlockedTechIds.includes('tech_mud_tires');
  const hasLowToolWear = world.unlockedTechIds.includes('tech_hardened_blades');
  const hasFastSwitch = world.unlockedTechIds.includes('tech_basic_implements');
  const hasAutoPathBonus = world.unlockedTechIds.includes('tech_auto_pathfinder');

  const logEvent = (
    line: number,
    vehicleId: string,
    message: string,
    type: 'info' | 'action' | 'warning' | 'error' | 'success' = 'action'
  ) => {
    world.logs.push({
      tick: world.metrics.ticks,
      line,
      vehicleId,
      message,
      type,
    });
  };

  const checkCollision = (movingVehicle: VehicleState, targetX: number, targetZ: number, line: number) => {
    for (const other of Object.values(world.vehicles)) {
      if (other.id !== movingVehicle.id && other.x === targetX && other.z === targetZ) {
        world.metrics.collisionsCount += 1;
        throw new SimulationRuntimeError(
          `RuntimeError: Collision! ${movingVehicle.name} collided with ${other.name} at (${targetX}, ${targetZ}).`,
          line
        );
      }
    }
  };

  const consumeFuelAndWear = (
    v: VehicleState,
    fuelCost: number,
    wearCost: number,
    line: number,
    toolToWear?: 'bajak' | 'penabur' | 'pemanen'
  ) => {
    const actualWear = hasLowToolWear ? wearCost * 0.5 : wearCost;
    v.fuel = Math.max(0, Number((v.fuel - fuelCost).toFixed(1)));
    world.metrics.fuelUsed = Number((world.metrics.fuelUsed + fuelCost).toFixed(1));

    v.condition = Math.max(0, Number((v.condition - actualWear).toFixed(1)));
    if (toolToWear) {
      v.toolCondition[toolToWear] = Math.max(
        0,
        Number((v.toolCondition[toolToWear] - actualWear * 1.2).toFixed(1))
      );
    }

    if (v.fuel <= 0) {
      throw new SimulationRuntimeError(
        `RuntimeError: ${v.name} ran out of diesel fuel (0%) at (${v.x}, ${v.z})! Call tractor.refuel() at the Fuel Station.`,
        line
      );
    }
    if (v.condition <= 0) {
      throw new SimulationRuntimeError(
        `RuntimeError: ${v.name} broke down (condition 0%) at (${v.x}, ${v.z})! Call tractor.repair() at the Workshop.`,
        line
      );
    }
  };

  function* stepMoveOne(v: VehicleState, line: number, isAutoPath = false): Generator<StepEvent, void, unknown> {
    const { dx, dz } = getDirectionDelta(v.direction);
    const nx = v.x + dx;
    const nz = v.z + dz;

    if (nx < 0 || nx >= world.width || nz < 0 || nz >= world.height) {
      throw new SimulationRuntimeError(
        `RuntimeError: ${v.name} moved out of field bounds at (${nx}, ${nz}).`,
        line
      );
    }

    const destTile = world.tiles[nz][nx];
    if (destTile.terrain === 'batu') {
      throw new SimulationRuntimeError(
        `RuntimeError: ${v.name} hit a Rock obstacle at (${nx}, ${nz})! Use inspect_front() or move_to(x, y).`,
        line
      );
    }

    checkCollision(v, nx, nz, line);

    let moveFuel = 1.5;
    let soundType: StepEvent['soundType'] = 'move';
    if (destTile.terrain === 'jalan') {
      moveFuel = 0.5;
      world.metrics.roadTilesCrossed += 1;
      soundType = 'road';
    } else if (destTile.terrain === 'lumpur') {
      moveFuel = hasLowMudCost ? 1.8 : 3.0;
      world.metrics.mudTilesCrossed += 1;
      soundType = 'mud';
    }

    if (isAutoPath && hasAutoPathBonus) {
      moveFuel *= 0.8;
    }

    v.x = nx;
    v.z = nz;
    v.actionLabel =
      destTile.terrain === 'lumpur'
        ? 'Heavy Mud'
        : destTile.terrain === 'jalan'
        ? 'Road Boost'
        : 'Moving';
    world.metrics.ticks += 1;
    world.activeLine = line;
    advanceCropGrowth(world, 15);
    consumeFuelAndWear(v, moveFuel, 1.0, line);

    yield { world: cloneWorld(world), line, soundType };
    v.actionLabel = null;
  }

  function* stepNavigateTo(v: VehicleState, targetX: number, targetZ: number, line: number): Generator<StepEvent, void, unknown> {
    const tx = Math.max(0, Math.min(world.width - 1, Math.round(targetX)));
    const tz = Math.max(0, Math.min(world.height - 1, Math.round(targetZ)));

    if (v.x === tx && v.z === tz) return;

    const path = findOptimalPath(world, v, tx, tz);
    if (path.length === 0) {
      throw new SimulationRuntimeError(
        `RuntimeError: No obstacle-free path found for ${v.name} to (${tx}, ${tz}).`,
        line
      );
    }

    for (const step of path) {
      const dx = step.x - v.x;
      const dz = step.z - v.z;
      if (dx === 1) v.direction = 'timur';
      else if (dx === -1) v.direction = 'barat';
      else if (dz === 1) v.direction = 'selatan';
      else if (dz === -1) v.direction = 'utara';

      yield* stepMoveOne(v, line, true);
    }
  }

  function* stepTill(v: VehicleState, line: number): Generator<StepEvent, void, unknown> {
    if (v.implement !== 'bajak') {
      if (world.level.id >= 4) {
        throw new SimulationRuntimeError(
          `RuntimeError: ${v.name} does not have the "plow" implement equipped! Call tractor.equip("plow") first.`,
          line
        );
      }
      v.implement = 'bajak';
    }

    const tile = world.tiles[v.z][v.x];
    if (tile.terrain !== 'tanah_biasa' && tile.terrain !== 'lumpur') {
      throw new SimulationRuntimeError(
        `RuntimeError: Cannot till on ${TERRAIN_TO_EN[tile.terrain]} at (${v.x}, ${v.z}).`,
        line
      );
    }

    v.actionLabel = 'Tilling';
    world.metrics.ticks += 1;
    world.activeLine = line;

    if (tile.soil !== 'sudah_dibajak') {
      tile.soil = 'sudah_dibajak';
      world.metrics.tilledCount += 1;
    }

    advanceCropGrowth(world, 20);
    consumeFuelAndWear(v, 2.0, 2.5, line, 'bajak');
    logEvent(line, v.id, `${v.name} tilled soil at (${v.x}, ${v.z}).`, 'action');

    yield { world: cloneWorld(world), line, soundType: 'till' };
    v.actionLabel = null;
  }

  function* stepPlant(v: VehicleState, rawCrop: string, line: number): Generator<StepEvent, void, unknown> {
    const crop = normalizeCropName(rawCrop);
    const cropEn = crop === 'wortel' ? 'carrot' : crop === 'gandum' ? 'wheat' : 'corn';

    if (v.implement !== 'penabur') {
      if (world.level.id === 4) {
        throw new SimulationRuntimeError(
          `RuntimeError: ${v.name} does not have the "seeder" implement equipped! Call tractor.equip("seeder") first.`,
          line
        );
      }
      v.implement = 'penabur';
    }

    const tile = world.tiles[v.z][v.x];
    if (tile.soil !== 'sudah_dibajak') {
      throw new SimulationRuntimeError(
        `RuntimeError: Soil at (${v.x}, ${v.z}) is untilled! Call tractor.till() before tractor.plant("${cropEn}").`,
        line
      );
    }
    if (tile.crop !== 'kosong') {
      throw new SimulationRuntimeError(
        `RuntimeError: Tile (${v.x}, ${v.z}) already has a crop planted.`,
        line
      );
    }
    if (v.seeds[crop] <= 0) {
      throw new SimulationRuntimeError(
        `RuntimeError: ${v.name} is out of "${cropEn}" seeds!`,
        line
      );
    }

    v.seeds[crop] -= 1;
    tile.crop = crop;
    tile.growth = 35;
    v.actionLabel = `Planting ${cropEn}`;
    world.metrics.ticks += 1;
    world.metrics.plantedCount += 1;
    world.activeLine = line;

    advanceCropGrowth(world, 25);
    consumeFuelAndWear(v, 1.5, 2.0, line, 'penabur');
    logEvent(line, v.id, `${v.name} planted ${cropEn} seed at (${v.x}, ${v.z}).`, 'action');

    yield { world: cloneWorld(world), line, soundType: 'plant' };
    v.actionLabel = null;
  }

  function* stepHarvest(v: VehicleState, line: number): Generator<StepEvent, void, unknown> {
    if (v.implement !== 'pemanen') {
      if (world.level.id === 4) {
        throw new SimulationRuntimeError(
          `RuntimeError: ${v.name} does not have the "harvester" implement equipped! Call tractor.equip("harvester") first.`,
          line
        );
      }
      v.implement = 'pemanen';
    }

    const tile = world.tiles[v.z][v.x];
    if (tile.crop === 'kosong') {
      throw new SimulationRuntimeError(
        `RuntimeError: No crop to harvest at (${v.x}, ${v.z}).`,
        line
      );
    }
    if (tile.growth < 100) {
      throw new SimulationRuntimeError(
        `RuntimeError: Crop at (${v.x}, ${v.z}) is not mature yet (${tile.growth}%). Check is_crop_ready() or call wait_until_ripe().`,
        line
      );
    }

    const currentCargo = getTotalCargo(v.cargo);
    if (currentCargo >= v.maxCargo) {
      throw new SimulationRuntimeError(
        `RuntimeError: ${v.name} crop tank is full (${currentCargo}/${v.maxCargo})! Call deliver_to_warehouse() to unload.`,
        line
      );
    }

    const harvestedCrop = tile.crop;
    const cropEn = harvestedCrop === 'wortel' ? 'carrot' : harvestedCrop === 'gandum' ? 'wheat' : 'corn';
    tile.crop = 'kosong';
    tile.growth = 0;

    v.cargo[harvestedCrop] += 1;
    v.actionLabel = `Harvesting ${cropEn}`;
    world.metrics.ticks += 1;
    world.metrics.harvestedTotal += 1;
    world.metrics.harvestedByCrop[harvestedCrop] += 1;
    world.activeLine = line;

    advanceCropGrowth(world, 20);
    consumeFuelAndWear(v, 2.0, 3.0, line, 'pemanen');
    logEvent(
      line,
      v.id,
      `${v.name} harvested 1 ${cropEn} at (${v.x}, ${v.z}). Tank: ${getTotalCargo(v.cargo)}/${v.maxCargo}`,
      'success'
    );

    yield { world: cloneWorld(world), line, soundType: 'harvest' };
    v.actionLabel = null;
  }

  function* stepEquipImplement(v: VehicleState, rawImpl: string, line: number): Generator<StepEvent, void, unknown> {
    const impl = normalizeImplementName(rawImpl);
    if (v.implement === impl) return;

    v.implement = impl;
    const implEn = IMPL_TO_EN[impl].toUpperCase();
    v.actionLabel = `Equip ${implEn}`;
    const switchTicks = hasFastSwitch ? 1 : 2;
    world.metrics.ticks += switchTicks;
    world.metrics.toolSwitches += 1;
    world.activeLine = line;

    consumeFuelAndWear(v, 1.0, 0.5, line);
    logEvent(line, v.id, `${v.name} equipped implement: ${implEn}.`, 'info');

    yield { world: cloneWorld(world), line, soundType: 'turn' };
    v.actionLabel = null;
  }

  function* stepRefuel(v: VehicleState, line: number): Generator<StepEvent, void, unknown> {
    const tile = world.tiles[v.z][v.x];
    if (tile.terrain !== 'pom_bensin') {
      const nearest = findNearestTileByTerrain(world, v.x, v.z, 'pom_bensin');
      if (!nearest) {
        throw new SimulationRuntimeError(`RuntimeError: No Fuel Station found on this field.`, line);
      }
      yield* stepNavigateTo(v, nearest.x, nearest.z, line);
    }

    v.fuel = v.maxFuel;
    v.actionLabel = 'Refueling 100%';
    world.metrics.ticks += 1;
    world.metrics.refuelsCount += 1;
    world.activeLine = line;
    logEvent(line, v.id, `${v.name} refueled diesel tank to ${v.maxFuel}L at Fuel Station.`, 'success');

    yield { world: cloneWorld(world), line, soundType: 'refuel' };
    v.actionLabel = null;
  }

  function* stepRepair(v: VehicleState, line: number): Generator<StepEvent, void, unknown> {
    const tile = world.tiles[v.z][v.x];
    if (tile.terrain !== 'bengkel') {
      const nearest = findNearestTileByTerrain(world, v.x, v.z, 'bengkel');
      if (!nearest) {
        throw new SimulationRuntimeError(`RuntimeError: No Workshop found on this field.`, line);
      }
      yield* stepNavigateTo(v, nearest.x, nearest.z, line);
    }

    v.condition = 100;
    v.toolCondition = { bajak: 100, penabur: 100, pemanen: 100 };
    v.actionLabel = 'Repairing 100%';
    world.metrics.ticks += 1;
    world.metrics.repairsCount += 1;
    world.activeLine = line;
    logEvent(line, v.id, `${v.name} repaired engine & implements to 100% at Workshop.`, 'success');

    yield { world: cloneWorld(world), line, soundType: 'repair' };
    v.actionLabel = null;
  }

  function* stepDeliverToWarehouse(v: VehicleState, line: number): Generator<StepEvent, void, unknown> {
    const tile = world.tiles[v.z][v.x];
    if (tile.terrain !== 'gudang') {
      const nearest = findNearestTileByTerrain(world, v.x, v.z, 'gudang');
      if (!nearest) {
        throw new SimulationRuntimeError(`RuntimeError: No Warehouse found on this field.`, line);
      }
      yield* stepNavigateTo(v, nearest.x, nearest.z, line);
    }

    const total = getTotalCargo(v.cargo);
    world.metrics.warehouseDeliveredTotal += total;
    world.metrics.warehouseByCrop.wortel += v.cargo.wortel;
    world.metrics.warehouseByCrop.gandum += v.cargo.gandum;
    world.metrics.warehouseByCrop.jagung += v.cargo.jagung;

    v.cargo = { wortel: 0, gandum: 0, jagung: 0 };
    v.actionLabel = `Unloaded ${total} Crops`;
    world.metrics.ticks += 1;
    world.activeLine = line;
    logEvent(
      line,
      v.id,
      `${v.name} delivered ${total} crops to Warehouse. Total stored: ${world.metrics.warehouseDeliveredTotal}`,
      'success'
    );

    yield { world: cloneWorld(world), line, soundType: 'harvest' };
    v.actionLabel = null;
  }

  function* stepTransferCargo(source: VehicleState, target: VehicleState, line: number): Generator<StepEvent, void, unknown> {
    const dist = Math.abs(source.x - target.x) + Math.abs(source.z - target.z);
    if (dist > 1) {
      throw new SimulationRuntimeError(
        `RuntimeError: ${source.name} is too far from ${target.name} to transfer cargo (distance ${dist} tiles; must be adjacent).`,
        line
      );
    }

    const spaceLeft = target.maxCargo - getTotalCargo(target.cargo);
    let transferred = 0;
    (['wortel', 'gandum', 'jagung'] as const).forEach((crop) => {
      const amount = Math.min(source.cargo[crop], spaceLeft - transferred);
      if (amount > 0) {
        source.cargo[crop] -= amount;
        target.cargo[crop] += amount;
        transferred += amount;
      }
    });

    source.actionLabel = `Transfer -> ${target.codeAlias}`;
    target.actionLabel = `Loaded +${transferred}`;
    world.metrics.ticks += 1;
    world.activeLine = line;
    logEvent(line, source.id, `${source.name} transferred ${transferred} crops to ${target.name}.`, 'info');

    yield { world: cloneWorld(world), line, soundType: 'harvest' };
    source.actionLabel = null;
    target.actionLabel = null;
  }

  const env: Record<string, unknown> = {};
  const userFuncs: Record<string, { params: string[]; body: Stmt[] }> = {};

  const createVehicleProxy = (v: VehicleState) => {
    const seedProxy = new Proxy(v.seeds as unknown as Record<string, number>, {
      get(target, prop: string) {
        const k = normalizeCropName(prop);
        return target[k];
      },
      set(target, prop: string, val: number) {
        const k = normalizeCropName(prop);
        target[k] = val;
        return true;
      },
    });

    return {
      __vehicleId: v.id,
      get id() {
        return v.id;
      },
      get x() {
        return v.x;
      },
      get y() {
        return v.z;
      },
      get z() {
        return v.z;
      },
      get position() {
        return [v.x, v.z];
      },
      // English properties
      get direction() {
        return DIR_TO_EN[v.direction];
      },
      get fuel() {
        return v.fuel;
      },
      get max_fuel() {
        return v.maxFuel;
      },
      get energy_level() {
        return v.fuel;
      },
      get condition() {
        return v.condition;
      },
      get implement() {
        return IMPL_TO_EN[v.implement];
      },
      get cargo() {
        return getTotalCargo(v.cargo);
      },
      get capacity() {
        return v.maxCargo;
      },
      get seeds() {
        return seedProxy;
      },
      // Indonesian aliases for backward compatibility
      get arah() {
        return v.direction;
      },
      get bahan_bakar() {
        return v.fuel;
      },
      get kondisi() {
        return v.condition;
      },
      get alat() {
        return v.implement;
      },
      get muatan() {
        return getTotalCargo(v.cargo);
      },
      get kapasitas() {
        return v.maxCargo;
      },
      get bibit() {
        return seedProxy;
      },
      inventory: {
        seeds: seedProxy,
        crop_storage: {
          add: () => {},
        },
      },
      current_path_pattern: 'snake',
    };
  };

  const refreshEnvProxies = () => {
    for (const v of Object.values(world.vehicles)) {
      const proxy = createVehicleProxy(v);
      env[v.id] = proxy;
      env[v.codeAlias] = proxy;
      // Bind standard English names: tractor, harvester, hauler
      if (v.id === 'traktor' || v.role === 'traktor') {
        env.tractor = proxy;
      }
      if (v.id === 'pemanen' || v.role === 'pemanen') {
        env.harvester = proxy;
      }
      if (v.id === 'pengangkut' || v.role === 'pengangkut') {
        env.hauler = proxy;
      }
    }
    const first = Object.values(world.vehicles)[0];
    if (first) {
      const firstProxy = createVehicleProxy(first);
      if (!env.tractor) env.tractor = firstProxy;
      if (!env.traktor) env.traktor = firstProxy;
      if (!env.VE01) env.VE01 = firstProxy;
    }
  };

  refreshEnvProxies();

  // Constants for PDF Page 1 Screenshot compatibility
  env.Grounds = {
    Untilled: 'untilled',
    Tilled: 'tilled',
    MatureCrop: 'mature_crop',
  };
  env.Entities = {
    Carrot: 'carrot',
    Wheat: 'wheat',
    Corn: 'corn',
  };
  env.attachment = {
    till_unit: {
      is_ready: () => true,
      activate: () => true,
    },
    seeder_unit: {
      activate: () => true,
    },
    harvester_unit: {
      activate: () => true,
    },
  };
  env.sensor = {
    inspect: (pos?: [number, number]) => {
      const defaultV = Object.values(world.vehicles)[0];
      const x = Array.isArray(pos) ? pos[0] : defaultV.x;
      const z = Array.isArray(pos) ? pos[1] : defaultV.z;
      const tile = world.tiles[z]?.[x];
      if (!tile) return { type: 'rock', crop: 'none' };
      const type =
        tile.crop !== 'kosong' && tile.growth >= 100
          ? 'mature_crop'
          : tile.soil === 'sudah_dibajak'
          ? 'tilled'
          : 'untilled';
      return {
        type,
        terrain: TERRAIN_TO_EN[tile.terrain],
        soil: tile.soil === 'sudah_dibajak' ? 'tilled' : 'untilled',
        crop:
          tile.crop === 'wortel'
            ? 'carrot'
            : tile.crop === 'gandum'
            ? 'wheat'
            : tile.crop === 'jagung'
            ? 'corn'
            : 'none',
        growth: tile.growth,
      };
    },
  };
  env.path_finder = {
    get_next_tile: () => {
      const v = Object.values(world.vehicles)[0];
      const nextX = (v.x + 1) % world.width;
      const nextZ = nextX === 0 ? (v.z + 1) % world.height : v.z;
      return [nextX, nextZ];
    },
  };

  const evalExpr = (exprStr: string, line: number): unknown => {
    refreshEnvProxies();
    const trimmed = exprStr.trim();
    if (!trimmed) return null;

    const rangeFn = (a: number, b?: number, c?: number): number[] => {
      let start = 0;
      let stop = a;
      let step = 1;
      if (b !== undefined) {
        start = a;
        stop = b;
      }
      if (c !== undefined) {
        step = c;
      }
      const arr: number[] = [];
      if (step > 0) {
        for (let x = start; x < stop; x += step) arr.push(x);
      } else if (step < 0) {
        for (let x = start; x > stop; x += step) arr.push(x);
      }
      return arr;
    };

    const defaultVehicle = Object.values(world.vehicles)[0];

    const inspectGroundFn = (v: VehicleState = defaultVehicle) => {
      const t = world.tiles[v.z][v.x];
      return TERRAIN_TO_EN[t.terrain];
    };

    const inspectFrontFn = (v: VehicleState = defaultVehicle) => {
      const { dx, dz } = getDirectionDelta(v.direction);
      const nx = v.x + dx;
      const nz = v.z + dz;
      if (nx < 0 || nx >= world.width || nz < 0 || nz >= world.height) return 'out_of_bounds';
      return TERRAIN_TO_EN[world.tiles[nz][nx].terrain];
    };

    const isCropReadyFn = (v: VehicleState = defaultVehicle) => {
      const t = world.tiles[v.z][v.x];
      return t.crop !== 'kosong' && t.growth >= 100;
    };

    const getStatusFn = (v: VehicleState = defaultVehicle) => ({
      id: v.id,
      x: v.x,
      y: v.z,
      direction: DIR_TO_EN[v.direction],
      fuel: v.fuel,
      condition: v.condition,
      implement: IMPL_TO_EN[v.implement],
      cargo: getTotalCargo(v.cargo),
      capacity: v.maxCargo,
    });

    const jsExpr = transformPythonExprToJs(trimmed);

    const context: Record<string, unknown> = {
      ...env,
      True: true,
      False: false,
      None: null,
      range: rangeFn,
      len: (x: unknown[]) => (Array.isArray(x) || typeof x === 'string' ? x.length : 0),
      abs: Math.abs,
      min: Math.min,
      max: Math.max,
      round: Math.round,
      int: (x: unknown) => parseInt(String(x), 10),
      str: (x: unknown) => String(x),
      // English global sensor functions
      inspect_ground: () => inspectGroundFn(defaultVehicle),
      inspect_front: () => inspectFrontFn(defaultVehicle),
      is_crop_ready: () => isCropReadyFn(defaultVehicle),
      get_status: () => getStatusFn(defaultVehicle),
      // Indonesian aliases
      cek_tanah: () => inspectGroundFn(defaultVehicle),
      cek_depan: () => inspectFrontFn(defaultVehicle),
      tanaman_siap: () => isCropReadyFn(defaultVehicle),
      status: () => getStatusFn(defaultVehicle),
      calculate_yield: () => 1,
    };

    const attachSensorMethods = (p: Record<string, unknown> | undefined, v: VehicleState) => {
      if (!p) return;
      p.inspect_ground = () => inspectGroundFn(v);
      p.inspect_front = () => inspectFrontFn(v);
      p.is_crop_ready = () => isCropReadyFn(v);
      p.get_status = () => getStatusFn(v);
      p.get_position = () => [v.x, v.z];
      p.cek_tanah = () => inspectGroundFn(v);
      p.cek_depan = () => inspectFrontFn(v);
      p.tanaman_siap = () => isCropReadyFn(v);
      p.status = () => getStatusFn(v);
      p.posisi = () => [v.x, v.z];
      p.detect_crop = () => world.tiles[v.z][v.x].crop !== 'kosong';
      p.update_energy = () => v.fuel;
    };

    for (const v of Object.values(world.vehicles)) {
      attachSensorMethods(context[v.id] as Record<string, unknown>, v);
      attachSensorMethods(context[v.codeAlias] as Record<string, unknown>, v);
    }
    if (defaultVehicle) {
      attachSensorMethods(context.tractor as Record<string, unknown>, defaultVehicle);
    }
    if (world.vehicles.pemanen) {
      attachSensorMethods(context.harvester as Record<string, unknown>, world.vehicles.pemanen);
    }
    if (world.vehicles.pengangkut) {
      attachSensorMethods(context.hauler as Record<string, unknown>, world.vehicles.pengangkut);
    }

    try {
      const keys = Object.keys(context);
      const vals = Object.values(context);
      const fn = new Function(...keys, `return (${jsExpr});`);
      return fn(...vals);
    } catch (err) {
      throw new SimulationRuntimeError(
        `RuntimeError on line ${line} while evaluating "${trimmed}": ${
          err instanceof Error ? err.message : String(err)
        }`,
        line
      );
    }
  };

  function* executeCallOrExpr(exprStr: string, line: number): Generator<StepEvent, unknown, unknown> {
    const trimmed = exprStr.trim();

    if (trimmed.startsWith('print(') && trimmed.endsWith(')')) {
      const inner = trimmed.slice(6, -1);
      const val = evalExpr(inner, line);
      logEvent(
        line,
        'print',
        typeof val === 'object' ? JSON.stringify(val) : String(val),
        'info'
      );
      world.activeLine = line;
      yield { world: cloneWorld(world), line };
      return null;
    }

    const callMatch = trimmed.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
    if (callMatch) {
      const objName = callMatch[1];
      const methodName = callMatch[2];
      const rawArgsStr = callMatch[3].trim();
      const args: unknown[] = rawArgsStr ? (evalExpr(`[${rawArgsStr}]`, line) as unknown[]) : [];

      let targetVehicle: VehicleState | null = null;
      if (objName) {
        const resolved = env[objName] as { __vehicleId?: string } | undefined;
        if (resolved && resolved.__vehicleId && world.vehicles[resolved.__vehicleId]) {
          targetVehicle = world.vehicles[resolved.__vehicleId];
        }
      } else {
        targetVehicle = Object.values(world.vehicles)[0] || null;
      }

      if (targetVehicle) {
        const v = targetVehicle;
        switch (methodName) {
          case 'move_forward':
          case 'move':
          case 'maju': {
            const steps = args[0] !== undefined ? Number(args[0]) : 1;
            for (let s = 0; s < steps; s++) {
              yield* stepMoveOne(v, line);
            }
            return null;
          }
          case 'turn_right':
          case 'belok_kanan':
          case 'turn':
          case 'belok': {
            const dirArg = args[0] ? String(args[0]).toLowerCase() : 'right';
            const isLeft = dirArg.includes('left') || dirArg.includes('kiri');
            v.direction = rotateDirection(v.direction, isLeft ? 'kiri' : 'kanan');
            v.actionLabel = isLeft ? 'Turn Left' : 'Turn Right';
            world.metrics.ticks += 1;
            world.activeLine = line;
            consumeFuelAndWear(v, 0.5, 0.2, line);
            yield { world: cloneWorld(world), line, soundType: 'turn' };
            v.actionLabel = null;
            return null;
          }
          case 'turn_left':
          case 'belok_kiri': {
            v.direction = rotateDirection(v.direction, 'kiri');
            v.actionLabel = 'Turn Left';
            world.metrics.ticks += 1;
            world.activeLine = line;
            consumeFuelAndWear(v, 0.5, 0.2, line);
            yield { world: cloneWorld(world), line, soundType: 'turn' };
            v.actionLabel = null;
            return null;
          }
          case 'face':
          case 'set_direction':
          case 'hadap': {
            v.direction = normalizeDirectionName(String(args[0] || 'east'));
            v.actionLabel = `Face ${DIR_TO_EN[v.direction]}`;
            world.metrics.ticks += 1;
            world.activeLine = line;
            yield { world: cloneWorld(world), line, soundType: 'turn' };
            v.actionLabel = null;
            return null;
          }
          case 'till':
          case 'plow':
          case 'bajak': {
            yield* stepTill(v, line);
            return null;
          }
          case 'plant':
          case 'sow':
          case 'tanam': {
            const cropName = args[0] !== undefined ? String(args[0]) : 'carrot';
            yield* stepPlant(v, cropName, line);
            return null;
          }
          case 'harvest':
          case 'panen': {
            yield* stepHarvest(v, line);
            return null;
          }
          case 'equip':
          case 'attach':
          case 'pasang_alat': {
            const implName = args[0] !== undefined ? String(args[0]) : 'plow';
            yield* stepEquipImplement(v, implName, line);
            return null;
          }
          case 'refuel':
          case 'go_to_fuel_station':
          case 'isi_bahan_bakar':
          case 'ke_pom_bensin': {
            yield* stepRefuel(v, line);
            return null;
          }
          case 'repair':
          case 'go_to_workshop':
          case 'perbaiki':
          case 'ke_bengkel': {
            yield* stepRepair(v, line);
            return null;
          }
          case 'deliver_to_warehouse':
          case 'unload_at_warehouse':
          case 'go_to_warehouse':
          case 'kirim_ke_gudang':
          case 'ke_gudang': {
            yield* stepDeliverToWarehouse(v, line);
            return null;
          }
          case 'move_to':
          case 'go_to':
          case 'ke': {
            let tx = v.x;
            let tz = v.z;
            if (Array.isArray(args[0])) {
              tx = Number(args[0][0]);
              tz = Number(args[0][1]);
            } else {
              tx = Number(args[0]);
              tz = Number(args[1]);
            }
            yield* stepNavigateTo(v, tx, tz, line);
            return null;
          }
          case 'set_path': {
            const dest = String(args[0] || '');
            if (dest.includes('charge') || dest.includes('fuel') || dest.includes('bensin')) {
              yield* stepRefuel(v, line);
            }
            return null;
          }
          case 'transfer_to':
          case 'transfer_ke':
          case 'muat_ke': {
            const targetArg = args[0] as { __vehicleId?: string } | string | undefined;
            let targetV: VehicleState | undefined;
            if (typeof targetArg === 'string') {
              const norm = targetArg.toLowerCase();
              if (norm === 'hauler') targetV = world.vehicles.pengangkut;
              else if (norm === 'harvester') targetV = world.vehicles.pemanen;
              else if (norm === 'tractor') targetV = world.vehicles.traktor;
              else targetV = world.vehicles[targetArg];
            } else if (targetArg && typeof targetArg === 'object' && targetArg.__vehicleId) {
              targetV = world.vehicles[targetArg.__vehicleId];
            }
            if (!targetV) {
              throw new SimulationRuntimeError(
                `RuntimeError: Target vehicle for transfer_to() not found on line ${line}.`,
                line
              );
            }
            yield* stepTransferCargo(v, targetV, line);
            return null;
          }
          case 'wait_until_ripe':
          case 'tunggu_matang': {
            const tile = world.tiles[v.z][v.x];
            if (tile.crop !== 'kosong' && tile.growth < 100) {
              tile.growth = 100;
              v.actionLabel = 'Waiting for Crop';
              world.metrics.ticks += 1;
              world.activeLine = line;
              yield { world: cloneWorld(world), line };
              v.actionLabel = null;
            }
            return null;
          }
        }
      }

      if (!objName && userFuncs[methodName]) {
        const fnDef = userFuncs[methodName];
        const prevValues: Record<string, unknown> = {};
        fnDef.params.forEach((p, idx) => {
          prevValues[p] = env[p];
          env[p] = args[idx];
        });
        const res = yield* execBlock(fnDef.body);
        fnDef.params.forEach((p) => {
          env[p] = prevValues[p];
        });
        if (res && res.type === 'return') {
          return res.value;
        }
        return null;
      }
    }

    return evalExpr(trimmed, line);
  }

  type FlowSignal =
    | { type: 'normal' }
    | { type: 'break' }
    | { type: 'continue' }
    | { type: 'return'; value: unknown };

  function* execBlock(stmts: Stmt[]): Generator<StepEvent, FlowSignal, unknown> {
    for (const stmt of stmts) {
      stepCount += 1;
      if (stepCount > maxSteps) {
        throw new SimulationRuntimeError(
          `RuntimeError: Execution step limit (${maxSteps} steps) exceeded! Check for infinite while True loops.`,
          stmt.line
        );
      }

      if (checkLevelObjectiveMet(world) && world.metrics.ticks > 0) {
        world.status = 'victory';
        return { type: 'break' };
      }

      switch (stmt.type) {
        case 'pass':
          break;
        case 'break':
          return { type: 'break' };
        case 'continue':
          return { type: 'continue' };
        case 'return': {
          const val = stmt.expr ? yield* executeCallOrExpr(stmt.expr, stmt.line) : null;
          return { type: 'return', value: val };
        }
        case 'def': {
          userFuncs[stmt.name] = { params: stmt.params, body: stmt.body };
          break;
        }
        case 'assign': {
          const val = yield* executeCallOrExpr(stmt.expr, stmt.line);
          if (stmt.op === '=') {
            env[stmt.target] = val;
          } else if (stmt.op === '+=') {
            env[stmt.target] = (Number(env[stmt.target]) || 0) + Number(val);
          } else if (stmt.op === '-=') {
            env[stmt.target] = (Number(env[stmt.target]) || 0) - Number(val);
          }
          break;
        }
        case 'expr': {
          yield* executeCallOrExpr(stmt.expr, stmt.line);
          break;
        }
        case 'if': {
          for (const branch of stmt.branches) {
            const condMet = branch.cond === null ? true : Boolean(evalExpr(branch.cond, branch.line));
            if (condMet) {
              const sig = yield* execBlock(branch.body);
              if (sig.type !== 'normal') return sig;
              break;
            }
          }
          break;
        }
        case 'while': {
          while (Boolean(evalExpr(stmt.cond, stmt.line))) {
            stepCount += 1;
            if (stepCount > maxSteps) {
              throw new SimulationRuntimeError(
                `RuntimeError: while loop exceeded safe step limit (${maxSteps} steps).`,
                stmt.line
              );
            }
            const sig = yield* execBlock(stmt.body);
            if (sig.type === 'break') break;
            if (sig.type === 'return') return sig;
            if (checkLevelObjectiveMet(world)) {
              world.status = 'victory';
              return { type: 'break' };
            }
          }
          break;
        }
        case 'for': {
          const iterable = evalExpr(stmt.iterExpr, stmt.line);
          if (!Array.isArray(iterable)) {
            throw new SimulationRuntimeError(
              `TypeError on line ${stmt.line}: "${stmt.iterExpr}" is not iterable.`,
              stmt.line
            );
          }
          for (const item of iterable) {
            env[stmt.varName] = item;
            const sig = yield* execBlock(stmt.body);
            if (sig.type === 'break') break;
            if (sig.type === 'return') return sig;
          }
          break;
        }
      }
    }
    return { type: 'normal' };
  }

  try {
    yield* execBlock(parsedStmts);

    if (checkLevelObjectiveMet(world)) {
      world.status = 'victory';
      logEvent(
        world.activeLine || 1,
        'system',
        `Objective Complete! Harvested: ${world.metrics.harvestedTotal}, Warehouse: ${world.metrics.warehouseDeliveredTotal}, Fuel used: ${world.metrics.fuelUsed}L`,
        'success'
      );
      soundEngine.playVictory();
      yield { world: cloneWorld(world), line: world.activeLine || 1 };
    } else {
      world.status = 'failed';
      world.failureReason = `Script finished, but level objective is not yet complete: ${world.level.objective.description}`;
      logEvent(world.activeLine || 1, 'system', world.failureReason, 'warning');
      yield { world: cloneWorld(world), line: world.activeLine || 1 };
    }
  } catch (err) {
    const line = err instanceof SimulationRuntimeError ? err.line : world.activeLine || 1;
    const msg = err instanceof Error ? err.message : 'Simulation RuntimeError';
    world.status = 'failed';
    world.failureReason = msg;
    world.activeLine = line;
    logEvent(line, 'error', msg, 'error');
    soundEngine.playError();
    yield { world: cloneWorld(world), line, soundType: 'error' };
  }
}

function transformPythonExprToJs(expr: string): string {
  let out = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;

  while (i < expr.length) {
    const ch = expr[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      out += ch;
      i++;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble) {
      const prevChar = i > 0 ? expr[i - 1] : ' ';
      const isStartBoundary = !/[a-zA-Z0-9_.]/.test(prevChar);

      if (isStartBoundary) {
        if (expr.slice(i, i + 4) === 'and ' || expr.slice(i, i + 4) === 'and(') {
          out += '&& ';
          i += 3;
          continue;
        }
        if (expr.slice(i, i + 3) === 'or ' || expr.slice(i, i + 3) === 'or(') {
          out += '|| ';
          i += 2;
          continue;
        }
        if (expr.slice(i, i + 4) === 'not ' || expr.slice(i, i + 4) === 'not(') {
          out += '! ';
          i += 3;
          continue;
        }
      }
      if (expr.slice(i, i + 2) === '//') {
        out += '/';
        i += 2;
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}
