import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Trophy, Users, ShieldAlert, Zap } from 'lucide-react';

export const Snake2Tab: React.FC = () => {
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefreshGame = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenNewTab = () => {
    window.open('/game/snake2', '_blank');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 border border-emerald-500/30 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 text-2xl font-black shadow-lg shadow-emerald-500/20">
              🐍
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Ular Rimba 2 (MMO 1000m²)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE WEBSOCKET
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-1">
                Arena Luas 1000m² &bull; WebSocket <code className="bg-slate-800/80 px-1 py-0.5 rounded text-amber-300">ws://medium.lynzz.id:2252</code> &bull; 14–21 Buah &bull; Adu Kepala
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={handleRefreshGame}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-sm"
              title="Muat Ulang Game"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Game
            </button>
            <button
              onClick={handleOpenNewTab}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition"
              title="Buka Layar Penuh di Tab Baru"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Layar Penuh
            </button>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-emerald-500/20 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Multiplayer WS</div>
              <div className="text-[10px] text-slate-400">Lampu status Hijau/Merah</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Adu Kepala &amp; K.O</div>
              <div className="text-[10px] text-slate-400">Pendek kalah &amp; auto-respawn</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">14–21 Buah-Buahan</div>
              <div className="text-[10px] text-slate-400">Pellet anti lag &amp; multi-buah</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Patung Jeda 🗿</div>
              <div className="text-[10px] text-slate-400">Membeku abu-abu saat pause</div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Game Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 sm:p-4 shadow-2xl flex flex-col items-center">
        <div className="w-full max-w-[560px] aspect-[9/16] sm:aspect-[4/5] min-h-[640px] max-h-[820px] rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
          <iframe
            key={iframeKey}
            src="/game/snake2"
            title="Ular Rimba 2 Multiplayer"
            className="w-full h-full border-0"
            allow="autoplay"
          />
        </div>
        <div className="text-center text-[11px] text-slate-400 mt-3">
          💡 <em>Gunakan tombol D-Pad di layar atau keyboard <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">WASD</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">Panah</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">Spasi</kbd> (Jeda Patung).</em>
        </div>
      </div>
    </div>
  );
};
