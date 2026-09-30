'use strict';

import { kirimForwardSigned } from './richHelper.js';

const html = `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
html,body{width:100%;min-height:100%;background:#090b10;color:#eef4ff}
body{padding:8px;overflow-y:auto;display:flex;justify-content:center;align-items:flex-start}

/* 9:16 PORTRAIT HANDHELD RETRO CONSOLE (PANJANG KE BAWAH) */
#app{
  width:100%;
  max-width:390px;
  min-height:620px;
  margin:0 auto;
  background:linear-gradient(180deg,#1c212d 0%,#131720 40%,#0a0c10 100%);
  border:3px solid #2e3648;
  border-radius:28px;
  box-shadow:0 16px 40px rgba(0,0,0,0.88),inset 0 2px 4px rgba(255,255,255,0.12);
  padding:10px 12px 16px;
  display:flex;
  flex-direction:column;
  gap:10px;
  position:relative;
}

/* TOP SHOULDER & BRAND BAR */
.psp-top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:0 6px;
}
.shoulder-btn{
  background:linear-gradient(180deg,#3b4458,#1b202c);
  border:1.5px solid #55627e;
  border-radius:8px 8px 3px 3px;
  padding:4px 12px;
  font-size:9.5px;
  font-weight:900;
  color:#9da9c4;
  cursor:pointer;
  box-shadow:0 2px 5px rgba(0,0,0,0.5);
  transition:all 0.1s;
}
.shoulder-btn:active{
  background:#00e5ff;
  color:#000;
  border-color:#00e5ff;
}
.psp-brand{
  font-size:10.5px;
  font-weight:900;
  color:#00e5ff;
  letter-spacing:1.5px;
  display:flex;
  align-items:center;
  gap:4px;
}

/* SCREEN HOUSING (LCD GLASS) */
.screen-wrap{
  position:relative;
  background:#040507;
  border:2.5px solid #282f3d;
  border-radius:16px;
  overflow:hidden;
  box-shadow:inset 0 3px 12px rgba(0,0,0,0.95),0 4px 12px rgba(0,0,0,0.5);
}
canvas#dinoCanvas{
  display:block;
  width:100%;
  height:auto;
  aspect-ratio:16/9.6;
  background:transparent;
  image-rendering:pixelated;
  cursor:pointer;
}

/* FLOATING OVERLAYS (MENGAMBANG DI ATAS LAYAR) */
.floating-overlay{
  position:absolute;
  inset:0;
  background:rgba(5,7,12,0.88);
  backdrop-filter:blur(3px);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:8px;
  z-index:40;
  transition:opacity 0.2s ease;
}
.floating-overlay.hide{
  display:none;
}
.floating-panel{
  background:linear-gradient(180deg,#181f2f 0%,#0f1420 100%);
  border:2px solid #00e5ff;
  border-radius:14px;
  width:100%;
  max-width:320px;
  padding:10px 12px;
  text-align:center;
  box-shadow:0 10px 30px rgba(0,229,255,0.25);
  display:flex;
  flex-direction:column;
  gap:6px;
}
.panel-title{
  font-size:12px;
  font-weight:900;
  color:#00e5ff;
  letter-spacing:0.5px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:5px;
}
.feature-badges{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:4px;
}
.badge-item{
  background:rgba(0,0,0,0.6);
  border:1px solid #283247;
  border-radius:6px;
  padding:3px 2px;
  font-size:8.5px;
  font-weight:700;
  color:#cbd5e1;
}
.btn-play-now{
  background:linear-gradient(90deg,#00e5ff,#0091ea);
  border:none;
  border-radius:10px;
  padding:8px 0;
  color:#000;
  font-size:12px;
  font-weight:900;
  letter-spacing:0.5px;
  cursor:pointer;
  box-shadow:0 4px 15px rgba(0,229,255,0.4);
  transition:all 0.1s;
}
.btn-play-now:active{
  transform:scale(0.96);
  filter:brightness(1.2);
}
.mini-auto-bar{
  background:rgba(0,229,255,0.06);
  border:1px solid rgba(0,229,255,0.3);
  border-radius:8px;
  padding:4px 8px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  font-size:8.5px;
  color:#cbd5e1;
}
.auto-code{
  font-family:monospace;
  font-weight:bold;
  color:#00e5ff;
}
.btn-mini-copy{
  background:#00e5ff;
  border:none;
  border-radius:4px;
  padding:2px 8px;
  font-size:8px;
  font-weight:900;
  color:#000;
  cursor:pointer;
}

/* END GAME STATS & CLAIM */
.end-stats-row{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:4px;
  background:rgba(0,0,0,0.5);
  padding:6px;
  border-radius:8px;
  border:1px solid #283247;
}
.end-stat-box{text-align:center;}
.end-stat-val{font-size:12px;font-weight:900;color:#fff;}
.end-stat-lbl{font-size:7.5px;color:#8e9cb8;font-weight:bold;}
.claim-box{
  background:rgba(0,0,0,0.7);
  border:1px dashed #00e5ff;
  border-radius:8px;
  padding:6px;
  display:flex;
  flex-direction:column;
  gap:4px;
}
.claim-code-txt{
  font-family:monospace;
  font-size:9.5px;
  font-weight:900;
  color:#00e5ff;
  word-break:break-all;
}
.btn-copy-claim{
  background:#00e5ff;
  border:none;
  border-radius:6px;
  padding:5px;
  font-size:9px;
  font-weight:900;
  color:#000;
  cursor:pointer;
}
.btn-retry{
  background:linear-gradient(90deg,#00e5ff,#0091ea);
  border:none;
  border-radius:8px;
  padding:6px;
  font-size:11px;
  font-weight:900;
  color:#000;
  cursor:pointer;
}

/* CONTROLLER SECTION (LOWER HALF OF 9:16) */
.controls-deck{
  display:grid;
  grid-template-columns:108px 1fr 108px;
  gap:6px;
  align-items:center;
  margin-top:2px;
}

/* LEFT: D-PAD & ANALOG */
.left-deck{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:8px;
}
.dpad-grid{
  width:88px;
  height:88px;
  position:relative;
}
.dpad-btn{
  position:absolute;
  width:29px;
  height:29px;
  background:linear-gradient(180deg,#2b3242,#181c26);
  border:1px solid #48546f;
  color:#cbd5e1;
  font-size:11px;
  font-weight:900;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  box-shadow:0 3px 6px rgba(0,0,0,0.5);
  transition:all 0.08s;
}
.dpad-btn:active{
  background:#00e5ff;
  color:#000;
  transform:scale(0.92);
}
.dpad-up{top:0;left:29px;border-radius:7px 7px 0 0}
.dpad-down{bottom:0;left:29px;border-radius:0 0 7px 7px}
.dpad-left{top:29px;left:0;border-radius:7px 0 0 7px}
.dpad-right{top:29px;right:0;border-radius:0 7px 7px 0}
.dpad-center{top:29px;left:29px;width:29px;height:29px;background:#141720;border:none;position:absolute}

.analog-hub{
  width:44px;
  height:44px;
  border-radius:50%;
  background:radial-gradient(circle,#3c4558 0%,#181d28 65%,#090b10 100%);
  border:2px solid #54627f;
  box-shadow:inset 0 3px 6px rgba(0,0,0,0.8),0 3px 8px rgba(0,0,0,0.6);
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:transform 0.1s;
}
.analog-hub:active{
  transform:scale(0.94);
  border-color:#00e5ff;
}
.analog-inner{
  width:18px;
  height:18px;
  border-radius:50%;
  border:1px dashed #6b7a99;
}

/* CENTER: SYSTEM BUTTONS */
.center-deck{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:6px;
}
.sys-bar{
  display:flex;
  gap:4px;
  width:100%;
}
.sys-btn{
  flex:1;
  padding:5px 2px;
  background:#181c26;
  border:1px solid #3b4458;
  border-radius:6px;
  color:#8e9cb8;
  font-size:8px;
  font-weight:900;
  text-align:center;
  cursor:pointer;
}
.sys-btn:active{
  background:#00e5ff;
  color:#000;
}
.quick-auto-btn{
  width:100%;
  padding:6px 4px;
  background:linear-gradient(180deg,#19382b,#0f241c);
  border:1px solid #00e676;
  border-radius:8px;
  color:#00e676;
  font-size:9.5px;
  font-weight:900;
  cursor:pointer;
  text-align:center;
  box-shadow:0 2px 6px rgba(0,0,0,0.4);
}
.quick-auto-btn:active{
  background:#00e676;
  color:#000;
}

/* RIGHT: ACTION BUTTONS (△ ◯ ✕ □) */
.right-deck{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:8px;
}
.action-grid{
  width:88px;
  height:88px;
  position:relative;
}
.act-btn{
  position:absolute;
  width:29px;
  height:29px;
  border-radius:50%;
  background:linear-gradient(180deg,#2f3647,#1b1f2b);
  border:2px solid #485268;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:11px;
  font-weight:900;
  cursor:pointer;
  box-shadow:0 2px 5px rgba(0,0,0,0.5);
  transition:all 0.08s;
}
.act-btn:active{
  transform:scale(0.92);
  filter:brightness(1.4);
}
.act-triangle{top:0;left:29px;color:#00e676;border-color:#00e67666}
.act-circle{right:0;top:29px;color:#ff3366;border-color:#ff336666}
.act-cross{bottom:0;left:29px;color:#00e5ff;border-color:#00e5ff66}
.act-square{left:0;top:29px;color:#ff4081;border-color:#ff408166}

/* TOAST */
.toast{
  position:fixed;
  bottom:14px;
  left:50%;
  transform:translateX(-50%) translateY(20px);
  background:#0c1017;
  border:1px solid #00e5ff;
  color:#00e5ff;
  padding:5px 14px;
  border-radius:16px;
  font-size:10px;
  font-weight:bold;
  opacity:0;
  pointer-events:none;
  transition:all 0.2s;
  z-index:999;
}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style>

<div id="app">
  <!-- Top Shoulder Buttons Bar -->
  <div class="psp-top">
    <button class="shoulder-btn" id="btnL" type="button">[ L ] AUTO</button>
    <div class="psp-brand">
      <span>SONY PSP™</span>
      <span style="color:#00e676;font-size:8px;">🔋100%</span>
    </div>
    <button class="shoulder-btn" id="btnR" type="button">[ R ] JUMP</button>
  </div>

  <!-- Screen Housing with Canvas & Floating Panels -->
  <div class="screen-wrap">
    <canvas id="dinoCanvas" width="800" height="420"></canvas>

    <!-- FLOATING WELCOME PANEL -->
    <div class="floating-overlay" id="welcomeOverlay">
      <div class="floating-panel">
        <div class="panel-title">
          <span>🦖</span>
          <span>CHROME DINO PSP</span>
        </div>

        <div class="feature-badges">
          <div class="badge-item">❤️ 4 Hearts</div>
          <div class="badge-item">🪙 +Koin &amp; XP</div>
          <div class="badge-item">🏆 9999 Win</div>
        </div>

        <button class="btn-play-now" id="btnStartNow" type="button">
          ▶ MAINKAN SEKARANG (✕)
        </button>

        <div class="mini-auto-bar">
          <div>🤖 Auto: <span class="auto-code">.bayardinoauto</span></div>
          <button class="btn-mini-copy" id="btnCopyPay" type="button">Salin</button>
        </div>
      </div>
    </div>

    <!-- FLOATING END GAME MODAL OVERLAY -->
    <div class="floating-overlay hide" id="endOverlay">
      <div class="floating-panel">
        <div style="font-size:20px;" id="endIcon">🏆</div>
        <div class="panel-title" id="endTitle">Permainan Selesai</div>
        <div id="endStory" style="font-size:9px;color:#c2cce0;margin:2px 0;line-height:1.3;">
          Selamat telah menyelesaikan perjalanan!
        </div>

        <div class="end-stats-row">
          <div class="end-stat-box">
            <div class="end-stat-val" id="endScore">0</div>
            <div class="end-stat-lbl">SKOR</div>
          </div>
          <div class="end-stat-box">
            <div class="end-stat-val" id="endCoins" style="color:#ffd700;">+0</div>
            <div class="end-stat-lbl">KOIN</div>
          </div>
          <div class="end-stat-box">
            <div class="end-stat-val" id="endXp" style="color:#00e5ff;">+0</div>
            <div class="end-stat-lbl">XP</div>
          </div>
        </div>

        <div class="claim-box">
          <div style="font-size:7.5px;color:#9da9c4;font-weight:bold;">KODE KLAIM (.klaimdino &lt;kode&gt;):</div>
          <div class="claim-code-txt" id="endClaimCode">DN-XXXX-XXXX</div>
          <button class="btn-copy-claim" id="btnCopyClaim" type="button">📋 Salin Kode Klaim</button>
        </div>

        <button class="btn-retry" id="btnRetry" type="button">🔄 MAIN LAGI (△)</button>
      </div>
    </div>
  </div>

  <!-- FULL PHYSICAL PSP CONTROLLER (LOWER HALF) -->
  <div class="controls-deck">
    <!-- LEFT: D-PAD & ANALOG -->
    <div class="left-deck">
      <div class="dpad-grid">
        <button class="dpad-btn dpad-up" id="btnDpadUp" type="button">▲</button>
        <button class="dpad-btn dpad-left" id="btnDpadLeft" type="button">◀</button>
        <div class="dpad-center"></div>
        <button class="dpad-btn dpad-right" id="btnDpadRight" type="button">▶</button>
        <button class="dpad-btn dpad-down" id="btnDpadDown" type="button">▼</button>
      </div>
      <div class="analog-hub" id="btnAnalog" title="Analog (Klik untuk Lompat)">
        <div class="analog-inner"></div>
      </div>
    </div>

    <!-- CENTER: SYSTEM BUTTONS & AUTO TOGGLE -->
    <div class="center-deck">
      <button class="quick-auto-btn" id="btnQuickAuto" type="button">🤖 MODE AUTO</button>
      <div class="sys-bar">
        <button class="sys-btn" id="btnHome" type="button">⌂ HOME</button>
        <button class="sys-btn" id="btnVol" type="button">🔊 VOL</button>
      </div>
      <div class="sys-bar">
        <button class="sys-btn" id="btnSelect" type="button">SELECT</button>
        <button class="sys-btn" id="btnStart" type="button" style="color:#00e5ff;font-weight:bold;">START</button>
      </div>
    </div>

    <!-- RIGHT: PLAYSTATION ACTION BUTTONS (△ ◯ ✕ □) -->
    <div class="right-deck">
      <div class="action-grid">
        <button class="act-btn act-triangle" id="btnTriangle" type="button" title="Triangle: Ulangi / Menu">△</button>
        <button class="act-btn act-circle" id="btnCircle" type="button" title="Circle: Merunduk">○</button>
        <button class="act-btn act-cross" id="btnCross" type="button" title="Cross: Lompat / Mulai">✕</button>
        <button class="act-btn act-square" id="btnSquare" type="button" title="Square: Suara">□</button>
      </div>
      <span style="font-size:8px;font-weight:bold;color:#4f5d75;letter-spacing:1px;">ACTION</span>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
(function(){
  'use strict';

  var cv = document.getElementById('dinoCanvas');
  var ctx = cv.getContext('2d');
  var W = 800, H = 420;

  var toastEl = document.getElementById('toast');
  var welcomeOverlay = document.getElementById('welcomeOverlay');
  var endOverlay = document.getElementById('endOverlay');
  var endIcon = document.getElementById('endIcon');
  var endTitle = document.getElementById('endTitle');
  var endStory = document.getElementById('endStory');
  var endScore = document.getElementById('endScore');
  var endCoins = document.getElementById('endCoins');
  var endXp = document.getElementById('endXp');
  var endClaimCode = document.getElementById('endClaimCode');
  var btnL = document.getElementById('btnL');
  var btnVol = document.getElementById('btnVol');

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(window._tToast);
    window._tToast = setTimeout(function(){
      toastEl.classList.remove('show');
    }, 2000);
  }

  // Audio Engine
  var AC = null, muted = false;
  function getAudio() {
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
    if (AC && AC.state === 'suspended') {
      try { AC.resume(); } catch(e){}
    }
    return AC;
  }
  function playTone(freq, duration, type, vol) {
    if (muted) return;
    var a = getAudio();
    if (!a) return;
    try {
      var o = a.createOscillator();
      var g = a.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, a.currentTime);
      g.gain.setValueAtTime(vol || 0.08, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + duration);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + duration + 0.02);
    } catch(e){}
  }

  function sndJump() { playTone(440, 0.08, 'square', 0.06); }
  function sndCoin() { playTone(987, 0.1, 'sine', 0.08); setTimeout(function(){ playTone(1318, 0.12, 'sine', 0.08); }, 60); }
  function sndHit() { playTone(160, 0.15, 'sawtooth', 0.1); }
  function sndWin() { playTone(523, 0.12, 'triangle', 0.1); setTimeout(function(){ playTone(659, 0.12, 'triangle', 0.1); }, 120); setTimeout(function(){ playTone(783, 0.2, 'triangle', 0.12); }, 240); }

  // Game Constants & State
  var GROUND_Y = 320;
  var GRAVITY = 0.55;
  var JUMP_FORCE = -11.5;
  var WIN_SCORE = 9999;

  var isRunning = false;
  var isGameOver = false;
  var isAutoUnlocked = false;
  var autoMode = false;
  var score = 0;
  var bestScore = 0;
  var coins = 0;
  var xp = 0;
  var hearts = 4;
  var gameSpeed = 5.5;
  var currentCode = '';

  try {
    bestScore = parseInt(localStorage.getItem('dino_hi_score') || '0', 10) || 0;
    isAutoUnlocked = localStorage.getItem('dino_auto_unlocked') === 'true';
  } catch(e){}

  var dino = {
    x: 60, y: GROUND_Y - 48, w: 44, h: 48,
    vy: 0, grounded: true, ducking: false,
    invincibleTimer: 0, legStep: 0, animTick: 0
  };

  var obstacles = [];
  var coinsList = [];
  var clouds = [];
  var stars = [];
  var groundTiles = [];
  var nextObsDistance = 220;
  var lastObsX = 0;
  var nightMode = false;
  var nightFactor = 0;

  // Init Background Elements
  for (var i = 0; i < 50; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 80), r: Math.random() * 1.5 + 0.5, blink: Math.random() });
  }
  for (var c = 0; c < 5; c++) {
    clouds.push({ x: c * 180 + Math.random() * 50, y: 40 + Math.random() * 70, speed: 0.3 + Math.random() * 0.4 });
  }
  for (var g = 0; g < W + 40; g += 15) {
    groundTiles.push({ x: g, length: 3 + Math.floor(Math.random() * 8), type: Math.random() > 0.8 ? 1 : 0 });
  }

  function generateClaimCode(sc, cn, xpVal, ending) {
    var raw = 'DINO_' + sc + '_' + cn + '_' + xpVal + '_' + ending + '_' + Date.now();
    var hash = 0;
    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    var hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    return 'DN-' + hex.slice(0, 4) + '-' + hex.slice(4, 8);
  }

  function resetGame(enableAuto) {
    isRunning = true;
    isGameOver = false;
    score = 0;
    coins = 0;
    xp = 0;
    hearts = 4;
    gameSpeed = 5.5;
    autoMode = !!enableAuto;

    dino.y = GROUND_Y - 48;
    dino.vy = 0;
    dino.grounded = true;
    dino.ducking = false;
    dino.invincibleTimer = 0;

    obstacles = [];
    coinsList = [];
    nextObsDistance = 220;
    lastObsX = W;

    welcomeOverlay.classList.add('hide');
    endOverlay.classList.add('hide');

    if (btnL) {
      btnL.textContent = autoMode ? '[ L ] AUTO ON' : '[ L ] AUTO';
      btnL.style.color = autoMode ? '#00e676' : '#9da9c4';
    }
  }

  function jump() {
    if (!isRunning || isGameOver) {
      resetGame(autoMode);
      return;
    }
    if (dino.grounded) {
      dino.vy = JUMP_FORCE;
      dino.grounded = false;
      dino.ducking = false;
      sndJump();
    }
  }

  function duck(state) {
    if (!isRunning || isGameOver) return;
    dino.ducking = state;
    if (state && !dino.grounded) {
      dino.vy += 4;
    }
  }

  function triggerGameOver(endingType) {
    isRunning = false;
    isGameOver = true;

    if (score > bestScore) {
      bestScore = Math.floor(score);
      try { localStorage.setItem('dino_hi_score', bestScore.toString()); } catch(e){}
    }

    currentCode = generateClaimCode(Math.floor(score), coins, xp, endingType);

    if (endingType === 'happy') {
      sndWin();
      endIcon.textContent = '💕🦖❤️';
      endTitle.textContent = 'HAPPY ENDING! (9999 POIN)';
      endStory.textContent = 'Dino berhasil berlari sampai akhir dan bertemu kekasih hatinya!';
      endTitle.style.color = '#ff4081';
    } else {
      sndHit();
      endIcon.textContent = '💀';
      endTitle.textContent = 'GAME OVER';
      endStory.textContent = 'Dino kehabisan darah setelah menabrak rintangan.';
      endTitle.style.color = '#00e5ff';
    }

    endScore.textContent = Math.floor(score);
    endCoins.textContent = '+' + coins;
    endXp.textContent = '+' + xp;
    endClaimCode.textContent = currentCode;

    endOverlay.classList.remove('hide');
  }

  // Bind Buttons
  var btnStartNow = document.getElementById('btnStartNow');
  if (btnStartNow) btnStartNow.addEventListener('click', function(e){ e.stopPropagation(); resetGame(false); });

  var btnCross = document.getElementById('btnCross');
  if (btnCross) btnCross.addEventListener('click', function(e){ e.stopPropagation(); jump(); });

  var btnR = document.getElementById('btnR');
  if (btnR) btnR.addEventListener('click', function(e){ e.stopPropagation(); jump(); });

  var btnDpadUp = document.getElementById('btnDpadUp');
  if (btnDpadUp) btnDpadUp.addEventListener('click', function(e){ e.stopPropagation(); jump(); });

  var btnAnalog = document.getElementById('btnAnalog');
  if (btnAnalog) btnAnalog.addEventListener('click', function(e){ e.stopPropagation(); jump(); });

  var btnStart = document.getElementById('btnStart');
  if (btnStart) btnStart.addEventListener('click', function(e){ e.stopPropagation(); resetGame(false); });

  var btnHome = document.getElementById('btnHome');
  if (btnHome) btnHome.addEventListener('click', function(e){ e.stopPropagation(); welcomeOverlay.classList.remove('hide'); });

  var btnSelect = document.getElementById('btnSelect');
  if (btnSelect) btnSelect.addEventListener('click', function(e){ e.stopPropagation(); welcomeOverlay.classList.remove('hide'); });

  var btnTriangle = document.getElementById('btnTriangle');
  if (btnTriangle) btnTriangle.addEventListener('click', function(e){
    e.stopPropagation();
    if (isGameOver) resetGame(autoMode);
    else welcomeOverlay.classList.toggle('hide');
  });

  var btnRetry = document.getElementById('btnRetry');
  if (btnRetry) btnRetry.addEventListener('click', function(e){ e.stopPropagation(); resetGame(autoMode); });

  // Duck handlers
  function bindDuck(el) {
    if (!el) return;
    el.addEventListener('mousedown', function(e){ e.stopPropagation(); duck(true); });
    el.addEventListener('mouseup', function(e){ e.stopPropagation(); duck(false); });
    el.addEventListener('touchstart', function(e){ e.preventDefault(); e.stopPropagation(); duck(true); });
    el.addEventListener('touchend', function(e){ e.preventDefault(); e.stopPropagation(); duck(false); });
  }
  bindDuck(document.getElementById('btnDpadDown'));
  bindDuck(document.getElementById('btnCircle'));

  // Sound / Mute
  function toggleMute() {
    muted = !muted;
    if (btnVol) btnVol.textContent = muted ? '🔇 VOL' : '🔊 VOL';
    showToast(muted ? 'Suara Dimatikan' : 'Suara Diaktifkan');
  }
  if (btnVol) btnVol.addEventListener('click', toggleMute);
  var btnSquare = document.getElementById('btnSquare');
  if (btnSquare) btnSquare.addEventListener('click', toggleMute);

  // Auto Mode Toggle
  function toggleAuto() {
    if (isAutoUnlocked) {
      autoMode = !autoMode;
      if (btnL) {
        btnL.textContent = autoMode ? '[ L ] AUTO ON' : '[ L ] AUTO';
        btnL.style.color = autoMode ? '#00e676' : '#9da9c4';
      }
      showToast(autoMode ? '🤖 Mode Auto AI Aktif' : '👤 Mode Manual Aktif');
    } else {
      showToast('🔒 Bayar 150rb koin (.bayardinoauto) untuk unlock!');
    }
  }
  if (btnL) btnL.addEventListener('click', toggleAuto);
  var btnQuickAuto = document.getElementById('btnQuickAuto');
  if (btnQuickAuto) btnQuickAuto.addEventListener('click', toggleAuto);

  // Copy Buttons
  var btnCopyPay = document.getElementById('btnCopyPay');
  if (btnCopyPay) btnCopyPay.addEventListener('click', function(e){
    e.stopPropagation();
    try {
      navigator.clipboard.writeText('.bayardinoauto');
      showToast('📋 Perintah .bayardinoauto disalin!');
    } catch(err){}
  });

  var btnCopyClaim = document.getElementById('btnCopyClaim');
  if (btnCopyClaim) btnCopyClaim.addEventListener('click', function(e){
    e.stopPropagation();
    if (!currentCode) return;
    try {
      navigator.clipboard.writeText(currentCode);
      showToast('📋 Kode klaim disalin! Kirim ke bot WhatsApp.');
    } catch(err){}
  });

  cv.addEventListener('click', function(){ jump(); });

  // Keyboard support
  window.addEventListener('keydown', function(e){
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      jump();
    } else if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      duck(true);
    }
  });
  window.addEventListener('keyup', function(e){
    if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      duck(false);
    }
  });

  // Main Loop
  function update() {
    if (isRunning && !isGameOver) {
      score += 0.12;
      gameSpeed = Math.min(13, 5.5 + Math.floor(score / 200) * 0.4);

      var cycle = Math.floor(score / 500) % 2;
      nightMode = cycle === 1;
      if (nightMode && nightFactor < 1) nightFactor = Math.min(1, nightFactor + 0.02);
      if (!nightMode && nightFactor > 0) nightFactor = Math.max(0, nightFactor - 0.02);

      // Win Condition Check
      if (score >= WIN_SCORE) {
        triggerGameOver('happy');
        return;
      }

      // Physics
      dino.y += dino.vy;
      dino.vy += GRAVITY;

      var currentGroundY = dino.ducking ? GROUND_Y - 30 : GROUND_Y - 48;
      if (dino.y >= currentGroundY) {
        dino.y = currentGroundY;
        dino.vy = 0;
        dino.grounded = true;
      }

      dino.animTick++;
      if (dino.animTick % 6 === 0) {
        dino.legStep = (dino.legStep + 1) % 2;
      }
      if (dino.invincibleTimer > 0) {
        dino.invincibleTimer--;
      }

      // Spawn Obstacles
      lastObsX -= gameSpeed;
      if (W - lastObsX >= nextObsDistance) {
        var isPtero = score > 250 && Math.random() > 0.6;
        if (isPtero) {
          var heights = [GROUND_Y - 35, GROUND_Y - 60, GROUND_Y - 80];
          var py = heights[Math.floor(Math.random() * heights.length)];
          obstacles.push({ x: W, y: py, w: 38, h: 26, type: 'ptero', wingUp: false, wingTick: 0 });
        } else {
          var count = Math.random() > 0.6 ? 2 : 1;
          var cw = count === 2 ? 38 : 22;
          var ch = 42 + Math.floor(Math.random() * 12);
          obstacles.push({ x: W, y: GROUND_Y - ch, w: cw, h: ch, type: 'cactus' });
        }

        if (Math.random() > 0.4) {
          coinsList.push({ x: W + 50, y: GROUND_Y - 75 - Math.floor(Math.random() * 40), r: 8, collected: false });
        }

        nextObsDistance = 220 + Math.random() * 180;
        lastObsX = W;
      }

      // Auto AI
      if (autoMode && obstacles.length > 0) {
        var nearest = null;
        for (var n = 0; n < obstacles.length; n++) {
          if (obstacles[n].x + obstacles[n].w > dino.x) {
            nearest = obstacles[n];
            break;
          }
        }
        if (nearest) {
          var dist = nearest.x - (dino.x + dino.w);
          if (dist > 0 && dist < (gameSpeed * 16)) {
            if (nearest.type === 'ptero' && nearest.y >= GROUND_Y - 45) {
              duck(true);
            } else if (dino.grounded) {
              jump();
            }
          } else if (dist < -10) {
            duck(false);
          }
        }
      }

      // Update Obstacles
      for (var o = obstacles.length - 1; o >= 0; o--) {
        var ob = obstacles[o];
        ob.x -= gameSpeed;
        if (ob.type === 'ptero') {
          ob.wingTick++;
          if (ob.wingTick % 8 === 0) ob.wingUp = !ob.wingUp;
        }

        // Collision Check
        var dw = dino.ducking ? 52 : dino.w;
        var dh = dino.ducking ? 30 : dino.h;
        if (
          dino.invincibleTimer === 0 &&
          dino.x + 8 < ob.x + ob.w - 6 &&
          dino.x + dw - 8 > ob.x + 6 &&
          dino.y + 6 < ob.y + ob.h &&
          dino.y + dh > ob.y + 4
        ) {
          sndHit();
          hearts--;
          dino.invincibleTimer = 60;
          if (hearts <= 0) {
            triggerGameOver('bad');
            return;
          }
        }

        if (ob.x + ob.w < -20) {
          obstacles.splice(o, 1);
          xp += 5;
        }
      }

      // Update Coins
      for (var c = coinsList.length - 1; c >= 0; c--) {
        var cn = coinsList[c];
        cn.x -= gameSpeed;
        var dwC = dino.ducking ? 52 : dino.w;
        var dhC = dino.ducking ? 30 : dino.h;
        if (!cn.collected &&
            cn.x > dino.x && cn.x < dino.x + dwC + 10 &&
            cn.y > dino.y - 10 && cn.y < dino.y + dhC + 10
        ) {
          cn.collected = true;
          coins += 10;
          xp += 20;
          sndCoin();
        }
        if (cn.x < -20 || cn.collected) {
          coinsList.splice(c, 1);
        }
      }

      // Ground animation
      groundTiles.forEach(function(gt){
        gt.x -= gameSpeed;
        if (gt.x < -20) gt.x = W + Math.random() * 20;
      });
    }

    // DRAWING
    var bg = nightFactor > 0 ? (nightFactor === 1 ? '#0a0d14' : '#151922') : '#ffffff';
    var fg = nightFactor > 0.5 ? '#ffffff' : '#222222';
    var groundCol = nightFactor > 0.5 ? '#55627e' : '#535353';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Stars
    if (nightFactor > 0.2) {
      stars.forEach(function(st){
        ctx.fillStyle = 'rgba(255,255,255,' + (st.blink * nightFactor) + ')';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Clouds
    clouds.forEach(function(cl){
      if (isRunning) cl.x -= cl.speed;
      if (cl.x < -60) cl.x = W + 40;
      ctx.fillStyle = nightFactor > 0.5 ? '#242b3a' : '#d8d8d8';
      ctx.fillRect(cl.x, cl.y, 44, 12);
      ctx.fillRect(cl.x + 8, cl.y - 6, 26, 6);
      ctx.fillRect(cl.x + 14, cl.y + 12, 18, 4);
    });

    // Ground Line
    ctx.strokeStyle = groundCol;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    // Ground details
    ctx.fillStyle = groundCol;
    groundTiles.forEach(function(gt){
      ctx.fillRect(gt.x, GROUND_Y + 4, gt.length, 2);
    });

    // Coins
    coinsList.forEach(function(cn){
      if (!cn.collected) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(cn.x, cn.y, cn.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('$', cn.x - 3, cn.y + 3);
      }
    });

    // Obstacles
    obstacles.forEach(function(ob){
      ctx.fillStyle = fg;
      if (ob.type === 'cactus') {
        ctx.fillRect(ob.x + ob.w * 0.35, ob.y, ob.w * 0.3, ob.h);
        ctx.fillRect(ob.x, ob.y + ob.h * 0.3, ob.w * 0.35, 6);
        ctx.fillRect(ob.x, ob.y + ob.h * 0.15, ob.w * 0.2, ob.h * 0.2);
        ctx.fillRect(ob.x + ob.w * 0.65, ob.y + ob.h * 0.45, ob.w * 0.35, 6);
        ctx.fillRect(ob.x + ob.w * 0.8, ob.y + ob.h * 0.3, ob.w * 0.2, ob.h * 0.2);
      } else {
        ctx.fillRect(ob.x + 10, ob.y + 12, 22, 8);
        ctx.fillRect(ob.x, ob.y + 10, 10, 6);
        ctx.fillRect(ob.x - 6, ob.y + 12, 6, 2);
        if (ob.wingUp) {
          ctx.fillRect(ob.x + 14, ob.y - 4, 8, 16);
          ctx.fillRect(ob.x + 18, ob.y - 8, 4, 8);
        } else {
          ctx.fillRect(ob.x + 14, ob.y + 18, 8, 14);
          ctx.fillRect(ob.x + 18, ob.y + 24, 4, 8);
        }
      }
    });

    // Dino
    var blink = dino.invincibleTimer === 0 || Math.floor(dino.invincibleTimer / 4) % 2 === 0;
    if (blink) {
      ctx.fillStyle = fg;
      var dx = dino.x, dy = dino.y;
      if (dino.ducking) {
        ctx.fillRect(dx + 12, dy + 6, 36, 16);
        ctx.fillRect(dx + 38, dy + 2, 18, 14);
        ctx.fillStyle = bg; ctx.fillRect(dx + 48, dy + 6, 4, 4);
        ctx.fillStyle = fg; ctx.fillRect(dx + 52, dy + 10, 6, 4);
        if (dino.legStep === 0) {
          ctx.fillRect(dx + 18, dy + 22, 6, 8); ctx.fillRect(dx + 34, dy + 22, 6, 4);
        } else {
          ctx.fillRect(dx + 18, dy + 22, 6, 4); ctx.fillRect(dx + 34, dy + 22, 6, 8);
        }
      } else {
        ctx.fillRect(dx + 22, dy, 22, 16);
        ctx.fillRect(dx + 34, dy + 16, 10, 4);
        ctx.fillStyle = bg; ctx.fillRect(dx + 26, dy + 4, 4, 4);
        ctx.fillStyle = fg;
        ctx.fillRect(dx + 8, dy + 16, 20, 20);
        ctx.fillRect(dx, dy + 18, 8, 12);
        ctx.fillRect(dx - 4, dy + 20, 4, 6);
        ctx.fillRect(dx + 28, dy + 22, 6, 4);
        if (!dino.grounded) {
          ctx.fillRect(dx + 12, dy + 36, 4, 10); ctx.fillRect(dx + 22, dy + 36, 4, 6);
        } else if (dino.legStep === 0) {
          ctx.fillRect(dx + 12, dy + 36, 4, 12); ctx.fillRect(dx + 12, dy + 46, 6, 2); ctx.fillRect(dx + 22, dy + 36, 4, 6);
        } else {
          ctx.fillRect(dx + 12, dy + 36, 4, 6); ctx.fillRect(dx + 22, dy + 36, 4, 12); ctx.fillRect(dx + 22, dy + 46, 6, 2);
        }
      }
    }

    // Top HUD
    ctx.fillStyle = fg;
    ctx.font = 'bold 13px monospace';
    var scoreStr = ('00000' + Math.floor(score)).slice(-5);
    var hiStr = ('00000' + Math.floor(bestScore)).slice(-5);
    var txt = 'HI ' + hiStr + '  ' + scoreStr;
    var tw = ctx.measureText(txt).width;
    ctx.fillText(txt, W - tw - 16, 26);

    var hStr = '';
    for (var h = 0; h < 4; h++) hStr += h < hearts ? '❤️' : '🖤';
    ctx.font = '14px sans-serif';
    ctx.fillText(hStr, 16, 25);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('🪙 ' + coins, 125, 25);
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('⭐ ' + xp + ' XP', 195, 25);

    if (autoMode) {
      ctx.fillStyle = '#00e676';
      ctx.fillText('[🤖 AUTO]', 275, 25);
    }

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
})();
</script>
`;

