/**
 * OguriCap/ai/mahiru/memory.js
 * -----------------------------------------------------------------------
 * Manajemen Memori & Pelacakan Pesan Percakapan Mahiru Shiina.
 * Menyimpan riwayat obrolan per user/chat agar percakapan tetap nyambung,
 * serta melacak ID & teks pesan yang ASLI dikirim oleh Mahiru AI.
 */

const MAX_HISTORY = 10; // Maksimal 5 pasang pesan bolak-balik

// Set & Map untuk melacak pesan yang ASLI dikirim oleh Mahiru AI
// Mencegah reply ke chat biasa dari nomor bot/owner ter-trigger sebagai chat AI
const mahiruSentMessageIds = new Set();
const mahiruSentTexts = new Set();

/**
 * Merekam ID dan teks pesan yang dikirim oleh Mahiru AI
 * @param {string} id - Message ID
 * @param {string} text - Message text
 */
export function recordMahiruSentMessage(id, text = '') {
	if (id && typeof id === 'string') {
		mahiruSentMessageIds.add(id);
		if (mahiruSentMessageIds.size > 3000) {
			const oldest = mahiruSentMessageIds.values().next().value;
			mahiruSentMessageIds.delete(oldest);
		}
	}
	if (text && typeof text === 'string') {
		const clean = text.trim();
		if (clean) {
			mahiruSentTexts.add(clean);
			if (mahiruSentTexts.size > 500) {
				const oldest = mahiruSentTexts.values().next().value;
				mahiruSentTexts.delete(oldest);
			}
		}
	}
}

/**
 * Memeriksa apakah pesan yang di-reply adalah ASLI pesan dari Mahiru AI
 * (Bukan pesan teks biasa dari pemilik bot / pesan command bot lain)
 *
 * @param {Object} m - Objek pesan WhatsApp
 * @param {Object} db - Database global
 * @returns {boolean}
 */
export function isReplyToMahiru(m, db = global.db) {
	if (!m || !m.quoted) return false;

	const quotedId = m.quoted.id || m.quoted.key?.id;
	const quotedText = (typeof m.quoted.text === 'string' ? m.quoted.text : m.quoted.body || '').trim();

	// 1. Cek ID pesan yang tercatat di tracker Mahiru
	if (quotedId && mahiruSentMessageIds.has(quotedId)) {
		return true;
	}

	// 2. Cek teks di cache balasan Mahiru
	if (quotedText && mahiruSentTexts.has(quotedText)) {
		return true;
	}

	// 3. Cek di memori percakapan sesi (db.mahiruMemory)
	if (db && db.mahiruMemory && typeof db.mahiruMemory === 'object') {
		// Cek di sesi chat ini dulu
		const sessionKey = `${m.chat}:${m.sender}`;
		const sessionHistory = db.mahiruMemory[sessionKey];
		if (Array.isArray(sessionHistory) && quotedText) {
			const isMatch = sessionHistory.some(msg => msg.role === 'assistant' && (
				msg.content === quotedText ||
				msg.content.includes(quotedText) ||
				quotedText.includes(msg.content)
			));
			if (isMatch) return true;
		}

		// Cek semua session history untuk chat/grup ini jika di grup
		if (m.isGroup && quotedText) {
			for (const [key, hist] of Object.entries(db.mahiruMemory)) {
				if (key.startsWith(`${m.chat}:`) && Array.isArray(hist)) {
					const match = hist.some(msg => msg.role === 'assistant' && (
						msg.content === quotedText ||
						msg.content.includes(quotedText) ||
						quotedText.includes(msg.content)
					));
					if (match) return true;
				}
			}
		}
	}

	return false;
}

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
