/**
 * apiGlobal/services/downloader/spotify-scrap.js
 * -----------------------------------------------------------------------
 * Layanan Scraper Spotify Mandiri Berkecepatan Tinggi (Super Cepat & Fleksibel).
 *
 * Sesuai instruksi:
 * - Wajib menggunakan scrap mulai dari search hingga download audio tanpa apikey.
 * - Scrap menjadi engine UTAMA (super cepat, sub-second to instant cache).
 * - 2 API (Neoxr & Naze) tetap digunakan sebagai BACKUP cadangan jika scrap gagal.
 * - Fitur lirik tetap sama persis (LRCLIB + Lyrics.ovh) tanpa diubah.
 * - In-memory cache serentak 5 menit TTL + Auto Garbage Collection.
 */

import axios from 'axios';
import https from 'https';
import YTMusic from 'ytmusic-api';
import yts from 'yt-search';
import { apiSpotifySearch, apiSpotifyDownload } from './spotify.js';
import { apiYoutubeScrapSearch, apiYoutubeScrapAudio } from './yt-scrap.js';
import { ValidationError } from '../../core/errors.js';

// -----------------------------------------------------------------------
// Keep-Alive Agent & YTMusic Singleton
// -----------------------------------------------------------------------
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 30,
  maxFreeSockets: 10,
  timeout: 15000
});

let ytmInstance = null;
let ytmInitPromise = null;

async function getYtMusic() {
  if (ytmInstance) return ytmInstance;
  if (!ytmInitPromise) {
    ytmInitPromise = (async () => {
      try {
        const ytm = new YTMusic();
        await ytm.initialize();
        ytmInstance = ytm;
        return ytmInstance;
      } catch (err) {
        console.warn('⚠️ YTMusic init warning:', err?.message || err);
        ytmInitPromise = null;
        return null;
      }
    })();
  }
  return ytmInitPromise;
}

// -----------------------------------------------------------------------
// In-Memory Cache (5 Menit TTL) + Auto Cleanup
// -----------------------------------------------------------------------
const searchCache = new Map();
const trackCache = new Map();
const lyricsCache = new Map();
const streamCache = new Map();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit
const MAX_CACHE_ENTRIES = 200;

function pruneExpiredCache() {
  const now = Date.now();
  for (const [k, v] of searchCache.entries()) if (now > v.expires) searchCache.delete(k);
  for (const [k, v] of trackCache.entries()) if (now > v.expires) trackCache.delete(k);
  for (const [k, v] of lyricsCache.entries()) if (now > v.expires) lyricsCache.delete(k);
  for (const [k, v] of streamCache.entries()) if (now > v.expires) streamCache.delete(k);
}

const cleanupTimer = setInterval(pruneExpiredCache, 60 * 1000);
if (typeof cleanupTimer?.unref === 'function') {
  cleanupTimer.unref();
}

function getFromCache(cacheMap, key) {
  pruneExpiredCache();
  const item = cacheMap.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cacheMap.delete(key);
    return null;
  }
  return item.data;
}

function saveToCache(cacheMap, key, data, ttlMs = CACHE_TTL_MS) {
  pruneExpiredCache();
  if (cacheMap.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cacheMap.keys().next().value;
    if (firstKey) cacheMap.delete(firstKey);
  }
  cacheMap.set(key, { data, expires: Date.now() + ttlMs });
}

// -----------------------------------------------------------------------
// Helper: Ekstraksi Spotify Track ID & YouTube Video ID
// -----------------------------------------------------------------------
export function extractSpotifyTrackId(url = '') {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/track[/:]([a-zA-Z0-9]{22})/i) ||
                url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/i);
  return match ? match[1] : null;
}

export function extractYouTubeVideoId(urlOrId = '') {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
}

