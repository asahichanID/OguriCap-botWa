/**
 * apiGlobal/services/downloader/spotify.js
 * -----------------------------------------------------------------------
 * Layanan Spotify (pencarian & unduh). Menggantikan pencarian/unduh yang
 * sebelumnya hardcoded terpisah di:
 *   - musume/upgrade/tracendd.js (cariSpotify / unduhSpotify — 3 provider)
 *   - naze.js case 'spotifydl'   (1 provider: Naze)
 *
 * CATATAN KOMPATIBILITAS PENTING:
 * Bentuk response 3 provider ini TIDAK seragam (kadang di bawah `.result`,
 * kadang `.data`, kadang array langsung), dan command lama sengaja
 * membaca banyak kemungkinan nama field sekaligus (title/name,
 * artist/artists[0].name, dst) karena tidak tahu provider mana yang akan
 * merespons. Supaya migrasi ini AMAN (tidak mengubah perilaku), fungsi
 * di bawah ini TIDAK memaksakan satu bentuk baru — cukup mengembalikan
 * data mentah provider yang menang (`result`), dan command tetap boleh
 * memakai logika pembacaan field yang sudah ada sebelumnya.
 */

import { runProviders } from '../../core/requestEngine.js';
import { nazeRequest } from '../../providers/naze.provider.js';
import { neoxrRequest } from '../../providers/neoxr.provider.js';
import { fgmodsSpotifySearch, fgmodsSpotifyDownload } from '../../providers/fgmods.provider.js';
import { vihangaytSpotifySearch, vihangaytSpotifyDownload } from '../../providers/vihangayt.provider.js';
import { getTimeout, DEFAULT_RETRY } from '../../config/index.js';
import { envelope, validated } from '../../core/normalizer.js';
import { ValidationError } from '../../core/errors.js';

const SERVICE_GROUP = 'spotify';

function pickResult(raw) {
	return raw?.result ?? raw?.data ?? raw?.list ?? raw;
}

function extractSearchArray(raw) {
	if (Array.isArray(raw?.data)) return raw.data;
	if (Array.isArray(raw?.result?.tracks)) return raw.result.tracks;
	if (Array.isArray(raw?.result)) return raw.result;
	if (Array.isArray(raw?.result?.top_results)) return raw.result.top_results;
	if (Array.isArray(raw)) return raw;
	const data = pickResult(raw);
	return Array.isArray(data) ? data : [];
}

/**
 * Cari lagu di Spotify. Prioritas: Neoxr → Naze → fgmods → vihangayt.
 * Sesuai perilaku asli, provider hanya dianggap berhasil jika mengembalikan
 * minimal 1 hasil yang valid.
 *
 * @param {string} query
 * @returns {Promise<{result: any[], provider: string, raw: any}>}
 */
export async function apiSpotifySearch(query) {
	if (!query) throw new ValidationError('apiSpotifySearch: parameter "query" wajib diisi.');

	const timeout = getTimeout(SERVICE_GROUP);
	const isValid = (raw) => extractSearchArray(raw).length >= 1;

	const providers = [
		validated(neoxrRequest('/spotify-search', { q: query }, { timeout }), isValid),
		validated(nazeRequest('/search/spotify', { query }, { timeout }), isValid)
	];

	const { raw, providerName } = await runProviders('spotify.search', providers, {
		defaultTimeout: timeout,
		defaultRetry: DEFAULT_RETRY
	});

	const items = extractSearchArray(raw).slice(0, 10).map((item) => {
		const title = item.title || item.name || item.track || 'Spotify Track';
		const artist = item.artist || (Array.isArray(item.artists) ? item.artists.map(a => a.name).join(', ') : '') || 'Spotify Artist';
		const thumbnail = item.thumbnail || item.image || item.album?.images?.[0]?.url || '';
		const duration = item.duration || (item.duration_ms ? `${Math.floor(item.duration_ms / 60000)}:${String(Math.floor((item.duration_ms % 60000) / 1000)).padStart(2, '0')}` : '--:--');
		const url = item.url || item.link || (item.id ? `https://open.spotify.com/track/${item.id}` : '');
		return {
			...item,
			title,
			name: title,
			artist,
			author: artist,
			thumbnail,
			image: thumbnail,
			duration,
			url
		};
	});

	return envelope(items, providerName, raw);
}

/**
 * Unduh audio Spotify berdasarkan URL lagu. Prioritas: Neoxr → Naze AIO → Naze Spotify.
 *
 * @param {string} url
 */
export async function apiSpotifyDownload(url) {
	if (!url) throw new ValidationError('apiSpotifyDownload: parameter "url" wajib diisi.');

	const timeout = getTimeout(SERVICE_GROUP);
	const isValid = (raw) => {
		const directUrl = raw?.data?.url || raw?.result?.medias?.[0]?.url || raw?.result?.download || raw?.result?.url || raw?.url || raw?.download;
		return Boolean(directUrl && typeof directUrl === 'string' && directUrl.startsWith('http'));
	};

	const providers = [
		validated(neoxrRequest('/spotify', { url }, { timeout }), isValid),
		validated(nazeRequest('/download/aio', { url }, { timeout }), isValid),
		validated(nazeRequest('/download/spotify', { url }, { timeout }), isValid)
	];

	const { raw, providerName } = await runProviders('spotify.download', providers, {
		defaultTimeout: timeout,
		defaultRetry: DEFAULT_RETRY
	});

	const data = raw?.data || raw?.result || raw;
	const downloadUrl = data?.url || data?.download || data?.medias?.[0]?.url;
	const title = data?.title || data?.name || 'Spotify Audio';
	const artist = data?.artist || data?.author || (Array.isArray(data?.artists) ? data.artists.map(a => a.name).join(', ') : '') || 'Spotify Artist';
	const thumbnail = data?.thumbnail || data?.image || data?.album?.images?.[0]?.url || '';
	const duration = data?.duration || (data?.duration_ms ? `${Math.floor(data.duration_ms / 60000)}:${String(Math.floor((data.duration_ms % 60000) / 1000)).padStart(2, '0')}` : '--:--');

	const normalized = {
		...data,
		title,
		name: title,
		artist,
		author: artist,
		thumbnail,
		image: thumbnail,
		duration,
		url: downloadUrl,
		download: downloadUrl,
		filename: `${title} - ${artist}.mp3`
	};

	return envelope(normalized, providerName, raw);
}

export default { apiSpotifySearch, apiSpotifyDownload };
