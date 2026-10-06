'use strict'

import { kirimForwardSigned } from './richHelper.js';

const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#111314">
<title>Ular Rimba 2: Multiplayer 1000m²</title>
<style>
:root{--bg:#111314;--wood:#d4b48f;--text:#ece7de;--dim:#95a1a8;--panel:#232d32;--panel2:#1a2225;--line:#3b4b54;--green:#8fb17a;--green2:#5c8650;--red:#ff3b30;--gold:#ffd166;--cyan:#00e5ff;--purple:#d946ef}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{min-height:100%;background:radial-gradient(900px 500px at 50% -10%,#263338 0%,var(--bg) 68%);color:var(--text);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
body{display:flex;justify-content:center;align-items:center;padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));overflow-x:hidden;touch-action:manipulation}
.app{width:min(100%,540px);margin:auto}
.console{width:100%;background:linear-gradient(180deg,#2b373e,#1a2125);border:1px solid #3d4d56;border-radius:24px;padding:11px;box-shadow:0 30px 80px #000a,inset 0 1px 0 #ffffff14}
.head{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#151c1f;border:1px solid #2e3a40;border-radius:14px;padding:8px 10px;margin-bottom:7px}
.brand{display:flex;align-items:center;gap:8px;min-width:0}
.logo{width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:10px;background:radial-gradient(120% 120% at 30% 20%,#34d399,#059669);color:#062316;font-size:19px;font-weight:950;box-shadow:0 4px 0 #044b34}
.brandText{min-width:0}
.title{font-family:Georgia,serif;font-size:15px;font-weight:900;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e8f4ed}
.sub{margin-top:2px;color:#7ee787;font-size:7.5px;font-weight:700;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chips{display:grid;grid-template-columns:repeat(3,minmax(44px,1fr));gap:5px;flex:none}
.chip{min-width:44px;padding:4px 6px;text-align:center;background:#1a2327;border:1px solid #304149;border-radius:9px}
.chip b{display:block;color:var(--dim);font-size:5.8px;letter-spacing:.12em}
.chip span{display:block;margin-top:2px;color:var(--wood);font-size:11.5px;font-weight:900;line-height:1}

/* Status Bar: Online Indicator & Player Name Input */
.serverBar{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#131a1d;border:1px solid #293840;border-radius:11px;padding:5px 9px;margin-bottom:7px}
.serverStatus{display:flex;align-items:center;gap:6px}
.statusLed{width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 7px #ef4444;transition:background .25s,box-shadow .25s}
.statusLed.online{background:#10b981;box-shadow:0 0 9px #10b981}
.statusText{font-size:7.5px;font-weight:900;letter-spacing:.04em;color:#94a3b8}
.statusLed.online + .statusText{color:#34d399}
.nameWrapper{display:flex;align-items:center;gap:5px}
.nameLabel{font-size:7px;font-weight:900;color:var(--dim);letter-spacing:.05em}
.nameWrapper input{background:#1a2428;border:1px solid #364852;border-radius:6px;color:#f8fafc;font-size:9px;font-weight:bold;padding:2px 7px;width:108px;outline:none;transition:border-color .2s}
.nameWrapper input:focus{border-color:#34d399;box-shadow:0 0 6px rgba(52,211,153,.35)}

.arena{position:relative;width:100%;padding:6px;border:1px solid #28373e;border-radius:16px;background:#0d1417;box-shadow:inset 0 12px 28px #000d;overflow:hidden}
.canvasWrap{position:relative;width:100%;aspect-ratio:1/1;border-radius:11px;overflow:hidden;background:#141d20}
.canvasWrap canvas{display:block;width:100%;height:100%;background:#141d20;image-rendering:auto;touch-action:none;user-select:none}
.hint{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;align-items:flex-end;gap:5px;pointer-events:none;z-index:15}
.badge{padding:4px 8px;border-radius:999px;background:#0a1215e6;border:1px solid #ffffff18;color:#dce6e1;font-size:7px;font-weight:900;letter-spacing:.04em;backdrop-filter:blur(4px);box-shadow:0 4px 10px #0008}
.badge.gold{color:var(--gold)}
.badge.red{color:#ff5555;border-color:#ff333360;background:#1a0808eb}
.overlay{position:absolute;inset:6px;border-radius:11px;display:grid;place-items:center;background:#060d10cc;backdrop-filter:blur(10px);opacity:0;pointer-events:none;transition:opacity .2s ease;z-index:20}
.overlay.show{opacity:1;pointer-events:auto}
.modal{width:min(86%,330px);padding:20px 16px;text-align:center;border:1px solid #4a5d67;border-radius:16px;background:linear-gradient(180deg,#2f3d45,#1d262b);box-shadow:0 18px 40px #0009}
.modalIcon{font-size:32px;line-height:1}
.modal h2{margin-top:7px;font-family:Georgia,serif;font-size:19px;color:#f0f6fc}
.modal p{margin-top:5px;color:var(--dim);font-size:9px;line-height:1.45}
.modal .miniRow{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}
.mini{padding:7px;border:1px solid #3c4d56;border-radius:8px;background:#162024}
.mini b{display:block;color:var(--gold);font-size:13px}
.mini span{display:block;margin-top:2px;color:var(--dim);font-size:6.5px;letter-spacing:.05em;text-transform:uppercase}
.ctrl{margin-top:8px;padding:9px;border:1px solid #35454d;border-radius:15px;background:linear-gradient(180deg,#222c32,#182125)}
.ctrlTop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
.ctrlTop b{font-size:6.8px;letter-spacing:.12em;color:var(--dim)}
.ctrlTop b:last-child{color:var(--wood)}
.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:8px}
.btn{min-height:39px;border:1px solid #485760;border-radius:10px;background:linear-gradient(180deg,#36454c,#242f34);color:var(--text);font:900 8.2px system-ui;letter-spacing:.04em;box-shadow:0 4px 0 #101619,inset 0 1px 0 #ffffff1a;touch-action:manipulation;user-select:none}
.btn.primary{background:linear-gradient(180deg,#34d399,#059669);border-color:#10b981;color:#042115;font-weight:950;box-shadow:0 4px 0 #044b34,inset 0 1px 0 #ffffff40}
.btn.active{transform:translateY(3px);box-shadow:0 1px 0 #101619}
.btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.dpadWrap{display:flex;justify-content:center}
.dpad{position:relative;width:min(54vw,225px);height:min(54vw,225px);min-width:180px;min-height:180px;max-width:225px;max-height:225px;border-radius:50%;border:1px solid #34434b;background:radial-gradient(100% 100% at 50% 45%,#1c2529,#13191c);box-shadow:inset 0 8px 20px #000c;touch-action:none}
.pad{position:absolute;width:29%;height:29%;min-width:52px;min-height:52px;max-width:68px;max-height:68px;border:1px solid #50616b;border-radius:17px;display:grid;place-items:center;background:linear-gradient(180deg,#3a474f,#242e34);color:#e3ebee;font-size:19px;font-weight:900;box-shadow:0 7px 0 #0f1518,0 12px 20px #0006,inset 0 1px 0 #ffffff1f;touch-action:manipulation;user-select:none;transition:transform .05s ease,background .05s ease}
.pad.up{top:4.3%;left:50%;transform:translateX(-50%)}
.pad.down{bottom:4.3%;left:50%;transform:translateX(-50%)}
.pad.left{left:4.3%;top:50%;transform:translateY(-50%)}
.pad.right{right:4.3%;top:50%;transform:translateY(-50%)}
.pad.active{background:linear-gradient(180deg,#43545d,#2b373e)}
.pad.up.active,.pad.down.active{transform:translateX(-50%) translateY(4px) scale(.97)}
.pad.left.active,.pad.right.active{transform:translateY(-50%) translateY(4px) scale(.97)}
.centerDot{position:absolute;left:50%;top:50%;width:22%;height:22%;min-width:42px;min-height:42px;max-width:52px;max-height:52px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(100% at 30% 30%,#34d399,#047857);border:1px solid #10b981;box-shadow:0 5px 0 #064e3b,inset 0 1px 0 #ffffff80}
.footer{display:flex;justify-content:space-between;gap:8px;margin-top:7px;padding:0 3px;color:#6d7c82;font-size:6.5px}
.footer span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.footer kbd{padding:2px 4px;border:1px solid #313f45;border-radius:4px;background:#101618;color:#92a2a7;font:700 6px system-ui}
@media(max-width:380px){body{padding:5px}.console{padding:8px;border-radius:18px}.head{padding:6px 8px;margin-bottom:5px}.logo{width:30px;height:30px;font-size:15px}.title{font-size:13px}.sub{font-size:6.5px}.chip{min-width:38px}.chip b{font-size:5.2px}.chip span{font-size:10px}.serverBar{padding:4px 7px;margin-bottom:5px}.nameWrapper input{width:90px;font-size:8.5px}.ctrl{padding:7px}.actions{gap:4px}.btn{min-height:35px;font-size:7px}.dpad{width:185px;height:185px}}
</style>
</head>
<body>
<div class="app">
  <div class="console">
    <div class="head">
      <div class="brand">
        <div class="logo">2</div>
        <div class="brandText">
          <div class="title">ULAR RIMBA 2</div>
          <div class="sub">MULTIPLAYER 1000m² • 14-21 BUAH • ADU KEPALA</div>
        </div>
      </div>
      <div class="chips">
        <div class="chip"><b>SKOR</b><span id="score">0</span></div>
        <div class="chip"><b>BUAH</b><span id="foodCount">18</span></div>
        <div class="chip"><b>LEVEL</b><span id="level">1</span></div>
      </div>
    </div>

    <!-- Status Bar: Online / Offline Status Light & Name Input -->
    <div class="serverBar">
      <div class="serverStatus">
        <span class="statusLed" id="statusLed"></span>
        <span class="statusText" id="statusText">OFFLINE (SOLO)</span>
      </div>
      <div class="nameWrapper">
        <span class="nameLabel">NAMA:</span>
        <input type="text" id="playerNameInput" maxlength="12" placeholder="Nama Anda" value="Pemain" />
      </div>
    </div>

    <div class="arena">
      <div class="canvasWrap">
        <canvas id="game" width="720" height="720"></canvas>
        <div class="hint">
          <span class="badge" id="stateBadge">SIAP</span>
          <span class="badge red" id="hazardBadge">⚠️ LASER &amp; MUSUH: MATI</span>
          <span class="badge gold" id="bestBadge">BEST 0</span>
        </div>
        <div class="overlay" id="overlay">
          <div class="modal">
            <div class="modalIcon" id="modalIcon">🐍</div>
            <h2 id="modalTitle">Ular Rimba 2</h2>
            <p id="modalText">Jelajahi peta 1000m² realtime! Tabrak badan musuh / adu kepala (panjang menang). Jeda = Patung Batu 🗿!</p>
            <div class="miniRow">
              <div class="mini"><b id="modalScore">0</b><span>Skor</span></div>
              <div class="mini"><b id="modalBest">0</b><span>Best</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="ctrl">
      <div class="ctrlTop"><b>◈ KONTROL KAMERA DINAMIS</b><b>OGURI CAP MULTIPLAYER</b></div>
      <div class="actions">
        <button class="btn primary" id="startBtn" type="button">▶ MULAI</button>
        <button class="btn" id="resetBtn" type="button">↻ ULANG</button>
      </div>
      <div class="dpadWrap">
        <div class="dpad" id="dpad">
          <button class="pad up" data-dir="up" type="button" aria-label="Atas">▲</button>
          <button class="pad down" data-dir="down" type="button" aria-label="Bawah">▼</button>
          <button class="pad left" data-dir="left" type="button" aria-label="Kiri">◀</button>
          <button class="pad right" data-dir="right" type="button" aria-label="Kanan">▶</button>
          <div class="centerDot"></div>
        </div>
      </div>
      <div class="footer">
        <span>Hijau = Anda • Merah = Lawan (Musuh) • 🗿 = Patung Jeda</span>
        <span><kbd>WASD</kbd> <kbd>←↑↓→</kbd> <kbd>SPACE</kbd></span>
      </div>
    </div>
  </div>
</div>
<script>
'use strict';
(()=>{
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const scoreEl = document.getElementById('score');
const foodCountEl = document.getElementById('foodCount');
const levelEl = document.getElementById('level');
const stateBadge = document.getElementById('stateBadge');
const bestBadge = document.getElementById('bestBadge');
const statusLed = document.getElementById('statusLed');
const statusText = document.getElementById('statusText');
const playerNameInput = document.getElementById('playerNameInput');
const overlay = document.getElementById('overlay');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
const modalScore = document.getElementById('modalScore');
const modalBest = document.getElementById('modalBest');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

// Skala Arena Luas ~1000m² (80x80 blok dunia)
// Viewport kamera menampilkan 16x16 blok secara mulus
const WORLD_SIZE = 80;
const VIEW_TILES = 16;
const CELL = canvas.width / VIEW_TILES; // 720 / 16 = 45px
const BASE_SPEED = 140;
const MIN_SPEED = 72;
const MIN_FOOD_COUNT = 14; // Minimal 14-21 makanan emoji buah buahan serentak
const MAX_FOOD_COUNT = 21;

let snake = [];
let prevSnake = [];
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let inputQueue = [];
let foods = []; // Array makanan multi-pellet emoji buah buahan
let score = 0;
let best = 0;
let running = false;
let paused = false;
let gameOver = false;
let speed = BASE_SPEED;
let accumulator = 0;
let lastTime = 0;
let visualAngle = 0;
let targetAngle = 0;
let bodyAngles = [];
let particles = [];
let tongue = 0;
let swipeStart = null;
let visualHead = { x: 40, y: 40 };
let camX = 40;
let camY = 40;

// Identitas Pemain & WebSocket Multiplayer (ws://medium.lynzz.id:2252)
let myPlayerId = 'p_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36).substring(4);
let myPlayerName = 'Pemain';
try {
  const savedName = localStorage.getItem('oguri_snake2_name');
  if (savedName && savedName.trim()) {
    myPlayerName = savedName.trim().substring(0, 12);
  } else {
    myPlayerName = 'Pemain_' + Math.floor(100 + Math.random() * 900);
  }
} catch(_) {}
if (playerNameInput) playerNameInput.value = myPlayerName;

let ws = null;
let isWsOnline = false;
let remotePlayers = {}; // { [playerId]: { name, state: { snake, score, isPaused, isDead, dir }, lastSeen } }

// Palet Makanan Emoji Buah-Buahan (14-21 Pellet, Ringan & Anti Lag):
// Titik radar berwarna-warni sesuai karakter buah (Bukan Merah Polos)
const FRUIT_EMOJIS = [
  { emoji: '🍎', name: 'Apel', color: '#ff6b6b', pts: 15 },
  { emoji: '🍏', name: 'Apel Hijau', color: '#7bed9f', pts: 20 },
  { emoji: '🍌', name: 'Pisang', color: '#eccc68', pts: 20 },
  { emoji: '🍇', name: 'Anggur', color: '#a55eea', pts: 25 },
  { emoji: '🍊', name: 'Jeruk', color: '#ffa502', pts: 15 },
  { emoji: '🍓', name: 'Stroberi', color: '#ff6b81', pts: 30 },
  { emoji: '🍉', name: 'Semangka', color: '#2ed573', pts: 25 },
  { emoji: '🍍', name: 'Nanas', color: '#ffa502', pts: 35 },
  { emoji: '🍑', name: 'Persik', color: '#f8a5c2', pts: 20 },
  { emoji: '🍒', name: 'Ceri', color: '#ea8685', pts: 30 },
  { emoji: '🥝', name: 'Kiwi', color: '#55e6c1', pts: 35 },
  { emoji: '🥭', name: 'Mangga', color: '#ffbe76', pts: 40 },
  { emoji: '🫐', name: 'Blueberry', color: '#70a1ff', pts: 45 },
  { emoji: '🍐', name: 'Buah Pir', color: '#badc58', pts: 20 },
  { emoji: '🥥', name: 'Kelapa', color: '#dfe4ea', pts: 50 },
  { emoji: '🍈', name: 'Melon', color: '#9aec64', pts: 30 },
  { emoji: '🍋', name: 'Lemon', color: '#f9ca24', pts: 15 }
];

try {
  best = Number(localStorage.getItem('oguri_snake2_best') || 0) || 0;
} catch {}

function safeBestSave() {
  try {
    localStorage.setItem('oguri_snake2_best', String(best));
  } catch {}
}

function cloneSnake(a) {
  return a.map(s => ({ x: s.x, y: s.y }));
}

function getRandomTargetFoodCount() {
  return Math.floor(Math.random() * (MAX_FOOD_COUNT - MIN_FOOD_COUNT + 1)) + MIN_FOOD_COUNT;
}

// Generate satu butir makanan emoji acak di peta 1000m²
function createRandomFood() {
  let f, guard = 0;
  do {
    const template = FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)];
    f = {
      x: Math.floor(Math.random() * (WORLD_SIZE - 2)) + 1,
      y: Math.floor(Math.random() * (WORLD_SIZE - 2)) + 1,
      emoji: template.emoji,
      name: template.name,
      color: template.color,
      pts: template.pts,
      pulseOffset: Math.random() * Math.PI * 2
    };
    guard++;
  } while (
    (snake.some(s => s.x === f.x && s.y === f.y) || foods.some(existing => existing.x === f.x && existing.y === f.y)) &&
    guard < 600
  );
  return f;
}

function createFruitAt(x, y) {
  const template = FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)];
  return {
    x: Math.max(1, Math.min(WORLD_SIZE - 2, x)),
    y: Math.max(1, Math.min(WORLD_SIZE - 2, y)),
    emoji: template.emoji,
    name: template.name,
    color: template.color,
    pts: template.pts,
    pulseOffset: Math.random() * Math.PI * 2
  };
}

// Menghasilkan sekumpulan 14-21 butir makanan emoji buah buahan
function populateFoods(count) {
  const target = count || getRandomTargetFoodCount();
  foods = [];
  for (let i = 0; i < target; i++) {
    foods.push(createRandomFood());
  }
}

// -------------------------------------------------------------
// WEBSOCKET MULTIPLAYER ENGINE (ws://medium.lynzz.id:2252)
// -------------------------------------------------------------
function updateServerStatus(online, text) {
  isWsOnline = online;
  if (statusLed) {
    if (online) {
      statusLed.classList.add('online');
      statusLed.classList.remove('offline');
    } else {
      statusLed.classList.remove('online');
      statusLed.classList.add('offline');
    }
  }
  if (statusText) {
    statusText.textContent = text || (online ? 'ONLINE (MULTIPLAYER)' : 'OFFLINE (SOLO)');
  }
}

function getSyncPayload() {
  return {
    snake: snake,
    prevSnake: prevSnake,
    score: score,
    length: snake.length,
    isPaused: paused,
    isDead: gameOver,
    dir: dir
  };
}

let wsReconnectTimer = null;
let lastBroadcastTime = 0;
let candidateIndex = 0;

const INJECTED_WS = '__INJECTED_WS_URL__';

function getWsEndpoints() {
  const list = [];
  
  // 1. Injected server URL jika ada
  if (INJECTED_WS && !INJECTED_WS.startsWith('__') && INJECTED_WS.startsWith('ws')) {
    list.push(INJECTED_WS);
  }

  // 2. Browser origin URL
  if (typeof location !== 'undefined' && location.host) {
    const isHttps = location.protocol === 'https:' || location.hostname.includes('run.app') || location.hostname.includes('vercel.app');
    const proto = isHttps ? 'wss:' : 'ws:';
    list.push(proto + '//' + location.host + '/ws/snake2');
  }

  // 3. Public Cloud Run server default (Aman untuk WebView WhatsApp & Browser)
  list.push('wss://ais-dev-duf3mcc5xc3j7mpviuftcm-684707883963.asia-southeast1.run.app/ws/snake2');
  list.push('wss://ais-pre-duf3mcc5xc3j7mpviuftcm-684707883963.asia-southeast1.run.app/ws/snake2');

  // 4. Upstream lynzz direct
  list.push('ws://medium.lynzz.id:2252');

  // Hapus duplikat
  return Array.from(new Set(list));
}

function broadcastMyState(force = false) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (!force && now - lastBroadcastTime < 50) return; // Throttled 20 FPS sync to avoid network lag
  lastBroadcastTime = now;
  try {
    ws.send(JSON.stringify({
      type: 'player_state',
      roomId: 'snake2_global',
      playerId: myPlayerId,
      playerName: myPlayerName,
      state: getSyncPayload()
    }));
  } catch (_) {}
}

function connectMultiplayerWs() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  // Bersihkan socket lama jika ada
  if (ws) {
    try {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
    } catch (_) {}
    ws = null;
  }

  const endpoints = getWsEndpoints();
  if (candidateIndex >= endpoints.length) {
    candidateIndex = 0;
  }
  const targetUrl = endpoints[candidateIndex];

  try {
    ws = new WebSocket(targetUrl);

    let connectTimeout = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        try { ws.close(); } catch (_) {}
        candidateIndex = (candidateIndex + 1) % endpoints.length;
        connectMultiplayerWs();
      }
    }, 2800);

    ws.onopen = () => {
      clearTimeout(connectTimeout);
      updateServerStatus(true, 'ONLINE (MULTIPLAYER)');
      try {
        ws.send(JSON.stringify({
          type: 'join_room',
          roomId: 'snake2_global',
          playerId: myPlayerId,
          playerName: myPlayerName,
          state: getSyncPayload()
        }));
      } catch (_) {}
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'room_joined' && Array.isArray(data.players)) {
          remotePlayers = {};
          data.players.forEach(p => {
            if (p.id && p.id !== myPlayerId) {
              remotePlayers[p.id] = {
                id: p.id,
                name: p.name || 'Lawan',
                state: p.state || {},
                lastSeen: performance.now()
              };
            }
          });
        } else if (data.type === 'player_joined' && data.player) {
          if (data.player.id !== myPlayerId) {
            remotePlayers[data.player.id] = {
              id: data.player.id,
              name: data.player.name || 'Lawan',
              state: data.player.state || {},
              lastSeen: performance.now()
            };
          }
        } else if (data.type === 'player_left' && data.playerId) {
          delete remotePlayers[data.playerId];
        } else if (data.type === 'player_state' && data.playerId) {
          if (data.playerId !== myPlayerId) {
            remotePlayers[data.playerId] = {
              id: data.playerId,
              name: data.playerName || remotePlayers[data.playerId]?.name || 'Lawan',
              state: data.state || {},
              lastSeen: performance.now()
            };
          }
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      clearTimeout(connectTimeout);
      updateServerStatus(false, 'OFFLINE (SOLO)');
    };

    ws.onclose = () => {
      clearTimeout(connectTimeout);
      updateServerStatus(false, 'OFFLINE (SOLO)');
      candidateIndex = (candidateIndex + 1) % endpoints.length;
      wsReconnectTimer = setTimeout(connectMultiplayerWs, 2000);
    };
  } catch (_) {
    updateServerStatus(false, 'OFFLINE (SOLO)');
    candidateIndex = (candidateIndex + 1) % endpoints.length;
    wsReconnectTimer = setTimeout(connectMultiplayerWs, 2500);
  }
}

// Auto Ping Heartbeat
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    } catch (_) {}
  }
  // Bersihkan lawan yang tidak aktif lebih dari 12 detik
  const now = performance.now();
  Object.keys(remotePlayers).forEach(id => {
    if (now - remotePlayers[id].lastSeen > 12000) {
      delete remotePlayers[id];
    }
  });
}, 7000);

if (playerNameInput) {
  playerNameInput.addEventListener('input', (e) => {
    const val = (e.target.value || '').trim().substring(0, 12);
    if (val) {
      myPlayerName = val;
      try { localStorage.setItem('oguri_snake2_name', myPlayerName); } catch(_) {}
      broadcastMyState();
    }
  });
}

function updateUi() {
  scoreEl.textContent = score;
  foodCountEl.textContent = foods.length;
  levelEl.textContent = Math.floor(score / 60) + 1;
  bestBadge.textContent = 'BEST ' + best;
  stateBadge.textContent = gameOver ? 'K.O (NABRAK)' : paused ? '🗿 PATUNG (JEDA)' : running ? 'JELAJAH 1000m²' : 'SIAP';
  startBtn.textContent = gameOver ? '▶ MULAI' : paused ? '▶ LANJUT' : running ? 'Ⅱ JEDA' : '▶ MULAI';
  modalScore.textContent = score;
  modalBest.textContent = best;
}

function show(title, text, icon = '🐍') {
  modalIcon.textContent = icon;
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalScore.textContent = score;
  modalBest.textContent = best;
  overlay.classList.add('show');
  updateUi();
}

function hide() {
  overlay.classList.remove('show');
}

function reset() {
  const startX = Math.floor(WORLD_SIZE / 2) + Math.floor((Math.random() - 0.5) * 20);
  const startY = Math.floor(WORLD_SIZE / 2) + Math.floor((Math.random() - 0.5) * 20);
  snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY }
  ];
  prevSnake = cloneSnake(snake);
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  inputQueue = [];
  populateFoods();
  score = 0;
  speed = BASE_SPEED;
  accumulator = 0;
  running = false;
  paused = false;
  gameOver = false;
  visualAngle = 0;
  targetAngle = 0;
  bodyAngles = [0, 0, 0];
  particles = [];
  tongue = 0;
  visualHead = { x: startX, y: startY };
  camX = startX - VIEW_TILES / 2 + 0.5;
  camY = startY - VIEW_TILES / 2 + 0.5;
  hide();
  updateUi();
  broadcastMyState();
  draw(0);
}

// RESPONS KETIKA MATI: Respawn instan tanpa menunggu tombol mulai
function instantRespawn(killerName) {
  // Tubuh lama berubah jadi makanan
  snake.forEach(seg => {
    if (Math.random() < 0.75) {
      foods.push(createFruitAt(seg.x, seg.y));
    }
  });

  burst(snake[0].x, snake[0].y, '#ff4757');

  const startX = Math.floor(Math.random() * (WORLD_SIZE - 10)) + 5;
  const startY = Math.floor(Math.random() * (WORLD_SIZE - 10)) + 5;
  snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY }
  ];
  prevSnake = cloneSnake(snake);
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  inputQueue = [];
  score = 0;
  speed = BASE_SPEED;
  accumulator = 0;
  running = true;
  paused = false;
  gameOver = false;
  visualAngle = 0;
  targetAngle = 0;
  bodyAngles = [0, 0, 0];
  visualHead = { x: startX, y: startY };
  camX = startX - VIEW_TILES / 2 + 0.5;
  camY = startY - VIEW_TILES / 2 + 0.5;
  hide();
  updateUi();
  broadcastMyState();
}

function start() {
  if (gameOver) reset();
  if (running) return;
  paused = false;
  running = true;
  hide();
  lastTime = performance.now();
  accumulator = 0;
  updateUi();
  broadcastMyState();
}

function togglePause() {
  if (gameOver) {
    reset();
    start();
    return;
  }
  if (!running) {
    start();
    return;
  }
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    accumulator = 0;
    hide();
  } else {
    show('Patung Jeda 🗿', 'Ular Anda menjadi patung abu-abu saat jeda! Tekan LANJUT untuk bergerak kembali.', '🗿');
  }
  updateUi();
  broadcastMyState();
}

function endGame(reason = 'NABRAK') {
  if (gameOver) return;
  gameOver = true;
  running = false;
  paused = false;
  if (score > best) {
    best = score;
    safeBestSave();
  }
  stateBadge.textContent = 'K.O';
  const detail = reason === 'LASER'
    ? 'Anda menyentuh Garis Merah Laser Pembatas arena 1000m²!'
    : 'Ular menabrak rintangan atau badan lawan!';
  show('Ular Tumbang', detail + ' Skor: ' + score + ' • Best: ' + best + '. Tekan ULANG.', '💥');
  broadcastMyState();
}

function setDirection(x, y) {
  const last = inputQueue.length ? inputQueue[inputQueue.length - 1] : nextDir;
  if (last.x === -x && last.y === -y) return;
  if (last.x === x && last.y === y) return;
  if (inputQueue.length < 4) inputQueue.push({ x, y });
  targetAngle = Math.atan2(y, x);
  if (!running && !gameOver) start();
}

// -------------------------------------------------------------
// LOGIC TICK & MULTIPLAYER COMBAT / SALING BUNUH
// -------------------------------------------------------------
function logicTick() {
  if (paused) return; // Jika patung jeda, tidak bergerak

  prevSnake = cloneSnake(snake);
  if (inputQueue.length) {
    nextDir = inputQueue.shift();
  }
  dir = nextDir;
  targetAngle = Math.atan2(dir.y, dir.x);

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // 1. PEMBATAS GARIS MERAH TERANG: Jika keluar batas 1000m², langsung MATI
  if (head.x < 0 || head.x >= WORLD_SIZE || head.y < 0 || head.y >= WORLD_SIZE) {
    endGame('LASER');
    return;
  }

  // 2. Cek tabrakan dengan badan sendiri
  const bodyHit = snake.some((s, idx) => idx < snake.length - 1 && s.x === head.x && s.y === head.y);
  if (bodyHit) {
    endGame('BODY');
    return;
  }

  // 3. MULTIPLAYER COMBAT DENGAN LAWAN (POV DIRI SENDIRI: SEMUA LAWAN = MERAH / MUSUH)
  for (const enemyId in remotePlayers) {
    const enemy = remotePlayers[enemyId];
    if (!enemy || !enemy.state || enemy.state.isDead) continue;
    const enemySnake = enemy.state.snake;
    if (!Array.isArray(enemySnake) || enemySnake.length === 0) continue;

    const enemyHead = enemySnake[0];

    // A. ADU KEPALA (HEAD-TO-HEAD): Yang pendek kalah!
    if (head.x === enemyHead.x && head.y === enemyHead.y) {
      if (snake.length > enemySnake.length) {
        // KITA MENANG! Lawan kalah & skor lawan diambil semua jadi skor kita
        const gained = enemy.state.score || (enemySnake.length * 20);
        score += gained;
        burst(head.x, head.y, '#ffd166');
        // Tubuh lawan berubah jadi makanan langsung
        enemySnake.forEach(seg => foods.push(createFruitAt(seg.x, seg.y)));
        delete remotePlayers[enemyId];
      } else if (snake.length < enemySnake.length) {
        // KITA KALAH! Tubuh kita berubah jadi makanan & respawn instan
        instantRespawn(enemy.name || 'Lawan');
        return;
      } else {
        // Panjang sama: Adu skor
        if ((score || 0) >= (enemy.state.score || 0)) {
          score += 50;
          enemySnake.forEach(seg => foods.push(createFruitAt(seg.x, seg.y)));
          delete remotePlayers[enemyId];
        } else {
          instantRespawn(enemy.name || 'Lawan');
          return;
        }
      }
    }

    // B. KEPALA KITA MENABRAK BADAN LAWAN ATAU PATUNG LAWAN: KITA MATI & RESPAWN INSTAN
    const enemyBodyHit = enemySnake.some((seg, idx) => {
      // Jika lawan patung, seluruh tubuhnya adalah batu rintangan
      return (enemy.state.isPaused || idx > 0) && seg.x === head.x && seg.y === head.y;
    });

    if (enemyBodyHit) {
      instantRespawn(enemy.name || 'Lawan');
      return;
    }
  }

  snake.unshift(head);
  bodyAngles.unshift(targetAngle);

  // 4. Periksa apakah memakan salah satu pellet makanan emoji buah
  const eatenIdx = foods.findIndex(f => f.x === head.x && f.y === head.y);
  if (eatenIdx !== -1) {
    const eaten = foods[eatenIdx];
    score += eaten.pts;
    tongue = 10;
    burst(head.x, head.y, eaten.color);
    foods.splice(eatenIdx, 1);

    // KETIKA HABIS SEMUA (atau kurang dari 14): MUNCUL LAGI ACAK MAKANAN DAN TEMPATNYA
    if (foods.length === 0) {
      populateFoods(getRandomTargetFoodCount());
    } else if (foods.length < MIN_FOOD_COUNT) {
      while (foods.length < getRandomTargetFoodCount()) {
        foods.push(createRandomFood());
      }
    }

    speed = Math.max(MIN_SPEED, BASE_SPEED - Math.floor(score / 50) * 3);
    if (score > best) {
      best = score;
      safeBestSave();
    }
  } else {
    snake.pop();
    bodyAngles.pop();
  }

  updateUi();
  broadcastMyState();
}

function burst(worldX, worldY, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 0.06 + Math.random() * 0.14;
    particles.push({
      wx: worldX + 0.5,
      wy: worldY + 0.5,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 16 + Math.random() * 10,
      max: 26,
      color: color || '#ffd166'
    });
  }
}

// -------------------------------------------------------------
// RENDER UTAMA DENGAN KAMERA DINAMIS & TEMPAT SEBELUMNYA (ANTI-LAG)
// -------------------------------------------------------------
function draw(t) {
  ctx.fillStyle = '#11171a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const headPrev = prevSnake[0] || snake[0];
  const headCurr = snake[0] || visualHead;
  visualHead = {
    x: headPrev.x + (headCurr.x - headPrev.x) * t,
    y: headPrev.y + (headCurr.y - headPrev.y) * t
  };

  // Kamera sinkron mengalir bersama ular (100% smooth, anti-jitter)
  camX = visualHead.x - VIEW_TILES / 2 + 0.5;
  camY = visualHead.y - VIEW_TILES / 2 + 0.5;

  // Render petak blok arena secara modular (hanya yang terlihat di kamera)
  const minX = Math.floor(camX) - 1;
  const maxX = Math.ceil(camX + VIEW_TILES) + 1;
  const minY = Math.floor(camY) - 1;
  const maxY = Math.ceil(camY + VIEW_TILES) + 1;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const sx = (x - camX) * CELL;
      const sy = (y - camY) * CELL;

      // Area dalam arena 1000m²
      if (x >= 0 && x < WORLD_SIZE && y >= 0 && y < WORLD_SIZE) {
        ctx.fillStyle = (x + y) % 2 ? '#172226' : '#141c20';
        ctx.fillRect(sx, sy, CELL + 0.5, CELL + 0.5);
      } else {
        // Area bahaya di luar pembatas
        ctx.fillStyle = '#080c0e';
        ctx.fillRect(sx, sy, CELL + 0.5, CELL + 0.5);
      }
    }
  }

  // -----------------------------------------------------------
  // ⚡ PEMBATAS GARIS MERAH TERANG (LETHAL NEON LASER BORDER)
  // -----------------------------------------------------------
  const laserX = -camX * CELL;
  const laserY = -camY * CELL;
  const laserW = WORLD_SIZE * CELL;
  const laserH = WORLD_SIZE * CELL;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 30, 45, 0.4)';
  ctx.lineWidth = 10;
  ctx.strokeRect(laserX, laserY, laserW, laserH);

  ctx.strokeStyle = '#ff283b';
  ctx.lineWidth = 4;
  ctx.strokeRect(laserX, laserY, laserW, laserH);

  ctx.strokeStyle = '#ffebee';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(laserX, laserY, laserW, laserH);
  ctx.restore();

  // -----------------------------------------------------------
  // RENDER MAKANAN / PELLETS: 14-21 EMOJI BUAH-BUAHAN (ULTRA CEPAT & ANTI LAG)
  // -----------------------------------------------------------
  const now = performance.now();
  ctx.save();
  ctx.font = Math.round(CELL * 0.72) + 'px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const f of foods) {
    const sx = (f.x - camX) * CELL + CELL / 2;
    const sy = (f.y - camY) * CELL + CELL / 2;

    if (sx < -CELL || sx > canvas.width + CELL || sy < -CELL || sy > canvas.height + CELL) {
      continue;
    }

    const floatOffset = Math.sin(now / 160 + f.pulseOffset) * 2.2;
    ctx.fillText(f.emoji, sx, sy + floatOffset);
  }
  ctx.restore();

  // -----------------------------------------------------------
  // RENDER LAWAN (MULTIPLAYER ENEMIES - POV KITA: SEMUANYA MUSUH MERAH / 🗿 PATUNG)
  // -----------------------------------------------------------
  for (const enemyId in remotePlayers) {
    const enemy = remotePlayers[enemyId];
    if (!enemy || !enemy.state || enemy.state.isDead) continue;
    const enemySnake = enemy.state.snake;
    if (!Array.isArray(enemySnake) || enemySnake.length === 0) continue;

    const isStatue = !!enemy.state.isPaused;
    const enemyPrev = enemy.state.prevSnake || enemySnake;

    for (let i = enemySnake.length - 1; i >= 0; i--) {
      const cur = enemySnake[i];
      const prev = enemyPrev[i] || cur;
      const segWorldX = prev.x + (cur.x - prev.x) * t;
      const segWorldY = prev.y + (cur.y - prev.y) * t;

      const sx = (segWorldX - camX) * CELL + CELL / 2;
      const sy = (segWorldY - camY) * CELL + CELL / 2;

      if (sx >= -CELL * 2 && sx <= canvas.width + CELL * 2 && sy >= -CELL * 2 && sy <= canvas.height + CELL * 2) {
        let ang = 0;
        if (i === 0) {
          const d = enemy.state.dir || { x: 1, y: 0 };
          ang = Math.atan2(d.y, d.x);
        } else {
          const nextCur = enemySnake[i - 1];
          const nextPrev = enemyPrev[i - 1] || nextCur;
          const nextWorldX = nextPrev.x + (nextCur.x - nextPrev.x) * t;
          const nextWorldY = nextPrev.y + (nextCur.y - nextPrev.y) * t;
          ang = Math.atan2(nextWorldY - segWorldY, nextWorldX - segWorldX);
        }

        drawSnakeSegment(sx, sy, CELL * 0.44, i, ang, true, isStatue);
        if (i === 0) {
          drawNameTag(sx, sy, enemy.name || 'Musuh', true, isStatue);
        }
      }
    }
  }

  // -----------------------------------------------------------
  // RENDER ULAR SENDIRI: HIJAU / 🗿 PATUNG ABU JIKA JEDA
  // -----------------------------------------------------------
  const isMyStatue = paused;
  for (let i = snake.length - 1; i >= 0; i--) {
    const cur = snake[i];
    const prev = prevSnake[i] || cur;

    const segWorldX = prev.x + (cur.x - prev.x) * t;
    const segWorldY = prev.y + (cur.y - prev.y) * t;

    const sx = (segWorldX - camX) * CELL + CELL / 2;
    const sy = (segWorldY - camY) * CELL + CELL / 2;

    if (sx >= -CELL * 2 && sx <= canvas.width + CELL * 2 && sy >= -CELL * 2 && sy <= canvas.height + CELL * 2) {
      let ang = visualAngle;
      if (i === 0) {
        ang = visualAngle;
      } else {
        const nextCur = snake[i - 1];
        const nextPrev = prevSnake[i - 1] || nextCur;
        const nextWorldX = nextPrev.x + (nextCur.x - nextPrev.x) * t;
        const nextWorldY = nextPrev.y + (nextCur.y - nextPrev.y) * t;
        const dx = nextWorldX - segWorldX;
        const dy = nextWorldY - segWorldY;
        if (Math.hypot(dx, dy) > 0.001) {
          ang = Math.atan2(dy, dx);
        } else {
          ang = bodyAngles[i] || visualAngle;
        }
      }

      drawSnakeSegment(sx, sy, CELL * 0.45, i, ang, false, isMyStatue);
      if (i === 0) {
        drawNameTag(sx, sy, myPlayerName || 'Anda', false, isMyStatue);
      }
    }
  }

  // Partikel percikan makanan ringan tanpa shadowBlur
  for (const p of particles) {
    p.wx += p.vx;
    p.wy += p.vy;
    p.life--;
    const psx = (p.wx - camX) * CELL;
    const psy = (p.wy - camY) * CELL;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(psx, psy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  particles = particles.filter(p => p.life > 0);

  if (tongue > 0 && running && !paused) tongue--;

  // -----------------------------------------------------------
  // 🗺️ MINIMAP / RADAR (POJOK KIRI ATAS - TETAP KELIHATAN & JALAN)
  // -----------------------------------------------------------
  drawMinimap();
}

function drawSnakeSegment(x, y, r, i, angle, isEnemy = false, isStatue = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Bayangan tanah ringan
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 6, r * 0.95, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createLinearGradient(-r, -r * 0.8, r, r * 0.8);

  if (isStatue) {
    // 🗿 TEXTURE PATUNG BATU / ABU-ABU
    grad.addColorStop(0, '#9ca3af');
    grad.addColorStop(0.5, '#4b5563');
    grad.addColorStop(1, '#1f2937');
  } else if (isEnemy) {
    // ⚔️ TEXTURE MUSUH MERAH NEON / CRIMSON (POV DIRI SENDIRI)
    if (i === 0) {
      grad.addColorStop(0, '#fca5a5');
      grad.addColorStop(0.35, '#ef4444');
      grad.addColorStop(1, '#7f1d1d');
    } else {
      const sh = Math.max(0.55, 1 - i * 0.02);
      grad.addColorStop(0, 'rgba(' + Math.round(239 * sh) + ',' + Math.round(68 * sh) + ',' + Math.round(68 * sh) + ',1)');
      grad.addColorStop(0.5, 'rgba(185,28,28,1)');
      grad.addColorStop(1, 'rgba(127,29,29,1)');
    }
  } else {
    // 👑 TEXTURE HIJAU EMERALD ULAR SENDIRI
    if (i === 0) {
      grad.addColorStop(0, '#a7f3d0');
      grad.addColorStop(0.35, '#34d399');
      grad.addColorStop(1, '#064e3b');
    } else {
      const sh = Math.max(0.55, 1 - i * 0.02);
      grad.addColorStop(0, 'rgba(' + Math.round(52 * sh) + ',' + Math.round(211 * sh) + ',' + Math.round(153 * sh) + ',1)');
      grad.addColorStop(0.5, 'rgba(16,149,106,1)');
      grad.addColorStop(1, 'rgba(4,75,52,1)');
    }
  }

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.18, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sisik punggung
  ctx.fillStyle = isStatue ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.2, r * 0.65, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (i === 0) {
    if (isStatue) {
      // Mata Patung Batu Tertutup
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(r * 0.35, -r * 0.42, 3.2, 4.2, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.35, r * 0.42, 3.2, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Mata Ular
      ctx.fillStyle = isEnemy ? '#450a0a' : '#06281e';
      ctx.beginPath();
      ctx.ellipse(r * 0.35, -r * 0.42, 3.8, 5.2, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.35, r * 0.42, 3.8, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris Mata
      ctx.fillStyle = isEnemy ? '#fef08a' : '#ffd166';
      ctx.beginPath();
      ctx.arc(r * 0.58, -r * 0.42, 1.5, 0, Math.PI * 2);
      ctx.arc(r * 0.58, r * 0.42, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Lidah Bercabang
      if (tongue > 0 && !isStatue) {
        ctx.strokeStyle = isEnemy ? '#dc2626' : '#ff3b30';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 1.18, 0);
        ctx.lineTo(r * 1.18 + 12, -3.5);
        ctx.moveTo(r * 1.18, 0);
        ctx.lineTo(r * 1.18 + 12, 3.5);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function drawNameTag(x, y, name, isEnemy = false, isStatue = false) {
  ctx.save();
  ctx.font = 'bold 8.5px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const titleText = isStatue ? ('🗿 ' + name + ' (PATUNG)') : isEnemy ? ('⚔️ ' + name) : ('👑 ' + name);
  const textWidth = ctx.measureText(titleText).width;
  const padW = 7;
  const bw = textWidth + padW * 2;
  const bh = 14;
  const bx = x - bw / 2;
  const by = y - 32;

  // Background Badge Glassmorphic
  ctx.fillStyle = isStatue ? 'rgba(31, 41, 55, 0.88)' : isEnemy ? 'rgba(127, 29, 29, 0.88)' : 'rgba(6, 78, 59, 0.88)';
  ctx.strokeStyle = isStatue ? '#9ca3af' : isEnemy ? '#ef4444' : '#34d399';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 5);
  ctx.fill();
  ctx.stroke();

  // Teks Nama
  ctx.fillStyle = isStatue ? '#e5e7eb' : isEnemy ? '#fee2e2' : '#ecfdf5';
  ctx.fillText(titleText, x, by + bh / 2);
  ctx.restore();
}

// -------------------------------------------------------------
// 🗺️ RADAR / MINIMAP LENGKAP:
// - Terletak di pojok kiri atas
// - Titik Hijau: Pengguna sendiri (dengan halo berkedip)
// - Titik Merah: Musuh / Lawan Multiplayer
// - Titik Warna-warni (bukan merah): 14-21 Makanan Emoji Buah
// - Garis Merah: Laser pembatas arena 1000m²
// -------------------------------------------------------------
function drawMinimap() {
  const mmX = 14;
  const mmY = 14;
  const mmW = 122;
  const mmH = 122;
  const innerPad = 5;

  ctx.save();

  // Panel Dasar Radar Transparan Elegan Glassmorphic
  ctx.fillStyle = 'rgba(8, 14, 18, 0.92)';
  ctx.strokeStyle = '#2b3f47';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(mmX, mmY, mmW, mmH, 12);
  ctx.fill();
  ctx.stroke();

  // Grid Silang Radar Halus
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(mmX + mmW / 2, mmY + innerPad);
  ctx.lineTo(mmX + mmW / 2, mmY + mmH - innerPad);
  ctx.moveTo(mmX + innerPad, mmY + mmH / 2);
  ctx.lineTo(mmX + mmW - innerPad, mmY + mmH / 2);
  ctx.stroke();

  // Garis Pembatas Merah Laser di Minimap (Batas Arena 1000m²)
  ctx.strokeStyle = '#ff3344';
  ctx.lineWidth = 2;
  ctx.strokeRect(mmX + innerPad, mmY + innerPad, mmW - innerPad * 2, mmH - innerPad * 2);

  // Header Radar Mini & Status Live
  const livePulse = Math.sin(performance.now() / 220) > 0;
  ctx.fillStyle = isWsOnline ? (livePulse ? '#00ff66' : '#047857') : '#ef4444';
  ctx.beginPath();
  ctx.arc(mmX + 11, mmY + 12, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isWsOnline ? '#a7f3d0' : '#fca5a5';
  ctx.font = '900 7.5px system-ui, -apple-system, sans-serif';
  ctx.fillText(isWsOnline ? 'MAP 1000m² [LIVE]' : 'MAP 1000m² [SOLO]', mmX + 18, mmY + 14.5);

  const drawAreaW = mmW - innerPad * 2;
  const drawAreaH = mmH - innerPad * 2;

  // 1. Gambar Seluruh 14-21 Makanan di Minimap (Titik Warna-Warni Buah, BUKAN MERAH)
  for (const f of foods) {
    const mx = mmX + innerPad + (f.x / WORLD_SIZE) * drawAreaW;
    const my = mmY + innerPad + (f.y / WORLD_SIZE) * drawAreaH;

    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Gambar Seluruh LAWAN di Minimap (TITIK MERAH & BADAN MERAH)
  for (const enemyId in remotePlayers) {
    const enemy = remotePlayers[enemyId];
    if (!enemy || !enemy.state || enemy.state.isDead) continue;
    const enemySnake = enemy.state.snake;
    if (!Array.isArray(enemySnake) || enemySnake.length === 0) continue;

    // Badan Musuh di Radar (Garis Merah Pudar / Abu jika patung)
    ctx.strokeStyle = enemy.state.isPaused ? 'rgba(156, 163, 175, 0.7)' : 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < enemySnake.length; i++) {
      const ex = mmX + innerPad + (enemySnake[i].x / WORLD_SIZE) * drawAreaW;
      const ey = mmY + innerPad + (enemySnake[i].y / WORLD_SIZE) * drawAreaH;
      if (i === 0) ctx.moveTo(ex, ey);
      else ctx.lineTo(ex, ey);
    }
    ctx.stroke();

    // Kepala Musuh: Titik Merah Terang (atau Abu jika Patung)
    const eHead = enemySnake[0];
    const ehx = mmX + innerPad + (eHead.x / WORLD_SIZE) * drawAreaW;
    const ehy = mmY + innerPad + (eHead.y / WORLD_SIZE) * drawAreaH;

    ctx.fillStyle = enemy.state.isPaused ? '#9ca3af' : '#ef4444';
    ctx.beginPath();
    ctx.arc(ehx, ehy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Gambar Badan Ular Sendiri di Minimap (Jalur Hijau Lumut)
  ctx.strokeStyle = paused ? 'rgba(156, 163, 175, 0.8)' : 'rgba(52, 211, 153, 0.75)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i < snake.length; i++) {
    const sx = mmX + innerPad + (snake[i].x / WORLD_SIZE) * drawAreaW;
    const sy = mmY + innerPad + (snake[i].y / WORLD_SIZE) * drawAreaH;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // 4. Gambar TITIK HIJAU: Posisi Pengguna Sendiri (Dengan Denyut Terang Tetap Jalan)
  const headPos = visualHead || snake[0];
  const hx = mmX + innerPad + (headPos.x / WORLD_SIZE) * drawAreaW;
  const hy = mmY + innerPad + (headPos.y / WORLD_SIZE) * drawAreaH;

  const pulse = Math.sin(performance.now() / 180) * 1.5;

  // Halo Denyut Hijau Terang (atau Abu jika Patung)
  ctx.fillStyle = paused ? 'rgba(156, 163, 175, 0.3)' : 'rgba(0, 255, 102, 0.3)';
  ctx.beginPath();
  ctx.arc(hx, hy, 5.8 + pulse, 0, Math.PI * 2);
  ctx.fill();

  // Inti Titik Hijau Pengguna (atau Abu jika Patung)
  ctx.fillStyle = paused ? '#d1d5db' : '#00ff66';
  ctx.beginPath();
  ctx.arc(hx, hy, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!lastTime) lastTime = now;
  const dt = Math.min(32, Math.max(0, now - lastTime));
  lastTime = now;

  if (running && !paused && !gameOver) {
    accumulator += dt;
    while (accumulator >= speed) {
      logicTick();
      accumulator -= speed;
      if (gameOver) break;
    }

    let d = targetAngle - visualAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    visualAngle += d * (1 - Math.exp(-dt * 0.04));

    for (let i = 1; i < bodyAngles.length; i++) {
      let q = bodyAngles[i - 1] - bodyAngles[i];
      while (q > Math.PI) q -= Math.PI * 2;
      while (q < -Math.PI) q += Math.PI * 2;
      bodyAngles[i] += q * (1 - Math.exp(-dt * 0.035));
    }
  }

  draw(running && !paused && !gameOver ? Math.min(1, Math.max(0, accumulator / speed)) : 0);
}

function bind() {
  startBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    togglePause();
  }, { passive: false });

  resetBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    reset();
    show('Siap', 'Tekan MULAI untuk memulai ekspedisi 1000m².', '🐍');
  }, { passive: false });

  document.querySelectorAll('.pad').forEach(btn => {
    const press = e => {
      e.preventDefault();
      btn.classList.add('active');
      const d = btn.dataset.dir;
      if (d === 'up') setDirection(0, -1);
      else if (d === 'down') setDirection(0, 1);
      else if (d === 'left') setDirection(-1, 0);
      else setDirection(1, 0);
    };
    const release = () => btn.classList.remove('active');
    btn.addEventListener('pointerdown', press, { passive: false });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  });

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      togglePause();
      return;
    }
    if (k === 'r') {
      e.preventDefault();
      reset();
      show('Siap', 'Tekan MULAI untuk memulai ekspedisi.', '🐍');
      return;
    }
    if (k === 'w' || k === 'arrowup') setDirection(0, -1);
    else if (k === 's' || k === 'arrowdown') setDirection(0, 1);
    else if (k === 'a' || k === 'arrowleft') setDirection(-1, 0);
    else if (k === 'd' || k === 'arrowright') setDirection(1, 0);
  }, { passive: false });

  canvas.addEventListener('pointerdown', e => {
    swipeStart = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  canvas.addEventListener('pointerup', e => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
    else setDirection(0, dy > 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) {
      paused = true;
      show('Patung Jeda 🗿', 'Ular menjadi patung batu abu-abu saat layar ditinggalkan.', '🗿');
      updateUi();
      broadcastMyState();
    }
  });
}

reset();
show('Ular Rimba 2', 'Ekspedisi 1000m² Multiplayer! Pantau radar (Hijau = Anda, Merah = Lawan/Musuh). Adu kepala: yang pendek kalah! Jeda = Patung Batu 🗿.', '🐍');
bind();
connectMultiplayerWs();
requestAnimationFrame(frame);
})();

/* RIMURU LIGHT SFX: procedural WebAudio, no external audio asset */
(function(){
  if (window.__RIMURU_LIGHT_SFX__) return;
  var ac=null, master=null, last=0;
  function init(){
    try{
      if(!ac){
        var C=window.AudioContext||window.webkitAudioContext;
        if(!C) return null;
        ac=new C();
        master=ac.createGain();
        master.gain.value=0.055;
        master.connect(ac.destination);
      }
      if(ac.state==='suspended') ac.resume();
      return ac;
    }catch(_){ return null; }
  }
  function tone(freq,dur,type,vol,when){
    var c=init(); if(!c||!master) return;
    var now=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(freq,now);
    g.gain.setValueAtTime(0.0001,now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,vol||0.12),now+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,now+(dur||0.07));
    o.connect(g); g.connect(master); o.start(now); o.stop(now+(dur||0.07)+0.015);
  }
  function cool(now){
    var t=Date.now(); if(t-last<now) return false; last=t; return true;
  }
  var api={
    init:init,
    tap:function(){ if(cool(28)) tone(520,0.045,'square',0.055); },
    move:function(){ if(cool(24)) tone(300,0.035,'triangle',0.045); },
    rotate:function(){ if(cool(24)) tone(430,0.05,'triangle',0.05); },
    drop:function(){ if(cool(20)) tone(180,0.055,'square',0.05); },
    score:function(){ if(cool(18)) { tone(660,0.055,'sine',0.055); tone(880,0.055,'sine',0.04,0.045); } },
    line:function(){ if(cool(35)) { tone(740,0.06,'sine',0.06); tone(1040,0.09,'sine',0.045,0.05); } },
    win:function(){ if(cool(60)) { tone(523,0.08,'sine',0.06); tone(659,0.08,'sine',0.05,0.07); tone(784,0.12,'sine',0.045,0.14); } },
    over:function(){ if(cool(60)) { tone(392,0.09,'sawtooth',0.055); tone(294,0.12,'sawtooth',0.04,0.08); } }
  };
  window.__RIMURU_LIGHT_SFX__=api;

  function num(el){
    var s=(el.textContent||'').replace(/,/g,'').match(/-?\\d+(?:\\.\\d+)?/);
    return s?Number(s[0]):null;
  }
  function bindValue(el){
    var lastVal=num(el);
    var mo=new MutationObserver(function(){
      var n=num(el);
      if(n===null || lastVal===null){ lastVal=n; return; }
      if(n>lastVal){
        var id=((el.id||'')+' '+(el.className||'')).toLowerCase();
        if(/line|combo|clear|level|stage/.test(id)) api.line(); else api.score();
      } else if(n<lastVal && /life|hp|health|lives|heart/.test(((el.id||'')+' '+(el.className||'')).toLowerCase())) api.over();
      lastVal=n;
    });
    mo.observe(el,{subtree:true,childList:true,characterData:true});
  }
  function bindState(el){
    var prev=(el.textContent||'').toLowerCase(), prevCls=el.className||'';
    var mo=new MutationObserver(function(){
      var txt=(el.textContent||'').toLowerCase(), cls=el.className||'';
      var joined=txt+' '+cls.toLowerCase();
      if(joined!==prev+' '+prevCls.toLowerCase()){
        if(/game over|gameover|kalah|selesai|you lose|lose|mati|gagal|over/.test(joined)) api.over();
        else if(/menang|menang!|you win|winner|victory|berhasil|selamat/.test(joined)) api.win();
        prev=txt; prevCls=cls;
      }
    });
    mo.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
  }
  document.addEventListener('pointerdown',function(){ api.init(); api.tap(); },{passive:true,capture:true});
  document.addEventListener('keydown',function(e){
    api.init();
    var k=e.key;
    if(/^Arrow(Left|Right|Up|Down)$/.test(k) || /^(a|d|w|s)$/i.test(k)) api.move();
    else if(k===' ' || k==='Enter') api.tap();
  },{passive:true,capture:true});
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('[id]').forEach(function(el){
      var id=((el.id||'')+' '+(el.className||'')).toLowerCase();
      if(/score|points|lines|combo|level|stage|best|coin/.test(id)) bindValue(el);
      if(/over|result|status|message|state|win|lose|modal/.test(id)) bindState(el);
    });
  });
  if(document.readyState!=='loading'){
    document.querySelectorAll('[id]').forEach(function(el){
      var id=((el.id||'')+' '+(el.className||'')).toLowerCase();
      if(/score|points|lines|combo|level|stage|best|coin/.test(id)) bindValue(el);
      if(/over|result|status|message|state|win|lose|modal/.test(id)) bindState(el);
    });
  }
})();
</script>
</body>
</html>`

const pluginConfig = {
  name: 'snake2',
  alias: ['ular2', 'snake2game', 'ularrimba2', 'snakemap'],
  category: 'game',
  description: 'Game Snake 2 Multiplayer: WebSocket ws://medium.lynzz.id:2252, Peta 1000m², Minimap Radar Musuh Merah, Adu Kepala (Pendek Kalah), Jeda Patung Abu 🗿 & Nama Pemain',
  usage: '.snake2',
  example: '.snake2',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  isEnabled: true
};

function getPublicWsUrl() {
  const appUrl = process.env.APP_URL || (process.env.NG_ALLOWED_HOSTS ? ('https://' + process.env.NG_ALLOWED_HOSTS) : '');
  if (appUrl) {
    return appUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/snake2';
  }
  return 'wss://ais-dev-duf3mcc5xc3j7mpviuftcm-684707883963.asia-southeast1.run.app/ws/snake2';
}

async function kirimSnake2(conn, chatId, customHtml, title = '🐍 Ular Rimba 2 Multiplayer (1000m²)') {
  let content = customHtml || html;
  const publicWs = getPublicWsUrl();
  content = content.replace(/__INJECTED_WS_URL__/g, publicWs);
  return kirimForwardSigned(conn, chatId, content, title);
}

const handler = async (m, options = {}) => {
  const sock = options?.sock || options?.conn || options?.naze || options;
  const chatId = m?.chat || m?.key?.remoteJid;
  if (!chatId || !sock) return;

  const reactionKey = m?.raw?.key || m?.key;
  if (reactionKey && typeof sock.sendMessage === 'function') {
    await sock.sendMessage(chatId, { react: { text: '🐍', key: reactionKey } }).catch(() => {});
  }

  try {
    await kirimSnake2(sock, chatId);
  } catch (e) {
    console.error('[SNAKE2 ERROR]', e);
    if (typeof m?.reply === 'function') {
      await m.reply('❌ Gagal mengirim game Snake 2: ' + (e?.message || e));
    }
  }
};

export { pluginConfig as config, handler, kirimSnake2, html as SNAKE2_HTML };
export default handler;
