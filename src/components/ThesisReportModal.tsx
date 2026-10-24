import React from 'react';
import { SimulationWorld } from '../engine/farmSimulation';
import { SavedProgress } from '../types/game';
import { LEVELS } from '../data/levels';
import { X, Download, FileSpreadsheet, Award } from 'lucide-react';

interface ThesisReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  world: SimulationWorld;
  progress: SavedProgress;
  currentCode: string;
}

export const ThesisReportModal: React.FC<ThesisReportModalProps> = ({
  isOpen,
  onClose,
  world,
  progress,
  currentCode,
}) => {
  if (!isOpen) return null;

  const exportCsv = () => {
    const headers = [
      'Level_ID',
      'Nama_Level',
      'Status_Selesai',
      'Bintang_Terbaik',
      'Tick_Terbaik',
      'Solar_Terbaik_L',
      'Tick_Simulasi_Saat_Ini',
      'Solar_Saat_Ini_L',
      'Total_Panen_Saat_Ini',
      'Gudang_Saat_Ini',
    ];

    const rows = LEVELS.map((lvl) => {
      const rec = progress.completedLevels[lvl.id];
      const isCurr = lvl.id === world.level.id;
      return [
        lvl.id,
        `"${lvl.title}"`,
        rec ? 'Selesai' : 'Belum',
        rec ? rec.stars : 0,
        rec ? rec.bestTicks : '-',
        rec ? rec.bestFuel : '-',
        isCurr ? world.metrics.ticks : '-',
        isCurr ? world.metrics.fuelUsed : '-',
        isCurr ? world.metrics.harvestedTotal : '-',
        isCurr ? world.metrics.warehouseDeliveredTotal : '-',
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_evaluasi_agrocode_level_${world.level.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      activeLevel: {
        id: world.level.id,
        title: world.level.title,
        stage: world.level.stage,
        codeLinesCount: currentCode.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length,
        pythonCode: currentCode,
        metrics: world.metrics,
      },
      overallProgress: progress,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan_simulasi_agrocode_skripsi.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const completedCount = Object.keys(progress.completedLevels).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl bg-[#181B20] border border-[#2D333D] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#1E2229] border-b border-[#2D333D]">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Data Evaluasi & Metrik Simulasi (Lampiran Skripsi)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ringkasan metrik kuantitatif eksekusi algoritma Python, efisiensi bahan bakar solar, dan progres 10 level.
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

        <div className="p-6 overflow-y-auto space-y-5 text-xs text-zinc-300">
          {/* Current Run Telemetry */}
          <div className="p-4 rounded-lg bg-[#13161A] border border-[#262B33]">
            <h3 className="text-sm font-bold text-zinc-100 mb-3">
              Metrik Eksekusi Level Aktif ({world.level.title})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
              <div className="p-2.5 rounded bg-[#181B20] border border-[#252A32]">
                <div className="text-zinc-400 text-[11px]">Waktu (Ticks)</div>
                <div className="text-base font-bold text-zinc-100 mt-0.5">{world.metrics.ticks}</div>
              </div>
              <div className="p-2.5 rounded bg-[#181B20] border border-[#252A32]">
                <div className="text-zinc-400 text-[11px]">Solar Terpakai</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">{world.metrics.fuelUsed} L</div>
              </div>
              <div className="p-2.5 rounded bg-[#181B20] border border-[#252A32]">
                <div className="text-zinc-400 text-[11px]">Total Panen</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{world.metrics.harvestedTotal}</div>
              </div>
              <div className="p-2.5 rounded bg-[#181B20] border border-[#252A32]">
                <div className="text-zinc-400 text-[11px]">Setor Gudang</div>
                <div className="text-base font-bold text-sky-400 mt-0.5">{world.metrics.warehouseDeliveredTotal}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#232830] text-[11px] font-mono text-zinc-400 tabular-nums">
              <div>Ganti Alat: {world.metrics.toolSwitches}x</div>
              <div>Lewat Jalan: {world.metrics.roadTilesCrossed} petak</div>
              <div>Lewat Lumpur: {world.metrics.mudTilesCrossed} petak</div>
            </div>
          </div>

          {/* 10-Level Summary Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                Tabel Rekapitulasi 10 Level ({completedCount}/10 Selesai)
              </h3>
            </div>
            <div className="border border-[#262B33] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse font-mono text-xs tabular-nums">
                <thead>
                  <tr className="bg-[#1E2229] text-zinc-400 border-b border-[#262B33]">
                    <th className="py-2 px-3">Lvl</th>
                    <th className="py-2 px-3 font-sans">Nama Tantangan</th>
                    <th className="py-2 px-3">Tahap</th>
                    <th className="py-2 px-3">Bintang</th>
                    <th className="py-2 px-3">Tick Terbaik</th>
                    <th className="py-2 px-3">Solar Terbaik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232830]">
                  {LEVELS.map((lvl) => {
                    const rec = progress.completedLevels[lvl.id];
                    return (
                      <tr key={lvl.id} className="bg-[#14171B]">
                        <td className="py-2 px-3 text-zinc-400">#{lvl.id}</td>
                        <td className="py-2 px-3 font-sans text-zinc-200">{lvl.title.replace(/^Level \d+:\s*/, '')}</td>
                        <td className="py-2 px-3 text-zinc-400">{lvl.stage}</td>
                        <td className="py-2 px-3 text-amber-400">
                          {rec ? `${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-zinc-300">{rec ? `${rec.bestTicks} tick` : '—'}</td>
                        <td className="py-2 px-3 text-zinc-300">{rec ? `${rec.bestFuel} L` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Export Actions Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#1E2229] border-t border-[#2D333D]">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#282E38] hover:bg-[#323A46] text-zinc-200 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Unduh Tabel CSV</span>
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