// -----------------------------------------------------------------------
// 1. Ekstraksi Metadata Track (oEmbed + Spotify Embed Scraper + Fallback)
// -----------------------------------------------------------------------
export async function apiSpotifyScrapTrack(url) {
  if (!url) throw new ValidationError('apiSpotifyScrapTrack: parameter "url" wajib diisi.');
  const trackId = extractSpotifyTrackId(url);
  const cacheKey = trackId || url;
  const cached = getFromCache(trackCache, cacheKey);
  if (cached) return cached;

  let title = 'Spotify Track';
  let artist = 'Spotify Artist';
  let album = '';
  let thumbnail = 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0';
  let duration = '--:--';
  let duration_ms = 0;
  let releaseDate = '';

  // Jika berupa URL YouTube langsung (misal dari hasil scraper search)
  const ytId = extractYouTubeVideoId(url);
  if (ytId && !trackId) {
    try {
      const ytInfo = await yts({ videoId: ytId });
      if (ytInfo) {
        title = ytInfo.title || title;
        artist = ytInfo.author?.name || artist;
        thumbnail = ytInfo.thumbnail || thumbnail;
        duration = ytInfo.timestamp || duration;
        duration_ms = (ytInfo.seconds || 0) * 1000;
        album = title;
      }
    } catch (_) {}
  }

  // 1. Ekstraksi langsung via Spotify Embed (super kaya metadata & cepat tanpa apikey)
  if (trackId) {
    try {
      const embedRes = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 3500,
        httpsAgent: keepAliveAgent
      });
      const match = embedRes.data?.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        const json = JSON.parse(match[1]);
        const entity = json?.props?.pageProps?.state?.data?.entity;
        if (entity) {
          if (entity.name || entity.title) title = (entity.name || entity.title).trim();
          if (Array.isArray(entity.artists) && entity.artists.length > 0) {
            artist = entity.artists.map(a => a.name).join(', ').trim();
          }
          if (entity.duration) {
            duration_ms = entity.duration;
            const sec = Math.floor(duration_ms / 1000);
            duration = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
          }
          if (entity.releaseDate?.isoString) {
            releaseDate = entity.releaseDate.isoString.split('T')[0];
          }
          const img = entity.visualIdentity?.image?.[0]?.url;
          if (img) thumbnail = img;
        }
      }
    } catch (_) {}
  }

  // 2. Fallback via oEmbed jika embed HTML tidak memberikan metadata lengkap
  if (trackId && (!thumbnail || artist === 'Spotify Artist')) {
    try {
      const oembedRes = await axios.get('https://open.spotify.com/oembed', {
        params: { url },
        timeout: 3000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        httpsAgent: keepAliveAgent
      });
      if (oembedRes.data) {
        const d = oembedRes.data;
        if ((!title || title === 'Spotify Track') && d.title) {
          title = d.title.trim();
        }
        if (d.author_name && artist === 'Spotify Artist') {
          artist = d.author_name.trim();
        }
        if (d.thumbnail_url) {
          thumbnail = d.thumbnail_url;
        }
      }
    } catch (_) {}
  }

  // 3. Fallback ke Backup API jika scraping sama sekali belum menghasilkan title/artist
  if (trackId && (!artist || artist === 'Spotify Artist' || !title || title === 'Spotify Track')) {
    try {
      const directMeta = await apiSpotifyDownload(url);
      if (directMeta?.result) {
        title = directMeta.result.title || title;
        artist = directMeta.result.artist || artist;
        thumbnail = directMeta.result.thumbnail || thumbnail;
        duration = directMeta.result.duration || duration;
      }
    } catch (_) {}
  }

  const result = {
    id: trackId || ytId || '',
    url,
    title,
    artist,
    album: album || title,
    thumbnail: thumbnail || 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0',
    duration,
    duration_ms,
    releaseDate
  };

  saveToCache(trackCache, cacheKey, result);
  return result;
}

