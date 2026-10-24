import React from 'react';
import { SimulationWorld, getTotalCargo } from '../engine/farmSimulation';
import { Fuel, Wrench, Package,Sprout, CheckCircle2, Circle, Truck } from 'lucide-react';

interface MachineStatusHUDProps {
  world: SimulationWorld;
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
}

export const MachineStatusHUD: React.FC<MachineStatusHUDProps> = ({
  world,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const vehicles = Object.values(world.vehicles);
  const activeVehicle = world.vehicles[selectedVehicleId] || vehicles[0];
  const m = world.metrics;
  const obj = world.level.objective;

  const cargoCount = activeVehicle ? getTotalCargo(activeVehicle.cargo) : 0;
  const cargoPct = activeVehicle
    ? Math.min(100, Math.round((cargoCount / Math.max(1, activeVehicle.maxCargo)) * 100))
    : 0;
  const fuelPct = activeVehicle
    ? Math.min(100, Math.round((activeVehicle.fuel / Math.max(1, activeVehicle.maxFuel)) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-2.5 w-full text-xs text-zinc-200 select-none">
      {/* 1. Field Statistics Card (Matches Top-Right Card in PDF Page 1 Screenshot) */}
      <div className="p-3 rounded-lg bg-[#181B20]/95 border border-[#2C323B] shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-zinc-100 tracking-tight">
            Statistik Ladang
          </h3>
          <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
            Tick: {m.ticks} · Solar: {m.fuelUsed}L
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 py-1.5 px-2 rounded bg-[#121518] border border-[#232830] mb-2.5 tabular-nums">
          <div>
            <div className="text-[10px] text-zinc-400">Total Panen</div>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {m.harvestedTotal}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">Di Gudang</div>
            <div className="text-sm font-bold text-amber-400 font-mono">
              {m.warehouseDeliveredTotal}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">Dibajak/Tanam</div>
            <div className="text-sm font-bold text-sky-400 font-mono">
              {m.tilledCount}/{m.plantedCount}
            </div>
          </div>
        </div>

        {/* Level Objectives Checklist */}
        <div className="space-y-1 text-[11px]">
          <div className="text-zinc-400 font-medium mb-1">Target Level:</div>
          {obj.targetTilledCount !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-300">
                {m.tilledCount >= obj.targetTilledCount ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                )}
                Bajak Tanah
              </span>
              <span className="font-mono tabular-nums text-zinc-300">
                {m.tilledCount}/{obj.targetTilledCount}
              </span>
            </div>
          )}
          {obj.targetPlantedCount !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-300">
                {m.plantedCount >= obj.targetPlantedCount ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                )}
                Tanam Bibit
              </span>
              <span className="font-mono tabular-nums text-zinc-300">
                {m.plantedCount}/{obj.targetPlantedCount}
              </span>
            </div>
          )}
          {obj.targetHarvestTotal !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-300">
                {m.harvestedTotal >= obj.targetHarvestTotal ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                )}
                Hasil Panen
              </span>
              <span className="font-mono tabular-nums text-zinc-300">
                {m.harvestedTotal}/{obj.targetHarvestTotal}
              </span>
            </div>
          )}
          {obj.targetWarehouseTotal !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-300">
                {m.warehouseDeliveredTotal >= obj.targetWarehouseTotal ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                )}
                Setor ke Gudang
              </span>
              <span className="font-mono tabular-nums text-zinc-300">
                {m.warehouseDeliveredTotal}/{obj.targetWarehouseTotal}
              </span>
            </div>
          )}
          {obj.maxFuelUsed !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-300">
                {m.fuelUsed <= obj.maxFuelUsed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                )}
                Batas Solar
              </span>
              <span className="font-mono tabular-nums text-amber-300">
                {m.fuelUsed}/{obj.maxFuelUsed}L
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Machine Status (VE01) Card (Matches Middle-Right Card in PDF Page 1 Screenshot) */}
      {activeVehicle && (
        <div className="p-3 rounded-lg bg-[#181B20]/95 border border-[#2C323B] shadow-xl">
          {/* Vehicle Selector Tabs if Multiple Vehicles */}
          {vehicles.length > 1 && (
            <div className="flex items-center gap-1 p-1 mb-2.5 rounded bg-[#121518] border border-[#232830]">
              {vehicles.map((v) => {
                const pyObjName =
                  v.id === 'traktor' ? 'tractor' : v.id === 'pemanen' ? 'harvester' : 'hauler';
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVehicle(v.id)}
                    className={`flex-1 py-1 px-2 rounded text-[11px] font-mono font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      v.id === activeVehicle.id
                        ? 'bg-emerald-600 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {pyObjName} ({v.codeAlias})
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-zinc-100 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              Machine Status ({activeVehicle.codeAlias})
            </span>
            <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
              Pos: ({activeVehicle.x}, {activeVehicle.z}) ·{' '}
              {activeVehicle.direction === 'timur'
                ? 'EAST'
                : activeVehicle.direction === 'barat'
                ? 'WEST'
                : activeVehicle.direction === 'utara'
                ? 'NORTH'
                : 'SOUTH'}
            </span>
          </div>

          <div className="text-[11px] text-zinc-400 mb-2">
            Model: {activeVehicle.name} · Implement:{' '}
            <span className="text-amber-300 font-mono font-semibold uppercase">
              {activeVehicle.implement === 'bajak'
                ? 'plow'
                : activeVehicle.implement === 'penabur'
                ? 'seeder'
                : activeVehicle.implement === 'pemanen'
                ? 'harvester'
                : 'none'}
            </span>
          </div>

          {/* Fuel / Solar Bar */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1 text-zinc-300">
                <Fuel className="w-3 h-3 text-amber-400" />
                Bahan Bakar Solar:
              </span>
              <span className="font-mono tabular-nums text-amber-300 font-semibold">
                {activeVehicle.fuel}/{activeVehicle.maxFuel} ({fuelPct}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#121518] overflow-hidden border border-[#262B33]">
              <div
                className={`h-full transition-all duration-200 ${
                  fuelPct < 25 ? 'bg-red-500' : fuelPct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${fuelPct}%` }}
              />
            </div>
          </div>

          {/* Tool & Engine Condition Breakdown */}
          <div className="mb-2.5 py-1.5 px-2 rounded bg-[#121518] border border-[#232830] space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-zinc-300">
                <Wrench className="w-3 h-3 text-sky-400" />
                Kondisi Mesin Utama:
              </span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  activeVehicle.condition < 35 ? 'text-red-400' : 'text-sky-300'
                }`}
              >
                {activeVehicle.condition}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
              <span>· Bajak: {activeVehicle.toolCondition.bajak}%</span>
              <span>· Penabur: {activeVehicle.toolCondition.penabur}%</span>
              <span>· Pemanen: {activeVehicle.toolCondition.pemanen}%</span>
            </div>
          </div>

          {/* Crop Tank Capacity */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1 text-zinc-300">
                <Package className="w-3 h-3 text-emerald-400" />
                Tangki Panen (Crop Tank):
              </span>
              <span className="font-mono tabular-nums text-zinc-200">
                {cargoCount}/{activeVehicle.maxCargo} ({cargoPct}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#121518] overflow-hidden border border-[#262B33]">
              <div
                className="h-full bg-amber-400 transition-all duration-200"
                style={{ width: `${cargoPct}%` }}
              />
            </div>
          </div>

          {/* Seeds Inventory */}
          <div className="flex items-center justify-between pt-1.5 border-t border-[#262B33] text-[11px]">
            <span className="flex items-center gap-1 text-zinc-400">
              <Sprout className="w-3 h-3 text-emerald-400" />
              Stok Bibit:
            </span>
            <div className="flex items-center gap-2 font-mono tabular-nums text-zinc-300">
              <span>Wortel: {activeVehicle.seeds.wortel}</span>
              <span>·</span>
              <span>Gandum: {activeVehicle.seeds.gandum}</span>
              <span>·</span>
              <span>Jagung: {activeVehicle.seeds.jagung}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
