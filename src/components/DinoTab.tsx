import React, { useEffect, useRef, useState } from 'react';
import { Play, Copy, Check, RotateCcw, Heart, Coins, Sparkles, Bot, Volume2, VolumeX, Shield, Award, Terminal } from 'lucide-react';

export const DinoTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Floating Overlay States
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedPay, setCopiedPay] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [endData, setEndData] = useState<{
    title: string;
    story: string;
    score: number;
    coins: number;
    xp: number;
    ending: 'happy' | 'bad' | 'normal';
    code: string;
  }>({
    title: '',
    story: '',
    score: 0,
    coins: 0,
    xp: 0,
    ending: 'normal',
    code: '',
  });

  const [isAutoUnlocked, setIsAutoUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dino_auto_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [autoTokenInput, setAutoTokenInput] = useState<string>('');

  // Game Engine Reference
  const gameRef = useRef<{
    running: boolean;
    autoMode: boolean;
    score: number;
    bestScore: number;
    coins: number;
    xp: number;
    hearts: number;
    speed: number;
    invulnerableTimer: number;
    blinkState: boolean;
    soundOn: boolean;
    dino: {
      x: number;
      y: number;
      w: number;
      h: number;
      vy: number;
      grounded: boolean;
      ducking: boolean;
      legStep: number;
      legTimer: number;
    };
    obstacles: Array<{
      type: 'cactus' | 'bird';
      size?: 'small' | 'large';
      variant?: number;
      x: number;
      y: number;
      w: number;
      h: number;
      wingUp?: boolean;
      wingTimer?: number;
    }>;
    coinList: Array<{ x: number; y: number; collected: boolean }>;
    clouds: Array<{ x: number; y: number; speed: number }>;
    groundBumps: Array<{ x: number; y: number; len: number }>;
    spawnTimer: number;
    lastTime: number;
    lastHundred: number;
    isNight: boolean;
  }>({
    running: false,
    autoMode: false,
    score: 0,
    bestScore: 0,
    coins: 0,
    xp: 0,
    hearts: 4,
    speed: 6.2,
    invulnerableTimer: 0,
    blinkState: true,
    soundOn: true,
    dino: {
      x: 60,
      y: 270 - 48,
      w: 44,
      h: 48,
      vy: 0,
      grounded: true,
      ducking: false,
      legStep: 0,
      legTimer: 0,
    },
    obstacles: [],
    coinList: [],
    clouds: [],
    groundBumps: [],
    spawnTimer: 0,
    lastTime: 0,
    lastHundred: 0,
    isNight: false,
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  // --- Claim Code Generator ---
  function generateClaimCode(scoreVal: number, coinsVal: number, xpVal: number, endingType: 'happy' | 'bad' | 'normal') {
    const ts = Date.now();
    const endCode = endingType === 'happy' ? 'H' : endingType === 'bad' ? 'B' : 'N';
    const salt = 'OGURI_CHROME_DINO_SECRET_SALT_2026';
    const payload = `${scoreVal}:${coinsVal}:${xpVal}:${ts}:${endingType}:${salt}`;
    
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = ((hash << 5) - hash) + payload.charCodeAt(i);
      hash |= 0;
    }
    const sig = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
    return `DN-${scoreVal}-${coinsVal}-${xpVal}-${endCode}-${ts.toString(36).toUpperCase()}-${sig}`;
  }

  // --- Retro Sound Synthesizer ---
  const playTone = (freq: number, dur: number, type: OscillatorType = 'square', vol: number = 0.08) => {
    if (!gameRef.current.soundOn) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  const sndJump = () => playTone(540, 0.1, 'square', 0.07);
  const sndCoin = () => {
    playTone(980, 0.08, 'sine', 0.1);
    setTimeout(() => playTone(1320, 0.12, 'sine', 0.1), 60);
  };
  const sndHurt = () => {
    playTone(180, 0.18, 'sawtooth', 0.12);
    setTimeout(() => playTone(120, 0.22, 'sawtooth', 0.1), 100);
  };
  const sndScore = () => {
    playTone(600, 0.08, 'square', 0.08);
    setTimeout(() => playTone(780, 0.14, 'square', 0.08), 90);
  };
  const sndVictory = () => {
    [523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
      setTimeout(() => playTone(f, 0.2, 'triangle', 0.12), idx * 120);
    });
  };

  // Toggle Sound
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    gameRef.current.soundOn = next;
    showToast(next ? '🔊 Suara Aktif' : '🔇 Suara Senyap');
  };

  // Jump Action
  const jump = () => {
    const g = gameRef.current;
    if (showWelcome) {
      startGame(false);
      return;
    }
    if (showEndModal) {
      startGame(g.autoMode);
      return;
    }
    if (!g.running) {
      startGame(false);
      return;
    }
    if (g.dino.grounded && !g.dino.ducking) {
      g.dino.vy = -12.5;
      g.dino.grounded = false;
      sndJump();
    }
  };

  // Duck Action
  const duck = (isDucking: boolean) => {
    const g = gameRef.current;
    if (!g.running) return;
    g.dino.ducking = isDucking;
    if (isDucking) {
      g.dino.w = 56;
      g.dino.h = 30;
      if (!g.dino.grounded) {
        g.dino.vy += 4.5;
      }
    } else {
      g.dino.w = 44;
      g.dino.h = 48;
    }
  };

  // Start / Restart Game
  const startGame = (asAuto: boolean = false) => {
    if (asAuto && !isAutoUnlocked) {
      showToast('🔒 Mode Auto Terkunci! Bayar 150.000 Koin terlebih dahulu');
      return;
    }

    const g = gameRef.current;
    g.running = true;
    g.autoMode = asAuto;
    g.score = 0;
    g.coins = 0;
    g.xp = 0;
    g.hearts = 4;
    g.speed = 6.2;
    g.invulnerableTimer = 0;
    g.blinkState = true;
    g.spawnTimer = 60;
    g.lastTime = performance.now();
    g.lastHundred = 0;
    g.isNight = false;
    g.obstacles = [];
    g.coinList = [];

    g.dino = {
      x: 60,
      y: 270 - 48,
      w: 44,
      h: 48,
      vy: 0,
      grounded: true,
      ducking: false,
      legStep: 0,
      legTimer: 0,
    };

    // Prepopulate background
    g.clouds = [
      { x: 200, y: 50, speed: 0.8 },
      { x: 500, y: 70, speed: 0.6 },
      { x: 750, y: 40, speed: 0.9 },
    ];
    g.groundBumps = [];
    for (let x = 0; x < 900; x += 18) {
      if (Math.random() < 0.35) {
        g.groundBumps.push({ x, y: 270, len: Math.random() < 0.5 ? 4 : 8 });
      }
    }

    setShowWelcome(false);
    setShowEndModal(false);
    setCopiedCode(false);
    showToast(asAuto ? '🤖 Mode Automatic AI Aktif (Anti Gagal)' : '🎮 Permainan Dimulai! Tekan ✕ untuk Lompat');
  };

  // Trigger Ending & Game Over
  const triggerEnding = (endingType: 'happy' | 'bad' | 'normal') => {
    const g = gameRef.current;
    g.running = false;

    let finalScore = Math.floor(g.score);
    let finalCoins = g.coins;
    let finalXp = g.xp;
    let title = '';
    let story = '';

    if (endingType === 'happy') {
      finalScore = 9999;
      finalCoins += 50;
      finalXp += 250;
      title = '💕 HAPPY ENDING: CINTA SEJATI DI GURUN 🦖🦕';
      story = 'Dino berhasil berlari sejauh 9.999 langkah melintasi rintangan kaktus & pterodactyl! Di ujung cakrawala, Dino bertemu belahan hatinya dan hidup bahagia selamanya.';
      sndVictory();
    } else if (endingType === 'bad') {
      finalScore = Math.max(0, 9999 - 2999);
      finalCoins += 25;
      finalXp += 125;
      title = '💔 BAD ENDING: PATAH HATI (-2.999 Poin) 😭';
      story = 'Dino berhasil menembus 9.999 langkah, namun ternyata kekasih impiannya telah pergi meninggalkannya sendirian di gurun prasejarah yang tandus.';
      sndHurt();
    } else {
      title = '💀 GAME OVER: DINOSAURUS TUMBANG';
      story = `Dino kehabisan 4 darah nyawa setelah menabrak rintangan tajam. Raih kembali fokus dan coba lagi untuk mencapai 9.999 poin!`;
      sndHurt();
    }

    if (finalScore > g.bestScore) {
      g.bestScore = finalScore;
    }

    const code = generateClaimCode(finalScore, finalCoins, finalXp, endingType);

    setEndData({
      title,
      story,
      score: finalScore,
      coins: finalCoins,
      xp: finalXp,
      ending: endingType,
      code,
    });
    setShowEndModal(true);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'arrowup' || k === 'x') {
        e.preventDefault();
        jump();
      } else if (k === 'arrowdown' || k === 'c' || k === 'o') {
        e.preventDefault();
        duck(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowdown' || k === 'c' || k === 'o') {
        duck(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showWelcome, showEndModal]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const g = gameRef.current;
      const W = canvas.width;
      const H = canvas.height;
      const groundY = 270;

      // 1. GAME UPDATE LOGIC
      if (g.running) {
        g.score += 0.15 * (g.speed / 6.0);

        // Day/Night toggle
        g.isNight = Math.floor(g.score / 500) % 2 === 1;

        // Speed ramp
        if (g.speed < 13.5) {
          g.speed += 0.0007;
        }

        // Score 100 milestone beep
        const currentHundred = Math.floor(g.score / 100);
        if (currentHundred > g.lastHundred) {
          g.lastHundred = currentHundred;
          sndScore();
        }

        // Win condition at 9999
        if (g.score >= 9999) {
          const ending = g.hearts >= 3 ? 'happy' : 'bad';
          triggerEnding(ending);
        }

        // Invulnerability Blink Timer
        if (g.invulnerableTimer > 0) {
          g.invulnerableTimer -= 1;
          g.blinkState = Math.floor(g.invulnerableTimer / 5) % 2 === 0;
        } else {
          g.blinkState = true;
        }

        // Dino Physics
        if (!g.dino.grounded) {
          g.dino.vy += 0.65; // gravity
          g.dino.y += g.dino.vy;
          if (g.dino.y >= groundY - g.dino.h) {
            g.dino.y = groundY - g.dino.h;
            g.dino.vy = 0;
            g.dino.grounded = true;
          }
        } else {
          g.dino.legTimer += 1;
          if (g.dino.legTimer > 5) {
            g.dino.legStep = (g.dino.legStep + 1) % 2;
            g.dino.legTimer = 0;
          }
        }

        // Spawn Obstacles & Coins
        g.spawnTimer -= 1;
        if (g.spawnTimer <= 0) {
          const rand = Math.random();
          if (rand < 0.65) {
            // Cactus
            const isLarge = Math.random() < 0.45;
            const cactusW = isLarge ? 26 : 18;
            const cactusH = isLarge ? 48 : 36;
            g.obstacles.push({
              type: 'cactus',
              size: isLarge ? 'large' : 'small',
              x: W + 20,
              y: groundY - cactusH,
              w: cactusW,
              h: cactusH,
            });
          } else {
            // Flying Pterodactyl Bird
            const birdAltitudes = [groundY - 32, groundY - 55, groundY - 80];
            const chosenAlt = birdAltitudes[Math.floor(Math.random() * birdAltitudes.length)];
            g.obstacles.push({
              type: 'bird',
              x: W + 20,
              y: chosenAlt,
              w: 42,
              h: 30,
              wingUp: true,
              wingTimer: 0,
            });
          }

          // Random Coin spawn
          if (Math.random() < 0.35) {
            const coinY = Math.random() < 0.5 ? groundY - 60 : groundY - 30;
            g.coinList.push({ x: W + 120, y: coinY, collected: false });
          }

          // Next spawn interval
          const minGap = Math.max(45, 95 - g.speed * 3.5);
          g.spawnTimer = minGap + Math.floor(Math.random() * 45);
        }

        // AI Auto Mode Controller
        if (g.autoMode) {
          const nearestObs = g.obstacles.find(o => o.x > g.dino.x - 10 && o.x < g.dino.x + 220);
          if (nearestObs) {
            if (nearestObs.type === 'cactus') {
              if (nearestObs.x - (g.dino.x + g.dino.w) < 85 && g.dino.grounded) {
                jump();
              }
            } else if (nearestObs.type === 'bird') {
              if (nearestObs.y >= groundY - 45) {
                // Low bird -> Jump
                if (nearestObs.x - (g.dino.x + g.dino.w) < 85 && g.dino.grounded) {
                  jump();
                }
              } else if (nearestObs.y <= groundY - 50 && nearestObs.y >= groundY - 70) {
                // Mid bird -> Duck
                if (nearestObs.x - (g.dino.x + g.dino.w) < 110) {
                  duck(true);
                }
              }
            }
          } else {
            if (g.dino.ducking) duck(false);
          }
        }

        // Update Obstacles
        for (let i = g.obstacles.length - 1; i >= 0; i--) {
          const obs = g.obstacles[i];
          obs.x -= g.speed;

          if (obs.type === 'bird') {
            obs.wingTimer = (obs.wingTimer || 0) + 1;
            if (obs.wingTimer > 8) {
              obs.wingUp = !obs.wingUp;
              obs.wingTimer = 0;
            }
          }

          // Collision Check
          if (g.invulnerableTimer <= 0) {
            const pad = 6;
            const dBox = {
              x: g.dino.x + pad,
              y: g.dino.y + pad,
              w: g.dino.w - pad * 2,
              h: g.dino.h - pad * 2,
            };
            const oBox = {
              x: obs.x + pad,
              y: obs.y + pad,
              w: obs.w - pad * 2,
              h: obs.h - pad * 2,
            };

            const isColliding =
              dBox.x < oBox.x + oBox.w &&
              dBox.x + dBox.w > oBox.x &&
              dBox.y < oBox.y + oBox.h &&
              dBox.y + dBox.h > oBox.y;

            if (isColliding) {
              g.hearts -= 1;
              sndHurt();
              g.invulnerableTimer = 60; // 1 second invulnerability
              if (g.hearts <= 0) {
                triggerEnding('normal');
                break;
              }
            }
          }

          if (obs.x < -60) {
            g.obstacles.splice(i, 1);
          }
        }

        // Update Coins
        for (let i = g.coinList.length - 1; i >= 0; i--) {
          const c = g.coinList[i];
          c.x -= g.speed;

          if (!c.collected) {
            const dist = Math.hypot(g.dino.x + g.dino.w / 2 - c.x, g.dino.y + g.dino.h / 2 - c.y);
            if (dist < 32) {
              c.collected = true;
              g.coins += 1;
              g.xp += 5;
              sndCoin();
            }
          }

          if (c.x < -30) {
            g.coinList.splice(i, 1);
          }
        }

        // Update Clouds & Ground
        g.clouds.forEach(c => {
          c.x -= c.speed;
          if (c.x < -80) c.x = W + 40;
        });
        g.groundBumps.forEach(b => {
          b.x -= g.speed;
          if (b.x < -20) b.x = W + Math.random() * 20;
        });
      }

      // 2. CANVAS DRAWING
      const bgColor = g.isNight ? '#121418' : '#f7f9fa';
      const fgColor = g.isNight ? '#e2e8f0' : '#475569';
      const groundColor = g.isNight ? '#334155' : '#94a3b8';

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      // Night Stars
      if (g.isNight) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 24; i++) {
          const sx = (i * 37) % W;
          const sy = (i * 23) % 110;
          ctx.fillRect(sx, sy, 2, 2);
        }
      }

      // Clouds
      ctx.fillStyle = g.isNight ? '#2d3748' : '#cbd5e1';
      g.clouds.forEach(c => {
        ctx.fillRect(c.x, c.y, 48, 12);
        ctx.fillRect(c.x + 8, c.y - 6, 32, 6);
        ctx.fillRect(c.x + 16, c.y + 12, 16, 4);
      });

      // Ground Line & Bumps
      ctx.fillStyle = groundColor;
      ctx.fillRect(0, groundY, W, 2);
      g.groundBumps.forEach(b => {
        ctx.fillRect(b.x, b.y + 3, b.len, 2);
        ctx.fillRect(b.x + 2, b.y + 7, b.len / 2, 2);
      });

      // Draw Coins
      g.coinList.forEach(c => {
        if (!c.collected) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#b45309';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('$', c.x - 3, c.y + 3);
        }
      });

      // Draw Obstacles
      g.obstacles.forEach(obs => {
        ctx.fillStyle = fgColor;
        if (obs.type === 'cactus') {
          // Authentic Pixel Cactus
          const ox = obs.x;
          const oy = obs.y;
          const ow = obs.w;
          const oh = obs.h;
          // Main Stem
          ctx.fillRect(ox + ow * 0.35, oy, ow * 0.3, oh);
          // Left Arm
          ctx.fillRect(ox, oy + oh * 0.3, ow * 0.35, 6);
          ctx.fillRect(ox, oy + oh * 0.15, ow * 0.2, oh * 0.2);
          // Right Arm
          ctx.fillRect(ox + ow * 0.65, oy + oh * 0.45, ow * 0.35, 6);
          ctx.fillRect(ox + ow * 0.8, oy + oh * 0.3, ow * 0.2, oh * 0.2);
        } else if (obs.type === 'bird') {
          // Pterodactyl Bird
          const bx = obs.x;
          const by = obs.y;
          // Body
          ctx.fillRect(bx + 10, by + 12, 22, 8);
          // Head & Beak
          ctx.fillRect(bx, by + 10, 10, 6);
          ctx.fillRect(bx - 6, by + 12, 6, 2);
          // Wing (Flapping)
          if (obs.wingUp) {
            ctx.fillRect(bx + 14, by - 4, 8, 16);
            ctx.fillRect(bx + 18, by - 8, 4, 8);
          } else {
            ctx.fillRect(bx + 14, by + 18, 8, 14);
            ctx.fillRect(bx + 18, by + 24, 4, 8);
          }
        }
      });

      // Draw Dino (With Invincible Blink)
      if (g.blinkState) {
        ctx.fillStyle = fgColor;
        const dx = g.dino.x;
        const dy = g.dino.y;

        if (g.dino.ducking) {
          // Ducking Sprite (Low Profile)
          ctx.fillRect(dx + 12, dy + 6, 36, 16); // Body
          ctx.fillRect(dx + 38, dy + 2, 18, 14); // Head
          ctx.fillStyle = bgColor;
          ctx.fillRect(dx + 48, dy + 6, 4, 4);   // Eye
          ctx.fillStyle = fgColor;
          ctx.fillRect(dx + 52, dy + 10, 6, 4);  // Mouth
          // Legs
          if (g.dino.legStep === 0) {
            ctx.fillRect(dx + 18, dy + 22, 6, 8);
            ctx.fillRect(dx + 34, dy + 22, 6, 4);
          } else {
            ctx.fillRect(dx + 18, dy + 22, 6, 4);
            ctx.fillRect(dx + 34, dy + 22, 6, 8);
          }
        } else {
          // Standing / Running Dino
          // Head
          ctx.fillRect(dx + 22, dy, 22, 16);
          ctx.fillRect(dx + 34, dy + 16, 10, 4);
          // Eye (Negative space)
          ctx.fillStyle = bgColor;
          ctx.fillRect(dx + 26, dy + 4, 4, 4);
          ctx.fillStyle = fgColor;
          // Body & Tail
          ctx.fillRect(dx + 8, dy + 16, 20, 20);
          ctx.fillRect(dx, dy + 18, 8, 12);
          ctx.fillRect(dx - 4, dy + 20, 4, 6);
          // Tiny Arms
          ctx.fillRect(dx + 28, dy + 22, 6, 4);
          // Running Legs
          if (!g.dino.grounded) {
            ctx.fillRect(dx + 12, dy + 36, 4, 10);
            ctx.fillRect(dx + 22, dy + 36, 4, 6);
          } else if (g.dino.legStep === 0) {
            ctx.fillRect(dx + 12, dy + 36, 4, 12);
            ctx.fillRect(dx + 12, dy + 46, 6, 2);
            ctx.fillRect(dx + 22, dy + 36, 4, 6);
          } else {
            ctx.fillRect(dx + 12, dy + 36, 4, 6);
            ctx.fillRect(dx + 22, dy + 36, 4, 12);
            ctx.fillRect(dx + 22, dy + 46, 6, 2);
          }
        }
      }

      // Top HUD
      ctx.fillStyle = fgColor;
      ctx.font = 'bold 13px "Courier New", Courier, monospace';
      const scoreStr = ('00000' + Math.floor(g.score)).slice(-5);
      const hiStr = ('00000' + Math.floor(g.bestScore)).slice(-5);
      const fullText = `HI ${hiStr}  ${scoreStr}`;
      const tw = ctx.measureText(fullText).width;
      ctx.fillText(fullText, W - tw - 16, 26);

      // Hearts Display
      let heartStr = '';
      for (let h = 0; h < 4; h++) heartStr += h < g.hearts ? '❤️' : '🖤';
      ctx.font = '14px sans-serif';
      ctx.fillText(heartStr, 18, 25);

      // Coins & XP
      ctx.font = 'bold 12px "Courier New", Courier, monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`🪙 ${g.coins}`, 130, 25);
      ctx.fillStyle = '#06b6d4';
      ctx.fillText(`⭐ ${g.xp} XP`, 205, 25);

      if (g.autoMode) {
        ctx.fillStyle = '#10b981';
        ctx.fillText('[🤖 AUTO AI]', 290, 25);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Copy payment text
  const handleCopyPayment = () => {
    navigator.clipboard.writeText('.bayardinoauto');
    setCopiedPay(true);
    showToast('📋 Perintah .bayardinoauto disalin! Kirim ke bot WhatsApp.');
    setTimeout(() => setCopiedPay(false), 2000);
  };

  // Copy Claim Code
  const handleCopyClaimCode = () => {
    if (!endData.code) return;
    navigator.clipboard.writeText(endData.code);
    setCopiedCode(true);
    showToast('📋 Kode klaim disalin! Kirim ke bot WhatsApp.');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Activate Token
  const handleActivateToken = () => {
    if (!autoTokenInput.trim()) {
      showToast('Masukkan Token atau No WA Anda');
      return;
    }
    setIsAutoUnlocked(true);
    try {
      localStorage.setItem('dino_auto_unlocked', 'true');
    } catch {}
    showToast('✅ Mode Automatic Berhasil Diaktifkan!');
  };

  return (
    <div className="w-full max-w-[420px] mx-auto px-2 py-3">
      {/* 9:16 VERTICAL HANDHELD PSP CONSOLE CHASSIS */}
      <div className="bg-gradient-to-b from-[#1c212d] via-[#12151d] to-[#0c0e14] border-[3px] border-[#2a3142] rounded-[28px] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.85)] relative ring-1 ring-slate-600/30 flex flex-col gap-2">
        
        {/* Top PSP Shoulder Buttons ( [ L ] and [ R ] ) */}
        <div className="flex justify-between items-center px-2">
          <button
            onClick={() => {
              if (isAutoUnlocked) {
                gameRef.current.autoMode = !gameRef.current.autoMode;
                showToast(gameRef.current.autoMode ? '🤖 Mode Auto AI DIAKTIFKAN' : '👤 Mode Manual DIAKTIFKAN');
              } else {
                showToast('🔒 Mode Auto terkunci! Bayar 150rb koin');
              }
            }}
            className="px-3.5 py-1 bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 active:from-cyan-500 active:to-cyan-700 text-slate-300 active:text-black font-black text-[10px] rounded-t-lg border-t border-x border-slate-500/60 shadow-md transition-all cursor-pointer"
          >
            [ L ] • {gameRef.current.autoMode ? 'AUTO ON' : 'AUTO AI'}
          </button>

          {/* PSP Top Bezel Status Indicator */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="text-cyan-400 font-bold">SONY PSP™</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">🔋100%</span>
          </div>

          <button
            onClick={jump}
            className="px-3.5 py-1 bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 active:from-cyan-500 active:to-cyan-700 text-slate-300 active:text-black font-black text-[10px] rounded-t-lg border-t border-x border-slate-500/60 shadow-md transition-all cursor-pointer"
          >
            [ R ] • JUMP
          </button>
        </div>

        {/* CENTER: Screen Housing with Canvas & Floating Panel */}
        <div className="bg-[#050608] border-[2.5px] border-[#282f3d] rounded-2xl overflow-hidden shadow-[inset_0_3px_10px_rgba(0,0,0,0.9),0_4px_12px_rgba(0,0,0,0.4)] relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={420}
            onClick={jump}
            className="w-full h-auto aspect-[16/9.5] block cursor-pointer select-none object-cover"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* ========================================================= */}
          {/* FLOATING WELCOME PANEL (MENGAMBANG DI ATAS LAYAR) */}
          {/* ========================================================= */}
          {showWelcome && (
            <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 animate-in fade-in duration-200">
              <div className="bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-cyan-400 rounded-2xl max-w-xs w-full p-3 shadow-[0_15px_40px_rgba(0,229,255,0.35)] text-white space-y-2 text-center">
                
                {/* Header */}
                <div>
                  <div className="text-xl animate-bounce leading-none">🦖</div>
                  <h3 className="text-xs font-black text-cyan-400 tracking-wide mt-1 uppercase">
                    Chrome Dino PSP Edition
                  </h3>
                </div>

                {/* Features Badges Row */}
                <div className="grid grid-cols-3 gap-1 py-0.5">
                  <div className="bg-black/60 border border-slate-800 rounded-lg p-1 text-[9px] font-bold text-slate-300">
                    ❤️ 4 Hearts
                  </div>
                  <div className="bg-black/60 border border-slate-800 rounded-lg p-1 text-[9px] font-bold text-amber-400">
                    🪙 +Koin/XP
                  </div>
                  <div className="bg-black/60 border border-slate-800 rounded-lg p-1 text-[9px] font-bold text-cyan-300">
                    🏆 9999 Win
                  </div>
                </div>

                {/* Prominent Play Now Button */}
                <button
                  onClick={() => startGame(false)}
                  type="button"
                  className="w-full py-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-black text-xs rounded-xl shadow-[0_4px_16px_rgba(0,229,255,0.4)] transition-all flex items-center justify-center gap-1.5 tracking-wider active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>MAINKAN SEKARANG (✕)</span>
                </button>

                {/* Mini Auto AI Section */}
                <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-xl p-1.5 space-y-1 text-left">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-cyan-300 flex items-center gap-1">
                      <Bot className="w-3 h-3" /> Auto AI
                    </span>
                    <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full ${isAutoUnlocked ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-rose-950 text-rose-300 border border-rose-500'}`}>
                      {isAutoUnlocked ? '✅ AKTIF' : '🔒 150rb Koin'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-black/80 border border-slate-800 rounded-lg px-2 py-0.5">
                    <code className="text-[9.5px] font-mono font-bold text-cyan-300 flex-1">
                      .bayardinoauto
                    </code>
                    <button
                      onClick={handleCopyPayment}
                      type="button"
                      className="px-2 py-0.5 text-[8.5px] font-bold bg-cyan-500 text-black rounded hover:bg-cyan-400 transition-colors"
                    >
                      {copiedPay ? 'Tersalin' : 'Salin'}
                    </button>
                  </div>

                  {!isAutoUnlocked ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={autoTokenInput}
                        onChange={(e) => setAutoTokenInput(e.target.value)}
                        placeholder="No WA / Token"
                        className="flex-1 px-2 py-0.5 text-[9px] rounded border border-slate-700 bg-black text-white"
                      />
                      <button
                        onClick={handleActivateToken}
                        type="button"
                        className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500 hover:bg-emerald-400 text-black rounded transition-colors"
                      >
                        Aktifkan
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startGame(true)}
                      type="button"
                      className="w-full py-0.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[9.5px] font-black rounded-lg transition-all shadow-md"
                    >
                      🤖 MAINKAN MODE AUTO
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* FLOATING VICTORY & GAME OVER PANEL */}
          {/* ========================================================= */}
          {showEndModal && (
            <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 animate-in fade-in duration-200">
              <div className="bg-slate-900 border-2 border-cyan-400 rounded-2xl max-w-xs w-full p-3 shadow-[0_15px_40px_rgba(0,229,255,0.3)] text-center space-y-2 text-white">
                <div className="text-2xl">
                  {endData.ending === 'happy' ? '💕🦖❤️' : endData.ending === 'bad' ? '💔😭' : '💀'}
                </div>
                <h3 className={`text-xs font-black ${endData.ending === 'happy' ? 'text-rose-400' : endData.ending === 'bad' ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {endData.title}
                </h3>
                <p className="text-[9.5px] text-slate-300 leading-tight">
                  {endData.story}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-1 bg-black/60 p-1.5 rounded-xl border border-slate-800">
                  <div>
                    <div className="text-xs font-black text-white">{endData.score}</div>
                    <div className="text-[8px] text-slate-400">SKOR</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-amber-400">+{endData.coins}</div>
                    <div className="text-[8px] text-slate-400">KOIN</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-cyan-400">+{endData.xp}</div>
                    <div className="text-[8px] text-slate-400">XP</div>
                  </div>
                </div>

                {/* Claim Code Box */}
                <div className="bg-black/70 p-1.5 rounded-xl border border-dashed border-cyan-500 space-y-1">
                  <div className="text-[8px] font-bold text-slate-400">
                    KODE KLAIM (.klaimdino &lt;kode&gt;):
                  </div>
                  <div className="font-mono text-[9.5px] font-black text-cyan-300 break-all select-all">
                    {endData.code}
                  </div>
                  <button
                    onClick={handleCopyClaimCode}
                    type="button"
                    className="w-full py-1 bg-cyan-500 hover:bg-cyan-400 text-black text-[9.5px] font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Tersalin!' : 'Salin Kode Klaim'}</span>
                  </button>
                </div>

                <button
                  onClick={() => startGame(gameRef.current.autoMode)}
                  type="button"
                  className="w-full py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-xs rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>ULANGI (△)</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ========================================================= */}
        {/* FULL PHYSICAL PSP CONTROLLER SECTION (LOWER HALF OF 9:16) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-[105px_1fr_105px] gap-2 items-center pt-1 px-1">
          
          {/* LEFT: Directional D-PAD & Analog Stick */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-22 h-22">
              {/* Up */}
              <button
                onClick={jump}
                className="absolute top-0 left-7 w-8 h-8 bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-black rounded-t-lg border border-slate-600 flex items-center justify-center text-xs font-black text-slate-300 shadow-md transition-all cursor-pointer"
              >
                ▲
              </button>
              {/* Left */}
              <button
                onClick={jump}
                className="absolute top-7 left-0 w-8 h-8 bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-black rounded-l-lg border border-slate-600 flex items-center justify-center text-xs font-black text-slate-300 shadow-md transition-all cursor-pointer"
              >
                ◀
              </button>
              {/* Center */}
              <div className="absolute top-7 left-7 w-8 h-8 bg-slate-900 border-slate-700" />
              {/* Right */}
              <button
                onClick={jump}
                className="absolute top-7 right-0 w-8 h-8 bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-black rounded-r-lg border border-slate-600 flex items-center justify-center text-xs font-black text-slate-300 shadow-md transition-all cursor-pointer"
              >
                ▶
              </button>
              {/* Down (Duck) */}
              <button
                onMouseDown={() => duck(true)}
                onMouseUp={() => duck(false)}
                onTouchStart={(e) => { e.preventDefault(); duck(true); }}
                onTouchEnd={(e) => { e.preventDefault(); duck(false); }}
                className="absolute bottom-0 left-7 w-8 h-8 bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-black rounded-b-lg border border-slate-600 flex items-center justify-center text-xs font-black text-slate-300 shadow-md transition-all cursor-pointer"
              >
                ▼
              </button>
            </div>

            {/* PSP Analog Thumbstick */}
            <div
              onClick={jump}
              title="Analog Stick (Klik untuk Lompat)"
              className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 border-2 border-slate-600 shadow-[inset_0_3px_6px_rgba(0,0,0,0.8)] cursor-pointer active:scale-95 transition-transform flex items-center justify-center"
            >
              <div className="w-5 h-5 rounded-full border border-dashed border-slate-500/60" />
            </div>
          </div>

          {/* CENTER: System Buttons & Quick Auto Toggle */}
          <div className="flex flex-col items-center justify-center gap-1.5">
            <button
              onClick={() => {
                if (isAutoUnlocked) {
                  gameRef.current.autoMode = !gameRef.current.autoMode;
                  showToast(gameRef.current.autoMode ? '🤖 Mode Auto AI DIAKTIFKAN' : '👤 Mode Manual DIAKTIFKAN');
                } else {
                  showToast('🔒 Mode Auto terkunci! Bayar 150rb koin');
                }
              }}
              className="w-full py-1.5 bg-gradient-to-b from-[#19382b] to-[#0f241c] border border-emerald-500 text-emerald-400 hover:text-emerald-300 font-black text-[10px] rounded-lg shadow transition-all cursor-pointer"
            >
              🤖 MODE AUTO
            </button>

            <div className="grid grid-cols-2 gap-1 w-full text-[8.5px]">
              <button
                onClick={() => setShowWelcome(true)}
                className="py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 font-bold rounded cursor-pointer"
              >
                ⌂ HOME
              </button>
              <button
                onClick={toggleSound}
                className="py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 font-bold rounded cursor-pointer flex items-center justify-center gap-1"
              >
                {soundEnabled ? <Volume2 className="w-2.5 h-2.5 text-cyan-400" /> : <VolumeX className="w-2.5 h-2.5 text-rose-400" />}
                <span>VOL</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 w-full text-[8.5px]">
              <button
                onClick={() => setShowWelcome(true)}
                className="py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 font-bold rounded cursor-pointer"
              >
                SELECT
              </button>
              <button
                onClick={() => startGame(false)}
                className="py-1 bg-slate-800/80 hover:bg-slate-700 border border-cyan-500/60 text-cyan-300 font-black rounded cursor-pointer"
              >
                START
              </button>
            </div>
          </div>

          {/* RIGHT: Sony PlayStation Iconic Action Buttons (△ ◯ ✕ ▢) */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-22 h-22">
              {/* △ (Triangle - Restart / Info) */}
              <button
                onClick={() => {
                  if (showEndModal) startGame(gameRef.current.autoMode);
                  else setShowWelcome(true);
                }}
                className="absolute top-0 left-7 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 border-2 border-emerald-500 text-emerald-400 font-black text-xs flex items-center justify-center shadow-lg transition-transform cursor-pointer"
                title="Triangle: Menu / Ulangi"
              >
                △
              </button>

              {/* ◯ (Circle - Duck / Merunduk) */}
              <button
                onMouseDown={() => duck(true)}
                onMouseUp={() => duck(false)}
                onTouchStart={(e) => { e.preventDefault(); duck(true); }}
                onTouchEnd={(e) => { e.preventDefault(); duck(false); }}
                className="absolute top-7 right-0 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 border-2 border-rose-500 text-rose-400 font-black text-xs flex items-center justify-center shadow-lg transition-transform cursor-pointer"
                title="Circle: Merunduk"
              >
                ○
              </button>

              {/* ✕ (Cross - Jump / Play) */}
              <button
                onClick={jump}
                className="absolute bottom-0 left-7 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 border-2 border-cyan-500 text-cyan-400 font-black text-xs flex items-center justify-center shadow-lg transition-transform cursor-pointer"
                title="Cross: Lompat / Mulai"
              >
                ✕
              </button>

              {/* ▢ (Square - Sound toggle) */}
              <button
                onClick={toggleSound}
                className="absolute top-7 left-0 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 border-2 border-pink-500 text-pink-400 font-black text-xs flex items-center justify-center shadow-lg transition-transform cursor-pointer"
                title="Square: Suara"
              >
                □
              </button>
            </div>

            <span className="text-[9px] font-bold text-slate-500">ACTION</span>
          </div>

        </div>

      </div>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-cyan-400 text-cyan-300 text-xs font-bold px-4 py-2 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
