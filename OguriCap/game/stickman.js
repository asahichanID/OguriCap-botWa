import { kirimForwardSigned } from './richHelper.js';

const config = {
  name: 'stickman',
  alias: ['stick', 'stickgame', 'stickfight'],
  category: 'game',
  description: 'Game Stickman Shadow Fighter HTML AI Rich.',
  usage: '.stickman',
  example: '.stickman',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
};

const HTML = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Stickman Shadow Fighter</title>
<style>
:root{
  --ink:#e9edef;
  --ink-soft:#aebac1;
  --muted:#8696a0;
  --accent:#00a884;
  --line:#2a3942;
  --line-strong:#374248;
  --cell-bg:#111b21;
  --card-2:#2a3942;
  --sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 12px;}
.card{width:100%;max-width:390px;}
.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--line);gap:8px;}
.header__title{font-size:16px;font-weight:700;color:var(--ink);}
.header__sub{font-size:11px;color:var(--muted);}
.status{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:12px;gap:6px;}
.status__score{display:flex;gap:12px;color:var(--muted);font-size:11.5px;}
.status__score b{color:var(--ink);}
.board-wrap{position:relative;width:100%;aspect-ratio:16/10;background:#0d1522;border-radius:10px;overflow:hidden;border:1px solid var(--line);box-shadow:0 8px 24px rgba(0,0,0,0.5);}
canvas{width:100%;height:100%;display:block;cursor:pointer;touch-action:none;}
.controls{margin-top:10px;display:flex;flex-direction:column;gap:6px;}
.controls-row{display:flex;gap:6px;justify-content:center;}
.controls button{border:none;border-radius:8px;padding:10px 0;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:.2px;background:var(--card-2);color:var(--ink);border:1px solid var(--line);flex:1;}
.controls button:active{filter:brightness(.85);transform:scale(0.96);}
.btn-left{background:linear-gradient(180deg,#f39c12,#d68910);color:#fff !important;}
.btn-jump{background:linear-gradient(180deg,#55b8ff,#1b7fe0);color:#fff !important;flex:1.2;}
.btn-right{background:linear-gradient(180deg,#f39c12,#d68910);color:#fff !important;}
.btn-atk{background:linear-gradient(180deg,#e74c3c,#c0392b);color:#fff !important;flex:1.4;}
.btn-guard{background:linear-gradient(180deg,#9b59b6,#8e44ad);color:#fff !important;}
.btn-s1{background:linear-gradient(180deg,#3498db,#2980b9);color:#fff !important;}
.btn-s2{background:linear-gradient(180deg,#e67e22,#d35400);color:#fff !important;}
.btn-reset{background:var(--accent);color:#0b141a !important;border-color:var(--accent) !important;font-size:12px;}
.tip{text-align:center;font-size:9.5px;color:var(--muted);margin-top:6px;}
</style>
</head>
<body>

<main class="stage">
<div class="card">
  <div class="header">
    <div class="header__title">🥋 Stickman Shadow Fighter</div>
    <div class="header__sub">Ninja Bayangan AI</div>
  </div>
  <div class="status">
    <div class="status__score">
      <span>Koin <b id="coin-display">0</b></span>
      <span>Kill <b id="kill-display">0</b></span>
      <span>Wave <b id="wave-display">1</b></span>
    </div>
    <button class="btn-reset" id="btn-reset" style="padding:4px 10px;border-radius:6px;" type="button">🔄 Reset</button>
  </div>
  <div class="board-wrap">
    <canvas id="board" width="480" height="300"></canvas>
  </div>
  <div class="controls">
    <div class="controls-row">
      <button class="btn-left" id="btn-left" type="button">◀ Kiri</button>
      <button class="btn-jump" id="btn-jump" type="button">⬆ Lompat</button>
      <button class="btn-right" id="btn-right" type="button">Kanan ▶</button>
    </div>
    <div class="controls-row">
      <button class="btn-atk" id="btn-atk" type="button">⚔️ Tebas</button>
      <button class="btn-guard" id="btn-guard" type="button">🛡️ Tangkis</button>
      <button class="btn-s1" id="btn-s1" type="button">⚡ Petir</button>
      <button class="btn-s2" id="btn-s2" type="button">🔥 Naga Api</button>
    </div>
  </div>
  <div class="tip">Ketuk layar atau tombol • Keyboard: A/D/Panah, Space/W (Lompat), J (Tebas), K (Tangkis), 1/2 (Jurus)</div>
</div>
</main>

<script>
(function(){
  'use strict';
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const W = 480, H = 300, GY = 236;

  let kills = 0, coins = 0, wave = 1, combo = 0, comboTimer = 0;
  let gameOver = false, tick = 0, spawnTimer = 0;
  let keys = { l: false, r: false };

  const player = {
    x: 160, y: GY - 48, vx: 0, vy: 0, w: 26, h: 48,
    hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
    ground: true, dir: 1, atkState: 0, atkTimer: 0,
    blocking: false, invuln: 0
  };

  let enemies = [];
  let particles = [];
  let slashes = [];
  let floatTexts = [];

  function resetGame(){
    kills = 0;
    coins = 0;
    wave = 1;
    combo = 0;
    comboTimer = 0;
    gameOver = false;
    tick = 0;
    spawnTimer = 0;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    player.x = 160;
    player.y = GY - 48;
    player.vx = 0;
    player.vy = 0;
    player.ground = true;
    player.dir = 1;
    player.atkTimer = 0;
    player.blocking = false;
    player.invuln = 0;
    enemies = [];
    particles = [];
    slashes = [];
    floatTexts = [];
    spawnEnemy();
    spawnEnemy();
    updateUI();
  }

  function updateUI(){
    const coinEl = document.getElementById('coin-display');
    const killEl = document.getElementById('kill-display');
    const waveEl = document.getElementById('wave-display');
    if(coinEl) coinEl.textContent = coins;
    if(killEl) killEl.textContent = kills;
    if(waveEl) waveEl.textContent = wave;
  }

  function spawnEnemy(){
    if(enemies.length >= 6) return;
    const isRight = Math.random() > 0.5;
    const r = Math.random();
    const type = r < 0.55 ? 'ninja' : (r < 0.85 ? 'fast' : 'tank');
    const eHp = type === 'tank' ? 240 : (type === 'fast' ? 70 : 110);
    enemies.push({
      x: isRight ? W + 20 : -20,
      y: GY - 48,
      w: 24, h: 48,
      hp: eHp, maxHp: eHp,
      spd: type === 'fast' ? 2.3 : (type === 'tank' ? 0.9 : 1.4),
      type: type,
      dir: isRight ? -1 : 1,
      atkTimer: 0,
      atkCooldown: 40 + Math.floor(Math.random() * 30),
      hitFlash: 0
    });
  }

  function addParticles(x, y, col, count, spd){
    for(let i = 0; i < count; i++){
      const ang = Math.random() * Math.PI * 2;
      const s = (Math.random() * 0.7 + 0.3) * (spd || 3);
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * s,
        vy: Math.sin(ang) * s - (spd ? 1 : 0),
        col: col,
        life: 14 + Math.floor(Math.random() * 12),
        size: Math.random() * 3 + 2
      });
    }
  }

  function addFloatText(txt, x, y, col){
    floatTexts.push({ txt: txt, x: x, y: y, col: col || '#fff', vy: -1.2, alpha: 1 });
  }

  function jump(){
    if(gameOver){ resetGame(); return; }
    if(player.ground){
      player.vy = -11.5;
      player.ground = false;
      addParticles(player.x, GY, '#94a3b8', 4, 1.5);
    }
  }

  function attack(){
    if(gameOver){ resetGame(); return; }
    if(player.atkTimer > 0) return;
    player.atkTimer = 10;
    player.atkState = (player.atkState + 1) % 3;
    player.blocking = false;

    const slashX = player.x + (player.dir * 28);
    const slashY = player.y + 18;
    slashes.push({ x: slashX, y: slashY, dir: player.dir, type: 'sword', life: 6 });

    let hitCount = 0;
    enemies.forEach(e => {
      const dist = Math.abs(e.x - player.x);
      const isFacing = (player.dir === 1 && e.x > player.x) || (player.dir === -1 && e.x < player.x);
      if(dist < 55 && isFacing){
        const dmg = 45 + Math.floor(Math.random() * 18);
        e.hp -= dmg;
        e.hitFlash = 5;
        e.x += player.dir * 12;
        addParticles(e.x, e.y + 20, '#ef4444', 6, 2.5);
        addFloatText('-' + dmg, e.x, e.y, '#f87171');
        hitCount++;
      }
    });

    if(hitCount > 0){
      combo++;
      comboTimer = 75;
      player.mp = Math.min(player.maxMp, player.mp + 6);
    }
  }

  function skillLightning(){
    if(gameOver){ resetGame(); return; }
    if(player.mp < 35){
      addFloatText('Energi Kurang!', player.x, player.y - 10, '#38bdf8');
      return;
    }
    player.mp -= 35;
    player.atkTimer = 14;
    slashes.push({ x: player.x + player.dir * 70, y: GY - 40, dir: player.dir, type: 'thunder', life: 10 });
    addParticles(player.x, player.y + 15, '#38bdf8', 18, 4);

    enemies.forEach(e => {
      const dist = Math.abs(e.x - player.x);
      if(dist < 160){
        const dmg = 120 + Math.floor(Math.random() * 40);
        e.hp -= dmg;
        e.hitFlash = 10;
        e.x += (e.x > player.x ? 1 : -1) * 35;
        addParticles(e.x, e.y + 15, '#38bdf8', 12, 3);
        addFloatText('⚡ ' + dmg, e.x, e.y, '#38bdf8');
      }
    });
    combo += 3;
    comboTimer = 90;
  }

  function skillFire(){
    if(gameOver){ resetGame(); return; }
    if(player.mp < 50){
      addFloatText('Energi Kurang!', player.x, player.y - 10, '#f59e0b');
      return;
    }
    player.mp -= 50;
    player.atkTimer = 16;
    slashes.push({ x: player.x + player.dir * 90, y: player.y + 10, dir: player.dir, type: 'fire', life: 14 });
    addParticles(player.x, player.y + 15, '#f59e0b', 25, 4.5);

    enemies.forEach(e => {
      const dist = Math.abs(e.x - player.x);
      const isFacing = (player.dir === 1 && e.x > player.x) || (player.dir === -1 && e.x < player.x);
      if(dist < 200 && isFacing){
        const dmg = 200 + Math.floor(Math.random() * 60);
        e.hp -= dmg;
        e.hitFlash = 12;
        e.x += player.dir * 50;
        addParticles(e.x, e.y + 15, '#f59e0b', 16, 3.5);
        addFloatText('🔥 ' + dmg, e.x, e.y, '#fbbf24');
      }
    });
    combo += 5;
    comboTimer = 100;
  }

  function bindBtn(id, downFn, upFn){
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('pointerdown', function(e){
      e.preventDefault();
      if(downFn) downFn();
    });
    el.addEventListener('pointerup', function(e){
      e.preventDefault();
      if(upFn) upFn();
    });
    el.addEventListener('pointercancel', function(e){
      e.preventDefault();
      if(upFn) upFn();
    });
    el.addEventListener('pointerleave', function(e){
      if(upFn) upFn();
    });
  }

  bindBtn('btn-left', () => { keys.l = true; player.dir = -1; }, () => { keys.l = false; });
  bindBtn('btn-right', () => { keys.r = true; player.dir = 1; }, () => { keys.r = false; });
  bindBtn('btn-jump', jump, null);
  bindBtn('btn-atk', attack, null);
  bindBtn('btn-guard', () => { player.blocking = true; }, () => { player.blocking = false; });
  bindBtn('btn-s1', skillLightning, null);
  bindBtn('btn-s2', skillFire, null);

  const resetBtn = document.getElementById('btn-reset');
  if(resetBtn) resetBtn.addEventListener('click', resetGame);

  canvas.addEventListener('pointerdown', function(e){
    if(gameOver){ resetGame(); return; }
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * W;
    const clickY = ((e.clientY - rect.top) / rect.height) * H;
    if(clickY < H * 0.45){
      jump();
    } else if(clickX > W * 0.65){
      attack();
    } else if(clickX < W * 0.35){
      player.dir = clickX < W * 0.17 ? -1 : 1;
      player.vx = player.dir * 4.2;
    }
  });

  window.addEventListener('keydown', function(e){
    const k = e.key.toLowerCase();
    if(k === 'arrowleft' || k === 'a'){ keys.l = true; player.dir = -1; }
    if(k === 'arrowright' || k === 'd'){ keys.r = true; player.dir = 1; }
    if(k === 'arrowup' || k === 'w' || k === ' '){ e.preventDefault(); jump(); }
    if(k === 'j'){ attack(); }
    if(k === 'k'){ player.blocking = true; }
    if(k === '1'){ skillLightning(); }
    if(k === '2'){ skillFire(); }
    if(k === 'r'){ resetGame(); }
  });

  window.addEventListener('keyup', function(e){
    const k = e.key.toLowerCase();
    if(k === 'arrowleft' || k === 'a') keys.l = false;
    if(k === 'arrowright' || k === 'd') keys.r = false;
    if(k === 'k') player.blocking = false;
  });

  function update(){
    tick++;
    if(comboTimer > 0){
      comboTimer--;
      if(comboTimer <= 0) combo = 0;
    }

    if(!gameOver){
      if(tick % 8 === 0 && player.mp < player.maxMp){
        player.mp = Math.min(player.maxMp, player.mp + 1);
      }

      if(player.atkTimer > 0) player.atkTimer--;
      if(player.invuln > 0) player.invuln--;

      if(keys.l) player.vx = -4.0;
      else if(keys.r) player.vx = 4.0;
      else player.vx *= 0.65;

      player.x += player.vx;
      if(player.x < 20) player.x = 20;
      if(player.x > W - 20) player.x = W - 20;

      player.vy += 0.65;
      player.y += player.vy;
      if(player.y >= GY - 48){
        player.y = GY - 48;
        player.vy = 0;
        player.ground = true;
      }

      spawnTimer++;
      const spawnInterval = Math.max(70, 150 - wave * 10);
      if(spawnTimer >= spawnInterval){
        spawnTimer = 0;
        spawnEnemy();
      }

      enemies = enemies.filter(e => {
        if(e.hp <= 0){
          kills++;
          coins += e.type === 'tank' ? 25 : (e.type === 'fast' ? 15 : 10);
          addParticles(e.x, e.y + 20, '#f59e0b', 12, 3);
          addFloatText('+' + (e.type === 'tank' ? 25 : 10) + ' 🪙', e.x, e.y, '#f59e0b');
          if(kills % 8 === 0) wave++;
          updateUI();
          return false;
        }

        if(e.hitFlash > 0) e.hitFlash--;
        e.dir = e.x < player.x ? 1 : -1;
        const dist = Math.abs(e.x - player.x);

        if(dist > 28){
          e.x += e.dir * e.spd;
        } else {
          e.atkTimer++;
          if(e.atkTimer >= e.atkCooldown){
            e.atkTimer = 0;
            if(player.invuln <= 0){
              let edmg = e.type === 'tank' ? 85 : (e.type === 'fast' ? 35 : 45);
              if(player.blocking){
                edmg = Math.floor(edmg * 0.2);
                addParticles(player.x, player.y + 20, '#a855f7', 8, 2);
                addFloatText('TANGKIS! -' + edmg, player.x, player.y - 15, '#c084fc');
              } else {
                addParticles(player.x, player.y + 20, '#ef4444', 8, 2.5);
                addFloatText('-' + edmg, player.x, player.y - 15, '#ef4444');
              }
              player.hp -= edmg;
              player.invuln = 15;
              if(player.hp <= 0){
                player.hp = 0;
                gameOver = true;
                addFloatText('⚔️ GAME OVER', W / 2 - 40, H / 2, '#ef4444');
              }
            }
          }
        }
        return true;
      });
    }

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life--;
    });
    particles = particles.filter(p => p.life > 0);

    floatTexts.forEach(f => {
      f.y += f.vy;
      f.alpha -= 0.025;
    });
    floatTexts = floatTexts.filter(f => f.alpha > 0);

    slashes.forEach(s => s.life--);
    slashes = slashes.filter(s => s.life > 0);
  }

  function drawStickman(x, y, dir, isPlayer, state){
    state = state || {};
    ctx.save();
    ctx.translate(x, y);
    if(dir === -1) ctx.scale(-1, 1);

    const mainCol = isPlayer ? '#f8fafc' : (state.type === 'tank' ? '#ef4444' : state.type === 'fast' ? '#fbbf24' : '#f87171');
    const glowCol = isPlayer ? '#38bdf8' : '#dc2626';

    ctx.strokeStyle = state.hitFlash > 0 ? '#ffffff' : mainCol;
    ctx.fillStyle = state.hitFlash > 0 ? '#ffffff' : mainCol;
    ctx.lineWidth = state.type === 'tank' ? 5 : 3.5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(0, 8, state.type === 'tank' ? 9 : 7, 0, Math.PI * 2);
    ctx.fill();

    if(isPlayer){
      ctx.strokeStyle = glowCol;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-6, 8); ctx.lineTo(6, 8);
      ctx.moveTo(-6, 8); ctx.lineTo(-14, 4 + Math.sin(tick * 0.2) * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = state.hitFlash > 0 ? '#ffffff' : mainCol;
    ctx.lineWidth = state.type === 'tank' ? 5 : 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 15); ctx.lineTo(0, 30);
    ctx.stroke();

    const walk = Math.sin(tick * 0.35) * 7;
    ctx.beginPath();
    ctx.moveTo(0, 30); ctx.lineTo(player.ground ? -5 + (player.vx ? walk : 0) : -7, 46);
    ctx.moveTo(0, 30); ctx.lineTo(player.ground ? 5 - (player.vx ? walk : 0) : 7, 46);
    ctx.stroke();

    if(isPlayer && player.blocking){
      ctx.moveTo(0, 19); ctx.lineTo(8, 14); ctx.lineTo(8, 27);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(168,85,247,0.7)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(10, 21, 20, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    } else if(isPlayer && player.atkTimer > 0){
      ctx.moveTo(0, 19); ctx.lineTo(13, 11); ctx.lineTo(23, 7);
      ctx.stroke();
      ctx.strokeStyle = glowCol;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(23, 7); ctx.lineTo(43, -4);
      ctx.stroke();
    } else {
      ctx.moveTo(0, 19); ctx.lineTo(-6, 25);
      ctx.moveTo(0, 19); ctx.lineTo(7, 25);
      ctx.stroke();
      if(isPlayer){
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, 17); ctx.lineTo(-17, 29);
        ctx.stroke();
      }
    }

    if(!isPlayer && state.hp < state.maxHp){
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-14, -10, 28, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-14, -10, (state.hp / state.maxHp) * 28, 4);
    }

    ctx.restore();
  }

  function draw(){
    ctx.clearRect(0, 0, W, H);

    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#0a101d');
    sky.addColorStop(1, '#182436');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GY);

    ctx.save();
    ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#f0f9ff';
    ctx.beginPath();
    ctx.arc(390, 42, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#0b121e';
    ctx.beginPath();
    ctx.moveTo(0, GY);
    ctx.lineTo(40, 140); ctx.lineTo(90, 160); ctx.lineTo(160, 120);
    ctx.lineTo(220, 165); ctx.lineTo(310, 115); ctx.lineTo(390, 155);
    ctx.lineTo(480, 125); ctx.lineTo(480, GY);
    ctx.fill();

    const floor = ctx.createLinearGradient(0, GY, 0, H);
    floor.addColorStop(0, '#1a2638');
    floor.addColorStop(0.2, '#0f1724');
    floor.addColorStop(1, '#05080e');
    ctx.fillStyle = floor;
    ctx.fillRect(0, GY, W, H - GY);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GY); ctx.lineTo(W, GY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56,189,248,0.1)';
    ctx.lineWidth = 1;
    for(let i = 0; i < W; i += 32){
      ctx.beginPath();
      ctx.moveTo(i, GY); ctx.lineTo(i - 35, H);
      ctx.stroke();
    }

    slashes.forEach(s => {
      ctx.save();
      if(s.type === 'sword'){
        ctx.strokeStyle = 'rgba(56,189,248,0.85)';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 32, s.dir === 1 ? -Math.PI * 0.4 : Math.PI * 0.6, s.dir === 1 ? Math.PI * 0.4 : Math.PI * 1.4);
        ctx.stroke();
      } else if(s.type === 'thunder'){
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(s.x - 65, s.y - 35);
        ctx.lineTo(s.x - 18, s.y + 10);
        ctx.lineTo(s.x + 18, s.y - 18);
        ctx.lineTo(s.x + 65, s.y + 18);
        ctx.stroke();
      } else if(s.type === 'fire'){
        ctx.fillStyle = 'rgba(245,158,11,0.7)';
        ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    enemies.forEach(e => {
      drawStickman(e.x, e.y, e.dir, false, e);
    });

    drawStickman(player.x, player.y, player.dir, true);

    particles.forEach(p => {
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    floatTexts.forEach(f => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.fillStyle = f.col;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText(f.txt, f.x, f.y);
      ctx.restore();
    });

    ctx.save();
    ctx.fillStyle = 'rgba(10,15,24,0.85)';
    ctx.fillRect(10, 10, 110, 10);
    const hpRatio = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hpRatio > 0.4 ? '#10b981' : hpRatio > 0.2 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(10, 10, 110 * hpRatio, 10);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 110, 10);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px system-ui';
    ctx.fillText('HP ' + player.hp + '/' + player.maxHp, 13, 18);

    ctx.fillStyle = 'rgba(10,15,24,0.85)';
    ctx.fillRect(10, 24, 90, 7);
    const mpRatio = Math.max(0, player.mp / player.maxMp);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(10, 24, 90 * mpRatio, 7);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
    ctx.strokeRect(10, 24, 90, 7);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui';
    ctx.fillText('ENERGY ' + Math.floor(player.mp) + '%', 13, 30);

    if(combo > 1){
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'italic 900 16px system-ui, sans-serif';
      ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 10;
      ctx.fillText(combo + ' COMBO! 🔥', W - 110, 24);
    }

    if(gameOver){
      ctx.fillStyle = 'rgba(6,10,18,0.85)';
      ctx.fillRect(0, 90, W, 100);
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
      ctx.strokeRect(0, 90, W, 100);

      ctx.fillStyle = '#ef4444';
      ctx.font = '900 22px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('☠️ PERTARUNGAN SELESAI', W / 2, 128);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 12px system-ui';
      ctx.fillText('Kills: ' + kills + ' • Koin: ' + coins + ' • Wave: ' + wave, W / 2, 150);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText('Ketuk Reset Game untuk bermain lagi', W / 2, 172);
      ctx.textAlign = 'start';
    }
    ctx.restore();
  }

  function loop(){
    update();
    draw();
    requestAnimationFrame(loop);
  }

  resetGame();
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;

async function kirimStickman(conn, chatId, customHtml, title = '🥋 Stickman Shadow Fighter') {
  return kirimForwardSigned(conn, chatId, customHtml || HTML, title);
}

async function handler(m, options = {}) {
  const sock = options?.sock || options?.conn || options?.naze || options;
  const chat = m?.chat || m?.key?.remoteJid;
  if (!chat || !sock) return;

  try {
    await kirimStickman(sock, chat);
  } catch (e) {
    console.error('[STICKMAN ERROR]', e);
    try {
      if (typeof m?.reply === 'function') {
        await m.reply(`❌ Stickman gagal dikirim: ${e?.message || e}`);
      } else if (sock.sendMessage) {
        await sock.sendMessage(chat, { text: `❌ Stickman gagal dikirim: ${e?.message || e}` }, { quoted: m });
      }
    } catch {}
  }
}

export { config, handler, kirimStickman, HTML as STICKMAN_HTML };
export default handler;
