import { randomUUID } from 'crypto'
import { getTopLeaderboard, generateClaimCode } from './tebakbomData.js'

const SIG = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YcN55YRyad2+ZA=="
const CERT1 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg"
const CERT2 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZlXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYvNBkuLoZnQAq4j8yRekrQ=="

function buildTebakBomHTML(top3Players = []) {
	const safeTop3Json = JSON.stringify(top3Players).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

	let lbPreRendered = ''
	if (!top3Players || top3Players.length === 0) {
		lbPreRendered = '<div style="font-size:9px;color:#64748b;text-align:center;padding:4px">Belum ada skor. Main & klaim kodemu!</div>'
	} else {
		top3Players.slice(0, 3).forEach((p, i) => {
			const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : '🥉')
			const cleanPhone = (p.id || '').split('@')[0]
			const name = p.name && p.name !== 'Player' && p.name !== cleanPhone ? p.name : cleanPhone
			const scoreStr = Number(p.score || 0).toLocaleString('id-ID')
			lbPreRendered += `<div class="lb-row" style="display:flex;justify-content:space-between;align-items:center;font-size:10px;background:rgba(0,0,0,0.4);padding:4px 8px;border-radius:6px;margin-bottom:3px;"><span class="u-name" style="color:#f1f5f9;font-weight:700;">${medal} ${name}</span><span class="u-score" style="color:#00d9ff;font-weight:900;">${scoreStr} PTS</span></div>`
		})
	}
	
	return `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
html,body{width:100%;height:100%;background:#060b18;color:#f1f5f9;margin:0;padding:0;overflow-x:hidden;overflow-y:auto}
body{padding:12px 8px}
#app-container{width:100%;max-width:380px;margin:0 auto;background:linear-gradient(165deg,#0e1a30,#081122 60%,#040914);border:2px solid #00d9ff;border-radius:16px;box-shadow:0 0 22px rgba(0,217,255,0.3);padding:12px;position:relative}
.hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid rgba(0,217,255,0.2);margin-bottom:8px}
.title-box h1{font-size:16px;font-weight:900;letter-spacing:0.5px;color:#00d9ff;text-shadow:0 0 10px rgba(0,217,255,0.7);line-height:1.1}
.title-box span{font-size:8px;font-weight:700;letter-spacing:1px;color:#ff4757;text-transform:uppercase}
.score-pill{background:rgba(0,0,0,0.6);border:1px solid #00d9ff;border-radius:10px;padding:3px 10px;text-align:right}
.score-pill small{display:block;font-size:7px;color:#94a3b8;font-weight:700;letter-spacing:0.5px}
.score-pill b{font-size:14px;color:#ffd700;font-weight:900;text-shadow:0 0 8px rgba(255,215,0,0.6)}
.deck-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;min-height:184px;margin:4px 0}
.card{position:relative;width:100%;height:88px;cursor:pointer;border-radius:10px}
.card-face{width:100%;height:100%;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.5)}
.card-back{background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid rgba(0,217,255,0.45);color:#00d9ff}
.card-back:hover{border-color:#00d9ff;box-shadow:0 0 12px rgba(0,217,255,0.5)}
.card-front{border:2px solid rgba(255,255,255,0.2);display:none;z-index:1}
.card.flipped .card-back{display:none}
.card.flipped .card-front{display:flex}
.card-front.safe{background:radial-gradient(circle,#052e16,#022c22);border-color:#22c55e;box-shadow:0 0 14px rgba(34,197,94,0.5)}
.card-front.bomb{background:radial-gradient(circle,#450a0a,#1c0404);border-color:#ef4444;box-shadow:0 0 16px rgba(239,68,68,0.8)}
.card-icon{font-size:24px;margin-bottom:2px}
.card-val{font-size:11px;font-weight:900;letter-spacing:0.5px}
.card-front.safe .card-val{color:#4ade80}
.card-front.bomb .card-val{color:#f87171}
.action-bar{display:flex;gap:6px;margin:8px 0}
.btn{flex:1;padding:8px 10px;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;border:none;transition:all 0.15s ease}
.btn-reset{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#cbd5e1}
.btn-reset:active{background:rgba(255,255,255,0.2)}
.btn-claim{background:linear-gradient(135deg,#eab308,#ca8a04);color:#1e1b4b;box-shadow:0 0 10px rgba(234,179,8,0.4)}
.btn-claim:active{transform:scale(0.97)}
.lb-box{background:rgba(15,23,42,0.8);border:1px solid rgba(0,217,255,0.2);border-radius:10px;padding:6px 10px;margin-bottom:6px}
.lb-hdr{display:flex;justify-content:space-between;align-items:center;font-size:9px;font-weight:800;color:#94a3b8;margin-bottom:4px;letter-spacing:0.5px}
.lb-list{display:flex;flex-direction:column;gap:3px}
.lb-row{display:flex;justify-content:space-between;align-items:center;font-size:9px;background:rgba(0,0,0,0.35);padding:4px 8px;border-radius:6px}
.lb-row .u-name{color:#f1f5f9;font-weight:700;display:flex;align-items:center;gap:4px}
.lb-row .u-score{color:#00d9ff;font-weight:900}
.modal{position:absolute;inset:0;background:rgba(2,6,23,0.94);backdrop-filter:blur(6px);display:none;flex-direction:column;align-items:center;justify-content:center;padding:16px;text-align:center;z-index:20;border-radius:16px}
.modal.show{display:flex}
.modal h2{font-size:16px;color:#ffd700;margin-bottom:6px;font-weight:900}
.modal p{font-size:10px;color:#94a3b8;line-height:1.4;margin-bottom:10px}
.code-box{background:#0f172a;border:2px dashed #00d9ff;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:900;color:#00d9ff;letter-spacing:1px;margin-bottom:12px;word-break:break-all}
.shake{animation:shakeAnim 0.4s cubic-bezier(.36,.07,.19,.97) both}
@keyframes shakeAnim{10%,90%{transform:translate3d(-2px,0,0)}20%,80%{transform:translate3d(3px,0,0)}30%,50%,70%{transform:translate3d(-5px,0,0)}40%,60%{transform:translate3d(5px,0,0)}}
</style>
<div id="app-container">
  <div class="hdr">
    <div class="title-box">
      <h1>💣 TEBAK BOM</h1>
      <span>4 AMAN • 2 BOM</span>
    </div>
    <div class="score-pill">
      <small>SCORE</small>
      <b id="sc-val">0</b>
    </div>
  </div>
  
  <div class="deck-grid" id="card-deck">
    <div class="card" id="card-0"><div class="card-face card-back"><div class="card-icon" style="font-size:26px;filter:drop-shadow(0 0 6px #00d9ff)">❓</div><div class="card-val" style="color:#00d9ff">TEBAK</div></div><div class="card-face card-front safe"><div class="card-icon">💎</div><div class="card-val">+100</div></div></div>
    <div class="card" id="card-1"><div class="card-face card-back"><div class="card-icon" style="font-size:26px;filter:drop-shadow(0 0 6px #00d9ff)">❓</div><div class="card-val" style="color:#00d9ff">TEBAK</div></div><div class="card-face card-front safe"><div class="card-icon">💎</div><div class="card-val">+250</div></div></div>
    <div class="card" id="card-2"><div class="card-face card-back"><div class="card-icon" style="font-size:26px;filter:drop-shadow(0 0 6px #00d9ff)">❓</div><div class="card-val" style="color:#00d9ff">TEBAK</div></div><div class="card-face card-front safe"><div class="card-icon">💎</div><div class="card-val">+500</div></div></div>
    <div class="card" id="card-3"><div class="card-face card-back"><div class="card-icon" style="font-size:26px;filter:drop-shadow(0 0 6px #00d9ff)">❓</div><div class="card-val" style="color:#00d9ff">TEBAK</div></div><div class="card-face card-front safe"><div class="card-icon">💎</div><div class="card-val">+1000</div></div></div>
    <div class="card" id="card-4"><div class="card-face card-back"><div class="card-icon" style="font-size:26px;filter:drop-shadow(0 0 6px #00d9ff)">❓</div><div class="card-val" style="color:#00d9ff">TEBAK</div></div><div class="card-face card-front bomb"><div class="card-icon">💣</div><div class="card-val">BOM!</div></div></div>
    <div class="card" id="card-5"><div class="card-face card-back"><div class="card-icon" style="font-size:26px;filter:drop-shadow(0 0 6px #00d9ff)">❓</div><div class="card-val" style="color:#00d9ff">TEBAK</div></div><div class="card-face card-front bomb"><div class="card-icon">💣</div><div class="card-val">BOM!</div></div></div>
  </div>
  
  <div class="action-bar">
    <button class="btn btn-reset" onclick="initGame()">🔄 Ronde Baru</button>
    <button class="btn btn-claim" id="claim-btn" onclick="openClaimModal()">🎁 KLAIM REWARD</button>
  </div>
  
  <div class="lb-box">
    <div class="lb-hdr">
      <span>🏆 TOP 3 LEADERBOARD</span>
      <span style="color:#38bdf8">.claimr</span>
    </div>
    <div class="lb-list" id="lb-entries">${lbPreRendered}</div>
  </div>

  <div class="modal" id="claim-modal">
    <h2 id="modal-title">🎉 KODE KLAIM KAMU</h2>
    <p id="modal-desc">Salin kode di bawah dan ketik di chat WhatsApp untuk klaim saldo Money, Exp & catat peringkatmu!</p>
    <div class="code-box" id="modal-code">TB-0-XXXX</div>
    <button class="btn btn-claim" style="width:100%;margin-bottom:6px" onclick="copyCode()">📋 Salin Perintah (.claimr)</button>
    <button class="btn btn-reset" style="width:100%" onclick="closeClaimModal()">Tutup</button>
  </div>
</div>

<script>
(function(){
  var currentScore = 0;
  var safeFound = 0;
  var gameOver = false;
  var cards = [];
  var generatedCode = '';
  var audioCtx = null;

  function getAC() {
    if (!audioCtx) {
      try {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) audioCtx = new C();
      } catch(e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch(e) {}
    }
    return audioCtx;
  }

  /* ================== SUARA LEDAKAN BOM & SFX ================== */
  function playExplosionSound() {
    var a = getAC();
    if (!a) return;
    try {
      var t = a.currentTime;
      var dur = 0.8;
      var len = Math.floor(a.sampleRate * dur);
      var buf = a.createBuffer(1, len, a.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
      
      var noiseSrc = a.createBufferSource();
      noiseSrc.buffer = buf;
      
      var filter = a.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(40, t + dur);
      
      var gain = a.createGain();
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      
      noiseSrc.connect(filter);
      filter.connect(gain);
      gain.connect(a.destination);
      noiseSrc.start(t);
      noiseSrc.stop(t + dur);

      var osc = a.createOscillator();
      var oscGain = a.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.6);
      oscGain.gain.setValueAtTime(0.4, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(oscGain);
      oscGain.connect(a.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    } catch(e){}
  }

  function playSafeSound(combo) {
    var a = getAC();
    if (!a) return;
    try {
      var t = a.currentTime;
      var freqs = [523, 659, 784, 1046, 1318];
      var baseFreq = freqs[Math.min(combo, freqs.length - 1)];
      
      var osc = a.createOscillator();
      var g = a.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.15);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g);
      g.connect(a.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch(e){}
  }

  function playWinSound() {
    var a = getAC();
    if (!a) return;
    try {
      var t = a.currentTime;
      [523, 659, 784, 1046].forEach(function(f, i){
        var osc = a.createOscillator();
        var g = a.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t + (i * 0.08));
        g.gain.setValueAtTime(0.1, t + (i * 0.08));
        g.gain.exponentialRampToValueAtTime(0.001, t + (i * 0.08) + 0.25);
        osc.connect(g);
        g.connect(a.destination);
        osc.start(t + (i * 0.08));
        osc.stop(t + (i * 0.08) + 0.28);
      });
    } catch(e){}
  }

  /* ================== GAME LOGIC ================== */
  function initGame() {
    gameOver = false;
    safeFound = 0;
    var deckEl = document.getElementById('card-deck');
    if (!deckEl) return;
    
    cards = [
      { id: 0, isBomb: false, pts: 100, flipped: false },
      { id: 1, isBomb: false, pts: 250, flipped: false },
      { id: 2, isBomb: false, pts: 500, flipped: false },
      { id: 3, isBomb: false, pts: 1000, flipped: false },
      { id: 4, isBomb: true, pts: 0, flipped: false },
      { id: 5, isBomb: true, pts: 0, flipped: false }
    ];
    
    // Acak Kartu
    cards.sort(function(){ return Math.random() - 0.5; });

    // Update elemen DOM yang sudah ada, jangan hancurkan agar transisi aman
    cards.forEach(function(c, idx){
      var cardDiv = document.getElementById('card-' + idx);
      if (!cardDiv) return;
      
      cardDiv.className = 'card'; // reset class
      
      var frontFace = cardDiv.querySelector('.card-front');
      if (frontFace) {
        frontFace.className = 'card-face card-front ' + (c.isBomb ? 'bomb' : 'safe');
        frontFace.innerHTML = c.isBomb 
          ? '<div class="card-icon">💣</div><div class="card-val">BOM!</div>' 
          : '<div class="card-icon">💎</div><div class="card-val">+' + c.pts + '</div>';
      }
      
      cardDiv.onclick = function(){ pickCard(idx); };
    });

    updateUI();
  }

  function pickCard(idx) {
    if (gameOver || cards[idx].flipped) return;
    cards[idx].flipped = true;
    
    var cardEl = document.getElementById('card-' + idx);
    if (cardEl) cardEl.classList.add('flipped');

    var c = cards[idx];
    if (c.isBomb) {
      // Kena Bom!
      playExplosionSound();
      var app = document.getElementById('app-container');
      if (app) {
        app.classList.remove('shake');
        void app.offsetWidth;
        app.classList.add('shake');
      }
      
      // Poin turun 1.5x lipat
      currentScore = Math.floor(currentScore / 1.5);
      updateUI();
      
      // Buka semua kartu
      setTimeout(function(){
        revealAll();
      }, 500);
    } else {
      // Aman!
      safeFound++;
      currentScore += c.pts;
      playSafeSound(safeFound);
      updateUI();

      if (safeFound >= 4) {
        // Menang! Semua 4 kartu aman ditemukan!
        gameOver = true;
        playWinSound();
        setTimeout(function(){
          revealAll();
          openClaimModal();
        }, 600);
      }
    }
  }

  function revealAll() {
    cards.forEach(function(c, idx){
      var el = document.getElementById('card-' + idx);
      if (el && !c.flipped) {
        c.flipped = true;
        el.classList.add('flipped');
      }
    });
  }

  function updateUI() {
    var scEl = document.getElementById('sc-val');
    if (scEl) scEl.textContent = currentScore.toLocaleString('id-ID');
  }

  function makeClaimCode(score) {
    var safeScore = Math.max(10, score || 10);
    var nonce = Math.random().toString(36).substring(2, 8).toUpperCase();
    var hash = Math.random().toString(36).substring(2, 6).toUpperCase();
    return 'TB-' + safeScore + '-' + nonce + hash;
  }

  window.openClaimModal = function() {
    if (currentScore <= 0) {
      alert('Kumpulkan skor terlebih dahulu dengan membuka kartu aman!');
      return;
    }
    generatedCode = makeClaimCode(currentScore);
    var mTitle = document.getElementById('modal-title');
    var mDesc = document.getElementById('modal-desc');
    var mCode = document.getElementById('modal-code');
    
    if (mTitle) mTitle.textContent = safeFound >= 4 ? '🏆 JACKPOT KEMENANGAN!' : '💰 CASHOUT SCORE';
    if (mDesc) mDesc.textContent = 'Total Skor: ' + currentScore + ' PTS. Salin kode dan gunakan di chat WhatsApp!';
    if (mCode) mCode.textContent = generatedCode;
    
    var modal = document.getElementById('claim-modal');
    if (modal) modal.classList.add('show');
  };

  window.closeClaimModal = function() {
    var modal = document.getElementById('claim-modal');
    if (modal) modal.classList.remove('show');
  };

  window.copyCode = function() {
    var cmd = '.claimr ' + generatedCode;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).then(function(){
        alert('Perintah berhasil disalin:\\n' + cmd + '\\n\\nKirimkan ke bot WhatsApp untuk klaim hadiah!');
      });
    } else {
      prompt('Salin teks perintah ini:', cmd);
    }
  };

  window.initGame = initGame;
  
  // Eksekusi init secara instan dan sinkronous (seperti slot.js dan catur.js)
  try {
    initGame();
  } catch (e) {}
})();
</script>`
}

