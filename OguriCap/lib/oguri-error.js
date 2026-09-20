import chalk from 'chalk';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Membaca versi paket secara aman
let appVersion = '1.1.8';
try {
	const pkgPath = path.resolve(__dirname, '../package.json');
	if (fs.existsSync(pkgPath)) {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
		if (pkg.version) appVersion = pkg.version;
	}
} catch (e) {}

/**
 * Throttle cache untuk mencegah spam pesan error di grup/chat yang sama.
 * Format key: `${chatId}:${featureKey}` -> timestamp
 */
const chatErrorThrottle = new Map();

/**
 * Throttle cache untuk notifikasi ke Owner (mencegah banjir pesan ke owner)
 * Format key: `${errorFingerprint}` -> timestamp
 */
const ownerErrorThrottle = new Map();

// Pembersihan cache berkala setiap 5 menit
setInterval(() => {
	const now = Date.now();
	for (const [key, ts] of chatErrorThrottle.entries()) {
		if (now - ts > 120000) chatErrorThrottle.delete(key);
	}
	for (const [key, ts] of ownerErrorThrottle.entries()) {
		if (now - ts > 300000) ownerErrorThrottle.delete(key);
	}
}, 300000);

/**
 * Daftar error yang harus diabaikan secara diam-diam (tidak perlu mengirim error ke chat)
 */
const SILENT_ERROR_PATTERNS = [
	'No sessions',
	'ffmpeg exited with code',
	'rate-overlimit',
	'Connection Closed',
	'Stream Errored',
	'EPIPE',
	'client closed connection',
	'socket hang up'
];

/**
 * Analisis & kategorisasi error secara komprehensif
 * @param {Error|any} err 
 * @param {Object} context 
 * @returns {{ category: string, serviceName: string, statusCode: number|null, message: string }}
 */
export function categorizeError(err, context = {}) {
	const errMsg = err?.message || String(err || '');
	const errName = err?.name || '';
	const errCode = err?.code || '';
	const statusCode = err?.response?.status || err?.statusCode || err?.data?.status || null;
	const errorUrl = err?.config?.url || err?.request?.host || '';

	let serviceName = context.command || context.feature || '';

	// 1. Cek AllProvidersFailedError atau error rantai provider apiGlobal
	const isAllProviders = 
		errName === 'AllProvidersFailedError' ||
		err?.serviceName ||
		/All providers failed/i.test(errMsg) ||
		/Semua provider.*gagal/i.test(errMsg);

	if (isAllProviders) {
		serviceName = err?.serviceName || serviceName || 'layanan ini';
		return {
			category: 'api_exhausted',
			serviceName,
			statusCode: statusCode || 503,
			message: errMsg
		};
	}

	// 2. Cek Rate-Limit / Spam / Sistem Terlalu Sibuk (429 atau flood)
	const isRateLimit = 
		statusCode === 429 ||
		errCode === 'ERR_RATE_LIMITED' ||
		/rate limit|too many requests|overlimit|flood|terlalu banyak permintaan/i.test(errMsg);

	if (isRateLimit) {
		return {
			category: 'spam_exhausted',
			serviceName,
			statusCode: 429,
			message: errMsg
		};
	}

	// 3. Cek Timeout / Koneksi Lambat
	const isTimeout = 
		errName === 'TimeoutError' ||
		errCode === 'ECONNABORTED' ||
		errCode === 'ETIMEDOUT' ||
		/timeout|timed out|waktu habis/i.test(errMsg);

	if (isTimeout) {
		return {
			category: 'timeout',
			serviceName,
			statusCode: 408,
			message: errMsg
		};
	}

	// 4. Cek Akses Ditolak / Forbidden / Unauthorized (401 / 403)
	if (statusCode === 401 || statusCode === 403 || /unauthorized|forbidden|apikey invalid|access denied/i.test(errMsg)) {
		return {
			category: statusCode === 401 ? 'unauthorized' : 'forbidden',
			serviceName,
			statusCode,
			message: errMsg
		};
	}

	// 5. Cek Konten Tidak Ditemukan / Link Mati (404)
	if (statusCode === 404 || /not found|tidak ditemukan|404/i.test(errMsg)) {
		return {
			category: 'not_found',
			serviceName,
			statusCode: 404,
			message: errMsg
		};
	}

	// 6. Cek Beban Media / Ukuran File Terlalu Besar (413 / maxBodyLength)
	if (
		statusCode === 413 ||
		errCode === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' ||
		/maxbodylength|payload too large|file too large|terlalu besar/i.test(errMsg)
	) {
		return {
			category: 'payload_too_large',
			serviceName,
			statusCode: 413,
			message: errMsg
		};
	}

	// 7. Cek Server Tujuan Gangguan (500, 502, 503, 504, ECONNREFUSED, ENOTFOUND)
	if (
		(statusCode && statusCode >= 500) ||
		errCode === 'ECONNREFUSED' ||
		errCode === 'ENOTFOUND' ||
		errCode === 'EAI_AGAIN' ||
		/bad gateway|service unavailable|gateway timeout|server error/i.test(errMsg)
	) {
		return {
			category: 'server_error',
			serviceName,
			statusCode: statusCode || 500,
			message: errMsg
		};
	}

	// 8. General Default
	return {
		category: 'general',
		serviceName,
		statusCode: statusCode || null,
		message: errMsg
	};
}