// -----------------------------------------------------------------------
// 2. Pencarian Spotify Super Cepat (apiSpotifyScrapSearch)
//    - UTAMA: Scraper mandiri tanpa API key (YTMusic + yt-search + LRCLIB)
//    - BACKUP: 2 API (Neoxr & Naze) jika seluruh scraper gagal
// -----------------------------------------------------------------------
export async function apiSpotifyScrapSearch(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('apiSpotifyScrapSearch: parameter "query" wajib diisi.');
  }
  const cleanQ = query.trim().toLowerCase();
  const cached = getFromCache(searchCache, cleanQ);
  if (cached) return cached;

  let standardized = [];
  let providerUsed = '';

  // === TIER 1 (UTAMA): Scraper YouTube Music API (0 Apikey, Kualitas & Kecepatan Tinggi) ===
  try {
    const ytm = await getYtMusic();
    if (ytm) {
      const songs = await ytm.searchSongs(query.trim());
      if (Array.isArray(songs) && songs.length > 0) {
        standardized = songs.slice(0, 10).map((item, idx) => {
          const title = item.name || 'Spotify Track';
          const artist = item.artist?.name || 'Spotify Artist';
          const durationSec = typeof item.duration === 'number' ? item.duration : 0;
          const duration = durationSec > 0
            ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`
            : '--:--';
          const thumbnail = item.thumbnails?.[item.thumbnails.length - 1]?.url ||
                            item.thumbnails?.[0]?.url ||
                            'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0';
          const videoId = item.videoId || '';
          const url = videoId
            ? `https://www.youtube.com/watch?v=${videoId}`
            : `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + artist)}`;

          return {
            index: idx + 1,
            id: videoId || `track-${idx}`,
            title,
            name: title,
            artist,
            author: artist,
            album: item.album?.name || title,
            thumbnail,
            image: thumbnail,
            duration,
            duration_ms: durationSec * 1000,
            url
          };
        });
        providerUsed = 'spotify-scraper (ytmusic)';
      }
    }
  } catch (errYtm) {
    console.warn('⚠️ Scraper YTMusic search error:', errYtm?.message || errYtm);
  }

  // === TIER 2: Fallback Scraper yt-search (Lokal & Sangat Cepat, 0 Apikey) ===
  if (!standardized.length) {
    try {
      const ytRes = await yts(query.trim());
      const videos = Array.isArray(ytRes?.videos) ? ytRes.videos : [];
      if (videos.length > 0) {
        standardized = videos.slice(0, 10).map((item, idx) => {
          const rawTitle = item.title || 'Spotify Track';
          let title = rawTitle;
          let artist = item.author?.name || 'Spotify Artist';

          if (rawTitle.includes(' - ')) {
            const parts = rawTitle.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
          }

          const thumbnail = item.thumbnail || item.image || 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0';
          const duration = item.timestamp || (item.seconds ? `${Math.floor(item.seconds / 60)}:${String(item.seconds % 60).padStart(2, '0')}` : '--:--');

          return {
            index: idx + 1,
            id: item.videoId || `track-${idx}`,
            title,
            name: title,
            artist,
            author: artist,
            album: title,
            thumbnail,
            image: thumbnail,
            duration,
            duration_ms: (item.seconds || 0) * 1000,
            url: item.url || `https://www.youtube.com/watch?v=${item.videoId}`
          };
        });
        providerUsed = 'spotify-scraper (yt-search)';
      }
    } catch (errYts) {
      console.warn('⚠️ Scraper yts search error:', errYts?.message || errYts);
    }
  }

  // === TIER 3: Fallback Scraper LRCLIB Metadata Search (0 Apikey) ===
  if (!standardized.length) {
    try {
      const lrcRes = await axios.get('https://lrclib.net/api/search', {
        params: { q: query.trim() },
        timeout: 3500,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        httpsAgent: keepAliveAgent
      });
      if (Array.isArray(lrcRes.data) && lrcRes.data.length > 0) {
        standardized = lrcRes.data.slice(0, 10).map((item, idx) => {
          const title = item.trackName || 'Spotify Track';
          const artist = item.artistName || 'Spotify Artist';
          const durationSec = typeof item.duration === 'number' ? Math.round(item.duration) : 0;
          const duration = durationSec > 0
            ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`
            : '--:--';

          return {
            index: idx + 1,
            id: `lrc-${item.id || idx}`,
            title,
            name: title,
            artist,
            author: artist,
            album: item.albumName || title,
            thumbnail: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0',
            image: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0',
            duration,
            duration_ms: durationSec * 1000,
            url: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + artist)}`
          };
        });
        providerUsed = 'spotify-scraper (lrclib)';
      }
    } catch (errLrc) {
      console.warn('⚠️ Scraper LRCLIB search error:', errLrc?.message || errLrc);
    }
  }

  // === TIER 4 (BACKUP): 2 API Backup (Neoxr & Naze) jika seluruh scraper di atas gagal ===
  if (!standardized.length) {
    console.log('🔄 Seluruh Scraper tidak mengembalikan hasil, fallback ke 2 API Backup (Neoxr / Naze)...');
    try {
      const searchRes = await apiSpotifySearch(query);
      const list = Array.isArray(searchRes?.result) ? searchRes.result : [];

      standardized = list.map((item, idx) => {
        let title = item.title || item.name || 'Spotify Track';
        let artist = item.artist || item.author || 'Spotify Artist';
        if (title.includes(' - ') && (!artist || artist === 'Spotify Artist')) {
          const splitted = title.split(' - ');
          artist = splitted[0].trim();
          title = splitted.slice(1).join(' - ').trim();
        }
        const thumbnail = item.thumbnail || item.image || item.album?.images?.[0]?.url || 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0';
        const duration = item.duration || (item.duration_ms ? `${Math.floor(item.duration_ms / 60000)}:${String(Math.floor((item.duration_ms % 60000) / 1000)).padStart(2, '0')}` : '--:--');
        const url = item.url || (item.id ? `https://open.spotify.com/track/${item.id}` : '');

        return {
          index: idx + 1,
          id: item.id || extractSpotifyTrackId(url) || `track-${idx}`,
          title,
          name: title,
          artist,
          author: artist,
          album: item.album?.name || title,
          thumbnail,
          image: thumbnail,
          duration,
          duration_ms: item.duration_ms || 0,
          popularity: item.popularity || null,
          url
        };
      });
      providerUsed = searchRes?.provider || 'backup-api';
    } catch (errApi) {
      console.error('❌ Backup API Spotify search juga error:', errApi?.message || errApi);
    }
  }

  const envelopeRes = {
    result: standardized,
    provider: providerUsed || 'spotify-scraper',
    total: standardized.length
  };

  saveToCache(searchCache, cleanQ, envelopeRes);
  return envelopeRes;
}

