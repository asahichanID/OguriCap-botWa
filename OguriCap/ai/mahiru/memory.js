/**
 * OguriCap/ai/mahiru/memory.js
 * -----------------------------------------------------------------------
 * Manajemen Memori Percakapan Mahiru Shiina.
 * Menyimpan riwayat obrolan per user/chat agar percakapan tetap nyambung.
 */

const MAX_HISTORY = 10; // Maksimal 5 pasang pesan bolak-balik

/**
 * Mendapatkan riwayat pesan untuk user / grup tertentu.
 *
 * @param {Object} db - Database global
 * @param {string} sessionKey - Kunci unik sesi (misal: chatId_senderId)
 * @returns {Array<{role: string, content: string, timestamp: number}>}
 */
export function getMahiruMemory(db, sessionKey) {
	if (!db) return [];
	if (!db.mahiruMemory) db.mahiruMemory = {};
	if (!Array.isArray(db.mahiruMemory[sessionKey])) {
		db.mahiruMemory[sessionKey] = [];
	}
	return db.mahiruMemory[sessionKey];
}

/**
 * Menambahkan pesan ke dalam memori percakapan.
 *
 * @param {Object} db - Database global
 * @param {string} sessionKey - Kunci sesi
 * @param {'user'|'assistant'} role - Peran pengirim
 * @param {string} content - Isi pesan
 */
export function addMahiruMessage(db, sessionKey, role, content) {
	if (!db || !sessionKey || !content) return;
	if (!db.mahiruMemory) db.mahiruMemory = {};
	if (!Array.isArray(db.mahiruMemory[sessionKey])) {
		db.mahiruMemory[sessionKey] = [];
	}

	db.mahiruMemory[sessionKey].push({
		role,
		content: content.trim(),
		timestamp: Date.now()
	});

	// Pangkas jika melebihi batas
	if (db.mahiruMemory[sessionKey].length > MAX_HISTORY) {
		db.mahiruMemory[sessionKey] = db.mahiruMemory[sessionKey].slice(-MAX_HISTORY);
	}
}

/**
 * Menghapus / mereset memori percakapan.
 *
 * @param {Object} db - Database global
 * @param {string} sessionKey - Kunci sesi
 */
export function clearMahiruMemory(db, sessionKey) {
	if (!db || !db.mahiruMemory) return;
	if (db.mahiruMemory[sessionKey]) {
		delete db.mahiruMemory[sessionKey];
	}
}
