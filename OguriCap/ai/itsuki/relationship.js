/**
 * OguriCap/itsuki/relationship.js
 * -----------------------------------------------------------------------
 * Modul Manajemen Relasi Khusus Itsuki Nakano AI.
 *
 * Mengelola status hubungan spesial (misal: pacar, suami, murid/guru les, partner kuliner, dll.)
 * yang diberikan kepada pengguna tertentu HANYA atas izin Shiro-sama (Owner).
 */

/**
 * Mendapatkan data relasi Itsuki untuk user tertentu.
 *
 * @param {Object} db - Database global
 * @param {string} userJid - JID pengguna
 * @returns {Object|null} Objek relasi atau null
 */
export function getItsukiRelationship(db, userJid) {
	if (!db || !userJid) return null;
	const relDb = db.itsukiRelationships || (global.db && global.db.itsukiRelationships);
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
 * @returns {Object} Data relasi yang disimpan
 */
export function setItsukiRelationship(db, userJid, { role = 'pacar', targetName = '', note = '' } = {}) {
	if (!db) db = global.db || {};
	if (!db.itsukiRelationships) db.itsukiRelationships = {};

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

	db.itsukiRelationships[targetKey] = relData;
	if (global.db) {
		global.db.itsukiRelationships = db.itsukiRelationships;
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
export function removeItsukiRelationship(db, userJid) {
	if (!db || !userJid) return false;
	const relDb = db.itsukiRelationships || (global.db && global.db.itsukiRelationships);
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
 * Mendapatkan seluruh daftar relasi Itsuki.
 *
 * @param {Object} db - Database global
 * @returns {Array<Object>}
 */
export function listItsukiRelationships(db) {
	if (!db) db = global.db || {};
	const relDb = db.itsukiRelationships || (global.db && global.db.itsukiRelationships) || {};
	return Object.values(relDb);
}

/**
 * Membaca niat perintah relasi otomatis dari chat Shiro-sama.
 *
 * @param {string} text - Pesan dari owner
 * @param {Array<string>} mentionedJids - List JID yang di-tag
 * @param {string|null} quotedSender - JID pengirim yang direply
 * @returns {Object|null}
 */
export function parseOwnerItsukiRelationIntent(text = '', mentionedJids = [], quotedSender = null) {
	if (!text || typeof text !== 'string') return null;
	const lower = text.toLowerCase();

	// Tentukan target JID (dari mention array, quoted sender, atau nomor di dalam teks)
	let targetJid = null;
	if (Array.isArray(mentionedJids) && mentionedJids.length > 0) {
		targetJid = mentionedJids[0];
	} else if (quotedSender) {
		targetJid = quotedSender;
	} else {
		const numMatch = text.match(/@?(\d{8,16})/);
		if (numMatch && numMatch[1]) {
			targetJid = `${numMatch[1]}@s.whatsapp.net`;
		}
	}

	const isDelIntent = (
		lower.includes('putus') ||
		lower.includes('hapus relasi') ||
		lower.includes('cabut relasi') ||
		lower.includes('batal relasi') ||
		lower.includes('delrelasi') ||
		lower.includes('bukan lagi') ||
		/(hapus|cabut|batalkan|putus(in)?|hilangkan)\s+(relasi|hubungan|status|pacar|suami|istri|tunangan)/i.test(lower)
	);

	if (isDelIntent && targetJid) {
		return { action: 'delete', targetJid };
	}

	const isSetIntent = (
		lower.includes('anggap') ||
		lower.includes('jadiin') ||
		lower.includes('jadikan') ||
		lower.includes('izinkan') ||
		lower.includes('bolehkan') ||
		lower.includes('setrelasi') ||
		lower.includes('relasi') ||
		/(anggap|perlakukan|jadikan|buat|set|tetapkan)\s+(dia|mereka|kamu|kak|user|orang\s+ini|.*)?\s*(layaknya|sebagai|jadi)?\s*(pacar|kekasih|sahabat|adik|kakak|tunangan|istri|suami|pasangan|guru)/i.test(lower)
	);

	if (isSetIntent && targetJid) {
		let role = 'pacar';
		if (lower.includes('suami') || lower.includes('husband')) role = 'suami';
		else if (lower.includes('pacar') || lower.includes('kekasih') || lower.includes('ayang')) role = 'pacar';
		else if (lower.includes('guru') || lower.includes('sensei') || lower.includes('tutor')) role = 'guru les';
		else if (lower.includes('partner makan') || lower.includes('kuliner') || lower.includes('teman makan')) role = 'partner makan';
		else if (lower.includes('sahabat') || lower.includes('teman dekat')) role = 'sahabat';

		return { action: 'set', targetJid, role };
	}

	return null;
}