// -----------------------------------------------------------------------
// 3. Ekstraksi Lirik Lagu Multi-Tier (LRCLIB + Lyrics.ovh)
//    (Tetap sama persis sesuai instruksi, jangan diubah)
// -----------------------------------------------------------------------
export async function apiSpotifyLyrics(title = '', artist = '', rawQuery = '') {
  const cleanTitle = String(title || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
  const cleanArtist = String(artist || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
  const cacheKey = `${cleanTitle.toLowerCase()}::${cleanArtist.toLowerCase()}::${(rawQuery || '').toLowerCase()}`;

  const cached = getFromCache(lyricsCache, cacheKey);
  if (cached) return cached;

  let lyrics = null;
  let syncedLyrics = null;
  let source = '';

  // Tier 1: LRCLIB by track_name & artist_name (akurasi tertinggi & super cepat)
  if (cleanTitle) {
    try {
      const res = await axios.get('https://lrclib.net/api/get', {
        params: {
          track_name: cleanTitle,
          artist_name: cleanArtist || undefined
        },
        timeout: 4500,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        httpsAgent: keepAliveAgent
      });
      if (res.data?.plainLyrics) {
        lyrics = res.data.plainLyrics;
        syncedLyrics = res.data.syncedLyrics || null;
        source = 'LRCLIB (Exact)';
      }
    } catch (_) {}
  }

  // Tier 2: LRCLIB by general search query
  if (!lyrics) {
    const qSearch = rawQuery || `${cleanTitle} ${cleanArtist}`.trim();
    if (qSearch) {
      try {
        const res = await axios.get('https://lrclib.net/api/search', {
          params: { q: qSearch },
          timeout: 4500,
          headers: { 'User-Agent': 'Mozilla/5.0' },
          httpsAgent: keepAliveAgent
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
          const match = res.data.find(v => v.plainLyrics) || res.data[0];
          if (match?.plainLyrics) {
            lyrics = match.plainLyrics;
            syncedLyrics = match.syncedLyrics || null;
            source = 'LRCLIB (Search)';
          }
        }
      } catch (_) {}
    }
  }

  // Tier 3: Lyrics.ovh Fallback
  if (!lyrics && cleanTitle && cleanArtist) {
    try {
      const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`, {
        timeout: 4000
      });
      if (res.data?.lyrics) {
        lyrics = res.data.lyrics.trim();
        source = 'Lyrics.ovh';
      }
    } catch (_) {}
  }

  const result = {
    hasLyrics: Boolean(lyrics && lyrics.trim().length > 10),
    lyrics: lyrics ? lyrics.trim() : null,
    syncedLyrics: syncedLyrics ? syncedLyrics.trim() : null,
    source: source || 'None',
    trackName: cleanTitle || title,
    artistName: cleanArtist || artist
  };

  saveToCache(lyricsCache, cacheKey, result);
  return result;
}

// -----------------------------------------------------------------------
// 4. Ekstraksi Audio Multi-Engine (apiSpotifyScrapAudio)
//    - UTAMA: Scraper Audio Mandiri (0 Apikey, Sangat Cepat & Direct)
//    - BACKUP: 2 API (Neoxr & Naze AIO) jika scraper gagal
// -----------------------------------------------------------------------
export async function apiSpotifyScrapAudio(url, meta = {}) {
  if (!url) throw new ValidationError('apiSpotifyScrapAudio: parameter "url" wajib diisi.');
  const cacheKey = extractSpotifyTrackId(url) || extractYouTubeVideoId(url) || url;
  const cached = getFromCache(streamCache, cacheKey);
  if (cached) return cached;

  let title = meta.title || meta.name || '';
  let artist = meta.artist || meta.author || '';
  let thumbnail = meta.thumbnail || meta.image || '';

  // Jika title belum ada, gali metadata terlebih dahulu lewat scraper track (cepat & tanpa apikey)
  if (!title) {
    try {
      const trackInfo = await apiSpotifyScrapTrack(url);
      title = trackInfo.title;
      artist = trackInfo.artist;
      thumbnail = trackInfo.thumbnail;
    } catch (_) {}
  }

  let downloadUrl = null;
  let providerUsed = '';

  // =====================================================================
  // JALUR 1 (UTAMA): SCRAPER AUDIO MANDIRI TANPA APIKEY (SUPER CEPAT)
  // =====================================================================
  const ytDirectId = extractYouTubeVideoId(url);

  // Jika URL input langsung berupa link YouTube dari hasil scraper search:
  if (ytDirectId) {
    try {
      const ytAudio = await apiYoutubeScrapAudio(`https://www.youtube.com/watch?v=${ytDirectId}`);
      if (ytAudio?.result?.download) {
        downloadUrl = ytAudio.result.download;
        providerUsed = `spotify-scraper (direct-yt: ${ytAudio.provider})`;
        if (!thumbnail && ytAudio.result.thumbnail) thumbnail = ytAudio.result.thumbnail;
      }
    } catch (errDirect) {
      console.warn('⚠️ Scraper direct YT audio error:', errDirect?.message || errDirect);
    }
  }

  // Jika URL berupa Spotify track URL atau query:
  if (!downloadUrl) {
    const cleanSearchQuery = `${artist !== 'Spotify Artist' ? artist : ''} ${title !== 'Spotify Track' ? title : ''}`.trim() || title;
    if (cleanSearchQuery) {
      try {
        const ytSearch = await apiYoutubeScrapSearch(cleanSearchQuery);
        const firstVideo = ytSearch.result?.[0];
        if (firstVideo?.url) {
          const ytAudio = await apiYoutubeScrapAudio(firstVideo.url);
          if (ytAudio?.result?.download) {
            downloadUrl = ytAudio.result.download;
            providerUsed = `spotify-scraper (${ytAudio.provider})`;
            if (!thumbnail && firstVideo.thumbnail) thumbnail = firstVideo.thumbnail;
          }
        }
      } catch (errScrap) {
        console.warn('⚠️ Scraper Spotify audio error:', errScrap?.message || errScrap);
      }
    }
  }

  // =====================================================================
  // JALUR 2 (BACKUP): 2 API (Neoxr & Naze AIO) JIKA SCRAPER GAGAL
  // =====================================================================
  if (!downloadUrl) {
    console.log('🔄 Scraper audio tidak berhasil, mencoba 2 API Backup (Neoxr & Naze)...');
    try {
      const directDl = await apiSpotifyDownload(url);
      if (directDl?.result?.download || directDl?.result?.url) {
        downloadUrl = directDl.result.download || directDl.result.url;
        providerUsed = directDl.provider || 'backup-api';
        if ((!title || title === 'Spotify Track') && directDl.result.title) title = directDl.result.title;
        if ((!artist || artist === 'Spotify Artist') && directDl.result.artist) artist = directDl.result.artist;
        if (!thumbnail && directDl.result.thumbnail) thumbnail = directDl.result.thumbnail;
      }
    } catch (errApi) {
      console.error('❌ Backup API Spotify download error:', errApi?.message || errApi);
    }
  }

  if (!downloadUrl) {
    throw new Error('Gagal mendapatkan stream audio untuk lagu Spotify ini (Scraper & 2 API Backup telah dicoba).');
  }

  const finalResult = {
    download: downloadUrl,
    url: downloadUrl,
    title: title || 'Spotify Track',
    artist: artist || 'Spotify Artist',
    thumbnail: thumbnail || 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0',
    filename: `${title || 'Spotify'} - ${artist || 'Audio'}.mp3`,
    provider: providerUsed
  };

  saveToCache(streamCache, cacheKey, finalResult);
  return finalResult;
}

export default {
  extractSpotifyTrackId,
  extractYouTubeVideoId,
  apiSpotifyScrapTrack,
  apiSpotifyScrapSearch,
  apiSpotifyLyrics,
  apiSpotifyScrapAudio
};

