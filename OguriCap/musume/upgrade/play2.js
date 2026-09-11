import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import axios from 'axios';
import {
  apiYoutubeAudio,
  apiYoutubeDownload,
  apiYoutubeSearch
} from '../../apiGlobal/index.js';
import { cekSpam } from '../umahelper.js';

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
      // Kompres cover dengan FFmpeg agar ukuran Base64 sangat ringan (~10-14KB)
      const compressed = await new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-i', 'pipe:0',
          '-vf', 'scale=320:-1',
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
 * Generate YouTube 9:16 HTML Player (Aesthetic Dynamic Background, Responsive Fit, Soundwave & 64kbps Base64)
 */
export function generateYoutubePlayerHtml(track = {}) {
  const coverUrl = track.coverBase64 || track.thumbnail || 'https://i.ytimg.com/vi/fKRtnMYMW08/mqdefault.jpg';
  const title = (track.title || 'YouTube Music').replace(/"/g, '&quot;');
  const artist = (track.author || 'YouTube Audio').replace(/"/g, '&quot;');
  const duration = track.duration || '01:20';
  const audioDataUri = track.audioBase64 || '';

  return `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
html,body{width:100%;margin:0;padding:0;background:#07070a;color:#fff;overflow-x:hidden;-webkit-font-smoothing:antialiased}
body{padding:6px 4px 10px;box-sizing:border-box}

/* WRAPPER CARD - FLUID RESPONSIVE FIT TANPA SHRINK OVERFLOW */
.yt-card{
  width:100%;
  max-width:420px;
  margin:0 auto;
  position:relative;
  border-radius:20px;
  overflow:hidden;
  background:#0f0f15;
  border:1.5px solid rgba(255,255,255,0.12);
  box-shadow:0 12px 32px rgba(0,0,0,0.85);
  box-sizing:border-box;
}

/* DYNAMIC AMBIENT BACKDROP (Clipped to Card, No Viewport Scale Bleed) */
.yt-ambient-bg{
  position:absolute;
  inset:0;
  background-image:url("${coverUrl}");
  background-size:cover;
  background-position:center;
  filter:blur(28px) brightness(0.32) saturate(1.7);
  opacity:0.65;
  z-index:0;
  pointer-events:none;
}

.yt-card-mesh{
  position:absolute;
  inset:0;
  background:radial-gradient(circle at 50% 0%, rgba(230,20,50,0.22) 0%, rgba(14,14,20,0.8) 50%, rgba(7,7,10,0.96) 100%);
  z-index:1;
  pointer-events:none;
}

#ytApp{
  position:relative;
  z-index:2;
  width:100%;
  padding:12px;
  display:flex;
  flex-direction:column;
  gap:9px;
  box-sizing:border-box;
}

/* HEADER */
.yt-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  height:28px;
}
.yt-brand{
  display:flex;
  align-items:center;
  gap:6px;
  font-size:11px;
  font-weight:900;
  letter-spacing:1px;
  color:#fff;
  text-transform:uppercase;
  text-shadow:0 0 10px rgba(255,0,0,0.5);
}
.yt-brand svg{
  width:20px;
  height:20px;
  fill:#ff1a1a;
  filter:drop-shadow(0 0 5px rgba(255,0,0,0.6));
}
.yt-badge-wrap{
  display:flex;
  align-items:center;
  gap:5px;
}
.yt-badge{
  font-size:9px;
  font-weight:800;
  color:#fff;
  background:linear-gradient(135deg, #ff0040 0%, #cc0020 100%);
  border-radius:8px;
  padding:2px 7px;
  letter-spacing:0.5px;
  box-shadow:0 2px 6px rgba(255,0,60,0.35);
}
.yt-badge-sec{
  font-size:9px;
  font-weight:700;
  color:#2ecc71;
  background:rgba(46,204,113,0.15);
  border:1px solid rgba(46,204,113,0.35);
  border-radius:8px;
  padding:2px 6px;
}

/* COVER ART CONTAINER */
.yt-cover-box{
  width:100%;
  aspect-ratio:16/9;
  border-radius:14px;
  position:relative;
  overflow:hidden;
  background:#141419;
  box-shadow:0 8px 24px rgba(0,0,0,0.7), 0 0 14px rgba(255,0,40,0.2);
  border:1.2px solid rgba(255,255,255,0.12);
}
.yt-cover-img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}
.yt-cover-overlay{
  position:absolute;
  inset:0;
  background:linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
  pointer-events:none;
}

/* MINI LIVE EQUALIZER OVERLAY */
.yt-eq-overlay{
  position:absolute;
  bottom:8px;
  right:9px;
  display:flex;
  align-items:flex-end;
  gap:2.5px;
  height:15px;
  background:rgba(0,0,0,0.6);
  padding:2.5px 5px;
  border-radius:5px;
  border:1px solid rgba(255,255,255,0.12);
}
.yt-eq-bar{
  width:3px;
  background:#ff2a2a;
  border-radius:1px;
  height:3px;
  transition:height 0.1s ease;
}
.is-playing-eq .yt-eq-bar:nth-child(1){animation:eqAnim1 0.6s infinite ease-in-out alternate}
.is-playing-eq .yt-eq-bar:nth-child(2){animation:eqAnim2 0.45s infinite ease-in-out alternate}
.is-playing-eq .yt-eq-bar:nth-child(3){animation:eqAnim3 0.7s infinite ease-in-out alternate}
.is-playing-eq .yt-eq-bar:nth-child(4){animation:eqAnim1 0.5s infinite ease-in-out alternate}

@keyframes eqAnim1{0%{height:3px}100%{height:13px}}
@keyframes eqAnim2{0%{height:13px}100%{height:3px}}
@keyframes eqAnim3{0%{height:5px}100%{height:14px}}

.yt-live-tag{
  position:absolute;
  bottom:8px;
  left:9px;
  display:inline-flex;
  align-items:center;
  gap:4px;
  background:rgba(0,0,0,0.6);
  padding:2.5px 7px;
  border-radius:5px;
  font-size:9px;
  font-weight:700;
  color:#fff;
  border:1px solid rgba(255,255,255,0.12);
}
.yt-pulse-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#2ecc71;
  box-shadow:0 0 6px #2ecc71;
  animation:ytPulse 1.4s infinite;
}
@keyframes ytPulse{
  0%{opacity:1;transform:scale(1)}
  50%{opacity:0.4;transform:scale(0.85)}
  100%{opacity:1;transform:scale(1)}
}

/* TRACK INFO */
.yt-track-info{
  display:flex;
  flex-direction:column;
  gap:2px;
}
.yt-title{
  font-size:14px;
  font-weight:800;
  color:#fff;
  line-height:1.25;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  text-shadow:0 1px 3px rgba(0,0,0,0.8);
}
.yt-artist{
  font-size:11.5px;
  color:#b8b8c8;
  font-weight:600;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  display:flex;
  align-items:center;
  gap:4px;
}
.yt-artist svg{
  width:11px;
  height:11px;
  fill:#ff3333;
}

/* SOUNDWAVE VISUALIZER BAR */
.yt-wave-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:2px;
  height:16px;
  padding:0 1px;
  margin-top:1px;
}
.yt-wave-col{
  flex:1;
  background:rgba(255,255,255,0.16);
  border-radius:2px;
  height:3px;
  transition:height 0.15s ease, background 0.2s;
}
.is-playing-wave .yt-wave-col{
  background:linear-gradient(to top, #ff0044, #ff4466);
}
.is-playing-wave .yt-wave-col:nth-child(odd){animation:waveB 0.7s infinite alternate ease-in-out}
.is-playing-wave .yt-wave-col:nth-child(even){animation:waveA 0.5s infinite alternate ease-in-out}
.is-playing-wave .yt-wave-col:nth-child(3n){animation:waveC 0.6s infinite alternate ease-in-out}

@keyframes waveA{0%{height:3px}100%{height:14px}}
@keyframes waveB{0%{height:13px}100%{height:3px}}
@keyframes waveC{0%{height:5px}100%{height:15px}}

/* NOTICE BANNER: GUNAKAN .PLAY JIKA INGIN FULL */
.yt-notice-banner{
  background:rgba(255,0,60,0.1);
  border:1px solid rgba(255,0,60,0.28);
  border-radius:8px;
  padding:6px 9px;
  display:flex;
  align-items:center;
  gap:6px;
  font-size:10.5px;
  color:#ffb3be;
  box-shadow:0 2px 8px rgba(255,0,60,0.12);
}
.yt-notice-banner svg{
  width:14px;
  height:14px;
  fill:#ff3355;
  flex-shrink:0;
  filter:drop-shadow(0 0 3px rgba(255,0,60,0.5));
}
.yt-notice-banner strong{
  color:#fff;
  font-weight:800;
  text-decoration:underline;
}

/* SCRUBBER & TIMELINE */
.yt-scrubber-box{
  display:flex;
  flex-direction:column;
  gap:4px;
  margin-top:1px;
}
.yt-progress-bg{
  width:100%;
  height:5px;
  background:rgba(255,255,255,0.15);
  border-radius:3px;
  cursor:pointer;
  position:relative;
}
.yt-progress-fill{
  height:100%;
  width:0%;
  background:linear-gradient(90deg, #ff0044 0%, #ff1a1a 100%);
  border-radius:3px;
  position:relative;
  box-shadow:0 0 6px rgba(255,0,60,0.5);
  transition:width 0.1s linear;
}
.yt-progress-handle{
  position:absolute;
  right:-4px;
  top:50%;
  transform:translateY(-50%);
  width:10px;
  height:10px;
  border-radius:50%;
  background:#fff;
  box-shadow:0 0 6px rgba(255,0,0,0.8);
}
.yt-time-row{
  display:flex;
  justify-content:space-between;
  font-size:9.5px;
  font-weight:700;
  color:#9a9ab0;
}

/* CONTROLS ROW */
.yt-controls{
  display:flex;
  align-items:center;
  justify-content:space-evenly;
  margin-top:2px;
}
.yt-btn-sub{
  background:none;
  border:none;
  color:#9595a5;
  cursor:pointer;
  padding:6px;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:transform 0.15s, color 0.15s;
}
.yt-btn-sub:hover{color:#fff;transform:scale(1.1)}
.yt-btn-sub:active{transform:scale(0.9)}
.yt-btn-sub.active{color:#ff1a1a}
.yt-btn-sub svg{width:18px;height:18px;fill:currentColor}

.yt-play-btn{
  width:52px;
  height:52px;
  border-radius:50%;
  background:linear-gradient(135deg, #ff0044 0%, #d4001a 100%);
  border:none;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  box-shadow:0 5px 18px rgba(255,0,50,0.55), 0 0 12px rgba(255,0,0,0.25);
  transition:transform 0.15s, box-shadow 0.15s;
}
.yt-play-btn:hover{transform:scale(1.06);box-shadow:0 6px 22px rgba(255,0,50,0.7)}
.yt-play-btn:active{transform:scale(0.94)}
.yt-play-btn svg{width:24px;height:24px;fill:#fff;margin-left:2px}
.yt-play-btn.is-playing svg{margin-left:0}

/* BOTTOM COMPACT LOG STATUS */
.yt-log-bar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  background:rgba(255,255,255,0.05);
  border:1px solid rgba(255,255,255,0.08);
  border-radius:8px;
  padding:5px 8px;
  font-size:9.5px;
  color:#a5a5b5;
  margin-top:1px;
}
.yt-log-left{
  display:flex;
  align-items:center;
  gap:5px;
}
.yt-status-dot{
  width:5px;
  height:5px;
  border-radius:50%;
  background:#2ecc71;
  box-shadow:0 0 5px #2ecc71;
  transition:background 0.3s ease;
}
.yt-log-text{
  font-weight:700;
  color:#eee;
}
.yt-log-right{
  color:#999;
  font-weight:600;
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
      <div class="yt-brand">
        <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <span>YOUTUBE MUSIC</span>
      </div>
      <div class="yt-badge-wrap">
        <div class="yt-badge">01:20</div>
        <div class="yt-badge-sec">64 KBPS</div>
      </div>
    </div>

    <!-- COVER ART -->
    <div class="yt-cover-box" id="coverBox">
      <img class="yt-cover-img" id="coverImg" src="${coverUrl}" referrerpolicy="no-referrer" alt="Cover"/>
      <div class="yt-cover-overlay"></div>
      
      <!-- MINI EQUALIZER ON COVER -->
      <div class="yt-eq-overlay" id="eqOverlay">
        <div class="yt-eq-bar"></div>
        <div class="yt-eq-bar"></div>
        <div class="yt-eq-bar"></div>
        <div class="yt-eq-bar"></div>
      </div>

      <div class="yt-live-tag">
        <div class="yt-pulse-dot" id="pulseDot"></div>
        <span id="liveState">Siap Diputar</span>
      </div>
    </div>

    <!-- TRACK META -->
    <div class="yt-track-info">
      <div class="yt-title" id="trackTitle">${title}</div>
      <div class="yt-artist" id="trackArtist">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <span>${artist}</span>
      </div>
    </div>

    <!-- 24-BAR SOUNDWAVE VISUALIZER -->
    <div class="yt-wave-row" id="waveRow">
      <div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div>
      <div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div>
      <div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div>
      <div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div>
      <div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div><div class="yt-wave-col"></div>
    </div>

    <!-- NOTICE BANNER: GUNAKAN .PLAY JIKA INGIN FULL -->
    <div class="yt-notice-banner">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      <span>Audio preview 01:20 (64kbps). <strong>Gunakan .play jika ingin full</strong></span>
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
      <!-- REPEAT -->
      <button class="yt-btn-sub" id="btnRepeat" title="Ulangi Lagu">
        <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
      </button>

      <!-- REWIND 10s -->
      <button class="yt-btn-sub" id="btnRewind" title="Mundur 10 Detik">
        <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
      </button>

      <!-- MAIN PLAY/PAUSE -->
      <button class="yt-play-btn" id="btnPlay" title="Putar / Jeda">
        <svg id="playIcon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>

      <!-- FORWARD 10s -->
      <button class="yt-btn-sub" id="btnForward" title="Maju 10 Detik">
        <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
      </button>

      <!-- MUTE/VOLUME -->
      <button class="yt-btn-sub" id="btnMute" title="Bisu / Suara">
        <svg id="volIcon" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
      </button>
    </div>

    <!-- BOTTOM COMPACT STATUS LOG -->
    <div class="yt-log-bar">
      <div class="yt-log-left">
        <div class="yt-status-dot" id="statusDot"></div>
        <span class="yt-log-text" id="statusLog">⚡ Base64 64kbps • Sentuh Tombol Play</span>
      </div>
      <div class="yt-log-right" id="bitrateLog">64kbps MP3</div>
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
  var btnMute = document.getElementById('btnMute');
  var volIcon = document.getElementById('volIcon');
  var statusLog = document.getElementById('statusLog');
  var statusDot = document.getElementById('statusDot');
  var liveState = document.getElementById('liveState');
  var eqOverlay = document.getElementById('eqOverlay');
  var waveRow = document.getElementById('waveRow');

  var isPlaying = false;
  var isRepeat = false;
  var isMuted = false;

  function fmtTime(sec){
    if (!sec || isNaN(sec)) return '0:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setVisualizerState(active){
    if (eqOverlay) {
      if (active) eqOverlay.classList.add('is-playing-eq');
      else eqOverlay.classList.remove('is-playing-eq');
    }
    if (waveRow) {
      if (active) waveRow.classList.add('is-playing-wave');
      else waveRow.classList.remove('is-playing-wave');
    }
  }

  function updateStatus(text, dotColor, liveText){
    if (statusLog) statusLog.textContent = text;
    if (statusDot && dotColor) {
      statusDot.style.background = dotColor;
      statusDot.style.boxShadow = '0 0 6px ' + dotColor;
    }
    if (liveState && liveText) liveState.textContent = liveText;
  }

  function togglePlay(){
    if (!audio) return;
    if (audio.paused) {
      updateStatus('⚡ Memutar Base64 audio...', '#ff0044', 'Playing');
      var p = audio.play();
      if (p !== undefined) {
        p.then(function(){
          isPlaying = true;
          setVisualizerState(true);
          btnPlay.classList.add('is-playing');
          playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
          updateStatus('▶️ Sedang Memutar (64kbps)', '#ff0044', 'Playing');
        }).catch(function(err){
          console.warn('Playback error:', err);
          audio.load();
          audio.play().then(function(){
            isPlaying = true;
            setVisualizerState(true);
            btnPlay.classList.add('is-playing');
            playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            updateStatus('▶️ Sedang Memutar (64kbps)', '#ff0044', 'Playing');
          }).catch(function(err2){
            console.error('Final play error:', err2);
            isPlaying = false;
            setVisualizerState(false);
            btnPlay.classList.remove('is-playing');
            playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
            updateStatus('👉 Sentuh Play untuk memulai', '#f39c12', 'Sentuh Play');
          });
        });
      }
    } else {
      isPlaying = false;
      audio.pause();
      setVisualizerState(false);
      btnPlay.classList.remove('is-playing');
      playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      updateStatus('⏸️ Audio Dijeda', '#f39c12', 'Paused');
    }
  }

  // Bind Click & Touch
  if (btnPlay) {
    btnPlay.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      togglePlay();
    });
  }

  if (audio) {
    audio.onplay = function(){
      isPlaying = true;
      setVisualizerState(true);
      btnPlay.classList.add('is-playing');
      playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      updateStatus('▶️ Sedang Memutar (64kbps)', '#ff0044', 'Playing');
    };

    audio.onpause = function(){
      isPlaying = false;
      setVisualizerState(false);
      btnPlay.classList.remove('is-playing');
      playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      updateStatus('⏸️ Audio Dijeda', '#f39c12', 'Paused');
    };

    audio.oncanplay = function(){
      if (!isPlaying) {
        updateStatus('⚡ Base64 64kbps • Sentuh Tombol Play', '#2ecc71', 'Siap Diputar');
      }
    };

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
        isPlaying = false;
        setVisualizerState(false);
        btnPlay.classList.remove('is-playing');
        playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        progressFill.style.width = '0%';
        timeCur.textContent = '0:00';
        updateStatus('✅ Preview 01:20 selesai', '#2ecc71', 'Completed');
      }
    };
  }

  if (progressBg) {
    progressBg.onclick = function(e){
      e.stopPropagation();
      var rect = progressBg.getBoundingClientRect();
      var clickX = e.clientX - rect.left;
      var ratio = Math.max(0, Math.min(1, clickX / rect.width));
      if (audio && audio.duration) {
        audio.currentTime = ratio * audio.duration;
        progressFill.style.width = (ratio * 100) + '%';
        if (audio.paused) {
          togglePlay();
        }
      }
    };
  }

  if (btnRewind) {
    btnRewind.onclick = function(e){
      e.stopPropagation();
      if (audio) {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
      }
    };
  }

  if (btnForward) {
    btnForward.onclick = function(e){
      e.stopPropagation();
      if (audio) {
        audio.currentTime = Math.min(audio.duration || 80, audio.currentTime + 10);
      }
    };
  }

  if (btnRepeat) {
    btnRepeat.onclick = function(e){
      e.stopPropagation();
      isRepeat = !isRepeat;
      btnRepeat.classList.toggle('active', isRepeat);
      updateStatus(isRepeat ? '🔂 Repeat 1 Lagu Aktif' : '⚡ Normal Playback', '#2ecc71', isRepeat ? 'Repeat' : 'Siap Diputar');
    };
  }

  if (btnMute) {
    btnMute.onclick = function(e){
      e.stopPropagation();
      isMuted = !isMuted;
      if (audio) audio.muted = isMuted;
      btnMute.classList.toggle('active', isMuted);
      if (isMuted) {
        volIcon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
        updateStatus('🔇 Suara Dibisukan', '#f39c12', 'Muted');
      } else {
        volIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
        updateStatus('🔊 Suara Aktif', '#2ecc71', 'Siap Diputar');
      }
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

    // 2. PROSES PARALEL: THUMBNAIL (BASE64) & KOMPRESI AUDIO KE MP3 BASE64 64kbps (01:20 < 900KB)
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
      duration: '01:20',
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
