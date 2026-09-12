import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import axios from 'axios';
import {
  apiYoutubeAudio,
  apiYoutubeDownload,
  apiYoutubeSearch
} from '../apiGlobal/index.js';
import { cekSpam } from '../musume/umahelper.js';

// Cache Pterodactyl untuk hasil play2 YouTube (Bertahan 1 Jam Pas)
const ytPlayerCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 Jam pas (60 menit)

// Auto-purge permanen cache yang sudah lewat 1 jam
const purgeInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ytPlayerCache.entries()) {
    if (val.expiresAt && val.expiresAt <= now) {
      ytPlayerCache.delete(key);
      console.log(`[YTPLAYER-CACHE] Cache kedaluwarsa 1 jam dibersihkan: ${key}`);
    }
  }
}, 5 * 60 * 1000);
if (purgeInterval && typeof purgeInterval.unref === 'function') {
  purgeInterval.unref();
}

/**
 * Fetch thumbnail dan convert ke Base64 (Ringan ~10-14KB JPEG)
 */
async function fetchImageBase64(url, videoId = '') {
  const defaultPlaceholder = "data:image/svg+xml;base64," + Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">' +
    '<rect width="100%" height="100%" fill="#14141e"/>' +
    '<circle cx="160" cy="90" r="34" fill="#ff0044"/>' +
    '<polygon points="153,77 173,90 153,103" fill="#ffffff"/>' +
    '</svg>'
  ).toString('base64');

  const targetUrl = url || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '');
  if (!targetUrl) return defaultPlaceholder;

  try {
    const res = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/'
      }
    });

    if (res.data && res.data.length > 100) {
      // Kompres cover dengan FFmpeg agar ukuran Base64 sangat ringan (~10-14KB) dan rasio 1:1 (Square Crop)
      const compressed = await new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-i', 'pipe:0',
          '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=360:360",
          '-q:v', '5',
          '-f', 'image2',
          'pipe:1'
        ]);

        const chunks = [];
        ffmpeg.stdout.on('data', (c) => chunks.push(c));
        ffmpeg.stdin.on('error', () => {});
        ffmpeg.on('error', () => resolve(null));
        ffmpeg.on('close', (code) => {
          if (code === 0 && chunks.length) {
            resolve(Buffer.concat(chunks));
          } else {
            resolve(null);
          }
        });
        ffmpeg.stdin.write(res.data);
        ffmpeg.stdin.end();
      });

      if (compressed) {
        return `data:image/jpeg;base64,${compressed.toString('base64')}`;
      }
      return `data:image/jpeg;base64,${Buffer.from(res.data).toString('base64')}`;
    }
  } catch (e) {
    console.warn('[YTPLAYER] Gagal unduh cover Base64:', e?.message || e);
  }

  return defaultPlaceholder;
}

/**
 * Download audio buffer dengan axios dan header browser
 */
async function fetchBufferWithAxios(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 25000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': 'https://www.youtube.com/'
    }
  });
  if (res.data && res.data.length > 5000) {
    return Buffer.from(res.data);
  }
  throw new Error('Buffer audio terlalu kecil: ' + (res.data?.length || 0));
}

/**
 * Kompres audio buffer ke format MP3 via FFmpeg stdin pipe (01:20 menit ~ 76s @ 48kbps)
 */
async function compressBufferToMp3(buf, maxDurationSec = 76, bitrate = '48k') {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', 'pipe:0',
      '-t', String(maxDurationSec),
      '-c:a', 'libmp3lame',
      '-b:a', bitrate,
      '-ac', '2',
      '-ar', '44100',
      '-f', 'mp3',
      'pipe:1'
    ]);

    const chunks = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const out = Buffer.concat(chunks);
        if (out.length > 5000) {
          resolve(out);
        } else {
          reject(new Error(`Buffer output FFmpeg terlalu kecil (${out.length} bytes)`));
        }
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    ffmpeg.stdin.write(buf);
    ffmpeg.stdin.end();
  });
}

/**
 * Mengubah buffer ke Base64 dengan target presisi outer payload < 900KB (~800KB - 840KB)
 */
