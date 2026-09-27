/**
 * apiGlobal/services/downloader/ig-scrap.js
 * -----------------------------------------------------------------------
 * Layanan Instagram Scraper Mandiri (Free, No API Key, HD Quality First).
 *
 * Mengambil metadata, audio, video HD, dan slide foto/carousel dari URL
 * Instagram publik secara langsung tanpa bergantung pada API berbayar.
 *
 * Fitur:
 *   - Bebas API Key / Token
 *   - Auto-resolving shortlink & URL sanitization
 *   - Mendukung single image, single video (Reels), Carousel (foto/video campuran)
 *   - Format return 100% kompatibel dengan format Naze / NeoXR / tracendd.js
 *   - Fallback otomatis ke provider API resmi (Naze & NeoXR) jika scraper kendala
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { getTimeout } from '../../config/index.js';
import { envelope } from '../../core/normalizer.js';
import { ValidationError } from '../../core/errors.js';
import { apiInstagramDownload as apiInstagramBackup } from './instagram.js';

const SERVICE_GROUP = 'instagram';

// HTTPS agent reusable dengan keepAlive untuk kecepatan tinggi & hemat resource
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 10000
});

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

/**
 * Ekstrak shortcode / ID dari URL Instagram
 * @param {string} url 
 * @returns {string|null}
 */
export function extractInstagramCode(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:instagram\.com\/(?:p|reel|reels|tv|share\/reel)\/|instagr\.am\/p\/)([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Bersihkan URL Instagram dari tracking parameter
 * @param {string} url 
 * @returns {string}
 */
export function cleanInstagramUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    return `${parsed.origin}${parsed.pathname}`;
  } catch (e) {
    return url.trim().split('?')[0];
  }
}

/**
 * Decoder Packer JavaScript untuk Snapsave/Snapinsta
 */
function decodePacker(packed) {
  try {
    const match = packed.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\}\(([\s\S]*?)\)\)/);
    if (!match) return null;
    
    const paramsStr = match[1];
    // Parsing argumen: p, a, c, k, e, d
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];
      if ((char === '"' || char === "'") && paramsStr[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
      }
      if (char === ',' && !inQuotes) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    args.push(current.trim());

    if (args.length >= 6) {
      let p = args[0].replace(/^['"]|['"]$/g, '');
      let a = parseInt(args[1], 10);
      let c = parseInt(args[2], 10);
      let k = args[3].replace(/^['"]|['"]$/g, '').split('.split(')[0].split('|');
      let e = function (c) {
        return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
      };
      let d = {};
      while (c--) {
        d[e(c)] = k[c] || e(c);
      }
      return p.replace(/\b\w+\b/g, (w) => d[w] || w);
    }
  } catch (e) {
    // Abaikan kegagalan decode
  }
  return null;
}

/**
 * Petakan hasil data scraper ke format standar seragam OguriCap
 * Format ini 100% kompatibel dengan Naze & NeoXR.
 */
export function normalizeInstagramScraper(data) {
  if (!data) return null;

  let urls = [];
  if (Array.isArray(data.urls)) {
    urls = data.urls.map(u => ({
      url: typeof u === 'string' ? u : u.url,
      is_video: typeof u === 'string' ? /\.mp4/i.test(u) : Boolean(u.is_video ?? u.type === 'video' ?? u.type === 'mp4'),
      thumbnail: u.thumbnail ?? u.thumb ?? null
    }));
  } else if (Array.isArray(data.media)) {
    urls = data.media.map(u => ({
      url: typeof u === 'string' ? u : u.url,
      is_video: typeof u === 'string' ? /\.mp4/i.test(u) : Boolean(u.is_video ?? u.type === 'video' ?? u.type === 'mp4'),
      thumbnail: u.thumbnail ?? u.thumb ?? null
    }));
  } else if (data.url) {
    urls = [{
      url: data.url,
      is_video: Boolean(data.is_video ?? data.type === 'video' ?? /\.mp4/i.test(data.url)),
      thumbnail: data.thumbnail ?? data.thumb ?? null
    }];
  }

  // Filter URL valid & hilangkan duplikat
  const uniqueUrls = [];
  const seen = new Set();
  for (const item of urls) {
    if (item.url && !seen.has(item.url)) {
      seen.add(item.url);
      uniqueUrls.push(item);
    }
  }

  const caption = data.caption || data.title || data.desc || data.description || '';
  const audio = data.audio || data.music || data.audio_url || null;

  return {
    urls: uniqueUrls,
    caption: caption,
    title: caption.slice(0, 100) || 'Instagram Media',
    audio: audio,
    music: audio,
    author: {
      nickname: data.author?.nickname || data.author?.name || data.username || 'Instagram User',
      username: data.author?.username || data.username || 'instagram',
      avatar: data.author?.avatar || data.avatar || null
    },
    likes: Number(data.likes || data.like_count || 0),
    comments: Number(data.comments || data.comment_count || 0)
  };
}

/**
 * Scraper Engine 1: SnapSave / SnapInsta Direct AJAX & HTML Decoder
 */
async function scrapeSnapSave(url, timeout = 9000) {
  const targetUrl = cleanInstagramUrl(url);
  const endpoints = [
    {
      url: 'https://snapsave.app/action.php',
      headers: {
        ...DEFAULT_HEADERS,
        'Origin': 'https://snapsave.app',
        'Referer': 'https://snapsave.app/'
      }
    },
    {
      url: 'https://snapinsta.app/action2.php',
      headers: {
        ...DEFAULT_HEADERS,
        'Origin': 'https://snapinsta.app',
        'Referer': 'https://snapinsta.app/'
      }
    }
  ];

  for (const ep of endpoints) {
    try {
      const form = new URLSearchParams();
      form.append('url', targetUrl);
      
      const res = await axios.post(ep.url, form, {
        headers: {
          ...ep.headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        httpsAgent: agent,
        timeout
      });

      let html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (html.includes('eval(function(p,a,c,k,e,d)')) {
        const decoded = decodePacker(html);
        if (decoded) html = decoded;
      }

      const $ = cheerio.load(html);
      const urls = [];

      // Download button / link
      $('a.download-bottom, a[href*="download"], a[href*="token="], .btn-download, a[title*="Download"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http') && !href.includes('google') && !href.includes('facebook.com')) {
          const isVideo = href.includes('.mp4') || $(el).text().toLowerCase().includes('video') || $(el).hasClass('video');
          urls.push({
            url: href,
            is_video: isVideo
          });
        }
      });

      // Direct image tags inside result
      $('.download-items img, .media-box img, .thumbnail img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http') && !urls.some(u => u.url === src)) {
          urls.push({
            url: src,
            is_video: false
          });
        }
      });

      // Direct video tags
      $('video source, video').each((_, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http') && !urls.some(u => u.url === src)) {
          urls.push({
            url: src,
            is_video: true
          });
        }
      });

      if (urls.length > 0) {
        return normalizeInstagramScraper({
          urls,
          caption: $('p.caption, .post-caption, .media-content').text().trim() || ''
        });
      }
    } catch (e) {
      // Coba endpoint selanjutnya
    }
  }
  throw new Error('SnapSave/SnapInsta scraper failed');
}