/**
 * Format nama fitur agar lebih ramah dibaca pengguna
 * @param {string} rawName 
 * @returns {string}
 */
function humanizeServiceName(rawName = '') {
	if (!rawName) return 'fitur ini';
	const clean = String(rawName).toLowerCase().replace(/^(cmd|fitur|api)[_.]?/, '');
	const map = {
		tiktok: 'TikTok Downloader',
		tt: 'TikTok Downloader',
		instagram: 'Instagram Downloader',
		ig: 'Instagram Downloader',
		youtube: 'YouTube Downloader',
		yt: 'YouTube Downloader',
		ytmp3: 'YouTube Audio',
		ytmp4: 'YouTube Video',
		spotify: 'Spotify Downloader',
		pinterest: 'Pinterest Search/Download',
		pin: 'Pinterest',
		ai: 'Layanan AI',
		gemini: 'Google Gemini AI',
		gpt: 'ChatGPT AI',
		mahiru: 'Mahiru Shiina AI',
		sticker: 'Pembuat Stiker',
		brat: 'Brat Generator',
		ssweb: 'Screenshot Web',
		stalk: 'Stalker Profil',
		media: 'Pengolah Media'
	};
	return map[clean] || `fitur ${clean}`;
}

/**
 * Menghasilkan respon dialog kepribadian Oguri Cap yang imersif dan tematik
 * @param {string} category 
 * @param {Object} meta 
 * @returns {string}
 */
export function getOguriErrorDialogue(category, meta = {}) {
	const serviceTitle = humanizeServiceName(meta.serviceName || meta.command);

	switch (category) {
		case 'api_exhausted':
			return `🌾 *Oguri Cap:*
"Ugh... sepertinya sumber energi dan rute lari Oguri untuk *${serviceTitle}* sedang kehabisan stamina nih! 🥕💦
Server penyedianya sedang beristirahat atau tidak bisa dijangkau sementara waktu. Oguri butuh makan wortel ekstra dulu... Coba lagi sebentar lagi ya, Trainer! 🍚✨"`;

		case 'spam_exhausted':
			return `🏃‍♀️💨 *Oguri Cap:*
"Hosh... hosh... Nafas Oguri sampai terengah-engah karena terlalu banyak permintaan sekaligus! 💨💦
Lintasan balapnya terlalu padat, Oguri perlu rehat sejenak untuk mengatur nafas. Jangan di-spam ya, tunggu beberapa saat lagi sebelum mencoba kembali! 🥕"`;

		case 'timeout':
			return `🌧️ *Oguri Cap:*
"Lintasannya terasa berat dan koneksi ke server tujuan lambat sekali... Waktu tunggu (Timeout) sudah habis nih! ⏱️
Coba periksa kembali jaringan atau ulangi larinya beberapa saat lagi ya!"`;

		case 'forbidden':
		case 'unauthorized':
			return `🔒 *Oguri Cap:*
"Waduh, pintu gerbangnya terkunci rapat! 🚫 Akses ke server tujuan ditolak (memerlukan Apikey aktif atau izin khusus).
Lapor ke Trainer / Owner Shiro-sama ya jika ini perlu dibuka kembali! 🌾"`;

		case 'not_found':
			return `🔍 *Oguri Cap:*
"Eh? Jejak konten atau target yang kamu cari tidak ditemukan di lintasan!
Pastikan link atau kata kuncinya sudah benar, berstatus publik, dan belum dihapus ya! 🌾"`;

		case 'payload_too_large':
			return `📦 *Oguri Cap:*
"Wah, beban file atau medianya terlalu berat untuk dibawa lari Oguri! 💦
Ukuran file melebihi batas kemampuan server/WhatsApp. Coba gunakan media dengan durasi atau ukuran yang lebih ringkas ya!"`;

		case 'server_error':
			return `🍲 *Oguri Cap:*
"Server tujuan sepertinya sedang mengalami gangguan di dapur sistemnya... 🔧
Mohon bersabar sejenak selagi server memulihkan tenaganya ya, Trainer!"`;

		case 'general':
		default:
			return `🥕 *Oguri Cap:*
"Aduh... Oguri sempat tersandung sedikit di lintasan! 🏃‍♀️💦
Terjadi kendala teknis saat memproses permintaanmu. Coba ulangi beberapa saat lagi ya, Trainer!"`;
	}
}

