import React, { useRef } from 'react';
import { Code2, RotateCcw, Sparkles, BookOpen, AlertTriangle, Terminal } from 'lucide-react';

interface PythonCodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  activeLine: number | null;
  errorLine: number | null;
  errorMessage: string | null;
  isRunning: boolean;
  levelTitle: string;
  onResetCode: () => void;
  onLoadSolution: () => void;
  onLoadPdfDemoScript: () => void;
  onOpenApiDocs: () => void;
}

const QUICK_SNIPPETS: Array<{ label: string; snippet: string; category: 'aksi' | 'logika' | 'logistik' }> = [
  { label: 'move_forward(1)', snippet: 'tractor.move_forward(1)\n', category: 'aksi' },
  { label: 'turn_right()', snippet: 'tractor.turn_right()\n', category: 'aksi' },
  { label: 'turn_left()', snippet: 'tractor.turn_left()\n', category: 'aksi' },
  { label: 'till()', snippet: 'tractor.till()\n', category: 'aksi' },
  { label: 'plant("carrot")', snippet: 'tractor.plant("carrot")\n', category: 'aksi' },
  { label: 'harvest()', snippet: 'tractor.harvest()\n', category: 'aksi' },
  { label: 'equip("plow")', snippet: 'tractor.equip("plow")\n', category: 'logistik' },
  { label: 'refuel()', snippet: 'tractor.go_to_fuel_station()\ntractor.refuel()\n', category: 'logistik' },
  { label: 'repair()', snippet: 'tractor.go_to_workshop()\ntractor.repair()\n', category: 'logistik' },
  { label: 'deliver_to_warehouse()', snippet: 'tractor.deliver_to_warehouse()\n', category: 'logistik' },
  { label: 'for range(4):', snippet: 'for i in range(4):\n    ', category: 'logika' },
  { label: 'if is_crop_ready():', snippet: 'if is_crop_ready():\n    tractor.harvest()\n', category: 'logika' },
  { label: 'if fuel < 25:', snippet: 'if tractor.fuel < 25:\n    tractor.go_to_fuel_station()\n    tractor.refuel()\n', category: 'logika' },
];

export const PythonCodeEditor: React.FC<PythonCodeEditorProps> = ({
  code,
  onChange,
  activeLine,
  errorLine,
  errorMessage,
  isRunning,
  levelTitle,
  onResetCode,
  onLoadSolution,
  onLoadPdfDemoScript,
  onOpenApiDocs,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lines = code.split('\n');

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const insertSnippet = (snippet: string) => {
    if (isRunning) return;
    const ta = textareaRef.current;
    if (!ta) {
      onChange(code + (code.endsWith('\n') ? '' : '\n') + snippet);
      return;
    }

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = code.slice(0, start);
    const after = code.slice(end);
    const updated = before + snippet + after;
    onChange(updated);

    requestAnimationFrame(() => {
      ta.focus();
      const newCursor = start + snippet.length;
      ta.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const updated = code.slice(0, start) + '    ' + code.slice(end);
      onChange(updated);
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + 4, start + 4);
      });
    } else if (e.key === 'Enter') {
      const start = ta.selectionStart;
      const before = code.slice(0, start);
      const currentLine = before.split('\n').pop() || '';
      const indentMatch = currentLine.match(/^(\s*)/);
      const currentIndent = indentMatch ? indentMatch[1] : '';
      const extraIndent = currentLine.trim().endsWith(':') ? '    ' : '';

      if (currentIndent || extraIndent) {
        e.preventDefault();
        const insertStr = '\n' + currentIndent + extraIndent;
        const updated = code.slice(0, start) + insertStr + code.slice(ta.selectionEnd);
        onChange(updated);
        requestAnimationFrame(() => {
          const pos = start + insertStr.length;
          ta.setSelectionRange(pos, pos);
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#16191E] border border-[#2A2F37] rounded-lg overflow-hidden shadow-2xl">
      {/* Terminal Window Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1E2229] border-b border-[#2A2F37] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-mono font-semibold text-zinc-200 truncate">
            FIELD SCRIPT - VE01.py
          </span>
          <span className="hidden sm:inline text-xs text-zinc-500 truncate">
            · {levelTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenApiDocs}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-300 bg-[#262B33] hover:bg-[#313842] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Python API Reference"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>API Docs</span>
          </button>
          <button
            type="button"
            onClick={onLoadPdfDemoScript}
            disabled={isRunning}
            className="hidden md:flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
            title="Load PDF Page 1 Concept Script (VE01 Combine-A)"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>PDF Script</span>
          </button>
          <button
            type="button"
            onClick={onLoadSolution}
            disabled={isRunning}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
            title="Load Solution Code for Current Level"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Solusi</span>
          </button>
          <button
            type="button"
            onClick={onResetCode}
            disabled={isRunning}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-[#262B33] hover:bg-[#313842] rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
            title="Reset to Starter Code"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick-Touch Command Bar (English Python snippets) */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1A1D24] border-b border-[#262B33] overflow-x-auto shrink-0">
        <span className="text-[11px] font-mono text-zinc-400 shrink-0 mr-1">
          Quick Insert:
        </span>
        {QUICK_SNIPPETS.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={isRunning}
            onClick={() => insertSnippet(item.snippet)}
            className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 ${
              item.category === 'aksi'
                ? 'bg-emerald-950/50 border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/60'
                : item.category === 'logistik'
                ? 'bg-amber-950/50 border-amber-700/40 text-amber-300 hover:bg-amber-900/60'
                : 'bg-sky-950/50 border-sky-700/40 text-sky-300 hover:bg-sky-900/60'
            }`}
          >
            +{item.label}
          </button>
        ))}
      </div>

      {/* Main Editor Body with Line Gutter & Active Execution Line Highlight */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden bg-[#13161A]">
        <div
          ref={gutterRef}
          className="w-11 py-3 bg-[#16191E] border-r border-[#232830] text-right select-none overflow-hidden shrink-0"
        >
          {lines.map((_, idx) => {
            const ln = idx + 1;
            const isCurrent = activeLine === ln;
            const isErr = errorLine === ln;
            return (
              <div
                key={ln}
                className={`px-2 text-xs font-mono leading-6 tabular-nums ${
                  isErr
                    ? 'bg-red-500/30 text-red-300 font-bold'
                    : isCurrent
                    ? 'bg-emerald-500/25 text-emerald-300 font-bold'
                    : 'text-zinc-500'
                }`}
              >
                {ln}
              </div>
            );
          })}
        </div>

        <div className="relative flex-1 h-full overflow-hidden">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="code-input w-full h-full py-3 px-3 bg-transparent text-zinc-100 font-mono text-xs sm:text-[13px] leading-6 resize-none focus:outline-none overflow-auto selection:bg-emerald-500/30"
            placeholder="# Write Python code to control tractor, harvester, and hauler..."
          />
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-950/90 border-t border-red-500/40 text-xs text-red-200 shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="font-mono leading-relaxed">{errorMessage}</div>
        </div>
      )}
    </div>
  );
};