/**
 * Scraper Engine 2: IGDownloader / SaveIG Ajax
 */
async function scrapeIgDownloader(url, timeout = 9000) {
  const targetUrl = cleanInstagramUrl(url);
  const endpoints = [
    {
      url: 'https://v3.igdownloader.app/api/ajaxSearch',
      data: { recaptchaToken: '', q: targetUrl, t: 'media', lang: 'en' },
      origin: 'https://igdownloader.app'
    },
    {
      url: 'https://saveig.app/api/ajaxSearch',
      data: { q: targetUrl, t: 'media', lang: 'en' },
      origin: 'https://saveig.app'
    },
    {
      url: 'https://fastdl.to/api/ajaxSearch',
      data: { q: targetUrl, t: 'media', lang: 'en' },
      origin: 'https://fastdl.to'
    }
  ];

  for (const ep of endpoints) {
    try {
      const form = new URLSearchParams(ep.data);
      const res = await axios.post(ep.url, form, {
        headers: {
          ...DEFAULT_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': ep.origin,
          'Referer': `${ep.origin}/`
        },
        httpsAgent: agent,
        timeout
      });

      if (res.data && res.data.data) {
        const $ = cheerio.load(res.data.data);
        const urls = [];

        $('a[href*="http"]').each((_, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().toLowerCase();
          if (href && !href.includes('javascript') && (href.includes('dl') || href.includes('cdn') || href.includes('download') || href.includes('.mp4') || href.includes('.jpg') || text.includes('download'))) {
            urls.push({
              url: href,
              is_video: text.includes('video') || href.includes('.mp4')
            });
          }
        });

        if (urls.length > 0) {
          return normalizeInstagramScraper({
            urls,
            caption: $('.caption, .post-caption, p').text().trim() || ''
          });
        }
      }
    } catch (e) {
      // Lanjut
    }
  }
  throw new Error('IGDownloader/SaveIG scraper failed');
}

/**
 * Scraper Engine 3: Fast Public Scraping Aggregators
 */
