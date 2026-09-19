/**
 * OguriCap/ai/mahiru/relationship.js
 * -----------------------------------------------------------------------
 * Modul Manajemen Relasi Khusus Mahiru Shiina AI.
 * 
 * Mengelola status hubungan spesial (misal: pacar, sahabat dekat, adik, dll.)
 * yang diberikan kepada pengguna tertentu HANYA atas izin Shiro-sama (Owner).
 */

/**
 * Mendapatkan data relasi Mahiru untuk user tertentu.
 *
 * @param {Object} db - Database global
 * @param {string} userJid - JID pengguna (misal: 628xxx@s.whatsapp.net)
 * @returns {Object|null} Objek relasi atau null
 */
export function getMahiruRelationship(db, userJid) {
	if (!db || !userJid) return null;
	const relDb = db.mahiruRelationships || (global.db && global.db.mahiruRelationships);
	if (!relDb) return null;

	const cleanNum = String(userJid).replace(/[^0-9]/g, '');
	if (!cleanNum) return null;

	return relDb[cleanNum] || relDb[userJid] || null;
}

/**
 * Menyimpan / memperbarui relasi pengguna atas izin Shiro-sama.
 *
 * @param {Object} db - Database global
 * @param {string} userJid - JID pengguna target
 * @param {Object} data - Data relasi
 * @param {string} data.role - Jenis hubungan (contoh: 'pacar', 'sahabat', 'adik')
 * @param {string} [data.targetName] - Nama target
 * @param {string} [data.note] - Catatan tambahan
 * @returns {Object} Data relasi yang disimpan
 */
export function setMahiruRelationship(db, userJid, { role = 'pacar', targetName = '', note = '' } = {}) {
	if (!db) db = global.db || {};
	if (!db.mahiruRelationships) db.mahiruRelationships = {};

	const cleanNum = String(userJid).replace(/[^0-9]/g, '');
	const targetKey = cleanNum || userJid;

	const relData = {
		jid: userJid,
		number: cleanNum,
		role: role.toLowerCase(),
		targetName: targetName || cleanNum,
		grantedBy: 'Shiro-sama',
		note: note || 'Ditetapkan atas restu dan izin Shiro-sama',
		createdAt: Date.now(),
		updatedAt: Date.now()
	};

	db.mahiruRelationships[targetKey] = relData;
	if (global.db) {
		global.db.mahiruRelationships = db.mahiruRelationships;
		global._dbDirty = true;
	}

	return relData;
}

/**
 * Menghapus relasi pengguna.
 *
 * @param {Object} db - Database global
 * @param {string} userJid - JID target
 * @returns {boolean} Apakah berhasil dihapus
 */
export function removeMahiruRelationship(db, userJid) {
	if (!db || !userJid) return false;
	const relDb = db.mahiruRelationships || (global.db && global.db.mahiruRelationships);
	if (!relDb) return false;

	const cleanNum = String(userJid).replace(/[^0-9]/g, '');
	let deleted = false;

	if (cleanNum && relDb[cleanNum]) {
		delete relDb[cleanNum];
		deleted = true;
	}
	if (relDb[userJid]) {
		delete relDb[userJid];
		deleted = true;
	}

	if (deleted && global.db) {
		global._dbDirty = true;
	}

	return deleted;
}

/**
 * Mendapatkan seluruh daftar relasi Mahiru.
 *
 * @param {Object} db - Database global
 * @returns {Array<Object>} Daftar relasi
 */
export function listMahiruRelationships(db) {
	const relDb = db?.mahiruRelationships || global.db?.mahiruRelationships || {};
	return Object.values(relDb);
}

/**
 * Memeriksa apakah teks dari Shiro-sama mengandung instruksi penetapan relasi khusus secara natural.
 *
 * Contoh instruksi natural dari Shiro-sama:
 * - "mahiru, anggap @user / dia pacarmu ya"
 * - "mahiru, perlakukan @user layaknya pacar"
 * - "mahiru, jadikan @user pacarmu mulai sekarang"
 * - "mahiru, hapus relasi @user"
 *
 * @param {string} text - Teks pesan
 * @param {Array<string>} mentionedJids - List JID yang dimention
 * @param {string|null} quotedSender - JID pesan yang direply
 * @returns {Object|null} Action { action: 'set'|'remove', targetJid: string, role: string }
 */
export function parseOwnerRelationIntent(text = '', mentionedJids = [], quotedSender = null) {
	if (!text || typeof text !== 'string') return null;
	const lower = text.toLowerCase();

	// Tentukan target JID
	let targetJid = null;
	if (Array.isArray(mentionedJids) && mentionedJids.length > 0) {
		targetJid = mentionedJids[0];
	} else if (quotedSender) {
		targetJid = quotedSender;
	}

	// Cek jika perintah hapus relasi
	const isRemove = /(hapus|cabut|batalkan|putus(in)?|hilangkan)\s+(relasi|hubungan|status|pacar)/i.test(lower) ||
		/(jangan\s+anggap\s+.*(pacar|kekasih))/i.test(lower);

	if (isRemove && targetJid) {
		return { action: 'remove', targetJid };
	}

	// Cek kata kunci penetapan relasi
	const isSetMatch = /(anggap|perlakukan|jadikan|buat)\s+(dia|mereka|kamu|kak|user|orang\s+ini|.*)?\s*(layaknya|sebagai|jadi)?\s*(pacar|kekasih|sahabat|adik|kakak|tunangan|istri|suami)/i.test(lower) ||
		/(mulai\s+sekarang\s+.*(pacar|kekasih))/i.test(lower) ||
		/(pacaran\s+sama\s+.*)/i.test(lower);

	if (isSetMatch) {
		let role = 'pacar';
		if (/sahabat/i.test(lower)) role = 'sahabat';
		else if (/adik/i.test(lower)) role = 'adik';
		else if (/kakak/i.test(lower)) role = 'kakak';
		else if (/tunangan/i.test(lower)) role = 'tunangan';
		else if (/istri|suami/i.test(lower)) role = 'pasangan';

		// Jika targetJid ditemukan
		if (targetJid) {
			return { action: 'set', targetJid, role };
		}
	}

	return null;
}
