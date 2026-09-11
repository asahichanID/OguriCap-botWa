/**
 * OguriCap Limit Manager
 * Mengatur batas penggunaan perintah (Limit) bot:
 * - Free user: Limit 5 per hari
 * - VIP user & Owner: Bebas limit (Unlimited)
 * - Jika limit habis, bot HANYA mengirim pesan suara Oguri Cap 1 kali
 * - Percakapan selanjutnya dari user yang sama diabaikan tanpa spam
 */

export const OGURI_LIMIT_MESSAGE = `🥕 *Oguri Cap:*
"Haaah... Nafasku habis, Trainer... Energiku (limit) untukmu hari ini sudah habis! 🍚
Aku harus istirahat dan makan wortel dulu... 🥕
Limit harianmu (${global.limit?.free || 5} limit) akan terisi kembali besok pukul 00:00 WIB, atau Trainer bisa upgrade ke VIP untuk akses tanpa batas!"`.trim();

// Daftar perintah gratis (informasi / status / bantuan) yang tidak memotong limit dan bisa diakses saat limit 0
export const freeCommands = new Set([
	'menu', 'help', 'listmenu', 'allmenu',
	'limit', 'ceklimit', 'profile', 'me', 'cek',
	'owner', 'creator', 'sewa', 'buyvip', 'vip', 'premium', 'buy', 'price', 'listprem', 'listvip',
	'ping', 'speed', 'runtime', 'uptime', 'status', 'rules', 'infobot', 'bot',
	'afk', 'clearmemory', 'banktracen', 'daily'
]);

/**
 * Memeriksa dan memotong limit untuk perintah bot
 * @param {object} naze - Baileys client
 * @param {object} m - Objek pesan
 * @param {object} db - Database global
 * @param {boolean} isCreator - Apakah pengirim adalah Owner/Creator
 * @param {string} cmd - Nama command yang dipanggil
 * @returns {Promise<boolean>} true jika diizinkan, false jika diblokir oleh limit
 */
export async function handleUserLimit(naze, m, db, isCreator, cmd = '') {
	const sender = m.sender;
	if (!sender) return true;

	const cleanCmd = (cmd || '').toLowerCase().trim();
	// Perintah bebas limit diizinkan kapan saja
	if (freeCommands.has(cleanCmd)) return true;

	if (!db.users) db.users = {};
	if (!db.users[sender]) {
		db.users[sender] = {
			vip: false,
			limit: global.limit?.free || 5,
			limitNotified: false
		};
	}

	const user = db.users[sender];
	const isVip = isCreator || Boolean(user.vip);

	// VIP & Owner: Akses tanpa batas (Unlimited), tidak dipotong limit
	if (isVip) return true;

	// Pastikan nilai limit adalah angka yang valid
	if (typeof user.limit !== 'number' || isNaN(user.limit)) {
		user.limit = global.limit?.free || 5;
	}

	// Jika limit sudah habis (<= 0)
	if (user.limit <= 0) {
		user.limit = 0;
		// Kirim teks notifikasi Oguri Cap HANYA 1 KALI saja
		if (!user.limitNotified) {
			user.limitNotified = true;
			global._dbDirty = true;
			try {
				await m.reply(OGURI_LIMIT_MESSAGE);
			} catch (e) {
				console.error('[LIMIT] Gagal mengirim peringatan limit Oguri:', e);
			}
		}
		// Selebihnya diam (silent return) agar tidak spam jika terus mengirim command
		return false;
	}

	// Jika masih memiliki limit, potong 1 limit untuk eksekusi perintah
	user.limit -= 1;
	if (user.limit < 0) user.limit = 0;
	user.limitNotified = false; // Reset status notifikasi selama masih punya sisa limit
	global._dbDirty = true;
	return true;
}
