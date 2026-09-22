/**
 * apiGlobal/services/downloader/spotify-scrap.js
 * -----------------------------------------------------------------------
 * Layanan Scraper Spotify Mandiri Berkecepatan Tinggi (Super Cepat & Fleksibel).
 *
 * Fitur:
 * 1. apiSpotifyScrapSearch(query)  : Pencarian lagu Spotify super cepat & kaya metadata
 * 2. apiSpotifyLyrics(title, artist, query) : Ekstraksi lirik lagu (plain & synced) multi-tier (LRCLIB + Lyrics.ovh)
 * 3. apiSpotifyScrapTrack(url)     : Ekstraksi info track langsung lewat Spotify oEmbed & metadata cache
 * 4. apiSpotifyScrapAudio(url, meta): Pengambilan audio multi-engine (Direct Spotify CDN stream + YouTube high-speed audio converter)
 * 5. In-memory cache serentak 5 menit TTL + Auto Garbage Collection
 */

import axios from 'axios';
import { apiSpotifySearch, apiSpotifyDownload } from './spotify.js';
import { apiYoutubeScrapSearch, apiYoutubeScrapAudio } from './yt-scrap.js';
import { ValidationError } from '../../core/errors.js';

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
// Helper: Ekstraksi Spotify Track ID
// -----------------------------------------------------------------------
export function extractSpotifyTrackId(url = '') {
  if (!url) return null;
  const match = url.match(/track[/:]([a-zA-Z0-9]{22})/i) ||
                url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/i);
  return match ? match[1] : null;
}

// -----------------------------------------------------------------------
// 1. Ekstraksi Metadata Track (oEmbed + Fallback)
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
  let thumbnail = '';
  let duration = '--:--';
  let duration_ms = 0;
  let releaseDate = '';

  // 1. Ekstraksi langsung via Spotify Embed (super kaya metadata & cepat)
  if (trackId) {
    try {
      const embedRes = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 4500
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
  if (!thumbnail || artist === 'Spotify Artist') {
    try {
      const oembedRes = await axios.get('https://open.spotify.com/oembed', {
        params: { url },
        timeout: 4000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (oembedRes.data) {
        const d = oembedRes.data;
        if ((!title || title === 'Spotify Track') && d.title) {
          title = d.title.trim();
        }
        if (d.author_name && artist === 'Spotify Artist') {
          artist = d.author_name.trim();
        }
        if (!thumbnail && d.thumbnail_url) {
          thumbnail = d.thumbnail_url;
        }
      }
    } catch (_) {}
  }

  const result = {
    id: trackId || '',
    url,
    title,
    artist,
    album: album || title,
    thumbnail: thumbnail || 'https://telegra.ph/file/95670d63378f7f4210f03.png',
    duration,
    duration_ms,
    releaseDate
  };

  saveToCache(trackCache, cacheKey, result);
  return result;
}

// -----------------------------------------------------------------------
// 2. Pencarian Spotify Super Cepat (apiSpotifyScrapSearch)
// -----------------------------------------------------------------------
export async function apiSpotifyScrapSearch(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('apiSpotifyScrapSearch: parameter "query" wajib diisi.');
  }
  const cleanQ = query.trim().toLowerCase();
  const cached = getFromCache(searchCache, cleanQ);
  if (cached) return cached;

  const searchRes = await apiSpotifySearch(query);
  const list = Array.isArray(searchRes?.result) ? searchRes.result : [];

  const standardized = list.map((item, idx) => {
    let title = item.title || item.name || 'Spotify Track';
    let artist = item.artist || item.author || 'Spotify Artist';
    if (title.includes(' - ') && (!artist || artist === 'Spotify Artist')) {
      const splitted = title.split(' - ');
      artist = splitted[0].trim();
      title = splitted.slice(1).join(' - ').trim();
    }
    const thumbnail = item.thumbnail || item.image || item.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67616d0000b273b7d6ca50bf766ad72226290c';
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

  const envelopeRes = {
    result: standardized,
    provider: searchRes?.provider || 'spotify-scraper',
    total: standardized.length
  };

  saveToCache(searchCache, cleanQ, envelopeRes);
  return envelopeRes;
}

// -----------------------------------------------------------------------
// 3. Ekstraksi Lirik Lagu Multi-Tier (LRCLIB + Lyrics.ovh)
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
        headers: { 'User-Agent': 'Mozilla/5.0' }
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
          headers: { 'User-Agent': 'Mozilla/5.0' }
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
//    - Jalur 1: Direct Spotify Stream dari Backup Provider (Neoxr / Naze AIO)
//    - Jalur 2: YouTube Scraper Convert Audio (paling tahan lama & fleksibel)
// -----------------------------------------------------------------------
export async function apiSpotifyScrapAudio(url, meta = {}) {
  if (!url) throw new ValidationError('apiSpotifyScrapAudio: parameter "url" wajib diisi.');
  const cacheKey = extractSpotifyTrackId(url) || url;
  const cached = getFromCache(streamCache, cacheKey);
  if (cached) return cached;

  let title = meta.title || meta.name || '';
  let artist = meta.artist || meta.author || '';
  let thumbnail = meta.thumbnail || meta.image || '';

  // Jika title belum ada, gali dari oEmbed terlebih dahulu
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

  // Engine 1: Coba ambil direct stream dari Backup API (Neoxr / Naze AIO)
  try {
    const directDl = await apiSpotifyDownload(url);
    if (directDl?.result?.download || directDl?.result?.url) {
      downloadUrl = directDl.result.download || directDl.result.url;
      providerUsed = directDl.provider || 'spotify-direct';
      if (!title && directDl.result.title) title = directDl.result.title;
      if (!artist && directDl.result.artist) artist = directDl.result.artist;
      if (!thumbnail && directDl.result.thumbnail) thumbnail = directDl.result.thumbnail;
    }
  } catch (_) {
    /* Fallback ke Engine 2 (YouTube Scraping Convert) */
  }

  // Engine 2: YouTube Scraper Audio Convert (Persis seperti YouTube Scraper, super cepat & tanpa limit akun)
  if (!downloadUrl) {
    const searchQuery = `${artist} ${title}`.trim() || title;
    if (searchQuery) {
      try {
        const ytSearch = await apiYoutubeScrapSearch(searchQuery);
        const firstVideo = ytSearch.result?.[0];
        if (firstVideo?.url) {
          const ytAudio = await apiYoutubeScrapAudio(firstVideo.url);
          if (ytAudio?.result?.download) {
            downloadUrl = ytAudio.result.download;
            providerUsed = `yt-scrap (${ytAudio.provider})`;
            if (!thumbnail && firstVideo.thumbnail) thumbnail = firstVideo.thumbnail;
          }
        }
      } catch (errYt) {
        console.error('❌ Spotify yt-scrap fallback error:', errYt?.message || errYt);
      }
    }
  }

  if (!downloadUrl) {
    throw new Error('Gagal mendapatkan stream audio untuk lagu Spotify ini.');
  }

  const finalResult = {
    download: downloadUrl,
    url: downloadUrl,
    title: title || 'Spotify Track',
    artist: artist || 'Spotify Artist',
    thumbnail,
    filename: `${title || 'Spotify'} - ${artist || 'Audio'}.mp3`,
    provider: providerUsed
  };

  saveToCache(streamCache, cacheKey, finalResult);
  return finalResult;
}

export default {
  extractSpotifyTrackId,
  apiSpotifyScrapTrack,
  apiSpotifyScrapSearch,
  apiSpotifyLyrics,
  apiSpotifyScrapAudio
};