/**
 * Memeriksa apakah pesan error harus ditekan (suppressed) agar tidak spam di grup
 * @param {string} chatId 
 * @param {string} featureKey 
 * @param {number} [cooldownMs=60000] Default 60 detik cooldown per fitur per chat
 * @returns {boolean} true jika error harus disupress (jangan kirim pesan ganda)
 */
export function shouldSuppressError(chatId, featureKey = 'global', cooldownMs = 60000) {
	if (!chatId) return false;
	const key = `${chatId}:${featureKey}`;
	const now = Date.now();
	const lastSent = chatErrorThrottle.get(key);

	if (lastSent && now - lastSent < cooldownMs) {
		return true; // Supress / Jangan spam
	}

	chatErrorThrottle.set(key, now);
	return false;
}

/**
 * Mengirim notifikasi log error ke Owner secara cerdas dan ter-deduplikasi
 * @param {Object} naze - Instance Baileys Socket
 * @param {string} ownerNumber - Nomor WA Owner
 * @param {Object} data - Metadata error
 */
export async function notifyOwnerSmart(naze, ownerNumber, data = {}) {
	if (!naze || !ownerNumber) return;

	const fingerprint = `${data.command || 'unknown'}:${data.category || 'general'}:${data.errName || 'error'}`;
	const now = Date.now();
	const lastNotified = ownerErrorThrottle.get(fingerprint);

	// Throttle notifikasi owner: maksimal 1 alert per jenis error setiap 3 menit
	if (lastNotified && now - lastNotified < 180000) {
		return;
	}
	ownerErrorThrottle.set(fingerprint, now);

	try {
		const targetOwner = Array.isArray(ownerNumber) ? ownerNumber[0] : ownerNumber;
		const cleanOwner = String(targetOwner).replace(/[^0-9]/g, '') + '@s.whatsapp.net';

		const logText = `⚠️ *[LOG LAPORAN ERROR OGURI CAP]*
━━━━━━━━━━━━━━━━━━━━
📌 *Fitur/Command:* ${data.command ? `.${data.command}` : 'Non-Command / System'}
👤 *Pengirim:* @${data.senderNum || 'unknown'}
🏷️ *Tipe Pesan:* ${data.msgType || 'unknown'}
🕒 *Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
🔖 *Kategori:* ${data.category || 'general'} (Status: ${data.statusCode || '-'})
📦 *Versi:* v${appVersion}

📄 *Pesan Error:*
\`\`\`
${data.errorMessage || 'Terjadi kesalahan sistem'}
\`\`\`

🔍 *Detail / Stack:*
\`\`\`
${(data.stack || '').slice(0, 700)}
\`\`\`
━━━━━━━━━━━━━━━━━━━━`;

		if (naze.sendFromOwner) {
			await naze.sendFromOwner(cleanOwner, logText, data.quotedMsg || null, { contextInfo: { isForwarded: true } });
		} else if (naze.sendMessage) {
			await naze.sendMessage(cleanOwner, { text: logText, mentions: data.senderJid ? [data.senderJid] : [] });
		}
	} catch (e) {
		console.error(chalk.red('[OGURI-ERROR] Gagal mengirim log ke owner:'), e?.message || e);
	}
}