export async function getOptimizedBase64Audio(buf) {
  // Percobaan 1: 76 detik pada 48kbps (~440KB MP3 -> ~815KB final RichResponse)
  let mp3Buf = await compressBufferToMp3(buf, 76, '48k');
  
  // Jika ukuran MP3 melebihi 450KB, fallback ke 46kbps / 72 detik agar pasti < 840KB
  if (mp3Buf.length > 450 * 1024) {
    mp3Buf = await compressBufferToMp3(buf, 72, '46k');
  }
  
  return `data:audio/mpeg;base64,${mp3Buf.toString('base64')}`;
}

/**
 * Menyelesaikan audio stream dengan sistem fallback multi-kandidat anti-error
 */
async function resolveAudioBufferAndTrack(queryOrUrl) {
  let searchResults = [];
  const isDirectUrl = queryOrUrl.startsWith('http://') || queryOrUrl.startsWith('https://');

  if (isDirectUrl) {
    const s = await apiYoutubeSearch(queryOrUrl);
    searchResults = s?.result || [];
    if (!searchResults.length) {
      searchResults = [{
        url: queryOrUrl,
        title: 'YouTube Music Track',
        author: { name: 'YouTube Audio' },
        thumbnail: 'https://i.ytimg.com/vi/fKRtnMYMW08/mqdefault.jpg'
      }];
    }
  } else {
    const s = await apiYoutubeSearch(queryOrUrl);
    searchResults = s?.result || [];
  }

  if (!searchResults.length) {
    throw new Error('Lagu tidak ditemukan di YouTube.');
  }

  // Iterasi hingga 4 kandidat hasil teratas agar 100% anti 502/expired token
  for (let i = 0; i < Math.min(searchResults.length, 4); i++) {
    const candidate = searchResults[i];
    const candidateUrl = candidate.url || (candidate.videoId ? `https://youtube.com/watch?v=${candidate.videoId}` : '');
    if (!candidateUrl) continue;
    candidate.url = candidateUrl;

    // 1. Coba apiYoutubeAudio
    try {
      const audioInfo = await apiYoutubeAudio(candidateUrl);
      if (audioInfo?.result?.download) {
        const buf = await fetchBufferWithAxios(audioInfo.result.download);
        return { buffer: buf, track: candidate, audioRes: audioInfo.result };
      }
    } catch (e) {
      console.warn(`[YTPLAYER] Kandidat #${i + 1} apiYoutubeAudio gagal (${e?.message}), mencoba jalur berikutnya...`);
    }

    // 2. Coba apiYoutubeDownload fallback
    try {
      const dlInfo = await apiYoutubeDownload(candidateUrl, 'mp3');
      if (dlInfo?.result?.download) {
        const buf = await fetchBufferWithAxios(dlInfo.result.download);
        return { buffer: buf, track: candidate, audioRes: dlInfo.result };
      }
    } catch (e) {
      console.warn(`[YTPLAYER] Kandidat #${i + 1} apiYoutubeDownload fallback gagal (${e?.message})...`);
    }
  }

  throw new Error('Gagal mengunduh stream audio dari semua server penyedia.');
}

const SIG = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVNpZ25hdHVyZS5NZXRhZGF0Ye32cK55nffkX/8bQ81i2l+P9aU3T50k86t95+JkW6Y0yRkYmPz+dY4iR7qgK9FwN6fPzJk=";
const CERT1 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg";
const CERT2 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZlXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYvNBkuLoZnQAq4j8yRekrQ==";

/**
 * Generate YouTube HTML Player (Desain Spotify Modern Sesuai Screenshot)
 */
