// Grand Royal Casino Resort HTML Payload with Scatter All-Ways Jackpots, 5-Reel Slot Engine, and Auto-Copy Clipboard
export function buildCasinoHtml(initialWallet = 10000, playerName = 'Trainer') {
  const safeWallet = Math.max(100, Math.floor(initialWallet));
  const safeName = (playerName || 'Trainer').replace(/["'<>]/g, '');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Royal Casino Resort</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
html,body{width:100%;background:radial-gradient(circle at 50% 20%,#0e4a2e 0%,#072a19 50%,#02120b 100%);color:#f4faf6;touch-action:manipulation;overflow-y:auto;-webkit-overflow-scrolling:touch}
body{padding:8px 6px 28px;min-height:100%}

#casino-app{max-width:420px;margin:0 auto;position:relative}
.gold-glow{text-shadow:0 0 10px rgba(255,215,0,0.7),0 0 20px rgba(212,175,55,0.5)}

/* Header Marquee 3D Green Velvet & Gold */
.header-marquee{background:linear-gradient(135deg,#133d26 0%,#082415 100%);border:2px solid #d4af37;border-radius:12px;padding:8px 10px;margin-bottom:8px;box-shadow:0 6px 16px rgba(0,0,0,0.7),inset 0 1px 2px rgba(255,245,190,0.5),0 0 10px rgba(212,175,55,0.25);position:relative;overflow:hidden}
.casino-brand{display:flex;justify-content:space-between;align-items:center}
.casino-title{font-size:16px;font-weight:900;letter-spacing:0.5px;color:#ffd700;display:flex;align-items:center;gap:4px;text-shadow:0 2px 4px rgba(0,0,0,0.8),0 0 8px rgba(255,215,0,0.5)}
.casino-subtitle{font-size:8.5px;color:#86efac;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.wallet-box{background:radial-gradient(circle at 50% 50%,#082b17,#021008);border:1.8px solid #d4af37;border-radius:8px;padding:4px 8px;text-align:right;min-width:105px;box-shadow:inset 0 0 8px rgba(0,0,0,0.9),0 0 6px rgba(212,175,55,0.3)}
.wallet-label{font-size:7.5px;color:#d1fae5;font-weight:700;text-transform:uppercase}
.wallet-val{font-size:14px;font-weight:900;color:#ffe066;letter-spacing:0.5px;text-shadow:0 0 8px rgba(255,215,0,0.6)}

/* Tabs & Pills with Gold Trims */
.nav-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}
.nav-btn{padding:8px 6px;border-radius:10px;border:1.5px solid #1a5336;background:linear-gradient(180deg,#0b2e1c,#051a0f);color:#86efac;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 3px 6px rgba(0,0,0,0.5);transition:all 0.15s}
.nav-btn.active{border:2px solid #ffd700;background:linear-gradient(180deg,#4d3800,#261a00);color:#ffd700;box-shadow:0 0 12px rgba(255,215,0,0.45),inset 0 1px 2px #fff6cc}

.game-pills{display:flex;gap:5px;overflow-x:auto;padding-bottom:4px;margin-bottom:8px;-webkit-overflow-scrolling:touch}
.game-pills::-webkit-scrollbar{display:none}
.pill-btn{padding:6px 11px;white-space:nowrap;border-radius:16px;border:1.5px solid #1a5336;background:linear-gradient(180deg,#0a2d1b,#04170d);color:#a7f3d0;font-size:10.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;flex-shrink:0;box-shadow:0 2px 5px rgba(0,0,0,0.5)}
.pill-btn.active{border:1.8px solid #ffd700;background:linear-gradient(180deg,#382700,#170f00);color:#ffd700;box-shadow:0 0 8px rgba(255,215,0,0.4)}

/* Casino Stage 3D Felt & Golden Edge */
.casino-stage{background:radial-gradient(ellipse at 50% 30%,#0d4f2b 0%,#07321b 60%,#02170b 100%);border:2.5px solid #d4af37;border-radius:14px;padding:10px 8px;box-shadow:0 8px 24px rgba(0,0,0,0.8),inset 0 0 25px rgba(0,0,0,0.7),0 0 10px rgba(212,175,55,0.25);position:relative;margin-bottom:8px}

/* Chips & Luck Boost Banner */
.vip-luck-banner{background:linear-gradient(90deg,rgba(180,83,9,0.45),rgba(234,179,8,0.55),rgba(180,83,9,0.45));border:1.5px solid #eab308;border-radius:8px;padding:4px 6px;text-align:center;font-size:9.5px;font-weight:800;color:#fef08a;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 2px 6px rgba(0,0,0,0.5)}
.bet-chips{display:flex;justify-content:center;gap:5px;margin:6px 0;flex-wrap:wrap}
.chip{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;cursor:pointer;border:2px dashed rgba(255,255,255,0.75);box-shadow:0 3px 6px rgba(0,0,0,0.6);position:relative;transition:transform 0.15s;flex-shrink:0}
.chip:active{transform:scale(0.92)}
.chip.c100{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff}
.chip.c500{background:linear-gradient(135deg,#831843,#ec4899);color:#fff}
.chip.c1000{background:linear-gradient(135deg,#991b1b,#ef4444);color:#fff}
.chip.c5000{background:linear-gradient(135deg,#854d0e,#eab308);color:#000}
.chip.c10000{background:linear-gradient(135deg,#581c87,#a855f7);color:#fef08a;border:2px solid #ffd700;box-shadow:0 0 10px rgba(255,215,0,0.7)}
.chip.selected{transform:translateY(-3px);border:2px solid #ffd700;box-shadow:0 0 12px #ffd700}

/* Buttons with 3D Gold / Emerald Gradients */
.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.btn-gold{background:linear-gradient(180deg,#ffe066 0%,#d4af37 55%,#997300 100%);border:1.5px solid #fff3b0;border-radius:10px;color:#1a1200;font-size:12px;font-weight:900;padding:10px 12px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.6),inset 0 1px 2px #fff;text-shadow:0 1px 0 rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;gap:4px}
.btn-gold:active{transform:scale(0.96)}
.btn-gold:disabled{opacity:0.5;cursor:not-allowed;transform:none}
.btn-dark{background:linear-gradient(180deg,#184229,#0a2113);border:1.5px solid #2d7a4c;border-radius:10px;color:#d1fae5;font-size:12px;font-weight:800;padding:10px 12px;cursor:pointer;box-shadow:0 3px 6px rgba(0,0,0,0.5)}
.btn-dark:active{transform:scale(0.96)}

/* ROYAL SLOTS (5 REELS, 3 ROWS, GOLDEN TRIM) */
.slot-cabinet{width:100%;margin:0 auto}
.slot-header-bar{display:flex;justify-content:space-between;align-items:center;padding:5px 7px;background:linear-gradient(180deg,#1b472f,#0c2819);border:1.8px solid #d4af37;border-radius:8px 8px 0 0;font-size:9.5px;font-weight:800;color:#fde047}
.slot-reels-box{display:flex;width:100%;height:180px;background:#020b06;border:2.5px solid #d4af37;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;box-shadow:inset 0 0 22px rgba(0,0,0,0.95);position:relative}
.slot-payline{position:absolute;top:50%;left:0;right:0;height:2px;background:rgba(255,215,0,0.5);box-shadow:0 0 8px #ffd700;pointer-events:none;z-index:10}
.slot-reel{flex:1 1 20%;width:20%;min-width:0;max-width:20%;height:100%;position:relative;overflow:hidden;border-right:1px solid #2b573c;box-sizing:border-box;background:linear-gradient(90deg,#0a2114,#fbf8e8 18%,#ffffff 50%,#f5eed2 82%,#0a2114)}
.slot-reel:last-child{border-right:none}
.slot-strip{width:100%;position:absolute;top:0;left:0;will-change:transform}
.slot-sym{width:100%;height:60px;display:flex;align-items:center;justify-content:center;font-size:24px;border-bottom:1px solid rgba(160,120,60,0.25);box-sizing:border-box}
.slot-sym.win-glow{background:radial-gradient(circle,rgba(255,215,0,0.55) 0%,transparent 80%);filter:drop-shadow(0 0 6px #ffd700)}

.slot-s7{font:900 26px Impact,sans-serif;color:#ef4444;-webkit-text-stroke:1px #7f1d1d;text-shadow:0 0 8px #f87171,0 2px 4px #000}
.slot-bar-special{background:linear-gradient(135deg,#78350f,#f59e0b 50%,#78350f);border:1.5px solid #fef08a;border-radius:4px;padding:1px 3px;color:#1c1002;font:900 10px Impact,sans-serif;letter-spacing:0.5px;box-shadow:0 0 6px #eab308;display:inline-block;text-align:center}
.slot-bar-triple{background:linear-gradient(135deg,#831843,#ec4899 50%,#831843);border:1.5px solid #fbcfe8;border-radius:4px;padding:1px 3px;color:#fff;font:900 9.5px Impact,sans-serif;letter-spacing:0.5px;box-shadow:0 0 6px #ec4899;display:inline-block;text-align:center}

/* EUROPEAN ROULETTE */
.roulette-wrapper{display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;padding:4px 0}
.roulette-track{width:200px;height:200px;border-radius:50%;background:#1c1002;border:6px solid #d4af37;box-shadow:0 6px 18px rgba(0,0,0,0.85),0 0 10px rgba(212,175,55,0.4);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.roulette-wheel-svg{width:184px;height:184px;border-radius:50%;will-change:transform}
.roulette-ball-orbit{position:absolute;inset:8px;border-radius:50%;pointer-events:none;will-change:transform}
.roulette-ball{width:11px;height:11px;background:#fff;border-radius:50%;box-shadow:0 0 6px #fff,0 2px 4px rgba(0,0,0,0.6);position:absolute;top:2px;left:50%;transform:translateX(-50%);transition:all 0.3s ease}
.roulette-indicator{position:absolute;top:3px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid #ffd700;z-index:20;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))}
.roulette-center-hub{position:absolute;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#d4af37,#997300);border:2.5px solid #fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.6);z-index:15}
.roulette-hub-num{font:900 16px 'Arial Black',sans-serif;color:#1c1002;line-height:1}
.roulette-hub-col{font-size:6.5px;font-weight:900;color:#1c1002;letter-spacing:1px}

/* Dice & Blackjack */
.dice-arena{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 0}
.dice-board{perspective:400px;display:flex;gap:18px;justify-content:center;align-items:center;margin:8px 0}
.dice-cube{width:50px;height:50px;position:relative;transform-style:preserve-3d;transform:rotateX(-20deg) rotateY(25deg);transition:transform 1.1s cubic-bezier(0.17,0.89,0.32,1.28)}
.dice-face{position:absolute;width:50px;height:50px;background:#fff;border:2px solid #ccc;border-radius:8px;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:5px;box-shadow:inset 0 0 4px rgba(0,0,0,0.2)}
.pip{width:9px;height:9px;background:#1e293b;border-radius:50%;align-self:center;justify-self:center}
.pip.red{background:#dc2626}
.dice-face.f1{transform:translateZ(25px)}.dice-face.f6{transform:rotateY(180deg) translateZ(25px)}.dice-face.f2{transform:rotateY(-90deg) translateZ(25px)}.dice-face.f5{transform:rotateY(90deg) translateZ(25px)}.dice-face.f3{transform:rotateX(90deg) translateZ(25px)}.dice-face.f4{transform:rotateX(-90deg) translateZ(25px)}

.bj-table{display:flex;flex-direction:column;gap:8px}
.bj-hand-title{font-size:10px;font-weight:700;color:#ffe066;display:flex;justify-content:space-between;align-items:center}
.bj-cards{display:flex;gap:5px;min-height:64px;align-items:center;overflow-x:auto;padding:2px}
.card-3d{width:42px;height:62px;background:#fff;border-radius:5px;border:1px solid #d1d5db;color:#111;display:flex;flex-direction:column;justify-content:space-between;padding:3px;font-weight:900;font-size:11px;box-shadow:0 3px 6px rgba(0,0,0,0.4);position:relative}
.card-3d.red{color:#dc2626}
.card-3d.hidden{background:repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a 6px,#172554 6px,#172554 12px);color:transparent;border:2px solid #fff}

/* UI Feedback & Auto-Copy Toast */
.msg-banner{background:radial-gradient(ellipse at 50% 50%,#092615,#03120a);border:1.8px solid #d4af37;border-radius:8px;padding:6px 10px;text-align:center;font-size:11px;font-weight:800;color:#fef08a;margin:5px 0;min-height:32px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 10px rgba(0,0,0,0.8),0 2px 6px rgba(0,0,0,0.5)}
.claim-box{background:radial-gradient(circle at 50% 40%,#0e4c2c 0%,#072e19 70%,#02170b 100%);border:2px solid #34d399;border-radius:12px;padding:9px 10px;margin-top:8px;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,0.7),0 0 8px rgba(52,211,153,0.3)}
.claim-code-text{font:900 13px monospace;color:#a7f3d0;letter-spacing:1px;background:#022c22;padding:6px;border-radius:6px;margin:5px 0;border:1px solid #059669;user-select:all}
.toast-notice{background:linear-gradient(90deg,#fef08a,#fde047);color:#713f12;border:1px solid #ca8a04;border-radius:6px;padding:4px 6px;font-size:9.5px;font-weight:800;margin-top:3px}

/* Multiplayer UI 3D Felt & Golden Edges */
.room-card{background:radial-gradient(ellipse at 50% 30%,#0d4727 0%,#082e19 65%,#03140b 100%);border:2.5px solid #d4af37;border-radius:14px;padding:12px 10px;margin-bottom:8px;box-shadow:0 8px 24px rgba(0,0,0,0.8),inset 0 0 20px rgba(0,0,0,0.6),0 0 10px rgba(212,175,55,0.25)}
.room-code-display{background:radial-gradient(circle at 50% 50%,#2e1e05,#140d02);border:2px dashed #ffd700;border-radius:10px;padding:10px 8px;text-align:center;margin:10px 0;box-shadow:inset 0 0 12px rgba(0,0,0,0.9),0 0 10px rgba(255,215,0,0.3)}
.code-digits{font:900 32px 'Arial Black',sans-serif;letter-spacing:6px;color:#ffd700;margin:3px 0;text-shadow:0 0 12px rgba(255,215,0,0.8)}
.code-hint{font-size:9.5px;color:#fde68a;font-weight:700}
.input-field{width:100%;padding:9px 11px;border-radius:8px;border:1.8px solid #2d7a4c;background:#041a0e;color:#fff;font-size:12px;font-weight:700;margin-bottom:8px;outline:none}
.input-field:focus{border-color:#ffd700;box-shadow:0 0 8px rgba(255,215,0,0.4)}
.player-list{display:flex;flex-direction:column;gap:5px;margin:8px 0;max-height:130px;overflow-y:auto}
.player-row{display:flex;justify-content:space-between;align-items:center;background:rgba(4,26,14,0.8);border:1px solid #1a5336;padding:6px 8px;border-radius:6px;font-size:11px;font-weight:700;color:#ecfdf5}
.player-badge{padding:2px 6px;border-radius:4px;font-size:8.5px;font-weight:800}
.badge-host{background:linear-gradient(180deg,#ffd700,#b8860b);color:#1c1002}
.badge-guest{background:linear-gradient(180deg,#3b82f6,#1d4ed8);color:#fff}
.venue-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}
.venue-btn{padding:8px 6px;border-radius:8px;border:1.5px solid #1a5336;background:#062313;color:#a7f3d0;font-size:10.5px;font-weight:800;cursor:pointer;text-align:center}
.venue-btn.selected{border-color:#ffd700;background:linear-gradient(180deg,#382700,#170f00);color:#ffd700;box-shadow:0 0 8px rgba(255,215,0,0.4)}
</style>
</head>
<body>

<div id="casino-app">
  <!-- Top Marquee & Wallet -->
  <div class="header-marquee">
    <div class="casino-brand">
      <div>
        <div class="casino-title">👑 ROYAL CASINO</div>
        <div class="casino-subtitle">Vegas & Macau Luxury Hub</div>
      </div>
      <div class="wallet-box">
        <div class="wallet-label">💎 Carats / Coin</div>
        <div class="wallet-val" id="ui-wallet">0</div>
      </div>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <div class="nav-tabs">
    <button class="nav-btn active" id="tab-bot" onclick="switchMainMode('bot')">🤖 Lawan Bot</button>
    <button class="nav-btn" id="tab-mp" onclick="switchMainMode('mp')">👥 Multiplayer Room</button>
  </div>

  <!-- Game Selector Pills (Only for Single Player / Bot Mode) -->
  <div class="game-pills" id="game-pills-bar">
    <button class="pill-btn active" id="pill-slot" onclick="selectGame('slot')">🎰 Royal Slots</button>
    <button class="pill-btn" id="pill-roulette" onclick="selectGame('roulette')">🎡 European Roulette</button>
    <button class="pill-btn" id="pill-dice" onclick="selectGame('dice')">🎲 Dice Duel</button>
    <button class="pill-btn" id="pill-bj" onclick="selectGame('bj')">🃏 VIP Blackjack 21</button>
  </div>

  <!-- Multiplayer Room Setup View (Dedicated View - Replaces Stage) -->
  <div id="view-mp-setup" style="display:none;">
    <div class="room-card">
      <div style="font-size:13px;font-weight:900;color:#ffd700;margin-bottom:8px;text-align:center">🏛️ PILIH VENUE & BUAT ROOM MULTIPLAYER</div>
      
      <div style="font-size:10px;font-weight:700;color:#86efac;margin-bottom:4px">1. Pilih Game Meja:</div>
      <div class="venue-grid">
        <div class="venue-btn selected" id="v-slot" onclick="setMpVenue('slot')">🎰 Royal Slots</div>
        <div class="venue-btn" id="v-roulette" onclick="setMpVenue('roulette')">🎡 Roulette Table</div>
        <div class="venue-btn" id="v-dice" onclick="setMpVenue('dice')">🎲 Dice Duel</div>
        <div class="venue-btn" id="v-bj" onclick="setMpVenue('bj')">🃏 VIP Blackjack</div>
      </div>

      <div style="font-size:10px;font-weight:700;color:#86efac;margin-top:6px;margin-bottom:4px">2. Identitas Room:</div>
      <input type="text" id="host-name" class="input-field" placeholder="Nama Kamu" value="${safeName}">
      <input type="text" id="room-name" class="input-field" placeholder="Nama Room" value="VIP Lounge">
      <button class="btn-gold" style="width:100%" onclick="handleCreateRoom()">✨ Buat Room (Kode 4-Digit)</button>
      
      <div style="border-top:1px dashed #24573b;margin:12px 0"></div>
      
      <div style="font-size:12px;font-weight:900;color:#93c5fd;margin-bottom:6px;text-align:center">🔑 GABUNG KE ROOM TEMAN</div>
      <input type="text" id="join-name" class="input-field" placeholder="Nama Kamu" value="Player 2">
      <input type="text" id="join-code" class="input-field" placeholder="Masukkan 4-Digit Kode (contoh: 7482)" maxlength="4" style="text-align:center;font-size:18px;letter-spacing:4px">
      <button class="btn-dark" style="width:100%" onclick="handleJoinRoom()">🚪 Masuk ke Room</button>
    </div>
  </div>

  <!-- Active Multiplayer Lobby Header -->
  <div id="view-mp-active" style="display:none;" class="room-card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:13px;font-weight:900;color:#ffd700" id="mp-room-title">Room: VIP Lounge</div>
      <button class="btn-dark" style="padding:4px 8px;font-size:10px" onclick="leaveRoom()">Keluar</button>
    </div>
    <div class="room-code-display">
      <div class="code-hint">BERIKAN KODE 4-DIGIT INI KE TEMAN:</div>
      <div class="code-digits" id="mp-room-code">----</div>
      <button class="btn-gold" style="padding:6px 12px;font-size:10px;margin:0 auto" onclick="copyRoomCode()">📋 Salin Kode Room</button>
    </div>
    <div style="font-size:11px;font-weight:800;color:#86efac;margin-top:6px">Pemain di Room:</div>
    <div class="player-list" id="mp-player-list"></div>
    <button class="btn-gold" style="width:100%;margin-top:8px" onclick="startMpGameSession()">🎲 Mulai Meja Casino Multiplayer</button>
  </div>

  <!-- Casino Stage (Single Player Game Stage) -->
  <div class="casino-stage" id="casino-stage">
    <!-- GAME 1: ROYAL SLOTS (5 REELS, 3 ROWS, ALL-WAYS SCATTER JACKPOT) -->
    <div id="game-slot">
      <div class="slot-cabinet">
        <div class="slot-header-bar">
          <span>👑 ROYAL VEGAS 5-REEL</span>
          <span id="slot-luck-text" style="color:#fde047">🔥 RTP 99.8% • SCATTER ALL-WAYS</span>
        </div>
        <div class="slot-reels-box" id="slot-box">
          <div class="slot-payline"></div>
        </div>
      </div>
    </div>

    <!-- GAME 2: EUROPEAN ROULETTE WITH VISIBLE NUMBERS & MOVING BALL -->
    <div id="game-roulette" style="display:none;">
      <div style="text-align:center;font-size:11px;font-weight:800;color:#fde047;margin-bottom:4px">🎡 EUROPEAN ROULETTE (37 SLOTS)</div>
      <div class="roulette-wrapper">
        <div class="roulette-track">
          <div class="roulette-indicator"></div>
          <svg class="roulette-wheel-svg" id="roulette-wheel-svg" viewBox="0 0 200 200"></svg>
          <div class="roulette-ball-orbit" id="roulette-ball-orbit">
            <div class="roulette-ball" id="roulette-ball"></div>
          </div>
          <div class="roulette-center-hub">
            <div class="roulette-hub-num" id="roulette-hub-num">0</div>
            <div class="roulette-hub-col" id="roulette-hub-col">HIJAU</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0">
        <button class="btn-dark" style="background:#991b1b;color:#fff;border-color:#ef4444" id="btn-r-red" onclick="setRouletteChoice('red')">MERAH (x2)</button>
        <button class="btn-dark" style="background:#166534;color:#fff;border-color:#22c55e" id="btn-r-green" onclick="setRouletteChoice('green')">HIJAU 0 (x14)</button>
        <button class="btn-dark" style="background:#090d16;color:#fff;border-color:#475569" id="btn-r-black" onclick="setRouletteChoice('black')">HITAM (x2)</button>
      </div>
    </div>

    <!-- GAME 3: DICE DUEL -->
    <div id="game-dice" style="display:none;">
      <div style="text-align:center;font-size:12px;font-weight:800;color:#c9ad6a">🎲 HIGH-STAKES DICE DUEL</div>
      <div class="dice-arena">
        <div class="dice-board">
          <div class="dice-cube" id="dice-1">
            <div class="dice-face f1"><div class="pip red" style="grid-area:2/2"></div></div>
            <div class="dice-face f2"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:3/3"></div></div>
            <div class="dice-face f3"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:2/2"></div><div class="pip" style="grid-area:3/3"></div></div>
            <div class="dice-face f4"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:1/3"></div><div class="pip" style="grid-area:3/1"></div><div class="pip" style="grid-area:3/3"></div></div>
            <div class="dice-face f5"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:1/3"></div><div class="pip" style="grid-area:2/2"></div><div class="pip" style="grid-area:3/1"></div><div class="pip" style="grid-area:3/3"></div></div>
            <div class="dice-face f6"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:1/3"></div><div class="pip" style="grid-area:2/1"></div><div class="pip" style="grid-area:2/3"></div><div class="pip" style="grid-area:3/1"></div><div class="pip" style="grid-area:3/3"></div></div>
          </div>
          <div class="dice-cube" id="dice-2">
            <div class="dice-face f1"><div class="pip red" style="grid-area:2/2"></div></div>
            <div class="dice-face f2"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:3/3"></div></div>
            <div class="dice-face f3"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:2/2"></div><div class="pip" style="grid-area:3/3"></div></div>
            <div class="dice-face f4"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:1/3"></div><div class="pip" style="grid-area:3/1"></div><div class="pip" style="grid-area:3/3"></div></div>
            <div class="dice-face f5"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:1/3"></div><div class="pip" style="grid-area:2/2"></div><div class="pip" style="grid-area:3/1"></div><div class="pip" style="grid-area:3/3"></div></div>
            <div class="dice-face f6"><div class="pip" style="grid-area:1/1"></div><div class="pip" style="grid-area:1/3"></div><div class="pip" style="grid-area:2/1"></div><div class="pip" style="grid-area:2/3"></div><div class="pip" style="grid-area:3/1"></div><div class="pip" style="grid-area:3/3"></div></div>
          </div>
        </div>
        <div style="font-size:12px;font-weight:900;color:#ffd700" id="dice-result-text">PILIH PREDIKSI DADU</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0">
        <button class="btn-dark" id="btn-bet-low" onclick="setDiceChoice('low')">KECIL (2-6)<br><small style="color:#ffd700">x2.0</small></button>
        <button class="btn-dark" id="btn-bet-seven" onclick="setDiceChoice('seven')">ANGKA 7<br><small style="color:#ffd700">x5.0</small></button>
        <button class="btn-dark" id="btn-bet-high" onclick="setDiceChoice('high')">BESAR (8-12)<br><small style="color:#ffd700">x2.0</small></button>
      </div>
    </div>

    <!-- GAME 4: VIP BLACKJACK 21 -->
    <div id="game-bj" style="display:none;">
      <div style="text-align:center;font-size:12px;font-weight:800;color:#c9ad6a;margin-bottom:6px">🃏 VIP BLACKJACK 21</div>
      <div class="bj-table">
        <div>
          <div class="bj-hand-title">
            <span>DEALER (BOT)</span>
            <span id="bj-dealer-score" style="color:#ffd700">0</span>
          </div>
          <div class="bj-cards" id="bj-dealer-cards"></div>
        </div>
        <div style="border-top:1px dashed #244d3a;padding-top:6px">
          <div class="bj-hand-title">
            <span>TANGAN KAMU</span>
            <span id="bj-player-score" style="color:#ffd700">0</span>
          </div>
          <div class="bj-cards" id="bj-player-cards"></div>
        </div>
      </div>
    </div>

    <!-- VIP Luck Boost Indicator -->
    <div class="vip-luck-banner" id="vip-luck-banner">
      <span>✨ PASANG TARUHAN 100 - 10K • SCATTER ALL-WAYS &amp; ROULETTE REAL TRACK!</span>
    </div>

    <!-- Bet Chip Selector (Including 10K Gacor Chip) -->
    <div class="bet-chips">
      <div class="chip c100 selected" onclick="setBet(100)">100</div>
      <div class="chip c500" onclick="setBet(500)">500</div>
      <div class="chip c1000" onclick="setBet(1000)">1K</div>
      <div class="chip c5000" onclick="setBet(5000)">5K</div>
      <div class="chip c10000" onclick="setBet(10000)">10K</div>
    </div>

    <div class="msg-banner" id="game-msg">SIAP MEMASANG TARUHAN</div>

    <!-- Action Controls -->
    <div class="action-grid" id="main-controls">
      <button class="btn-dark" id="btn-sound" onclick="toggleAudio()">🔊 Sound</button>
      <button class="btn-gold" id="btn-play" onclick="handlePlayAction()">🎲 LEMPAR / SPIN</button>
    </div>

    <!-- Blackjack Specific Controls -->
    <div class="action-grid" id="bj-controls" style="display:none;">
      <button class="btn-dark" onclick="bjHit()">➕ HIT</button>
      <button class="btn-gold" onclick="bjStand()">✋ STAND</button>
    </div>
  </div>

  <!-- Cashout & Claim Code Generation Box -->
  <div class="claim-box">
    <div style="font-size:12px;font-weight:900;color:#6ee7b7">🎁 KLAIM KOIN KE AKUN WHATSAPP</div>
    <div style="font-size:10px;color:#a7f3d0;margin-top:2px">Selesai bermain? Kode klaim akan langsung otomatis disalin ke clipboard:</div>
    <button class="btn-gold" style="width:100%;margin-top:8px" onclick="generateClaimCode()">💰 Cash Out &amp; Salin Kode Klaim</button>
    <div id="claim-result-box" style="display:none;margin-top:8px">
      <div class="toast-notice" id="claim-toast-notice">✅ KODE LANGSUNG DISALIN KE CLIPBOARD!</div>
      <div class="claim-code-text" id="claim-code-val">CASINO-XXXX</div>
      <button class="btn-dark" style="width:100%;padding:6px;font-size:11px" onclick="copyClaimCodeAgain()">📋 Salin Ulang Kode</button>
      <div style="font-size:9px;color:#d1fae5;margin-top:4px">Ketik di chat WhatsApp: <b>.claimr &lt;kode&gt;</b></div>
    </div>
  </div>
</div>

<script>
(function(){
  // --- Audio Synthesizer Core ---
  var AC=null,MUTED=false;
  function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return null}}if(AC.state==='suspended'){try{AC.resume()}catch(e){}}return AC}
  function tone(f,d,t,v,at,sl){var a=ac();if(!a||MUTED)return;try{var n=a.currentTime+(at||0),o=a.createOscillator(),g=a.createGain();o.type=t||'sine';o.frequency.setValueAtTime(f,n);if(sl)o.frequency.exponentialRampToValueAtTime(sl,n+d);g.gain.setValueAtTime(v||0.1,n);g.gain.exponentialRampToValueAtTime(0.0001,n+d);o.connect(g);g.connect(a.destination);o.start(n);o.stop(n+d+0.02)}catch(e){}}
  function noise(d,v,at,fc){var a=ac();if(!a||MUTED)return;try{var n=a.currentTime+(at||0),len=Math.floor(a.sampleRate*d),b=a.createBuffer(1,len,a.sampleRate),c=b.getChannelData(0);for(var i=0;i<len;i++)c[i]=Math.random()*2-1;var s=a.createBufferSource(),g=a.createGain(),f=a.createBiquadFilter();s.buffer=b;f.type='lowpass';f.frequency.value=fc||1200;g.gain.setValueAtTime(v,n);g.gain.exponentialRampToValueAtTime(0.0001,n+d);s.connect(f);f.connect(g);g.connect(a.destination);s.start(n);s.stop(n+d+0.02)}catch(e){}}
  
  function sChip(){tone(800,0.04,'triangle',0.08);tone(1200,0.06,'sine',0.06,0.02)}
  function sRoll(){noise(0.25,0.15,0,800);tone(140,0.3,'sawtooth',0.08,0,320)}
  function sWin(){[523,659,784,1046].forEach(function(f,i){tone(f,0.12,'triangle',0.1,i*0.08)})}
  function sJackpot(){[523,659,784,1046,784,1046,1318,1568].forEach(function(f,i){tone(f,0.15,'square',0.12,i*0.09)})}
  function sLose(){tone(220,0.2,'sawtooth',0.08);tone(150,0.3,'sawtooth',0.08,0.12)}
  function sCard(){noise(0.08,0.12,0,2400);tone(600,0.04,'sine',0.05)}

  window.toggleAudio = function(){
    MUTED = !MUTED;
    var btn = document.getElementById('btn-sound');
    if(btn) btn.textContent = MUTED ? '🔇 Muted' : '🔊 Sound';
    if(!MUTED) sChip();
  };

  // Global State
  var wallet = ${safeWallet};
  var currentBet = 100;
  var currentGame = 'slot';
  var mainMode = 'bot';
  var diceChoice = 'seven';
  var rouletteChoice = 'red';
  var isPlaying = false;
  var currentClaimCode = '';
  
  var currentRoom = null;
  var myPlayerName = '${safeName}';

  // Read query & storage
  try {
    var rawUrl = window.location.search;
    var params = new URLSearchParams(rawUrl);
    if (params.get('balance')) wallet = parseInt(params.get('balance'), 10) || wallet;
    if (params.get('name')) myPlayerName = params.get('name');
    var savedWallet = localStorage.getItem('oguri_casino_wallet');
    if (savedWallet) wallet = Math.max(wallet, parseInt(savedWallet, 10));
  } catch(e){}

  function saveWallet(){
    try{localStorage.setItem('oguri_casino_wallet', String(wallet))}catch(e){}
    var el = document.getElementById('ui-wallet');
    if(el) el.textContent = wallet.toLocaleString('id-ID');
  }
  saveWallet();

  var mpVenue = 'slot';
  window.setMpVenue = function(v){
    sChip();
    mpVenue = v;
    ['slot','roulette','dice','bj'].forEach(function(k){
      var btn = document.getElementById('v-'+k);
      if(btn) btn.className = k === v ? 'venue-btn selected' : 'venue-btn';
    });
  };

  // Mode Switcher
  window.switchMainMode = function(mode){
    sChip();
    mainMode = mode;
    document.getElementById('tab-bot').className = mode === 'bot' ? 'nav-btn active' : 'nav-btn';
    document.getElementById('tab-mp').className = mode === 'mp' ? 'nav-btn active' : 'nav-btn';
    
    var gamePills = document.getElementById('game-pills-bar');
    var stage = document.getElementById('casino-stage');
    var mpSetup = document.getElementById('view-mp-setup');
    var mpActive = document.getElementById('view-mp-active');

    if(mode === 'mp'){
      if(gamePills) gamePills.style.display = 'none';
      if(stage) stage.style.display = 'none';
      if(!currentRoom){
        if(mpSetup) mpSetup.style.display = 'block';
        if(mpActive) mpActive.style.display = 'none';
      } else {
        if(mpSetup) mpSetup.style.display = 'none';
        if(mpActive) mpActive.style.display = 'block';
      }
      setMsg('🏛️ MULTIPLAYER: PILIH VENUE & BUAT / GABUNG ROOM');
    } else {
      if(gamePills) gamePills.style.display = 'flex';
      if(stage) stage.style.display = 'block';
      if(mpSetup) mpSetup.style.display = 'none';
      if(mpActive) mpActive.style.display = 'none';
      setMsg('MODE: ' + currentGame.toUpperCase() + ' - PASANG TARUHAN');
    }
  };

  window.startMpGameSession = function(){
    if(!currentRoom) return;
    sChip();
    selectGame(mpVenue || 'slot');
    mainMode = 'bot';
    document.getElementById('tab-bot').className = 'nav-btn active';
    document.getElementById('tab-mp').className = 'nav-btn';
    var gamePills = document.getElementById('game-pills-bar');
    var stage = document.getElementById('casino-stage');
    var mpSetup = document.getElementById('view-mp-setup');
    var mpActive = document.getElementById('view-mp-active');
    if(gamePills) gamePills.style.display = 'flex';
    if(stage) stage.style.display = 'block';
    if(mpSetup) mpSetup.style.display = 'none';
    if(mpActive) mpActive.style.display = 'none';
    setMsg('🎲 MEJA MULTIPLAYER AKTIF (' + (currentRoom.name || 'VIP') + ') - PASANG TARUHAN');
  };

  // Game Selector
  window.selectGame = function(g){
    sChip();
    currentGame = g;
    ['slot','roulette','dice','bj'].forEach(function(k){
      var p = document.getElementById('pill-'+k);
      var view = document.getElementById('game-'+k);
      if(p) p.className = k === g ? 'pill-btn active' : 'pill-btn';
      if(view) view.style.display = k === g ? 'block' : 'none';
    });
    document.getElementById('main-controls').style.display = g === 'bj' && isPlaying ? 'none' : 'grid';
    document.getElementById('bj-controls').style.display = g === 'bj' && isPlaying ? 'grid' : 'none';
    setMsg('MODE: ' + g.toUpperCase() + ' - PASANG TARUHAN');
  };

  window.setBet = function(amount){
    sChip();
    currentBet = amount;
    var chips = document.querySelectorAll('.chip');
    chips.forEach(function(c){
      c.classList.remove('selected');
      var val = parseInt(c.textContent.replace('K','000'), 10);
      if(amount === 1000 && c.textContent === '1K') val = 1000;
      if(amount === 5000 && c.textContent === '5K') val = 5000;
      if(amount === 10000 && c.textContent === '10K') val = 10000;
      if(val === amount){
        c.classList.add('selected');
      }
    });

    // Dynamic Luck Indicator
    var luckBanner = document.getElementById('vip-luck-banner');
    if(amount >= 10000){
      luckBanner.innerHTML = '💎 <b style="color:#ffd700">HIGH ROLLER 10K (Scatter All-Ways &amp; Potensi Jackpot)</b>';
    } else if(amount >= 5000){
      luckBanner.innerHTML = '✨ <b style="color:#ffd700">VIP TABLE 5K (Peluang Scatter All-Ways)</b>';
    } else if(amount >= 1000){
      luckBanner.innerHTML = '✨ <b style="color:#fde047">CLUB 1K (Multi-Reel Dynamic Play)</b>';
    } else {
      luckBanner.innerHTML = '✨ PASANG TARUHAN 100 - 10K • SCATTER ALL-WAYS &amp; ROULETTE REAL TRACK!';
    }
  };

  function setMsg(t){
    var el = document.getElementById('game-msg');
    if(el) el.textContent = t;
  }

  // --- ROYAL SLOTS (5 REELS, 3 ROWS, ALL-WAYS SCATTER JACKPOT) ---
  var slotSymList = [
    { id: 'cherry', html: '🍒', name: 'Cherry', baseVal: 1 },
    { id: 'grape', html: '🍇', name: 'Grape', baseVal: 1.5 },
    { id: 'bell', html: '🔔', name: 'Bell', baseVal: 2 },
    { id: 'diamond', html: '💎', name: 'Diamond', baseVal: 3 },
    { id: 'bar', html: '<span class="slot-bar-special">BAR</span>', name: 'Bar', baseVal: 4 },
    { id: 'bar3', html: '<span class="slot-bar-triple">3X BAR</span>', name: '3X Bar', baseVal: 6 },
    { id: 'seven', html: '<span class="slot-s7">7</span>', name: 'Lucky 7', baseVal: 10 }
  ];

  var reelCount = 5;
  var visibleRows = 3;
  var rowHeight = 60;
  var spinSteps = 16; // Fixed number of scroll items per spin
  var totalCellsPerReel = spinSteps + visibleRows; // 19 items

  // Store current visible 3 symbols per reel (5 reels x 3 rows)
  var currentGrid = [
    ['seven', 'cherry', 'bell'],
    ['bar3', 'seven', 'grape'],
    ['diamond', 'bar', 'seven'],
    ['bell', 'seven', 'bar3'],
    ['seven', 'diamond', 'cherry']
  ];

  var reelDomElements = [];

  function getSymObject(id){
    return slotSymList.find(function(s){ return s.id === id; }) || slotSymList[0];
  }

  function initSlotCabinet(){
    var box = document.getElementById('slot-box');
    box.innerHTML = '<div class="slot-payline"></div>';
    reelDomElements = [];

    for(var c = 0; c < reelCount; c++){
      var reel = document.createElement('div');
      reel.className = 'slot-reel';
      reel.id = 'slot-reel-' + c;

      var strip = document.createElement('div');
      strip.className = 'slot-strip';
      strip.id = 'slot-strip-' + c;

      // Populate initial 3 visible symbols
      var h = '';
      for(var r = 0; r < visibleRows; r++){
        var sObj = getSymObject(currentGrid[c][r]);
        h += '<div class="slot-sym" data-id="'+sObj.id+'">'+sObj.html+'</div>';
      }
      strip.innerHTML = h;
      reel.appendChild(strip);
      box.appendChild(reel);

      reelDomElements.push({ reel: reel, strip: strip });
    }
  }
  initSlotCabinet();

  function playSlot(){
    if(wallet < currentBet){ setMsg('❌ KOIN TIDAK CUKUP!'); sLose(); return; }
    wallet -= currentBet;
    saveWallet();
    isPlaying = true;
    sRoll();
    setMsg('🎰 SPINNING 5-REEL ROYAL SLOTS...');

    // Clear previous win glows
    document.querySelectorAll('.slot-sym').forEach(function(el){
      el.classList.remove('win-glow');
    });

    // DETERMINE TARGET GRID (5 Reels x 3 Rows = 15 Total Symbols on screen)
    // Balanced realistic casino RTP (~42% win frequency, varied payout tiers, natural misses)
    var is10K = currentBet >= 10000;
    var is5K = currentBet >= 5000;
    var is1K = currentBet >= 1000;

    // Real casino hit rate: 45% (10k), 42% (5k), 38% (1k), 35% (regular)
    var winChance = is10K ? 0.45 : is5K ? 0.42 : is1K ? 0.38 : 0.35;
    var willWin = Math.random() < winChance;

    var targetGrid = [[], [], [], [], []];

    if(willWin){
      // Decide tier of win (mostly small/medium wins, jackpot is genuinely rare & rewarding!)
      var r = Math.random();
      var targetSym = 'cherry';
      var scatterCount = 3;

      if(r < 0.01){
        // Ultra Rare Mega Jackpot: 5x Seven (1% of winning spins)
        targetSym = 'seven';
        scatterCount = 5;
      } else if(r < 0.03){
        // Rare Big Jackpot: 5x Bar3 or 4x Seven (2% of winning spins)
        targetSym = (Math.random() < 0.5 ? 'seven' : 'bar3');
        scatterCount = (targetSym === 'seven') ? 4 : 5;
      } else if(r < 0.08){
        // Great Win: 5x Diamond or 4x Bar3
        targetSym = (Math.random() < 0.5 ? 'bar3' : 'diamond');
        scatterCount = (targetSym === 'bar3') ? 4 : 5;
      } else if(r < 0.20){
        // Medium Win: 3x Seven, 4x Diamond, or 5x Bell
        targetSym = (Math.random() < 0.4 ? 'diamond' : Math.random() < 0.7 ? 'bell' : 'seven');
        scatterCount = (targetSym === 'seven') ? 3 : (targetSym === 'diamond') ? 4 : 5;
      } else if(r < 0.45){
        // Minor Win: 3x Bar/Diamond or 4x Bell/Grape
        targetSym = (Math.random() < 0.5 ? 'bar' : 'bell');
        scatterCount = (Math.random() < 0.6 ? 3 : 4);
      } else {
        // Small Common Return: 2x-3x Cherry/Grape/Bell
        targetSym = (Math.random() < 0.5 ? 'cherry' : 'grape');
        scatterCount = (Math.random() < 0.4 ? 2 : 3);
      }

      // Place targetSym randomly across the 15 cells (any row, any column)
      var positions = [];
      for(var c = 0; c < 5; c++){
        for(var row = 0; row < 3; row++){
          positions.push({ c: c, row: row });
        }
      }
      // Shuffle positions
      positions.sort(function(){ return Math.random() - 0.5; });

      var winningCells = positions.slice(0, scatterCount);

      // Fill grid
      for(var c = 0; c < 5; c++){
        for(var row = 0; row < 3; row++){
          var isWinSpot = winningCells.some(function(p){ return p.c === c && p.row === row; });
          if(isWinSpot){
            targetGrid[c][row] = targetSym;
          } else {
            // Pick random other symbol from non-matching pool
            var filtered = slotSymList.filter(function(s){ return s.id !== targetSym; });
            targetGrid[c][row] = filtered[Math.floor(Math.random() * filtered.length)].id;
          }
        }
      }
    } else {
      // Natural random mix (guarantees loss without triggering unintended 3x+ scatters)
      var pool = ['cherry', 'grape', 'bell', 'diamond', 'bar', 'bar3', 'seven'];
      for(var c = 0; c < 5; c++){
        for(var row = 0; row < 3; row++){
          targetGrid[c][row] = pool[(c * 3 + row) % pool.length];
        }
      }
      // Lightly randomize grid while keeping duplicate counts <= 2
      for(var c = 0; c < 5; c++){
        for(var row = 0; row < 3; row++){
          if(Math.random() < 0.5){
            var randSym = pool[Math.floor(Math.random() * pool.length)];
            // Count occurrences of randSym
            var curCount = 0;
            for(var tc = 0; tc < 5; tc++){
              for(var tr = 0; tr < 3; tr++){
                if(targetGrid[tc] && targetGrid[tc][tr] === randSym) curCount++;
              }
            }
            if(curCount < 2){
              targetGrid[c][row] = randSym;
            }
          }
        }
      }
    }

    // ANIMATE 5 REELS SMOOTHLY
    var stopDistance = spinSteps * rowHeight; // e.g. 16 * 60 = 960px

    reelDomElements.forEach(function(item, cIdx){
      var strip = item.strip;

      // Build strip content:
      // Index 0..2: previous symbols
      // Index 3..15: random spinning symbols
      // Index 16..18: targetGrid[cIdx][0..2]
      var html = '';
      for(var r = 0; r < visibleRows; r++){
        var sObj = getSymObject(currentGrid[cIdx][r]);
        html += '<div class="slot-sym" data-id="'+sObj.id+'">'+sObj.html+'</div>';
      }
      for(var i = 0; i < spinSteps - visibleRows; i++){
        var randObj = slotSymList[Math.floor(Math.random() * slotSymList.length)];
        html += '<div class="slot-sym" data-id="'+randObj.id+'">'+randObj.html+'</div>';
      }
      for(var r = 0; r < visibleRows; r++){
        var targetObj = getSymObject(targetGrid[cIdx][r]);
        html += '<div class="slot-sym target-sym" data-id="'+targetObj.id+'" data-reel="'+cIdx+'" data-row="'+r+'">'+targetObj.html+'</div>';
      }

      strip.innerHTML = html;
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0px)';

      // Force reflow
      void strip.offsetHeight;

      // Animate downward
      var reelDuration = 1.3 + (cIdx * 0.25); // staggered 1.3s to 2.3s
      strip.style.transition = 'transform ' + reelDuration + 's cubic-bezier(0.12, 0.85, 0.2, 1)';
      strip.style.transform = 'translateY(-' + stopDistance + 'px)';
    });

    // EVALUATE AFTER LAST REEL COMPLETES
    setTimeout(function(){
      // Update currentGrid to targetGrid
      currentGrid = targetGrid;

      // Count ALL symbols across all 15 positions (Scatter Any-Position System)
      var scatterCounts = {};
      for(var c = 0; c < 5; c++){
        for(var row = 0; row < 3; row++){
          var sId = targetGrid[c][row];
          scatterCounts[sId] = (scatterCounts[sId] || 0) + 1;
        }
      }

      // Check for scatter jackpot & prizes
      var totalMultiplier = 0;
      var winningSummary = [];
      var highestWinSym = null;

      // Payout Table for Any-Position Scatter
      var payoutRules = {
        'seven': { 5: 50, 4: 25, 3: 8, name: 'LUCKY 777' },
        'bar3': { 5: 35, 4: 18, 3: 6, name: '3X BAR' },
        'bar': { 5: 25, 4: 12, 3: 4, name: 'GOLDEN BAR' },
        'diamond': { 5: 20, 4: 10, 3: 3.5, name: 'DIAMOND' },
        'bell': { 5: 15, 4: 6, 3: 2.5, name: 'BELL' },
        'grape': { 5: 10, 4: 4, 3: 2.0, name: 'GRAPE' },
        'cherry': { 5: 8, 4: 3, 3: 1.5, 2: 1.0, name: 'CHERRY' }
      };

      for(var symId in scatterCounts){
        var count = scatterCounts[symId];
        var rule = payoutRules[symId];
        if(!rule) continue;

        var mult = 0;
        if(count >= 5) mult = rule[5] || 0;
        else if(count === 4) mult = rule[4] || 0;
        else if(count === 3) mult = rule[3] || 0;
        else if(count === 2 && rule[2]) mult = rule[2] || 0;

        if(mult > 0){
          totalMultiplier += mult;
          winningSummary.push(count + 'x ' + rule.name + ' (x' + mult + ')');
          if(!highestWinSym || mult > (payoutRules[highestWinSym]?.[scatterCounts[highestWinSym]] || 0)){
            highestWinSym = symId;
          }
        }
      }

      // Check middle payline consecutive match for extra bonus
      var midMatches = 1;
      var midFirst = targetGrid[0][1];
      for(var c = 1; c < 5; c++){
        if(targetGrid[c][1] === midFirst) midMatches++;
        else break;
      }
      if(midMatches >= 4){
        var lineBonus = (midMatches === 5 ? 10 : 4);
        totalMultiplier += lineBonus;
        winningSummary.push('LINE BONUS (+x' + lineBonus + ')');
      }

      // Highlight winning symbols on screen
      if(highestWinSym){
        document.querySelectorAll('.slot-sym.target-sym').forEach(function(el){
          if(el.getAttribute('data-id') === highestWinSym){
            el.classList.add('win-glow');
          }
        });
      }

      if(totalMultiplier > 0){
        var prize = Math.floor(currentBet * totalMultiplier);
        wallet += prize;
        if(totalMultiplier >= 25){
          setMsg('👑 MEGA ROYAL JACKPOT! +' + prize.toLocaleString('id-ID') + ' CARATS! (' + winningSummary.join(', ') + ')');
          sJackpot();
        } else if(totalMultiplier >= 5){
          setMsg('🔥 BIG WIN! +' + prize.toLocaleString('id-ID') + ' CARATS! (' + winningSummary.join(', ') + ')');
          sJackpot();
        } else {
          setMsg('🎉 MENANG +' + prize.toLocaleString('id-ID') + ' CARATS! (' + winningSummary.join(', ') + ')');
          sWin();
        }
      } else {
        setMsg('💦 BELUM BERUNTUNG! COBA LAGI');
        sLose();
      }

      saveWallet();
      isPlaying = false;
    }, 2600);
  }

  // --- EUROPEAN ROULETTE (37 SLOTS WITH ACCURATE WHEEL PHYSICS & INDICATOR) ---
  // Official European Roulette sequence clockwise:
  var rouletteOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

  var wheelRotation = 0;

  function renderRouletteWheelSVG(){
    var svg = document.getElementById('roulette-wheel-svg');
    if(!svg) return;
    var totalSlots = rouletteOrder.length; // 37
    var angleStep = 360 / totalSlots;
    var cx = 100, cy = 100, rOuter = 96, rInner = 52;
    var h = '';

    for(var i=0; i<totalSlots; i++){
      var num = rouletteOrder[i];
      var isGreen = num === 0;
      var isRed = redNumbers.includes(num);
      var color = isGreen ? '#15803d' : (isRed ? '#dc2626' : '#0f172a');
      var strokeCol = '#d4af37';

      // Wedge i centered at i * angleStep, spanning from (i - 0.5) to (i + 0.5)
      // Standard SVG angles: -90deg is top (12 o'clock)
      var startDeg = (i - 0.5) * angleStep - 90;
      var endDeg = (i + 0.5) * angleStep - 90;
      var centerDeg = i * angleStep - 90;

      var a1 = startDeg * Math.PI / 180;
      var a2 = endDeg * Math.PI / 180;
      var midA = centerDeg * Math.PI / 180;

      var x1 = cx + rOuter * Math.cos(a1);
      var y1 = cy + rOuter * Math.sin(a1);
      var x2 = cx + rOuter * Math.cos(a2);
      var y2 = cy + rOuter * Math.sin(a2);
      var x3 = cx + rInner * Math.cos(a2);
      var y3 = cy + rInner * Math.sin(a2);
      var x4 = cx + rInner * Math.cos(a1);
      var y4 = cy + rInner * Math.sin(a1);

      var pathData = 'M '+x1+' '+y1+' A '+rOuter+' '+rOuter+' 0 0 1 '+x2+' '+y2+' L '+x3+' '+y3+' A '+rInner+' '+rInner+' 0 0 0 '+x4+' '+y4+' Z';
      h += '<path d="'+pathData+'" fill="'+color+'" stroke="'+strokeCol+'" stroke-width="0.75"/>';

      var textR = 76;
      var tx = cx + textR * Math.cos(midA);
      var ty = cy + textR * Math.sin(midA);
      var rotDeg = i * angleStep;
      h += '<text x="'+tx+'" y="'+ty+'" fill="#ffffff" font-size="7.5" font-weight="900" text-anchor="middle" dominant-baseline="central" transform="rotate('+(rotDeg)+','+tx+','+ty+')">'+num+'</text>';
    }

    svg.innerHTML = h;
  }
  renderRouletteWheelSVG();

  window.setRouletteChoice = function(c){
    sChip();
    rouletteChoice = c;
    ['red','green','black'].forEach(function(k){
      var b = document.getElementById('btn-r-'+k);
      if(b) b.style.outline = (k === c) ? '3px solid #ffd700' : 'none';
    });
    setMsg('TARUHAN ROULETTE: ' + (c==='red'?'MERAH (x2)':c==='black'?'HITAM (x2)':'HIJAU 0 (x14)'));
  };

  function playRoulette(){
    if(wallet < currentBet){ setMsg('❌ KOIN TIDAK CUKUP!'); sLose(); return; }
    wallet -= currentBet;
    saveWallet();
    isPlaying = true;
    sRoll();
    setMsg('🎡 RODA ROULETTE BERPUTAR...');

    var svgWheel = document.getElementById('roulette-wheel-svg');
    var ballOrbit = document.getElementById('roulette-ball-orbit');
    var ball = document.getElementById('roulette-ball');

    var totalSlots = 37;
    var slotAngle = 360 / totalSlots;

    // Pick genuine winning slot
    var winningIndex = Math.floor(Math.random() * rouletteOrder.length);
    var winningNum = rouletteOrder[winningIndex];

    // Top indicator is at 12 o'clock (0 deg).
    // In SVG, wedge i is at angle: i * slotAngle.
    // When wheel rotates by R deg clockwise, the slot at the top indicator satisfies:
    // (i * slotAngle + R) mod 360 = 0
    // => R mod 360 = (360 - (winningIndex * slotAngle) % 360) % 360
    var baseDesiredRemainder = (360 - (winningIndex * slotAngle) % 360) % 360;
    var curRemainder = ((wheelRotation % 360) + 360) % 360;
    var diff = baseDesiredRemainder - curRemainder;
    if(diff < 0) diff += 360;

    // Add 4-6 full spins for realistic dramatic motion
    var extraSpins = (4 + Math.floor(Math.random() * 3)) * 360;
    wheelRotation += extraSpins + diff;

    svgWheel.style.transition = 'transform 4.5s cubic-bezier(0.12, 0.85, 0.22, 1)';
    svgWheel.style.transform = 'rotate(' + wheelRotation + 'deg)';

    // Ball orbits at the top and settles cleanly into the track indicator
    ballOrbit.style.transition = 'transform 4.5s cubic-bezier(0.1, 0.88, 0.2, 1)';
    ballOrbit.style.transform = 'rotate(' + (-(extraSpins + diff)) + 'deg)';

    ball.style.transform = 'translateX(-50%) scale(1.1)';
    setTimeout(function(){
      ball.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
    }, 3400);

    setTimeout(function(){
      var isGreen = winningNum === 0;
      var isRed = redNumbers.includes(winningNum);
      var colorName = isGreen ? 'HIJAU' : (isRed ? 'MERAH' : 'HITAM');

      document.getElementById('roulette-hub-num').textContent = winningNum;
      document.getElementById('roulette-hub-col').textContent = colorName;
      document.getElementById('roulette-hub-num').style.color = isGreen ? '#16a34a' : (isRed ? '#dc2626' : '#0f172a');

      var won = false;
      var mult = 0;
      if(rouletteChoice === 'red' && isRed){ won = true; mult = 2; }
      else if(rouletteChoice === 'black' && !isRed && !isGreen){ won = true; mult = 2; }
      else if(rouletteChoice === 'green' && isGreen){ won = true; mult = 14; }

      if(won){
        var prize = currentBet * mult;
        wallet += prize;
        setMsg('🎉 MENANG +' + prize.toLocaleString('id-ID') + ' CARATS! (' + winningNum + ' ' + colorName + ')');
        sWin();
      } else {
        setMsg('💦 HASIL: ' + winningNum + ' (' + colorName + ') - TIDAK TEMBUS');
        sLose();
      }

      saveWallet();
      isPlaying = false;
    }, 4600);
  }

  // --- DICE DUEL ---
  var diceRotations = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateY(90deg)',
    3: 'rotateX(-90deg)',
    4: 'rotateX(90deg)',
    5: 'rotateY(-90deg)',
    6: 'rotateY(180deg)'
  };

  window.setDiceChoice = function(c){
    sChip();
    diceChoice = c;
    ['low','seven','high'].forEach(function(k){
      var btn = document.getElementById('btn-bet-'+k);
      if(btn) btn.style.borderColor = k === c ? '#ffd700' : '#3d4f72';
    });
    setMsg('PILIHAN DADU: ' + (c==='low'?'KECIL (2-6)':c==='high'?'BESAR (8-12)':'ANGKA 7'));
  };

  function playDice(){
    if(wallet < currentBet){ setMsg('❌ KOIN TIDAK CUKUP!'); sLose(); return; }
    wallet -= currentBet;
    saveWallet();
    isPlaying = true;
    sRoll();
    setMsg('🎲 MENGOCYOK DADU...');
    
    var d1 = document.getElementById('dice-1');
    var d2 = document.getElementById('dice-2');
    d1.style.transform = 'rotateX('+(720+Math.random()*360)+'deg) rotateY('+(720+Math.random()*360)+'deg)';
    d2.style.transform = 'rotateX('+(720+Math.random()*360)+'deg) rotateY('+(720+Math.random()*360)+'deg)';
    
    setTimeout(function(){
      var v1 = Math.floor(Math.random()*6)+1;
      var v2 = Math.floor(Math.random()*6)+1;
      var total = v1 + v2;
      d1.style.transform = diceRotations[v1];
      d2.style.transform = diceRotations[v2];
      document.getElementById('dice-result-text').textContent = 'HASIL: ' + v1 + ' + ' + v2 + ' = ' + total;
      
      var won = false;
      var multiplier = 0;
      if(diceChoice === 'low' && total <= 6){ won = true; multiplier = 2; }
      else if(diceChoice === 'high' && total >= 8){ won = true; multiplier = 2; }
      else if(diceChoice === 'seven' && total === 7){ won = true; multiplier = 5; }
      
      if(won){
        var prize = currentBet * multiplier;
        wallet += prize;
        setMsg('🎉 MENANG +' + prize.toLocaleString('id-ID') + ' CARATS!');
        sWin();
      } else {
        setMsg('💦 KALAH! COBA LAGI');
        sLose();
      }
      saveWallet();
      isPlaying = false;
    }, 1200);
  }

  // --- BLACKJACK 21 ---
  var bjDeck = [];
  var bjPlayerHand = [];
  var bjDealerHand = [];
  
  function createDeck(){
    var suits = ['♠','♥','♦','♣'];
    var ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    bjDeck = [];
    suits.forEach(function(s){
      ranks.forEach(function(r){
        bjDeck.push({ r: r, s: s, isRed: (s==='♥'||s==='♦') });
      });
    });
    bjDeck.sort(function(){ return Math.random()-0.5 });
  }

  function getCardVal(c){
    if(['J','Q','K'].includes(c.r)) return 10;
    if(c.r === 'A') return 11;
    return parseInt(c.r, 10);
  }

  function calcHand(hand){
    var total = 0;
    var aces = 0;
    hand.forEach(function(c){
      total += getCardVal(c);
      if(c.r === 'A') aces++;
    });
    while(total > 21 && aces > 0){
      total -= 10;
      aces--;
    }
    return total;
  }

  function renderCard(c, isHidden){
    if(isHidden) return '<div class="card-3d hidden">?</div>';
    return '<div class="card-3d '+(c.isRed?'red':'')+'"><div>'+c.r+'</div><div style="font-size:18px">'+c.s+'</div><div style="text-align:right">'+c.r+'</div></div>';
  }

  function renderBJ(hideDealer){
    var dc = document.getElementById('bj-dealer-cards');
    var pc = document.getElementById('bj-player-cards');
    var ds = document.getElementById('bj-dealer-score');
    var ps = document.getElementById('bj-player-score');
    
    var dh = '';
    bjDealerHand.forEach(function(c, i){
      dh += renderCard(c, hideDealer && i===1);
    });
    dc.innerHTML = dh;
    ds.textContent = hideDealer ? '?' : calcHand(bjDealerHand);
    
    var ph = '';
    bjPlayerHand.forEach(function(c){ ph += renderCard(c, false); });
    pc.innerHTML = ph;
    ps.textContent = calcHand(bjPlayerHand);
  }

  function startBlackjack(){
    if(wallet < currentBet){ setMsg('❌ KOIN TIDAK CUKUP!'); sLose(); return; }
    wallet -= currentBet;
    saveWallet();
    isPlaying = true;
    createDeck();
    bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
    bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
    sCard();
    renderBJ(true);
    
    document.getElementById('main-controls').style.display = 'none';
    document.getElementById('bj-controls').style.display = 'grid';
    setMsg('BLACKJACK DIMULAI! HIT ATAU STAND?');
    
    if(calcHand(bjPlayerHand) === 21){
      bjStand();
    }
  }

  window.bjHit = function(){
    sCard();
    bjPlayerHand.push(bjDeck.pop());
    renderBJ(true);
    var score = calcHand(bjPlayerHand);
    if(score > 21){
      setMsg('💥 BUST! TOTAL ' + score + ' (LEWAT 21)');
      sLose();
      endBJ();
    }
  };

  window.bjStand = function(){
    while(calcHand(bjDealerHand) < 17){
      bjDealerHand.push(bjDeck.pop());
    }
    renderBJ(false);
    var pScore = calcHand(bjPlayerHand);
    var dScore = calcHand(bjDealerHand);
    
    if(pScore > 21){
      setMsg('💥 KAMU BUST! KALAH.');
      sLose();
    } else if(dScore > 21 || pScore > dScore){
      var prize = currentBet * 2;
      wallet += prize;
      setMsg('🎉 KAMU MENANG! +' + prize.toLocaleString('id-ID') + ' CARATS');
      sWin();
    } else if(pScore === dScore){
      wallet += currentBet;
      setMsg('🤝 SERI (PUSH)! KOIN DIKEMBALIKAN');
      sChip();
    } else {
      setMsg('🤖 DEALER MENANG (' + dScore + ' vs ' + pScore + ')');
      sLose();
    }
    saveWallet();
    endBJ();
  };

  function endBJ(){
    isPlaying = false;
    document.getElementById('main-controls').style.display = 'grid';
    document.getElementById('bj-controls').style.display = 'none';
  }

  window.handlePlayAction = function(){
    if(isPlaying) return;
    if(currentGame === 'slot') playSlot();
    else if(currentGame === 'roulette') playRoulette();
    else if(currentGame === 'dice') playDice();
    else if(currentGame === 'bj') startBlackjack();
  };

  // --- MULTIPLAYER ROOM 4-DIGIT SYSTEM ---
  window.handleCreateRoom = function(){
    var hName = document.getElementById('host-name').value.trim() || 'Trainer';
    var rName = document.getElementById('room-name').value.trim() || 'VIP Lounge';
    sChip();
    
    var code = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoom = {
      code: code,
      name: rName,
      host: hName,
      players: [
        { name: hName, isHost: true, chips: wallet, ready: true }
      ]
    };
    
    showActiveRoom();
    setMsg('🏛️ ROOM ' + code + ' DIBUAT! BAGIKAN KODE KE TEMAN');
  };

  window.handleJoinRoom = function(){
    var pName = document.getElementById('join-name').value.trim() || 'Player 2';
    var code = document.getElementById('join-code').value.trim();
    if(code.length !== 4){ alert('Masukkan 4-digit kode room!'); return; }
    sChip();
    
    currentRoom = {
      code: code,
      name: 'Room #' + code,
      host: 'Host',
      players: [
        { name: 'Host Room', isHost: true, chips: 10000, ready: true },
        { name: pName, isHost: false, chips: wallet, ready: true }
      ]
    };
    
    showActiveRoom();
    setMsg('✅ BERHASIL GABUNG KE ROOM ' + code);
  };

  function showActiveRoom(){
    document.getElementById('view-mp-setup').style.display = 'none';
    document.getElementById('view-mp-active').style.display = 'block';
    document.getElementById('mp-room-title').textContent = 'Room: ' + currentRoom.name;
    document.getElementById('mp-room-code').textContent = currentRoom.code;
    
    var pl = document.getElementById('mp-player-list');
    var h = '';
    currentRoom.players.forEach(function(p){
      h += '<div class="player-row"><span>👤 '+p.name+'</span><span class="player-badge '+(p.isHost?'badge-host':'badge-guest')+'">'+(p.isHost?'HOST':'PLAYER')+'</span></div>';
    });
    pl.innerHTML = h;
  }

  window.leaveRoom = function(){
    sChip();
    currentRoom = null;
    document.getElementById('view-mp-active').style.display = 'none';
    document.getElementById('view-mp-setup').style.display = 'block';
    setMsg('KELUAR DARI ROOM');
  };

  function fallbackCopyText(textToCopy){
    var textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {}
    document.body.removeChild(textArea);
  }

  window.copyRoomCode = function(){
    if(!currentRoom) return;
    sChip();
    var code = currentRoom.code;
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(code).then(function(){
        setMsg('📋 KODE ROOM ' + code + ' DISALIN KE CLIPBOARD!');
      }).catch(function(){
        fallbackCopyText(code);
        setMsg('📋 KODE ROOM ' + code + ' DISALIN!');
      });
    } else {
      fallbackCopyText(code);
      setMsg('📋 KODE ROOM ' + code + ' DISALIN!');
    }
  };

  function makeHex(len){
    var chars = '0123456789ABCDEF';
    var res = '';
    for(var i = 0; i < len; i++) res += chars[Math.floor(Math.random() * chars.length)];
    return res;
  }

  // --- CASHOUT & CLAIM REWARD ---
  window.generateClaimCode = function(){
    sChip();
    var safeAmount = Math.max(10, Math.floor(wallet || 1000));
    var code = 'CASINO-' + safeAmount + '-' + makeHex(4) + '-' + makeHex(4);
    currentClaimCode = code;

    // Call backend API to register active code
    try {
      fetch('/api/casino/claim-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: safeAmount, playerName: myPlayerName, code: code })
      }).then(function(res){ return res.json(); }).then(function(data){
        if(data && data.code){
          currentClaimCode = data.code;
          document.getElementById('claim-code-val').textContent = data.code;
        }
      }).catch(function(){});
    } catch(e){}

    document.getElementById('claim-result-box').style.display = 'block';
    document.getElementById('claim-code-val').textContent = code;

    var copyTarget = '.claimr ' + code;
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(copyTarget).then(function(){
        document.getElementById('claim-toast-notice').textContent = '✅ PERINTAH .claimr ' + code + ' DISALIN KE CLIPBOARD!';
      }).catch(function(){
        fallbackCopyText(copyTarget);
        document.getElementById('claim-toast-notice').textContent = '✅ KODE BERHASIL DISALIN!';
      });
    } else {
      fallbackCopyText(copyTarget);
      document.getElementById('claim-toast-notice').textContent = '✅ KODE BERHASIL DISALIN!';
    }
    setMsg('🎁 KODE KLAIM SIAP! SALIN & KETIK DI WHATSAPP');
    sWin();
  };

  window.copyClaimCodeAgain = function(){
    if(!currentClaimCode) return;
    sChip();
    var copyTarget = '.claimr ' + currentClaimCode;
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(copyTarget).then(function(){
        setMsg('📋 .claimr ' + currentClaimCode + ' DISALIN!');
      }).catch(function(){
        fallbackCopyText(copyTarget);
        setMsg('📋 DISALIN KE CLIPBOARD!');
      });
    } else {
      fallbackCopyText(copyTarget);
      setMsg('📋 DISALIN KE CLIPBOARD!');
    }
  };

})();
</script>
</body>
</html>`;
}
