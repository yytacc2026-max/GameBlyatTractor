import React from 'react';
import { TECH_TREE_NODES } from '../data/techTree';
import { CropInventory, TechNode } from '../types/game';
import { X, Check, Lock, Cpu, Unlock } from 'lucide-react';

interface TechTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedTechIds: string[];
  cropBank: CropInventory;
  onUnlockTech: (node: TechNode) => void;
  unlockAllThesisMode: boolean;
  onToggleThesisMode: () => void;
}

export const TechTreeModal: React.FC<TechTreeModalProps> = ({
  isOpen,
  onClose,
  unlockedTechIds,
  cropBank,
  onUnlockTech,
  unlockAllThesisMode,
  onToggleThesisMode,
}) => {
  if (!isOpen) return null;

  const canAfford = (node: TechNode) => {
    if (unlockAllThesisMode) return true;
    const c = node.cost;
    if (c.wortel && cropBank.wortel < c.wortel) return false;
    if (c.gandum && cropBank.gandum < c.gandum) return false;
    if (c.jagung && cropBank.jagung < c.jagung) return false;
    return true;
  };

  const isPrereqMet = (node: TechNode) => {
    if (unlockAllThesisMode || !node.prerequisiteId) return true;
    return unlockedTechIds.includes(node.prerequisiteId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl bg-[#181B20] border border-[#2D333D] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1E2229] border-b border-[#2D333D]">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              Pohon Teknologi Pertanian (Tech Tree)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Gunakan hasil panen yang terkumpul untuk membuka alat tempel, ban lumpur, tangki solar, dan API navigasi baru.
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

        {/* Crop Bank Bar & Thesis Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-[#14171B] border-b border-[#262B33]">
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <span className="text-zinc-400">Simpanan Hasil Panen:</span>
            <span className="text-orange-400 font-semibold">
              Wortel: {cropBank.wortel}
            </span>
            <span>·</span>
            <span className="text-yellow-400 font-semibold">
              Gandum: {cropBank.gandum}
            </span>
            <span>·</span>
            <span className="text-emerald-400 font-semibold">
              Jagung: {cropBank.jagung}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleThesisMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              unlockAllThesisMode
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                : 'bg-[#222730] border-[#333A47] text-zinc-300 hover:bg-[#2B313C]'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>
              {unlockAllThesisMode
                ? 'Mode Uji Skripsi Aktif (Semua Terbuka)'
                : 'Aktifkan Mode Uji Skripsi (Buka Semua Level & Tech)'}
            </span>
          </button>
        </div>

        {/* Tech Tree Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {TECH_TREE_NODES.map((node) => {
            const isUnlocked = unlockAllThesisMode || unlockedTechIds.includes(node.id);
            const prereqOk = isPrereqMet(node);
            const affordable = canAfford(node);

            return (
              <div
                key={node.id}
                className={`p-4 rounded-lg border flex flex-col justify-between transition-colors ${
                  isUnlocked
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : prereqOk
                    ? 'bg-[#1D2128] border-[#313844]'
                    : 'bg-[#15181D] border-[#242932] opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-mono text-emerald-400">
                      {node.category}
                    </span>
                    {isUnlocked ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Terbuka
                      </span>
                    ) : !prereqOk ? (
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <Lock className="w-3.5 h-3.5" /> Terkunci
                      </span>
                    ) : null}
                  </div>

                  <h3 className="text-sm font-bold text-zinc-100 mb-1">
                    {node.name}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-2">
                    {node.description}
                  </p>
                  <div className="text-xs font-mono text-amber-300 mb-3">
                    Efek: {node.effectText}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#2A303A]">
                  <div className="text-xs font-mono text-zinc-400 tabular-nums">
                    {Object.keys(node.cost).length === 0 ? (
                      <span>Gratis (Bawaan)</span>
                    ) : (
                      <span>
                        Biaya:{' '}
                        {[
                          node.cost.wortel ? `${node.cost.wortel} Wortel` : null,
                          node.cost.gandum ? `${node.cost.gandum} Gandum` : null,
                          node.cost.jagung ? `${node.cost.jagung} Jagung` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </div>

                  {!isUnlocked && (
                    <button
                      type="button"
                      disabled={!prereqOk || !affordable}
                      onClick={() => onUnlockTech(node)}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white transition-colors cursor-pointer"
                    >
                      Buka Teknologi
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
