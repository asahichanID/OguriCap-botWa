/**
 * OguriCap/itsuki/memory.js
 * -----------------------------------------------------------------------
 * Manajemen Memori & Pelacakan Pesan Percakapan Itsuki Nakano (中野 五月).
 * Menyimpan riwayat obrolan per user/chat agar percakapan tetap nyambung,
 * serta melacak ID & teks pesan yang ASLI dikirim oleh Itsuki AI.
 */

const MAX_HISTORY = 10; // Maksimal 5 pasang pesan bolak-balik

const itsukiSentMessageIds = new Set();
const itsukiSentTexts = new Set();

/**
 * Merekam ID dan teks pesan yang dikirim oleh Itsuki AI
 * @param {string} id - Message ID
 * @param {string} text - Message text
 */
export function recordItsukiSentMessage(id, text = '') {
	if (id && typeof id === 'string') {
		itsukiSentMessageIds.add(id);
		if (itsukiSentMessageIds.size > 3000) {
			const oldest = itsukiSentMessageIds.values().next().value;
			itsukiSentMessageIds.delete(oldest);
		}
	}
	if (text && typeof text === 'string') {
		const clean = text.trim();
		if (clean) {
			itsukiSentTexts.add(clean);
			if (itsukiSentTexts.size > 500) {
				const oldest = itsukiSentTexts.values().next().value;
				itsukiSentTexts.delete(oldest);
			}
		}
	}
}

/**
 * Memeriksa apakah pesan yang di-reply adalah ASLI pesan dari Itsuki AI
 *
 * @param {Object} m - Objek pesan WhatsApp
 * @param {Object} db - Database global
 * @returns {boolean}
 */
export function isReplyToItsuki(m, db = global.db) {
	if (!m || !m.quoted) return false;

	const quotedId = m.quoted.id || m.quoted.key?.id;
	const quotedText = (typeof m.quoted.text === 'string' ? m.quoted.text : m.quoted.body || '').trim();

	// 1. Cek ID pesan
	if (quotedId && itsukiSentMessageIds.has(quotedId)) {
		return true;
	}

	// 2. Cek teks di cache balasan
	if (quotedText && itsukiSentTexts.has(quotedText)) {
		return true;
	}

	// 3. Cek di memori percakapan sesi (db.itsukiMemory)
	if (db && db.itsukiMemory && typeof db.itsukiMemory === 'object') {
		const sessionKey = `${m.chat}:${m.sender}`;
		const sessionHistory = db.itsukiMemory[sessionKey];
		if (Array.isArray(sessionHistory) && quotedText) {
			const isMatch = sessionHistory.some(msg => msg.role === 'assistant' && (
				msg.content === quotedText ||
				msg.content.includes(quotedText) ||
				quotedText.includes(msg.content)
			));
			if (isMatch) return true;
		}

		if (m.isGroup && quotedText) {
			for (const [key, hist] of Object.entries(db.itsukiMemory)) {
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
 * @param {string} memKey - Kunci unik sesi (chat:sender)
 * @returns {Array<{role: string, content: string}>}
 */
export function getItsukiMemory(db, memKey) {
	if (!db) return [];
	db.itsukiMemory ??= {};
	if (!Array.isArray(db.itsukiMemory[memKey])) {
		db.itsukiMemory[memKey] = [];
	}
	return db.itsukiMemory[memKey];
}

/**
 * Menambahkan pesan ke memori riwayat Itsuki AI.
 *
 * @param {Object} db
 * @param {string} memKey
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
export function addItsukiMessage(db, memKey, role, content) {
	if (!db || !memKey || !content) return;
	db.itsukiMemory ??= {};
	if (!Array.isArray(db.itsukiMemory[memKey])) {
		db.itsukiMemory[memKey] = [];
	}
	db.itsukiMemory[memKey].push({ role, content });

	// Jaga agar tidak melebihi batas MAX_HISTORY
	if (db.itsukiMemory[memKey].length > MAX_HISTORY) {
		db.itsukiMemory[memKey] = db.itsukiMemory[memKey].slice(-MAX_HISTORY);
	}
}

/**
 * Menghapus memori riwayat percakapan Itsuki AI.
 *
 * @param {Object} db
 * @param {string} memKey
 */
export function clearItsukiMemory(db, memKey) {
	if (!db || !db.itsukiMemory) return;
	if (memKey) {
		delete db.itsukiMemory[memKey];
	} else {
		db.itsukiMemory = {};
	}
}
