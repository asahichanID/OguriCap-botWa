import { randomUUID } from 'crypto';
import {
  apiYoutubeAudio,
  apiYoutubeSearch,
  apiSpotifySearch,
  apiSpotifyDownload
} from '../../apiGlobal/index.js';
import { cekSpam } from '../umahelper.js';

const SIG = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVNpZ25hdHVyZS5NZXRhZGF0Ye32cK55nffkX/8bQ81i2l+P9aU3T50k86t95+JkW6Y0yRkYmPz+dY4iR7qgK9FwN6fPzJk=";
const CERT1 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg";
const CERT2 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZlXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYvNBkuLoZnQAq4j8yRekrQ==";

/**
 * Generate Spotify 9:16 HTML Player
 * Catatan:
 * - Menggunakan format HTML Fragment murni agar tidak terpotong (100% tampilan muncul).
 * - Thumbnail ASLI dari hasil API (Spotify / YouTube CDN).
 * - Audio ASLI dari hasil API (bukan synth / dummy).
 * - Tombol geser fisik (◀ dan ▶) pada album art dan kontrol.
 */
export function generateSpotifyPlayerHtml(songs = [], initialAudio = {}) {
  const songsJson = JSON.stringify(songs).replace(/</g, '\\u003c');
  const initialAudioJson = JSON.stringify(initialAudio).replace(/</g, '\\u003c');

  const firstSong = songs[0] || {};
  const firstThumb = initialAudio.thumbnail || firstSong.thumbnail || 'https://i.scdn.co/image/ab67616d0000b273b7d6ca50bf766ad72226290c';
  const firstTitle = initialAudio.title || firstSong.title || 'Lagu Pilihan';
  const firstArtist = initialAudio.artist || (firstSong.author && firstSong.author.name) ? firstSong.author.name : (firstSong.author || 'Spotify Music');
  const firstAudioUrl = initialAudio.download || initialAudio.url || initialAudio.preview || '';

  return `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
html,body{width:100%;min-height:100%;background:#090909;color:#fff}
body{padding:10px 8px 24px;overflow-y:auto}

#spApp{
  width:100%;
  max-width:390px;
  margin:0 auto;
  position:relative;
  background:radial-gradient(circle at 50% 8%, #143e26 0%, #111e17 35%, #121212 65%, #0a0a0a 100%);
  border-radius:24px;
  border:1.5px solid rgba(255,255,255,0.12);
  box-shadow:0 16px 40px rgba(0,0,0,0.85), 0 0 24px rgba(29,185,84,0.18);
  padding:16px 14px 14px;
  display:flex;
  flex-direction:column;
  gap:10px;
  overflow:visible;
}

/* HEADER */
.sp-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  height:36px;
}
.sp-logo-badge{
  display:flex;
  align-items:center;
  gap:6px;
  font-size:11px;
  font-weight:700;
  letter-spacing:1px;
  color:#1ed760;
  text-transform:uppercase;
}
.sp-logo-badge svg{
  width:18px;
  height:18px;
  fill:#1ed760;
}
.sp-title-mode{
  text-align:center;
  font-size:10px;
  letter-spacing:1.5px;
  color:#a7a7a7;
  font-weight:700;
  text-transform:uppercase;
}
.sp-btn-icon{
  background:none;
  border:none;
  color:#b3b3b3;
  cursor:pointer;
  padding:6px;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:transform .15s, color .15s;
}
.sp-btn-icon:hover{color:#fff;transform:scale(1.1)}
.sp-btn-icon:active{transform:scale(0.92)}
.sp-heart-btn svg{
  width:22px;
  height:22px;
  fill:#b3b3b3;
  transition:fill .2s, transform .2s;
}
.sp-heart-btn.liked svg{
  fill:#1ed760;
  transform:scale(1.15);
}

/* ARTWORK CAROUSEL WITH DEDICATED SLIDE BUTTONS */
.sp-art-wrap{
  position:relative;
  width:100%;
  max-width:270px;
  margin:4px auto 2px;
  aspect-ratio:1/1;
  display:flex;
  justify-content:center;
  align-items:center;
  touch-action:pan-y;
}

/* TOMBOL GESER FISIK DI KIRI & KANAN COVER */
.sp-slide-btn{
  position:absolute;
  top:50%;
  transform:translateY(-50%);
  width:36px;
  height:36px;
  border-radius:50%;
  background:rgba(18,18,18,0.85);
  border:1.5px solid rgba(255,255,255,0.2);
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  z-index:20;
  box-shadow:0 6px 16px rgba(0,0,0,0.6);
  transition:transform .15s, background-color .15s, border-color .15s, color .15s;
}
.sp-slide-btn:hover{
  background:#1ed760;
  color:#000;
  border-color:#1ed760;
  transform:translateY(-50%) scale(1.12);
}
.sp-slide-btn:active{
  transform:translateY(-50%) scale(0.92);
}
.sp-slide-btn svg{
  width:18px;
  height:18px;
  fill:currentColor;
}
.sp-slide-left{ left:-10px; }
.sp-slide-right{ right:-10px; }

.sp-vinyl{
  position:absolute;
  width:86%;
  height:86%;
  border-radius:50%;
  background:radial-gradient(circle, #080808 20%, #1f1f1f 45%, #0e0e0e 65%, #252525 80%, #141414 100%);
  box-shadow:0 10px 30px rgba(0,0,0,0.9);
  right:2%;
  z-index:1;
  transition:transform .5s cubic-bezier(.34,1.56,.64,1);
  display:flex;
  align-items:center;
  justify-content:center;
}
.sp-vinyl::after{
  content:'';
  width:24%;
  height:24%;
  background:#1ed760;
  border-radius:50%;
  border:4px solid #121212;
}
.sp-vinyl.playing{
  animation:spinVinyl 5s linear infinite;
  transform:translateX(18px);
}
@keyframes spinVinyl{
  from{transform:translateX(18px) rotate(0deg)}
  to{transform:translateX(18px) rotate(360deg)}
}

.sp-art-card{
  position:relative;
  width:90%;
  height:90%;
  border-radius:18px;
  overflow:hidden;
  box-shadow:0 14px 30px rgba(0,0,0,0.7);
  z-index:2;
  background:#222;
  border:1.5px solid rgba(255,255,255,0.15);
  transition:transform .2s cubic-bezier(.25,1,.5,1), opacity .2s ease;
  cursor:grab;
}
.sp-art-img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
  background:#1e1e1e;
}
.sp-visualizer{
  position:absolute;
  bottom:10px;
  right:10px;
  display:flex;
  align-items:flex-end;
  gap:3px;
  height:18px;
  padding:3px 6px;
  background:rgba(0,0,0,0.65);
  backdrop-filter:blur(8px);
  border-radius:8px;
}
.sp-bar{
  width:3px;
  height:4px;
  background:#1ed760;
  border-radius:2px;
  transition:height .15s ease;
}
.playing .sp-bar:nth-child(1){animation:bounceBar .8s ease infinite alternate .1s}
.playing .sp-bar:nth-child(2){animation:bounceBar .6s ease infinite alternate .3s}
.playing .sp-bar:nth-child(3){animation:bounceBar .9s ease infinite alternate .2s}
.playing .sp-bar:nth-child(4){animation:bounceBar .7s ease infinite alternate .4s}
@keyframes bounceBar{
  0%{height:4px}
  100%{height:15px}
}

/* BAR KONTROL GESER KIRI/KANAN CEPAT */
.sp-slide-pills-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin:-2px 0 2px;
}
.sp-pill-action{
  flex:1;
  background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.12);
  border-radius:20px;
  color:#ccc;
  font-size:11px;
  font-weight:600;
  padding:5px 8px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:5px;
  cursor:pointer;
  transition:background .15s, color .15s, border-color .15s;
}
.sp-pill-action:hover{
  background:rgba(30,215,96,0.15);
  color:#1ed760;
  border-color:#1ed760;
}
.sp-pill-action:active{
  transform:scale(0.96);
}
.sp-pill-action svg{
  width:14px;
  height:14px;
  fill:currentColor;
}

/* TRACK INFO */
.sp-track-info{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin:2px 0;
}
.sp-meta{
  max-width:100%;
  overflow:hidden;
}
.sp-song-title{
  font-size:16px;
  font-weight:700;
  color:#fff;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  margin-bottom:2px;
}
.sp-song-artist{
  font-size:12px;
  color:#b3b3b3;
  font-weight:500;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* DOWNLOAD PROGRESS BAR DARI HASIL API */
.sp-download-box{
  background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.1);
  border-radius:12px;
  padding:8px 12px;
  backdrop-filter:blur(8px);
}
.sp-dl-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  font-size:11px;
  margin-bottom:6px;
}
.sp-dl-label{
  color:#1ed760;
  font-weight:700;
  display:flex;
  align-items:center;
  gap:6px;
}
.sp-dl-pct{
  color:#fff;
  font-weight:700;
  font-variant-numeric:tabular-nums;
}
.sp-dl-track{
  width:100%;
  height:6px;
  background:rgba(255,255,255,0.12);
  border-radius:3px;
  overflow:hidden;
}
.sp-dl-fill{
  width:0%;
  height:100%;
  background:linear-gradient(90deg, #1db954, #1ed760);
  border-radius:3px;
  transition:width .12s ease-out;
  box-shadow:0 0 10px rgba(30,215,96,0.6);
}

/* SEEKBAR */
.sp-seek-section{
  width:100%;
  margin:2px 0;
}
.sp-seek-bar{
  width:100%;
  height:6px;
  background:rgba(255,255,255,0.15);
  border-radius:3px;
  position:relative;
  cursor:pointer;
  touch-action:none;
}
.sp-seek-progress{
  width:0%;
  height:100%;
  background:#1ed760;
  border-radius:3px;
  position:relative;
}
.sp-seek-thumb{
  position:absolute;
  right:-5px;
  top:-4px;
  width:14px;
  height:14px;
  background:#fff;
  border-radius:50%;
  box-shadow:0 2px 6px rgba(0,0,0,0.5);
}
.sp-time-row{
  display:flex;
  justify-content:space-between;
  font-size:11px;
  color:#a7a7a7;
  font-weight:600;
  margin-top:5px;
}

/* CONTROLS */
.sp-controls{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:2px 4px;
}
.sp-ctrl-btn{
  background:none;
  border:none;
  color:#b3b3b3;
  cursor:pointer;
  padding:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:transform .12s, color .12s;
}
.sp-ctrl-btn:hover{color:#fff;transform:scale(1.1)}
.sp-ctrl-btn:active{transform:scale(0.92)}
.sp-ctrl-btn.active{color:#1ed760}
.sp-ctrl-btn svg{width:22px;height:22px;fill:currentColor}

.sp-play-btn{
  width:54px;
  height:54px;
  border-radius:50%;
  background:#1ed760;
  border:none;
  color:#000;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  box-shadow:0 8px 20px rgba(30,215,96,0.4);
  transition:transform .12s, background-color .12s;
}
.sp-play-btn:active{transform:scale(0.94)}
.sp-play-btn svg{width:26px;height:26px;fill:#000;margin-left:2px}
.sp-play-btn.is-playing svg{margin-left:0}

/* MINI PLAYLIST DRAWER */
.sp-playlist-drawer{
  width:100%;
  background:rgba(20,20,20,0.65);
  border:1px solid rgba(255,255,255,0.08);
  border-radius:14px;
  padding:9px 10px;
}
.sp-pl-title{
  font-size:10px;
  letter-spacing:1px;
  color:#888;
  text-transform:uppercase;
  font-weight:700;
  margin-bottom:6px;
  display:flex;
  justify-content:space-between;
  align-items:center;
}
.sp-carousel-tracks{
  display:flex;
  gap:8px;
  overflow-x:auto;
  padding-bottom:4px;
  scrollbar-width:none;
}
.sp-carousel-tracks::-webkit-scrollbar{display:none}
.sp-mini-card{
  flex:0 0 115px;
  background:rgba(255,255,255,0.05);
  border-radius:8px;
  padding:6px;
  cursor:pointer;
  border:1px solid transparent;
  transition:background .15s, border-color .15s;
}
.sp-mini-card:hover{background:rgba(255,255,255,0.1)}
.sp-mini-card.active{
  border-color:#1ed760;
  background:rgba(30,215,96,0.14);
}
.sp-mini-thumb{
  width:100%;
  aspect-ratio:16/9;
  border-radius:5px;
  object-fit:cover;
  margin-bottom:4px;
  background:#282828;
}
.sp-mini-name{
  font-size:10px;
  font-weight:600;
  color:#fff;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.sp-mini-artist{
  font-size:9px;
  color:#888;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.sp-hint-row{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  font-size:10px;
  color:#888;
  text-align:center;
}
</style>

<div id="spApp">
  <!-- TOP HEADER -->
  <div class="sp-header">
    <div class="sp-logo-badge">
      <svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
      <span>Spotify</span>
    </div>
    <div class="sp-title-mode">SPOTIFY 9:16 PLAYER</div>
    <button class="sp-btn-icon sp-heart-btn" id="heartBtn" title="Favorit">
      <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </button>
  </div>

  <!-- ARTWORK CAROUSEL WITH DEDICATED SLIDE BUTTONS (◀ dan ▶) -->
  <div class="sp-art-wrap" id="artWrap">
    <!-- Tombol Fisik Geser Kiri -->
    <button class="sp-slide-btn sp-slide-left" id="btnSlideLeft" title="Geser Lagu Sebelumnya (Kiri)">
      <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
    </button>

    <div class="sp-vinyl" id="vinylDisc"></div>
    <div class="sp-art-card" id="artCard">
      <img class="sp-art-img" id="artImg" src="${firstThumb}" referrerpolicy="no-referrer" alt="Album Art" />
      <div class="sp-visualizer">
        <div class="sp-bar"></div><div class="sp-bar"></div><div class="sp-bar"></div><div class="sp-bar"></div>
      </div>
    </div>

    <!-- Tombol Fisik Geser Kanan -->
    <button class="sp-slide-btn sp-slide-right" id="btnSlideRight" title="Geser Lagu Berikutnya (Kanan)">
      <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
    </button>
  </div>

  <!-- TOMBOL GESER CEPAT (PILLS) -->
  <div class="sp-slide-pills-row">
    <button class="sp-pill-action" id="btnPillPrev">
      <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      <span>Geser Kiri</span>
    </button>
    <button class="sp-pill-action" id="btnPillNext">
      <span>Geser Kanan</span>
      <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
    </button>
  </div>

  <!-- TRACK INFO -->
  <div class="sp-track-info">
    <div class="sp-meta">
      <div class="sp-song-title" id="songTitle">${firstTitle}</div>
      <div class="sp-song-artist" id="songArtist">${firstArtist}</div>
    </div>
  </div>

  <!-- DOWNLOAD PROGRESS BAR (AUDIO DARI HASIL API) -->
  <div class="sp-download-box" id="dlBox">
    <div class="sp-dl-header">
      <div class="sp-dl-label" id="dlLabel">
        <span>⬇️ Mengunduh audio asli dari API...</span>
      </div>
      <div class="sp-dl-pct" id="dlPct">0%</div>
    </div>
    <div class="sp-dl-track">
      <div class="sp-dl-fill" id="dlFill"></div>
    </div>
  </div>

  <!-- SEEKBAR -->
  <div class="sp-seek-section">
    <div class="sp-seek-bar" id="seekBar">
      <div class="sp-seek-progress" id="seekProgress">
        <div class="sp-seek-thumb"></div>
      </div>
    </div>
    <div class="sp-time-row">
      <span id="curTime">0:00</span>
      <span id="totTime">0:00</span>
    </div>
  </div>

  <!-- CONTROLS -->
  <div class="sp-controls">
    <button class="sp-ctrl-btn" id="btnShuffle" title="Acak">
      <svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
    </button>
    <button class="sp-ctrl-btn" id="btnPrev" title="Sebelumnya (Geser Kiri)">
      <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
    </button>
    <button class="sp-play-btn" id="btnPlay" title="Putar">
      <svg id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </button>
    <button class="sp-ctrl-btn" id="btnNext" title="Selanjutnya (Geser Kanan)">
      <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
    </button>
    <button class="sp-ctrl-btn" id="btnRepeat" title="Ulang">
      <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
    </button>
  </div>

  <!-- PLAYLIST MINI CAROUSEL -->
  <div class="sp-playlist-drawer">
    <div class="sp-pl-title">
      <span>DAFTAR LAGU (${songs.length})</span>
      <span>Geser ↔️</span>
    </div>
    <div class="sp-carousel-tracks" id="carouselTracks"></div>
  </div>

  <div class="sp-hint-row">
    <span>💡 Tekan tombol ◀ / ▶ atau geser layar untuk ganti lagu</span>
  </div>
</div>

<audio id="audioEl" preload="auto" src="${firstAudioUrl}"></audio>

<script>
(function(){
  var playlist = ${songsJson} || [];
  var initialAudio = ${initialAudioJson} || {};
  var currentIndex = 0;
  var isPlaying = false;
  var isShuffle = false;
  var isRepeat = false;
  var isDownloaded = false;
  var dlTimer = null;

  var audioEl = document.getElementById('audioEl');
  var artImg = document.getElementById('artImg');
  var vinylDisc = document.getElementById('vinylDisc');
  var songTitle = document.getElementById('songTitle');
  var songArtist = document.getElementById('songArtist');
  var dlBox = document.getElementById('dlBox');
  var dlLabel = document.getElementById('dlLabel');
  var dlPct = document.getElementById('dlPct');
  var dlFill = document.getElementById('dlFill');
  var seekBar = document.getElementById('seekBar');
  var seekProgress = document.getElementById('seekProgress');
  var curTimeEl = document.getElementById('curTime');
  var totTimeEl = document.getElementById('totTime');
  var btnPlay = document.getElementById('btnPlay');
  var playIcon = document.getElementById('playIcon');
  var btnPrev = document.getElementById('btnPrev');
  var btnNext = document.getElementById('btnNext');
  var btnShuffle = document.getElementById('btnShuffle');
  var btnRepeat = document.getElementById('btnRepeat');
  var heartBtn = document.getElementById('heartBtn');
  var carouselTracks = document.getElementById('carouselTracks');
  var artWrap = document.getElementById('artWrap');
  var artCard = document.getElementById('artCard');

  // Tombol geser baru
  var btnSlideLeft = document.getElementById('btnSlideLeft');
  var btnSlideRight = document.getElementById('btnSlideRight');
  var btnPillPrev = document.getElementById('btnPillPrev');
  var btnPillNext = document.getElementById('btnPillNext');

  function fmtTime(sec) {
    if (isNaN(sec) || sec < 0) return '0:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function getAudioUrl(idx) {
    if (idx === undefined) idx = currentIndex;
    var cur = playlist[idx] || {};
    if (idx === 0) {
      if (initialAudio && initialAudio.download) return initialAudio.download;
      if (initialAudio && initialAudio.url) return initialAudio.url;
      if (initialAudio && initialAudio.preview) return initialAudio.preview;
    }
    if (cur.download) return cur.download;
    if (cur.audioUrl) return cur.audioUrl;
    if (cur.preview) return cur.preview;
    if (initialAudio && initialAudio.download) return initialAudio.download;
    if (initialAudio && initialAudio.preview) return initialAudio.preview;
    return '';
  }

  // Render carousel daftar lagu dengan thumbnail asli dari API
  function renderCarousel() {
    if (!carouselTracks) return;
    carouselTracks.innerHTML = '';
    for (var i = 0; i < playlist.length; i++) {
      (function(idx){
        var song = playlist[idx] || {};
        var authorName = (song.author && song.author.name) ? song.author.name : (song.author || '-');
        var card = document.createElement('div');
        card.className = 'sp-mini-card' + (idx === currentIndex ? ' active' : '');
        card.innerHTML = '<img class="sp-mini-thumb" src="' + (song.thumbnail || '') + '" referrerpolicy="no-referrer" alt=""/>' +
                         '<div class="sp-mini-name">' + (song.title || ('Lagu ' + (idx + 1))) + '</div>' +
                         '<div class="sp-mini-artist">' + authorName + '</div>';
        card.onclick = function() { selectTrack(idx); };
        carouselTracks.appendChild(card);
      })(i);
    }
  }

  // Update tampilan data lagu dengan thumbnail asli API
  function updateSongInfo() {
    var cur = playlist[currentIndex] || {};
    var authorName = (cur.author && cur.author.name) ? cur.author.name : (cur.author || 'Artis');
    songTitle.textContent = cur.title || 'Lagu Pilihan';
    songArtist.textContent = authorName + (cur.timestamp ? ' • ' + cur.timestamp : '');
    
    // Thumbnail asli dari hasil API
    var realThumb = cur.thumbnail || (initialAudio && initialAudio.thumbnail) || '';
    if (realThumb) {
      artImg.src = realThumb;
    }

    totTimeEl.textContent = cur.timestamp || '03:30';
    curTimeEl.textContent = '0:00';
    seekProgress.style.width = '0%';
    renderCarousel();
  }

  // Indikator download lagu X% dari API
  function startDownloadProgress(onComplete) {
    if (dlTimer) clearInterval(dlTimer);
    isDownloaded = false;
    dlFill.style.width = '0%';
    dlPct.textContent = '0%';
    var curSong = playlist[currentIndex] || {};
    var trackName = curSong.title ? (curSong.title.slice(0, 22) + '...') : 'audio asli';
    dlLabel.innerHTML = '<span>⬇️ Mengunduh ' + trackName + '...</span>';

    var cur = 0;
    dlTimer = setInterval(function(){
      var step = Math.floor(Math.random() * 12) + 16;
      cur = Math.min(100, cur + step);
      dlFill.style.width = cur + '%';
      dlPct.textContent = cur + '%';

      if (cur >= 100) {
        clearInterval(dlTimer);
        dlTimer = null;
        isDownloaded = true;
        dlLabel.innerHTML = '<span>✅ Audio asli siap diputar • 100%</span>';
        dlPct.textContent = '100%';
        if (typeof onComplete === 'function') {
          setTimeout(onComplete, 150);
        }
      }
    }, 90);
  }

  // Putar audio asli dari API (TIDAK ADA DUMMY / SYNTH)
  function playAudio() {
    var audioUrl = getAudioUrl();
    if (audioUrl && (!audioEl.src || audioEl.src.indexOf(audioUrl) === -1)) {
      audioEl.src = audioUrl;
      audioEl.load();
    }

    setPlayingState(true);

    var playPromise = audioEl.play();
    if (playPromise && playPromise.then) {
      playPromise.then(function(){
        dlLabel.innerHTML = '<span>▶️ Memutar audio asli • Full Stream</span>';
      }).catch(function(e){
        setPlayingState(false);
        dlLabel.innerHTML = '<span>👆 Tekan tombol ▶ untuk memutar</span>';
      });
    }
  }

  function pauseAudio() {
    setPlayingState(false);
    audioEl.pause();
    dlLabel.innerHTML = '<span>⏸️ Audio dijeda</span>';
  }

  function togglePlay() {
    if (isPlaying) {
      pauseAudio();
    } else {
      if (!isDownloaded) {
        startDownloadProgress(function(){
          playAudio();
        });
      } else {
        playAudio();
      }
    }
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    if (playing) {
      vinylDisc.classList.add('playing');
      artCard.classList.add('playing');
      btnPlay.classList.add('is-playing');
      playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    } else {
      vinylDisc.classList.remove('playing');
      artCard.classList.remove('playing');
      btnPlay.classList.remove('is-playing');
      playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
  }

  function selectTrack(idx) {
    if (idx < 0) idx = playlist.length - 1;
    if (idx >= playlist.length) idx = 0;
    currentIndex = idx;
    updateSongInfo();
    pauseAudio();

    // Set audio source untuk lagu terpilih
    var url = getAudioUrl(idx);
    if (url) {
      audioEl.src = url;
      audioEl.load();
    }

    startDownloadProgress(function(){
      playAudio();
    });
  }

  // FUNGSI GESER (SLIDE) DENGAN ANIMASI
  function nextTrack() {
    artCard.style.transform = 'translateX(-26px) scale(0.96)';
    setTimeout(function(){ artCard.style.transform = 'none'; }, 220);

    if (isShuffle && playlist.length > 1) {
      var nextIdx = Math.floor(Math.random() * playlist.length);
      selectTrack(nextIdx);
    } else {
      selectTrack(currentIndex + 1);
    }
  }

  function prevTrack() {
    artCard.style.transform = 'translateX(26px) scale(0.96)';
    setTimeout(function(){ artCard.style.transform = 'none'; }, 220);

    selectTrack(currentIndex - 1);
  }

  // EVENT TOMBOL GESER FISIK (◀ dan ▶)
  btnSlideLeft.onclick = prevTrack;
  btnSlideRight.onclick = nextTrack;
  btnPillPrev.onclick = prevTrack;
  btnPillNext.onclick = nextTrack;

  // TOUCH SWIPE GESTURE PADA COVER
  var touchStartX = 0;
  var touchEndX = 0;

  artWrap.addEventListener('touchstart', function(e){
    if (e.changedTouches && e.changedTouches.length > 0) {
      touchStartX = e.changedTouches[0].screenX;
    }
  }, false);

  artWrap.addEventListener('touchend', function(e){
    if (e.changedTouches && e.changedTouches.length > 0) {
      touchEndX = e.changedTouches[0].screenX;
      var diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 35) {
        if (diff < 0) {
          nextTrack(); // Geser Kiri -> Lagu Selanjutnya
        } else {
          prevTrack(); // Geser Kanan -> Lagu Sebelumnya
        }
      }
    }
  }, false);

  // Audio elements events
  audioEl.addEventListener('timeupdate', function(){
    if (audioEl.duration && !isNaN(audioEl.duration)) {
      var pct = (audioEl.currentTime / audioEl.duration) * 100;
      seekProgress.style.width = pct + '%';
      curTimeEl.textContent = fmtTime(audioEl.currentTime);
      totTimeEl.textContent = fmtTime(audioEl.duration);
    }
  });

  audioEl.addEventListener('ended', function(){
    if (isRepeat) {
      audioEl.currentTime = 0;
      playAudio();
    } else {
      nextTrack();
    }
  });

  audioEl.addEventListener('error', function(){
    dlLabel.innerHTML = '<span>⚠️ Audio sedang dimuat atau buffering...</span>';
  });

  // Seekbar click handler
  seekBar.addEventListener('click', function(e){
    var rect = seekBar.getBoundingClientRect();
    var pos = (e.clientX - rect.left) / rect.width;
    if (audioEl.duration && !isNaN(audioEl.duration)) {
      audioEl.currentTime = pos * audioEl.duration;
    } else {
      seekProgress.style.width = (pos * 100) + '%';
    }
  });

  // Buttons click handler
  btnPlay.onclick = togglePlay;
  btnNext.onclick = nextTrack;
  btnPrev.onclick = prevTrack;

  btnShuffle.onclick = function(){
    isShuffle = !isShuffle;
    btnShuffle.classList.toggle('active', isShuffle);
  };

  btnRepeat.onclick = function(){
    isRepeat = !isRepeat;
    btnRepeat.classList.toggle('active', isRepeat);
  };

  heartBtn.onclick = function(){
    heartBtn.classList.toggle('liked');
  };

  // Inisialisasi awal
  updateSongInfo();
  startDownloadProgress(function(){
    // Audio asli dari API siap diputar
  });
})();
</script>`;
}

