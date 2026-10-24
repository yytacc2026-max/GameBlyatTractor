import React from 'react';
import { X, BookOpen, Terminal } from 'lucide-react';

interface ApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDocsModal: React.FC<ApiDocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl bg-[#181B20] border border-[#2D333D] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1E2229] border-b border-[#2D333D]">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Python API Reference (Agricultural Vehicles)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Daftar lengkap method dan atribut Python untuk mengontrol objek <code>tractor</code> (VE01), <code>harvester</code> (VE02), dan <code>hauler</code> (VE03).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-[#2A303A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-zinc-300">
          {/* Section 1: Movement & Navigation */}
          <div>
            <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              1. Movement &amp; Route Navigation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.move_forward(steps=1)</code>
                <p className="text-zinc-400 mt-1">
                  Moves the vehicle forward by <code>steps</code> tiles in its current facing direction. Consumes diesel fuel (Road: 0.5L, Soil: 1.5L, Mud: 3.0L).
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.turn_right() / tractor.turn_left()</code>
                <p className="text-zinc-400 mt-1">
                  Rotates the vehicle 90 degrees clockwise or counter-clockwise.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.face("east" | "west" | "north" | "south")</code>
                <p className="text-zinc-400 mt-1">
                  Directly sets the vehicle&apos;s compass heading.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.move_to(x, y)</code>
                <p className="text-zinc-400 mt-1">
                  Automatically navigates to grid coordinates <code>(x, y)</code> using Dijkstra pathfinding (avoids rocks and prefers roads).
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Farming & Implements */}
          <div>
            <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              2. Soil Tilling, Implements &amp; Harvesting
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.equip("plow" | "seeder" | "harvester")</code>
                <p className="text-zinc-400 mt-1">
                  Attaches the specified agricultural implement before working. Switching implements takes simulation ticks.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.till()</code>
                <p className="text-zinc-400 mt-1">
                  Plows/tills the current soil tile so seeds can be planted.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.plant("carrot" | "wheat" | "corn")</code>
                <p className="text-zinc-400 mt-1">
                  Plants a seed on tilled soil. Consumes 1 seed from the vehicle&apos;s inventory.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.harvest()</code>
                <p className="text-zinc-400 mt-1">
                  Harvests a mature crop (100% growth) on the current tile and stores it in the vehicle&apos;s crop tank.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Fuel, Maintenance & Logistics */}
          <div>
            <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              3. Diesel Fuel, Workshop Repair &amp; Warehouse Logistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.go_to_fuel_station() &amp; tractor.refuel()</code>
                <p className="text-zinc-400 mt-1">
                  Navigates to the nearest Fuel Station (F) and refills the diesel fuel tank to 100%.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.go_to_workshop() &amp; tractor.repair()</code>
                <p className="text-zinc-400 mt-1">
                  Navigates to the nearest Workshop (B) and repairs engine &amp; all implements to 100% condition.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.deliver_to_warehouse()</code>
                <p className="text-zinc-400 mt-1">
                  Drives to the Warehouse (W) and unloads all harvested crops from the vehicle&apos;s tank.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.transfer_to(hauler)</code>
                <p className="text-zinc-400 mt-1">
                  Transfers harvested crops from the tractor/harvester into an adjacent hauler truck.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Sensors & Properties */}
          <div>
            <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              4. Sensors &amp; Vehicle Properties
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">is_crop_ready() / tractor.is_crop_ready()</code>
                <p className="text-zinc-400 mt-1">
                  Returns <code>True</code> if the crop on the current tile is 100% mature and ready to harvest.
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">inspect_ground() / tractor.inspect_front()</code>
                <p className="text-zinc-400 mt-1">
                  Returns the terrain type (<code>"soil"</code>, <code>"mud"</code>, <code>"rock"</code>, <code>"road"</code>, <code>"fuel_station"</code>, <code>"warehouse"</code>, <code>"workshop"</code>).
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.fuel / tractor.condition</code>
                <p className="text-zinc-400 mt-1">
                  Reads remaining diesel fuel or current machine condition percentage (0–100).
                </p>
              </div>
              <div className="p-3 rounded bg-[#13161A] border border-[#262B33]">
                <code className="text-amber-300 font-semibold">tractor.cargo / tractor.capacity</code>
                <p className="text-zinc-400 mt-1">
                  Reads current harvested crop count in the tank and maximum tank capacity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