/**
 * Mengirimkan game interaktif Tebak Bom HTML ke WhatsApp
 */
export async function kirimTebakBom(conn, chatId, senderJid = '') {
	const top3 = getTopLeaderboard(3)
	const htmlPayload = buildTebakBomHTML(top3)

	const data = Buffer.from(JSON.stringify({
		__typename: 'GenAIUnifiedResponse',
		response_id: randomUUID(),
		sections: [{
			__typename: 'GenAIUnifiedResponseSection',
			view_model: {
				__typename: 'GenAISingleLayoutViewModel',
				primitive: {
					__typename: 'GenAIaeacdsnwHtmlPrimitive',
					payload: htmlPayload,
					trusted_sources: []
				}
			}
		}]
	})).toString('base64')

	return conn.relayMessage(chatId, {
		messageContextInfo: {
			deviceListMetadata: {},
			deviceListMetadataVersion: 2,
			botMetadata: {
				messageDisclaimerText: "",
				botResponseId: randomUUID(),
				verificationMetadata: {
					proofs: [{
						version: 1,
						useCase: 1,
						signature: SIG,
						certificateChain: [CERT1, CERT2]
					}]
				}
			}
		},
		botForwardedMessage: {
			message: {
				richResponseMessage: {
					messageType: 1,
					submessages: [{
						messageType: 2,
						messageText: '💣 TEBAK BOM - DANGEROUS CARD MINESWEEPER'
					}],
					unifiedResponse: { data },
					contextInfo: {
						forwardingScore: 1,
						isForwarded: true,
						forwardedAiBotMessageInfo: {
							botJid: "867051314767696@bot"
						},
						forwardOrigin: 4
					}
				}
			}
		}
	}, {})
}

const pluginConfig = {
	name: "tebakbom",
	alias: ['minesweeper', 'bom', 'bomb'],
	category: "game",
	description: "Inline Dangerous Tebak Bom Card game with Canvas & SFX",
	usage: ".tebakbom",
	example: ".tebakbom",
	isOwner: false,
	isPremium: false,
	isGroup: false,
	isPrivate: false,
	cooldown: 1,
	energi: 0,
	isEnabled: true,
}

async function handler(m, options = {}) {
	const sock = options?.sock || options?.conn || options?.naze || options
	const chatId = m?.chat || m?.key?.remoteJid
	try {
		await kirimTebakBom(sock, chatId, m?.sender)
	} catch (e) {
		console.error("[TEBAKBOM]", e?.message || e)
		if (m?.reply) await m.reply("❌ Gagal mengirim game tebak bom: " + (e?.message || e))
	}
}

export { pluginConfig as config, handler }
export default handler