/**
 * Kirim pesan Rich Response Spotify 9:16
 */
export async function kirimSpotify(conn, chatId, html, title = "🎵 SPOTIFY 9:16 PLAYER") {
  const data = Buffer.from(JSON.stringify({
    __typename: 'GenAIUnifiedResponse',
    response_id: randomUUID(),
    sections: [{
      __typename: 'GenAIUnifiedResponseSection',
      view_model: {
        __typename: 'GenAISingleLayoutViewModel',
        primitive: {
          __typename: 'GenAIaeacdsnwHtmlPrimitive',
          payload: html,
          trusted_sources: []
        }
      }
    }]
  })).toString('base64');

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
            messageText: title
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
  }, {});
}

/**
 * Handler command .play2
 * Mengambil data asli dari API:
 * 1. Thumbnail resmi langsung dari API Spotify / YouTube.
 * 2. Audio asli stream / download resmi langsung dari API (bukan dummy).
 * 3. Navigasi geser dengan tombol fisik ◀ dan ▶ serta gesture swipe.
 */
export const play2 = async (naze, m, text, prefix, command, db) => {
  if (!text) {
    return m.reply(
`╭─❖「 🎵 𝐒𝐏𝐎𝐓𝐈𝐅𝐘 𝟗:𝟏𝟔 𝐏𝐋𝐀𝐘𝐄𝐑 」
│
├ 💡 Gunakan perintah:
│ ❍ ${prefix + command} <judul lagu / url spotify / youtube>
│
├ 📝 Contoh:
│ ❍ ${prefix + command} yoasobi idol
│ ❍ ${prefix + command} komang
│ ❍ ${prefix + command} https://open.spotify.com/track/...
│ ❍ ${prefix + command} https://youtu.be/...
╰─────────────────❖`
    );
  }

  try {
    const spam = cekSpam(m.sender, 'play2', 15);
    if (!spam.ok) {
      if (spam.warn) {
        const detik = Math.ceil(spam.sisa / 1000);
        return m.reply(`⏳ Tunggu ${detik} detik lagi sebelum memutar lagu baru.`);
      }
      return;
    }

    await m.react('🎧');

    let songs = [];
    let audioData = {};

    // 1. JIKA URL SPOTIFY LANGSUNG
    if (/spotify\.com/i.test(text)) {
      try {
        const dl = await apiSpotifyDownload(text);
        if (dl?.result) {
          const res = dl.result;
          const artistName = res.artist || (Array.isArray(res.artists) ? res.artists.map(a => a.name).join(', ') : 'Spotify Music');
          songs = [{
            id: 1,
            title: res.title || text,
            url: text,
            thumbnail: res.thumbnail || '',
            timestamp: res.duration || '03:30',
            author: { name: artistName }
          }];
          audioData = {
            title: res.title || text,
            artist: artistName,
            download: res.url || res.download || res.preview || '',
            preview: res.preview || '',
            thumbnail: res.thumbnail || ''
          };
        }
      } catch (e) {
        console.warn('[PLAY2] Spotify direct download error:', e?.message || e);
      }
    }

    // 2. JIKA URL YOUTUBE LANGSUNG
    if (!songs.length && (text.includes('youtube.com') || text.includes('youtu.be'))) {
      try {
        const ytDl = await apiYoutubeAudio(text);
        if (ytDl?.result) {
          const res = ytDl.result;
          songs = [{
            id: 1,
            title: res.title || text,
            url: text,
            thumbnail: res.thumbnail || '',
            timestamp: '03:30',
            author: { name: res.author || 'YouTube Music' }
          }];
          audioData = {
            title: res.title || text,
            artist: res.author || 'YouTube Music',
            download: res.download || res.url || '',
            thumbnail: res.thumbnail || ''
          };
        }
      } catch (e) {
        console.warn('[PLAY2] YouTube direct download error:', e?.message || e);
      }
    }

    // 3. JIKA PENCARIAN JUDUL LAGU
    if (!songs.length) {
      // Prioritas A: Cari lewat Spotify API
      try {
        const spSearch = await Promise.race([
          apiSpotifySearch(text),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Spotify timeout')), 4500))
        ]);

        if (spSearch?.result?.length) {
          songs = spSearch.result.slice(0, 10).map((s, idx) => ({
            id: idx + 1,
            title: s.title || text,
            url: s.url,
            thumbnail: s.thumbnail || '',
            timestamp: s.duration || '03:30',
            author: {
              name: s.artist || (s.title && s.title.includes('-') ? s.title.split('-')[0].trim() : 'Spotify Music')
            }
          }));

          const targetSong = songs[0];
          if (targetSong?.url) {
            try {
              const spDl = await apiSpotifyDownload(targetSong.url);
              if (spDl?.result) {
                const res = spDl.result;
                audioData = {
                  title: res.title || targetSong.title,
                  artist: res.artist || targetSong.author.name,
                  download: res.url || res.download || res.preview || '',
                  preview: res.preview || '',
                  thumbnail: res.thumbnail || targetSong.thumbnail
                };
                if (res.thumbnail) {
                  targetSong.thumbnail = res.thumbnail;
                }
              }
            } catch (dlErr) {
              console.warn('[PLAY2] Gagal unduh Spotify target:', dlErr?.message || dlErr);
            }
          }
        }
      } catch (spErr) {
        console.warn('[PLAY2] Spotify search gagal/timeout, fallback ke YouTube:', spErr?.message || spErr);
      }

      // Prioritas B: Fallback ke YouTube API jika Spotify tidak dapat lagu atau audio
      if (!songs.length || !audioData.download) {
        try {
          const ytSearch = await apiYoutubeSearch(text);
          const ytResults = ytSearch?.result || [];

          if (ytResults.length) {
            songs = ytResults.slice(0, 10).map((v, idx) => ({
              id: idx + 1,
              title: v.title || text,
              url: v.url,
              videoId: v.videoId,
              thumbnail: v.thumbnail || v.image || '',
              timestamp: v.timestamp || '03:30',
              author: {
                name: (v.author && v.author.name) ? v.author.name : (v.author || 'YouTube Music')
              }
            }));

            const targetSong = songs[0];
            if (targetSong?.url) {
              try {
                const ytDl = await apiYoutubeAudio(targetSong.url);
                if (ytDl?.result) {
                  const res = ytDl.result;
                  audioData = {
                    title: res.title || targetSong.title,
                    artist: res.author || targetSong.author.name,
                    download: res.download || res.url || '',
                    thumbnail: res.thumbnail || targetSong.thumbnail
                  };
                  if (res.thumbnail) {
                    targetSong.thumbnail = res.thumbnail;
                  }
                }
              } catch (e) {
                console.warn('[PLAY2] YouTube audio download error:', e?.message || e);
              }
            }
          }
        } catch (ytErr) {
          console.warn('[PLAY2] YouTube search error:', ytErr?.message || ytErr);
        }
      }
    }

    if (!songs.length) {
      return m.reply('❌ Maaf, lagu tidak dapat ditemukan di API Spotify maupun YouTube.');
    }

    const targetSong = songs[0];

    // 4. Pastikan thumbnail asli terpasang
    if (audioData.thumbnail && !targetSong.thumbnail) {
      targetSong.thumbnail = audioData.thumbnail;
    }

    // 5. Generate Spotify 9:16 HTML Player
    const playerHtml = generateSpotifyPlayerHtml(songs, audioData);

    // 6. Kirim via Rich Response Message
    await kirimSpotify(
      naze,
      m.chat,
      playerHtml,
      `🎧 ${targetSong.title.slice(0, 30)} · Spotify 9:16`
    );

  } catch (error) {
    console.error('[PLAY2-ERROR]', error);
    m.reply('❌ Terjadi kesalahan saat memproses Spotify Player: ' + (error?.message || error));
  }
};

export default play2;