async function scrapePublicAggregator(url, timeout = 9000) {
  const targetUrl = cleanInstagramUrl(url);
  const apis = [
    {
      name: 'siputzx',
      url: `https://api.siputzx.my.id/api/d/ig?url=${encodeURIComponent(targetUrl)}`,
      extract: (data) => {
        if (data?.data && Array.isArray(data.data)) {
          return data.data.map(item => ({
            url: item.url || item.dl || item,
            is_video: Boolean(item.is_video || item.type === 'video' || (typeof item.url === 'string' && item.url.includes('.mp4')))
          }));
        }
        return null;
      }
    },
    {
      name: 'botcahx',
      url: `https://api.botcahx.eu.org/api/dowloader/igdowloader?url=${encodeURIComponent(targetUrl)}&apikey=free`,
      extract: (data) => {
        if (data?.result && Array.isArray(data.result)) {
          return data.result.map(item => ({
            url: item.url || item._url || item,
            is_video: Boolean(item.type === 'video' || (typeof item.url === 'string' && item.url.includes('.mp4')))
          }));
        }
        return null;
      }
    }
  ];

  for (const api of apis) {
    try {
      const res = await axios.get(api.url, {
        headers: DEFAULT_HEADERS,
        httpsAgent: agent,
        timeout
      });

      const extracted = api.extract(res.data);
      if (extracted && extracted.length > 0) {
        return normalizeInstagramScraper({
          urls: extracted,
          caption: res.data?.caption || res.data?.desc || ''
        });
      }
    } catch (e) {
      // Abaikan dan lanjut
    }
  }

  throw new Error('Public Aggregator failed');
}

/**
 * Fungsi Pengikis Utama Multi-Engine Instagram
 * Menjalankan engine scraper secara paralel untuk kecepatan kilat (sub-detik).
 * @param {string} url 
 * @param {number} timeout 
 * @returns {Promise<{normalized: object, provider: string}>}
 */
export async function scrapeInstagram(url, timeout = 7000) {
  const engines = [
    async () => {
      const res = await scrapeSnapSave(url, timeout);
      if (res && res.urls?.length > 0) return { normalized: res, provider: 'snapsave-scraper' };
      throw new Error('snapsave empty');
    },
    async () => {
      const res = await scrapeIgDownloader(url, timeout);
      if (res && res.urls?.length > 0) return { normalized: res, provider: 'igdownloader-scraper' };
      throw new Error('igdownloader empty');
    },
    async () => {
      const res = await scrapePublicAggregator(url, timeout);
      if (res && res.urls?.length > 0) return { normalized: res, provider: 'public-scraper' };
      throw new Error('public aggregator empty');
    }
  ];

  try {
    // Eksekusi paralel tercepat (Promise.any) untuk respon kilat tanpa delay
    const fastest = await Promise.any(engines.map(fn => fn()));
    if (fastest?.normalized?.urls?.length > 0) {
      return fastest;
    }
  } catch (aggErr) {
    // Jika race paralel awal belum berhasil, coba berurutan sekali lagi dengan timeout singkat
    for (const engine of engines) {
      try {
        const res = await engine();
        if (res?.normalized?.urls?.length > 0) return res;
      } catch (e) {}
    }
  }

  throw new Error('Semua engine scraper Instagram gagal mengekstrak media');
}

/**
 * Layanan Utama Instagram Downloader (Scraper Utama Cepat -> Fallback Otomatis ke API Resmi).
 * 
 * @param {string} url - URL postingan / Reels Instagram
 * @param {object} [options]
 * @returns {Promise<{result: {urls: Array<{url:string, is_video:boolean}>, caption: string, title?: string, audio?: string}, provider: string, raw: any}>}
 */
export async function apiInstagramScrapDownload(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('apiInstagramScrapDownload: parameter "url" wajib diisi.');
  }

  const timeout = getTimeout(SERVICE_GROUP) || 8000;

  // 1. Eksekusi Scraper Mandiri secara paralel kilat
  try {
    const { normalized, provider } = await scrapeInstagram(url, timeout);
    if (normalized && normalized.urls && normalized.urls.length > 0) {
      return envelope(normalized, provider, normalized);
    }
  } catch (scrapErr) {
    console.warn(`[IG-SCRAPER] Scraper dialihkan ke API cadangan: ${scrapErr?.message || scrapErr}`);
  }

  // 2. Fallback otomatis ke API Resmi (Naze / NeoXR) jika scraper kendala
  try {
    const backupRes = await apiInstagramBackup(url);
    if (backupRes?.result?.urls?.length > 0) {
      return backupRes;
    }
  } catch (backupErr) {
    throw backupErr;
  }

  throw new Error('Gagal mengunduh media Instagram dari seluruh sumber');
}

export default {
  apiInstagramScrapDownload,
  scrapeInstagram,
  normalizeInstagramScraper,
  cleanInstagramUrl,
  extractInstagramCode
};