export function generateYoutubePlayerHtml(track = {}) {
  const coverUrl = track.coverBase64 || track.thumbnail || 'https://i.ytimg.com/vi/fKRtnMYMW08/mqdefault.jpg';
  const title = (track.title || 'YouTube Music').replace(/"/g, '&quot;');
  const artist = (track.author || 'YouTube Audio').replace(/"/g, '&quot;');
  const searchQuery = (track.searchQuery || title).replace(/"/g, '&quot;');
  const duration = track.duration || '1:00';
  const audioDataUri = track.audioBase64 || '';
  const ytUrl = track.url || 'https://youtu.be';

  return `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
html,body{width:100%;margin:0;padding:0;background:#000000;color:#fff;overflow-x:hidden;-webkit-font-smoothing:antialiased}
body{padding:6px 4px 10px;box-sizing:border-box}

/* WRAPPER CARD */
.yt-card{
  width:100%;
  max-width:380px;
  margin:0 auto;
  position:relative;
  border-radius:24px;
  overflow:hidden;
  background:#121114;
  border:1px solid rgba(255,255,255,0.08);
  box-shadow:0 16px 40px rgba(0,0,0,0.85);
  box-sizing:border-box;
}

/* SUBTLE AMBIENT BACKDROP */
.yt-ambient-bg{
  position:absolute;
  inset:0;
  background-image:url("${coverUrl}");
  background-size:cover;
  background-position:center;
  filter:blur(32px) brightness(0.22) saturate(1.8);
  opacity:0.55;
  z-index:0;
  pointer-events:none;
}

.yt-card-mesh{
  position:absolute;
  inset:0;
  background:linear-gradient(180deg, rgba(28,26,30,0.7) 0%, rgba(18,17,20,0.88) 60%, rgba(10,9,12,0.98) 100%);
  z-index:1;
  pointer-events:none;
}

#ytApp{
  position:relative;
  z-index:2;
  width:100%;
  padding:16px 16px 14px;
  display:flex;
  flex-direction:column;
  box-sizing:border-box;
}

/* TOP HEADER */
.yt-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  width:100%;
  margin-bottom:12px;
}
.yt-head-btn{
  background:none;
  border:none;
  color:rgba(255,255,255,0.75);
  cursor:pointer;
  padding:4px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.yt-head-btn svg{
  width:20px;
  height:20px;
  fill:currentColor;
}
.yt-head-center{
  display:flex;
  flex-direction:column;
  align-items:center;
  text-align:center;
  overflow:hidden;
  padding:0 8px;
}
.yt-head-sub{
  font-size:9.5px;
  font-weight:700;
  letter-spacing:1px;
  color:rgba(255,255,255,0.6);
  text-transform:uppercase;
}
.yt-head-title{
  font-size:13px;
  font-weight:800;
  color:#ffffff;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  max-width:210px;
  margin-top:1px;
}

/* THUMBNAIL (SQUARE 1:1, ROUNDED CORNERS) */
.yt-cover-wrap{
  width:100%;
  aspect-ratio:1 / 1;
  border-radius:18px;
  overflow:hidden;
  background:#18181f;
  box-shadow:0 12px 32px rgba(0,0,0,0.65);
  border:1px solid rgba(255,255,255,0.08);
  position:relative;
}
.yt-cover-img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

/* TRACK META & HEART ROW */
.yt-meta-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-top:14px;
  margin-bottom:10px;
  width:100%;
}
.yt-meta-info{
  display:flex;
  flex-direction:column;
  overflow:hidden;
  max-width:85%;
}
.yt-track-title{
  font-size:18px;
  font-weight:800;
  color:#ffffff;
  line-height:1.2;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.yt-track-artist{
  font-size:13px;
  font-weight:500;
  color:rgba(255,255,255,0.6);
  margin-top:2px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.yt-heart-btn{
  background:none;
  border:none;
  color:rgba(255,255,255,0.7);
  cursor:pointer;
  padding:4px;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:transform 0.15s, color 0.15s;
}
.yt-heart-btn:active{transform:scale(0.88)}
.yt-heart-btn svg{width:22px;height:22px;stroke:currentColor;fill:none}
.yt-heart-btn.is-liked svg{stroke:#ff3355;fill:#ff3355;color:#ff3355}

/* SCRUBBER & TIMELINE */
.yt-scrubber-box{
  display:flex;
  flex-direction:column;
  gap:5px;
  margin-top:2px;
  margin-bottom:12px;
  width:100%;
}
.yt-progress-bg{
  width:100%;
  height:4px;
  background:rgba(255,255,255,0.2);
  border-radius:2px;
  cursor:pointer;
  position:relative;
}
.yt-progress-fill{
  height:100%;
  width:0%;
  background:#ffffff;
  border-radius:2px;
  position:relative;
  transition:width 0.1s linear;
}
.yt-progress-handle{
  position:absolute;
  right:-5px;
  top:50%;
  transform:translateY(-50%);
  width:10px;
  height:10px;
  background:#ffffff;
  border-radius:50%;
  box-shadow:0 1px 4px rgba(0,0,0,0.6);
}
.yt-time-row{
  display:flex;
  justify-content:space-between;
  font-size:11px;
  font-weight:500;
  color:rgba(255,255,255,0.5);
}

/* PLAYBACK CONTROLS ROW */
.yt-controls{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:0 4px;
  margin-bottom:14px;
  width:100%;
}
.yt-ctrl-btn{
  background:none;
  border:none;
  color:rgba(255,255,255,0.65);
  cursor:pointer;
  padding:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:transform 0.15s, color 0.15s;
}
.yt-ctrl-btn:hover{color:#ffffff;transform:scale(1.1)}
.yt-ctrl-btn:active{transform:scale(0.92)}
.yt-ctrl-btn.active{color:#f7941d}
.yt-ctrl-btn svg{width:22px;height:22px;fill:currentColor}

.yt-main-play-btn{
  width:58px;
  height:58px;
  border-radius:50%;
  background:#ffffff;
  border:none;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  box-shadow:0 6px 20px rgba(0,0,0,0.35);
  transition:transform 0.15s, box-shadow 0.15s;
}
.yt-main-play-btn:hover{transform:scale(1.05)}
.yt-main-play-btn:active{transform:scale(0.94)}
.yt-play-inner{
  display:flex;
  align-items:center;
  justify-content:center;
  width:32px;
  height:32px;
  border-radius:6px;
  background:#f7941d;
}
.yt-play-inner svg{
  width:20px;
  height:20px;
  fill:#ffffff;
  margin-left:2px;
}
.is-playing .yt-play-inner svg{
  margin-left:0;
}

/* BOTTOM SECTION: COPY BUTTON */
.yt-bottom-section{
  display:flex;
  justify-content:center;
  width:100%;
  margin-top:2px;
}
.yt-copy-cmd-btn{
  background:rgba(255,255,255,0.05);
  border:none;
  color:rgba(255,255,255,0.7);
  font-size:11.5px;
  font-weight:500;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  text-align:center;
  padding:6px 12px;
  border-radius:14px;
  transition:all 0.2s ease;
  user-select:none;
}
.yt-copy-cmd-btn:hover{
  background:rgba(255,255,255,0.12);
  color:#ffffff;
}
.yt-copy-cmd-btn:active{
  transform:scale(0.97);
}
.yt-copy-cmd-btn.copied{
  background:rgba(46,204,113,0.18);
  color:#2ecc71;
  font-weight:700;
}
</style>

<div class="yt-card">
  <!-- DYNAMIC AMBIENT BACKDROP -->
  <div class="yt-ambient-bg"></div>
  <div class="yt-card-mesh"></div>

  <div id="ytApp">
    <!-- AUDIO BASE64 EMBEDDED -->
    <audio id="ytAudioEl" preload="auto" playsinline src="${audioDataUri}"></audio>

    <!-- HEADER -->
    <div class="yt-header">
      <button class="yt-head-btn" id="btnMinimize" aria-label="Minimize">
        <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
      </button>
      <div class="yt-head-center">
        <span class="yt-head-sub">PLAYING FROM SEARCH</span>
        <span class="yt-head-title">${searchQuery}</span>
      </div>
      <button class="yt-head-btn" id="btnMenu" aria-label="Menu">
        <svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      </button>
    </div>

    <!-- COVER ART (SQUARE 1:1) -->
    <div class="yt-cover-wrap">
      <img class="yt-cover-img" id="coverImg" src="${coverUrl}" referrerpolicy="no-referrer" alt="Cover"/>
    </div>

    <!-- TRACK META & HEART -->
    <div class="yt-meta-row">
      <div class="yt-meta-info">
        <div class="yt-track-title">${title}</div>
        <div class="yt-track-artist">${artist}</div>
      </div>
      <button class="yt-heart-btn" id="btnHeart" title="Suka">
        <svg id="heartSvg" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke-width="2"/></svg>
      </button>
    </div>

    <!-- SCRUBBER -->
    <div class="yt-scrubber-box">
      <div class="yt-progress-bg" id="progressBg">
        <div class="yt-progress-fill" id="progressFill">
          <div class="yt-progress-handle"></div>
        </div>
      </div>
      <div class="yt-time-row">
        <span id="timeCur">0:00</span>
        <span id="timeTot">${duration}</span>
      </div>
    </div>

    <!-- CONTROLS -->
    <div class="yt-controls">
      <!-- SHUFFLE -->
      <button class="yt-ctrl-btn" id="btnShuffle" title="Acak">
        <svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
      </button>

      <!-- REWIND 10s -->
      <button class="yt-ctrl-btn" id="btnRewind" title="Mundur 10 Detik">
        <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
      </button>

      <!-- MAIN PLAY/PAUSE (WHITE CIRCLE + ORANGE PAUSE/PLAY) -->
      <button class="yt-main-play-btn" id="btnPlay" title="Putar / Jeda">
        <div class="yt-play-inner">
          <svg id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </button>

      <!-- FORWARD 10s -->
      <button class="yt-ctrl-btn" id="btnForward" title="Maju 10 Detik">
        <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>

      <!-- REPEAT -->
      <button class="yt-ctrl-btn" id="btnRepeat" title="Ulangi">
        <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
      </button>
    </div>

    <!-- BOTTOM BUTTON: SALIN TAUTAN UNTUK UNDUH LEWAT COMMAND -->
    <div class="yt-bottom-section">
      <button class="yt-copy-cmd-btn" id="btnCopyYtmp3" title="Salin Command Unduh .ytmp3">
        <span id="copyBtnText">salin tautan untuk unduh lewat command</span>
      </button>
    </div>
  </div>
</div>

<script>
(function(){
  var audio = document.getElementById('ytAudioEl');
  var btnPlay = document.getElementById('btnPlay');
  var playIcon = document.getElementById('playIcon');
  var progressBg = document.getElementById('progressBg');
  var progressFill = document.getElementById('progressFill');
  var timeCur = document.getElementById('timeCur');
  var timeTot = document.getElementById('timeTot');
  var btnRewind = document.getElementById('btnRewind');
  var btnForward = document.getElementById('btnForward');
  var btnRepeat = document.getElementById('btnRepeat');
  var btnShuffle = document.getElementById('btnShuffle');
  var btnHeart = document.getElementById('btnHeart');
  var btnCopy = document.getElementById('btnCopyYtmp3');
  var copyBtnText = document.getElementById('copyBtnText');

  var isPlaying = false;
  var isRepeat = false;
  var isShuffle = false;
  var isLiked = false;

  var youtubeUrl = "${ytUrl}";
  var copyCommandText = ".ytmp3 " + youtubeUrl;

  function fmtTime(sec){
    if (!sec || isNaN(sec)) return '0:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setPlayingState(playing){
    isPlaying = playing;
    if (btnPlay) {
      if (playing) {
        btnPlay.classList.add('is-playing');
        playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      } else {
        btnPlay.classList.remove('is-playing');
        playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      }
    }
  }

  function togglePlay(){
    if (!audio) return;
    if (audio.paused) {
      var p = audio.play();
      if (p !== undefined) {
        p.then(function(){
          setPlayingState(true);
        }).catch(function(err){
          console.warn('Play retry:', err);
          audio.load();
          audio.play().then(function(){
            setPlayingState(true);
          }).catch(function(err2){
            console.error('Playback failed:', err2);
            setPlayingState(false);
          });
        });
      }
    } else {
      audio.pause();
      setPlayingState(false);
    }
  }

  // Play button
  if (btnPlay) {
    btnPlay.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      togglePlay();
    });
  }

  // Audio Event Listeners
  if (audio) {
    audio.onplay = function(){ setPlayingState(true); };
    audio.onpause = function(){ setPlayingState(false); };
    audio.ontimeupdate = function(){
      if (!audio.duration) return;
      var pct = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = pct + '%';
      timeCur.textContent = fmtTime(audio.currentTime);
    };
    audio.onloadedmetadata = function(){
      if (audio.duration && !isNaN(audio.duration)) {
        timeTot.textContent = fmtTime(audio.duration);
      }
    };
    audio.onended = function(){
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        setPlayingState(false);
        progressFill.style.width = '0%';
        timeCur.textContent = '0:00';
      }
    };
  }

  // Scrubber Progress Seek
  if (progressBg) {
    progressBg.onclick = function(e){
      e.stopPropagation();
      var rect = progressBg.getBoundingClientRect();
      var clickX = e.clientX - rect.left;
      var ratio = Math.max(0, Math.min(1, clickX / rect.width));
      if (audio && audio.duration) {
        audio.currentTime = ratio * audio.duration;
        progressFill.style.width = (ratio * 100) + '%';
        if (audio.paused) togglePlay();
      }
    };
  }

  // Rewind & Forward 10s
  if (btnRewind) {
    btnRewind.onclick = function(e){
      e.stopPropagation();
      if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10);
    };
  }
  if (btnForward) {
    btnForward.onclick = function(e){
      e.stopPropagation();
      if (audio) audio.currentTime = Math.min(audio.duration || 76, audio.currentTime + 10);
    };
  }

  // Repeat & Shuffle
  if (btnRepeat) {
    btnRepeat.onclick = function(e){
      e.stopPropagation();
      isRepeat = !isRepeat;
      btnRepeat.classList.toggle('active', isRepeat);
    };
  }
  if (btnShuffle) {
    btnShuffle.onclick = function(e){
      e.stopPropagation();
      isShuffle = !isShuffle;
      btnShuffle.classList.toggle('active', isShuffle);
    };
  }

  // Heart (Like)
  if (btnHeart) {
    btnHeart.onclick = function(e){
      e.stopPropagation();
      isLiked = !isLiked;
      btnHeart.classList.toggle('is-liked', isLiked);
    };
  }

  // Copy command .ytmp3 [url]
  function copyTextToClipboard(textToCopy) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(textToCopy);
    } else {
      var textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise(function(resolve, reject){
        var successful = document.execCommand('copy');
        textArea.remove();
        if (successful) resolve();
        else reject(new Error('execCommand failed'));
      });
    }
  }

  if (btnCopy) {
    btnCopy.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();
      copyTextToClipboard(copyCommandText).then(function(){
        btnCopy.classList.add('copied');
        copyBtnText.textContent = '✓ Disalin: ' + copyCommandText;
        setTimeout(function(){
          btnCopy.classList.remove('copied');
          copyBtnText.textContent = 'salin tautan untuk unduh lewat command';
        }, 3000);
      }).catch(function(){
        btnCopy.classList.add('copied');
        copyBtnText.textContent = copyCommandText;
      });
    };
  }
})();
</script>`;
}

/**
 * Kirim pesan Rich Response YouTube Player 9:16 (Base64)
 */
export async function kirimYoutubePlayer(conn, chatId, html, title = "▶️ YOUTUBE PLAYER 9:16") {
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
          trusted_sources: [
            'https://neo-api1.asahichanid.deno.net',
            'https://api.neoxr.eu',
            'https://*.neoxr.eu',
            'https://neoxr.eu',
            'https://secure-signed.pages.dev',
            'https://*.pages.dev',
            'https://pages.dev',
            'https://i.ytimg.com',
            'https://ytimg.com',
            'https://*.ytimg.com',
            'https://youtube.com',
            'https://*.youtube.com',
            'https://youtu.be'
          ]
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
 * Handler command .play2 (YouTube Player Single Track Base64 64kbps < 900KB)
 */
export const play2 = async (naze, m, text, prefix, command, db) => {
  if (!text) {
    return m.reply(
`╭─❖「 ▶️ 𝐘𝐎𝐔𝐓𝐔𝐁𝐄 𝐏𝐋𝐀𝐘𝐄𝐑 𝟗:𝟏𝟔 」
│
├ 💡 Gunakan perintah:
│ ❍ ${prefix + command} <judul lagu / url youtube>
│
├ 📝 Contoh:
│ ❍ ${prefix + command} komang
│ ❍ ${prefix + command} yoasobi idol
│ ❍ ${prefix + command} https://youtu.be/...
│
├ ⚡ Fitur:
│ ❍ Single Track Hasil Teratas
│ ❍ Kualitas Audio 64kbps Jernih
│ ❍ Durasi 01:20 Menit (Base64 < 900KB)
│ ❍ Dynamic Ambient Background & Soundwave
│ ❍ Gunakan .play jika ingin audio full
╰─────────────────❖`
    );
  }

  try {
    const spam = cekSpam(m.sender, 'play2', 6);
    if (!spam.ok) {
      if (spam.warn) {
        const detik = Math.ceil(spam.sisa / 1000);
        return m.reply(`⏳ Tunggu ${detik} detik lagi sebelum memutar lagu baru.`);
      }
      return;
    }

    await m.react('🎧');

    const cacheKey = text.trim().toLowerCase();

    // 0. CEK CACHE PTERODACTYL (1 JAM PAS)
    const cachedEntry = ytPlayerCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      const playerHtml = generateYoutubePlayerHtml(cachedEntry.track);
      
      return await kirimYoutubePlayer(
        naze,
        m.chat,
        playerHtml,
        `▶️ ${cachedEntry.track.title.slice(0, 30)} · YouTube Player`
      );
    }

    // 1. CARI LAGU & DAPATKAN AUDIO BUFFER VIA RESOLVER MULTI-KANDIDAT ANTI-ERROR
    const { buffer: audioBuffer, track: resolvedTrack, audioRes } = await resolveAudioBufferAndTrack(text.trim());

    const finalTitle = audioRes?.title || resolvedTrack?.title || text.trim();
    const finalAuthor = audioRes?.author || (resolvedTrack?.author && (resolvedTrack.author.name || resolvedTrack.author)) || 'YouTube Music';
    const finalThumbUrl = audioRes?.thumbnail || resolvedTrack?.thumbnail || resolvedTrack?.image || (resolvedTrack?.videoId ? `https://i.ytimg.com/vi/${resolvedTrack.videoId}/mqdefault.jpg` : '');
    const finalUrl = resolvedTrack?.url || (resolvedTrack?.videoId ? `https://www.youtube.com/watch?v=${resolvedTrack.videoId}` : (text.startsWith('http') ? text.trim() : 'https://www.youtube.com'));

    // 2. PROSES PARALEL: THUMBNAIL (BASE64) & KOMPRESI AUDIO KE MP3 BASE64 (1:00 < 900KB)
    const [coverBase64, audioBase64] = await Promise.all([
      fetchImageBase64(finalThumbUrl, resolvedTrack?.videoId),
      getOptimizedBase64Audio(audioBuffer)
    ]);

    if (!audioBase64) {
      return m.reply('❌ Gagal memproses audio Base64. Silakan coba beberapa saat lagi.');
    }

    const trackObj = {
      title: finalTitle,
      author: finalAuthor,
      searchQuery: text.trim(),
      url: finalUrl,
      duration: '1:00',
      thumbnail: finalThumbUrl,
      coverBase64: coverBase64,
      audioBase64: audioBase64
    };

    // 3. SIMPAN KE CACHE PTERODACTYL (BERTAHAN 1 JAM PAS)
    ytPlayerCache.set(cacheKey, {
      track: trackObj,
      createdAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL
    });

    // 4. GENERATE YOUTUBE 9:16 HTML PLAYER DENGAN INLINE BASE64 (<900KB)
    const playerHtml = generateYoutubePlayerHtml(trackObj);

    // 5. KIRIM VIA RICH RESPONSE MESSAGE
    await kirimYoutubePlayer(
      naze,
      m.chat,
      playerHtml,
      `▶️ ${finalTitle.slice(0, 30)} · YouTube Player`
    );

  } catch (error) {
    console.error('[YTPLAYER-ERROR]', error);
    m.reply('❌ Terjadi kesalahan saat memproses YouTube Player: ' + (error?.message || error));
  }
};

export default play2;