/**
 * HANDLER ERROR GLOBAL UTAMA UNTUK NAZE.JS DAN SELURUH FITUR BOT
 * --------------------------------------------------------------
 * Menggantikan block catch besar di naze.js menjadi 1 baris bersih dan elegan.
 *
 * @param {Object} params
 * @param {Error|any} params.err - Objek error yang ditangkap
 * @param {Object} params.m - Objek pesan Baileys m
 * @param {Object} params.naze - Instance socket Baileys bot
 * @param {string} [params.command] - Nama command yang sedang dijalankan
 * @param {string} [params.text] - Teks input
 * @param {boolean} [params.isCmd] - Apakah pemicu berupa command
 * @param {Object} [params.db] - Database global
 * @param {string|Array<string>} [params.ownerNumber] - Nomor owner
 * @param {string} [params.prefix] - Prefix aktif
 * @returns {Promise<boolean>}
 */
export async function handleOguriError({
	err,
	m,
	naze,
	command = '',
	text = '',
	isCmd = false,
	db = null,
	ownerNumber = global.owner || '6281563808289',
	prefix = '.'
} = {}) {
	// 1. Log teknis ke terminal untuk debugging
	const errString = err?.message || String(err || '');
	console.log(chalk.redBright('❌ [OGURI-ERROR CAUGHT]:'), chalk.yellow(command ? `[.${command}]` : '[General]'), chalk.white(errString));
	if (err?.stack) {
		console.log(chalk.gray((err.stack || '').slice(0, 300)));
	}

	// 2. Cek apakah error termasuk yang diabaikan diam-diam
	for (const pattern of SILENT_ERROR_PATTERNS) {
		if (errString.includes(pattern) || err?.code === pattern) {
			return false;
		}
	}

	// 3. Analisis dan kategorisasi error
	const analysis = categorizeError(err, { command });
	const featureKey = command || analysis.serviceName || analysis.category;
	const chatId = m?.chat || 'global';

	// 4. Periksa apakah error harus ditekan untuk mencegah banjir/spam di chat
	const isSuppressed = shouldSuppressError(chatId, featureKey, 60000);

	// 5. Jika tidak disupress dan ada target pesan yang valid, kirim dialog Oguri Cap
	if (!isSuppressed && m && typeof m.reply === 'function') {
		const oguriDialogue = getOguriErrorDialogue(analysis.category, {
			serviceName: analysis.serviceName,
			command
		});

		try {
			await m.reply(oguriDialogue);
		} catch (sendErr) {
			console.error(chalk.red('[OGURI-ERROR] Gagal membalas ke chat:'), sendErr?.message || sendErr);
		}
	} else if (isSuppressed) {
		console.log(chalk.yellowBright(`🛡️ [ANTI-SPAM ERROR] Notifikasi error untuk "${featureKey}" di chat ${chatId} diredam agar tidak spam.`));
	}

	// 6. Teruskan log ke Owner jika error bukan sekadar 404/not_found ringan
	if (analysis.category !== 'not_found' && analysis.category !== 'spam_exhausted') {
		const senderJid = m?.sender || '';
		const senderNum = senderJid ? senderJid.split('@')[0] : '';
		
		await notifyOwnerSmart(naze, ownerNumber, {
			command,
			category: analysis.category,
			statusCode: analysis.statusCode,
			errName: err?.name || 'Error',
			errorMessage: errString,
			stack: err?.stack || util.inspect(err),
			senderNum,
			senderJid,
			msgType: m?.type || 'message',
			quotedMsg: m
		});
	}

	return true;
}

/**
 * Helper untuk mereset throttle cache jika diperlukan (misal untuk testing)
 */
export function resetErrorThrottle() {
	chatErrorThrottle.clear();
	ownerErrorThrottle.clear();
}

export default handleOguriError;