const pluginConfig = {
  name: 'dino',
  alias: ['dinorun', 'chromedino'],
  category: 'game',
  description: 'Game Chrome Dino Offline PSP Edition 9:16 Panjang Vertikal dengan 4 Hearts Darah, Koin, XP, Ending 9999 Poin, dan Controller Fisik Lengkap',
  usage: '.dino',
  example: '.dino',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  isEnabled: true
};

async function kirimDino(conn, chatId, customHtml, title = '🦖 Chrome Dino PSP Edition') {
  return kirimForwardSigned(conn, chatId, customHtml || html, title);
}

const handler = async (m, options = {}) => {
  const sock = options?.sock || options?.conn || options?.naze || options;
  const chatId = m?.chat || m?.key?.remoteJid;
  if (!chatId || !sock) return;

  const reactionKey = m?.raw?.key || m?.key;
  if (reactionKey && typeof sock.sendMessage === 'function') {
    await sock.sendMessage(chatId, { react: { text: '🦖', key: reactionKey } }).catch(() => {});
  }

  try {
    await kirimDino(sock, chatId);
  } catch (e) {
    console.error('[DINO ERROR]', e);
    if (typeof m?.reply === 'function') {
      await m.reply('❌ Gagal mengirim game Chrome Dino: ' + (e?.message || e));
    }
  }
};

export { pluginConfig as config, handler, kirimDino, html as DINO_HTML };
export default handler;
