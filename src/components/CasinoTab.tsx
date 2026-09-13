import React, { useState, useEffect } from 'react';
import { Crown, Sparkles, Dices, Coins, Users, RefreshCw, ExternalLink, KeyRound, PlayCircle, Trophy, ShieldCheck, Gamepad2 } from 'lucide-react';
import { safeFetchJson } from '../lib/safeJson';

interface RoomItem {
  code: string;
  name: string;
  hostName: string;
  playersCount: number;
  gameType: string;
  minBet: number;
  state: string;
}

export const CasinoTab: React.FC = () => {
  const [iframeKey, setIframeKey] = useState(1);
  const [balance, setBalance] = useState(25000);
  const [playerName, setPlayerName] = useState('Trainer VIP');
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [newRoomName, setNewRoomName] = useState('Arena Macau VIP');
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await fetch('/api/casino/rooms');
      if (res.ok) {
        const data = await safeFetchJson<{ rooms?: RoomItem[] }>(res, {});
        setRooms(data.rooms || []);
      }
    } catch {
      // Ignore network errors safely
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async () => {
    try {
      const res = await fetch('/api/casino/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: newRoomName || 'VIP Lounge',
          hostName: playerName,
          minBet: 500,
          gameType: 'dice_duel'
        })
      });
      if (res.ok) {
        const data = await safeFetchJson<{ success?: boolean; room?: { code: string } }>(res, {});
        if (data.success && data.room) {
          setCreatedRoomCode(data.room.code);
          fetchRooms();
          setIframeKey(k => k + 1);
        }
      }
    } catch {
      // Ignore network errors safely
    }
  };

  const handleReloadGame = () => {
    setIframeKey(k => k + 1);
  };

  const gameUrl = `/casino?balance=${balance}&name=${encodeURIComponent(playerName)}`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 rounded-2xl p-6 text-white border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-500 text-black tracking-wider uppercase flex items-center gap-1 shadow-sm">
                <Crown className="w-3.5 h-3.5" /> HTML INTERACTIVE PAYLOAD
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30">
                4-Digit Multiplayer & Bot Mode
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-2 tracking-tight text-white flex items-center gap-2">
              <Dices className="w-6 h-6 text-amber-400" />
              GRAND ROYAL CASINO RESORT
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/80 mt-1 max-w-2xl leading-relaxed">
              Upgrade game <strong>.casino</strong> dengan payload interaktif (Vegas & Macau Resort). Menyediakan 4 mini-game: <strong>Dice Duel</strong>, <strong>Royal Slots (5-Reel Scatter All-Ways)</strong>, <strong>VIP Blackjack 21</strong>, dan <strong>European Roulette (Akurat 100% Real-Track)</strong> dengan variasi taruhan 100 s/d 10K, integrasi koin saldo real <code>db.users.money</code> & kode room 4-digit!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReloadGame}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
              title="Muat ulang canvas casino"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Restart Table</span>
            </button>
            <a
              href={gameUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black shadow-md transition-all active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka Layar Penuh</span>
            </a>
          </div>
        </div>
      </div>

      {/* Feature Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <Dices className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">5-Reel Scatter Slots</div>
            <div className="text-sm font-bold text-slate-800">All-Ways Jackpots</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Multiplayer 4-Digit</div>
            <div className="text-sm font-bold text-slate-800">Room Code Instan</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Real Wheel Track</div>
            <div className="text-sm font-bold text-slate-800">100% Sesuai Putaran</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">4 Game Lengkap</div>
            <div className="text-sm font-bold text-slate-800">Dice, Slot, BJ, Roulette</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage & Multiplayer Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Webview Container (2 Columns) */}
        <div className="lg:col-span-2 bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-white">Live Royal Casino Engine</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-amber-400 font-mono font-bold">Saldo: {balance.toLocaleString('id-ID')} Carats</span>
              <button
                onClick={() => setBalance(b => b + 10000)}
                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-md font-bold text-[10px]"
              >
                +10K Test Carats
              </button>
            </div>
          </div>

          <div className="relative w-full h-[640px] bg-slate-950">
            <iframe
              key={iframeKey}
              src={gameUrl}
              className="w-full h-full border-0"
              title="Royal Casino Resort Webview"
              allow="autoplay"
            />
          </div>
        </div>

        {/* Room Manager & WhatsApp Command Guide (1 Column) */}
        <div className="space-y-6">
          {/* Room Creator Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              KONTROL ROOM 4-DIGIT
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Nama Trainer / Player</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Nama Room Baru</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                onClick={handleCreateRoom}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                Buat Room & Dapatkan 4-Digit
              </button>

              {createdRoomCode && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-center space-y-1">
                  <div className="text-[11px] font-bold text-amber-800">KODE ROOM 4-DIGIT:</div>
                  <div className="text-2xl font-black font-mono tracking-widest text-amber-600">
                    {createdRoomCode}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Ketik di WhatsApp: <code>.casinoroom {createdRoomCode}</code>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Rooms List */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                ROOM AKTIF ({rooms.length})
              </h3>
              <button
                onClick={fetchRooms}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
                title="Refresh Room"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 font-medium">
                Belum ada room aktif. Buat room baru di atas atau lewat WhatsApp!
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {rooms.map((r) => (
                  <div
                    key={r.code}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{r.name}</div>
                      <div className="text-[10px] text-slate-500">Host: {r.hostName} · Min Bet: {r.minBet}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono font-bold text-xs">
                      #{r.code}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* WhatsApp Command Cheat Sheet */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-white space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> COMMAND WHATSAPP
            </h3>
            <ul className="text-xs space-y-2 font-mono text-slate-300">
              <li className="p-1.5 rounded-lg bg-slate-800/80">
                <strong className="text-amber-300">.casino</strong>
                <div className="text-[11px] text-slate-400 font-sans">Buka Grand Royal Casino (Rich HTML Payload)</div>
              </li>
              <li className="p-1.5 rounded-lg bg-slate-800/80">
                <strong className="text-amber-300">.casinomp</strong>
                <div className="text-[11px] text-slate-400 font-sans">Buka mode multiplayer & buat/gabung room 4-digit</div>
              </li>
              <li className="p-1.5 rounded-lg bg-slate-800/80">
                <strong className="text-amber-300">.claimr &lt;kode&gt;</strong>
                <div className="text-[11px] text-slate-400 font-sans">Klaim hadiah koin won dari Casino (Anti-Cheat)</div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
