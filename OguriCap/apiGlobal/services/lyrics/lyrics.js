/**
 * apiGlobal/services/lyrics/lyrics.js
 * -----------------------------------------------------------------------
 * PONDASI/PLACEHOLDER — fitur pencarian lirik lagu BELUM ADA di project
 * ini sebelum migrasi (perlu dibedakan dari `.tebaklirik`, yang merupakan
 * GAME tebak lirik lewat `/games/tebaklirik`, bukan pencarian lirik).
 * Sesuai Part 4 API_ARCHITECTURE.md, file ini tetap dibuat sebagai
 * pondasi supaya struktur apiGlobal lengkap dan siap dipakai kapan saja.
 *
 * Cara mengaktifkan di masa depan:
 *   1. Tambahkan fungsi provider di apiGlobal/providers/<nama>.provider.js
 *   2. Panggil fungsi tersebut lewat runProviders() di bawah ini
 *   3. Hapus NotImplementedError setelah provider terpasang
 */

import { apiSpotifyLyrics } from '../downloader/spotify-scrap.js';
import { envelope } from '../../core/normalizer.js';
import { ValidationError } from '../../core/errors.js';

/**
 * Cari lirik lagu berdasarkan judul dan artis (multi-tier LRCLIB + fallback).
 *
 * @param {string} title - Judul lagu yang dicari liriknya.
 * @param {string} [artist] - Nama penyanyi (opsional untuk mempercepat akurasi).
 */
export async function apiLyricsSearch(title, artist = '') {
	if (!title) throw new ValidationError('apiLyricsSearch: parameter "title" wajib diisi.');
	const result = await apiSpotifyLyrics(title, artist);
	return envelope(result, result.source || 'lrclib', result);
}

export default { apiLyricsSearch };
