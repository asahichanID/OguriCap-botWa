/**
 * OguriCap/ai/aiengine/memory.js
 * -----------------------------------------------------------------------
 * Universal Character-Agnostic Conversation Memory & Message Tracker.
 * 
 * Fitur:
 * - Tidak hardcode nama karakter (fleksibel menggunakan assistantId)
 * - Mengisolasi sesi dan memori per asisten (Mahiru, Itsuki, dsb.)
 * - Mendukung multi-asisten aktif bersamaan di grup tanpa saling tabrakan
 * - Pelacakan pesan keluar (anti-double reply & pendeteksi reply akurat)
 * - Sinkronisasi otomatis ke memori internal & global db
 */

// In-Memory storage per assistantId: assistantId -> Map<sessionKey, Array<Message>>
const memoryStore = new Map();

// Pelacakan pesan yang dikirim oleh masing-masing asisten: assistantId -> Set<string>
const sentMessageIds = new Map();
const sentMessageTexts = new Map();

/**
 * Mengambil store sent IDs untuk asisten tertentu
 * @param {string} assistantId 
 * @returns {Set<string>}
 */
function getAssistantSentIds(assistantId = 'default') {
	const id = String(assistantId).toLowerCase();
	if (!sentMessageIds.has(id)) {
		sentMessageIds.set(id, new Set());
	}
	return sentMessageIds.get(id);
}

/**
 * Mengambil store sent texts untuk asisten tertentu
 * @param {string} assistantId 
 * @returns {Set<string>}
 */
function getAssistantSentTexts(assistantId = 'default') {
	const id = String(assistantId).toLowerCase();
	if (!sentMessageTexts.has(id)) {
		sentMessageTexts.set(id, new Set());
	}
	return sentMessageTexts.get(id);
}

/**
 * Mengambil session memory map untuk asisten tertentu
 * @param {string} assistantId 
 * @returns {Map<string, Array<any>>}
 */
function getAssistantMemoryMap(assistantId = 'default') {
	const id = String(assistantId).toLowerCase();
	if (!memoryStore.has(id)) {
		memoryStore.set(id, new Map());
	}
	return memoryStore.get(id);
}

/**
 * Merekam ID dan isi teks pesan yang dikirim oleh asisten
 * @param {Object} params
 * @param {string} params.assistantId - ID asisten (contoh: 'mahiru', 'itsuki')
 * @param {string} [params.messageId] - ID pesan WhatsApp
 * @param {string} [params.text] - Konten teks pesan
 */
export function recordSentMessage({ assistantId = 'default', messageId = '', text = '' }) {
	const id = String(assistantId).toLowerCase();

	if (messageId && typeof messageId === 'string') {
		const ids = getAssistantSentIds(id);
		ids.add(messageId);
		if (ids.size > 3000) {
			const oldest = ids.values().next().value;
			ids.delete(oldest);
		}
	}

	if (text && typeof text === 'string') {
		const clean = text.trim();
		if (clean) {
			const texts = getAssistantSentTexts(id);
			texts.add(clean);
			if (texts.size > 500) {
				const oldest = texts.values().next().value;
				texts.delete(oldest);
			}
		}
	}
}

/**
 * Memeriksa apakah pesan yang di-reply adalah ASLI pesan dari asisten tertentu
 * @param {Object} params
 * @param {string} params.assistantId - ID asisten (contoh: 'mahiru', 'itsuki')
 * @param {Object} params.m - Objek pesan WhatsApp
 * @param {Object} [params.db] - Database global
 * @returns {boolean}
 */
export function isReplyToAssistant({ assistantId = 'default', m, db = global.db }) {
	if (!m || !m.quoted) return false;
	const id = String(assistantId).toLowerCase();

	const quotedId = m.quoted.id || m.quoted.key?.id;
	const quotedText = (typeof m.quoted.text === 'string' ? m.quoted.text : m.quoted.body || '').trim();

	// 1. Cek ID pesan yang dicatat pada tracker asisten
	const sentIds = getAssistantSentIds(id);
	if (quotedId && sentIds.has(quotedId)) {
		return true;
	}

	// 2. Cek teks di cache balasan asisten
	const sentTexts = getAssistantSentTexts(id);
	if (quotedText && sentTexts.has(quotedText)) {
		return true;
	}

	// 3. Cek di database memori sesi asisten
	const dbMemoryKey = `${id}Memory`;
	const memoryContainer = db?.[dbMemoryKey] || global.db?.[dbMemoryKey];
	if (memoryContainer && typeof memoryContainer === 'object' && quotedText) {
		const sessionKey = `${m.chat}:${m.sender}`;
		const sessionHistory = memoryContainer[sessionKey];
		if (Array.isArray(sessionHistory)) {
			const match = sessionHistory.some(msg => msg.role === 'assistant' && (
				msg.content === quotedText ||
				msg.content.includes(quotedText) ||
				quotedText.includes(msg.content)
			));
			if (match) return true;
		}

		if (m.isGroup) {
			for (const [key, hist] of Object.entries(memoryContainer)) {
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

	// 4. Cek di in-memory store
	const memMap = getAssistantMemoryMap(id);
	if (quotedText) {
		for (const [key, hist] of memMap.entries()) {
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

	return false;
}

/**
 * Mendapatkan riwayat pesan untuk asisten dan sesi tertentu
 * @param {Object} params
 * @param {string} params.assistantId - ID asisten (contoh: 'mahiru', 'itsuki')
 * @param {string} params.sessionKey - Kunci unik sesi (misal: chatId:senderId)
 * @param {Object} [params.db] - Database global
 * @param {number} [params.maxHistory=10] - Batas maksimal riwayat
 * @returns {Array<{role: string, content: string, timestamp: number}>}
 */
export function getMemory({ assistantId = 'default', sessionKey, db = global.db, maxHistory = 10 }) {
	if (!sessionKey) return [];
	const id = String(assistantId).toLowerCase();
	const dbMemoryKey = `${id}Memory`;

	// Sync dengan db jika ada
	if (db) {
		db[dbMemoryKey] ??= {};
		if (!Array.isArray(db[dbMemoryKey][sessionKey])) {
			const inMem = getAssistantMemoryMap(id).get(sessionKey);
			db[dbMemoryKey][sessionKey] = Array.isArray(inMem) ? inMem : [];
		}
		return db[dbMemoryKey][sessionKey];
	}

	const memMap = getAssistantMemoryMap(id);
	if (!memMap.has(sessionKey)) {
		memMap.set(sessionKey, []);
	}
	return memMap.get(sessionKey);
}

/**
 * Menambahkan pesan ke dalam memori percakapan asisten
 * @param {Object} params
 * @param {string} params.assistantId - ID asisten (contoh: 'mahiru', 'itsuki')
 * @param {string} params.sessionKey - Kunci sesi
 * @param {'user'|'assistant'} params.role - Peran pengirim
 * @param {string} params.content - Isi pesan
 * @param {Object} [params.db] - Database global
 * @param {number} [params.maxHistory=10] - Batas maksimal riwayat
 */
export function addMessage({ assistantId = 'default', sessionKey, role, content, db = global.db, maxHistory = 10 }) {
	if (!sessionKey || !content) return;
	const id = String(assistantId).toLowerCase();
	const clean = typeof content === 'string' ? content.trim() : String(content);
	if (!clean) return;

	const entry = {
		role,
		content: clean,
		timestamp: Date.now()
	};

	// 1. Simpan di in-memory map
	const memMap = getAssistantMemoryMap(id);
	if (!memMap.has(sessionKey)) {
		memMap.set(sessionKey, []);
	}
	const inMemList = memMap.get(sessionKey);
	inMemList.push(entry);
	if (inMemList.length > maxHistory) {
		memMap.set(sessionKey, inMemList.slice(-maxHistory));
	}

	// 2. Simpan di db jika ada
	if (db) {
		const dbMemoryKey = `${id}Memory`;
		db[dbMemoryKey] ??= {};
		if (!Array.isArray(db[dbMemoryKey][sessionKey])) {
			db[dbMemoryKey][sessionKey] = [];
		}
		db[dbMemoryKey][sessionKey].push(entry);
		if (db[dbMemoryKey][sessionKey].length > maxHistory) {
			db[dbMemoryKey][sessionKey] = db[dbMemoryKey][sessionKey].slice(-maxHistory);
		}
	}
}

/**
 * Menghapus / mereset memori percakapan asisten
 * @param {Object} params
 * @param {string} params.assistantId - ID asisten (contoh: 'mahiru', 'itsuki')
 * @param {string} params.sessionKey - Kunci sesi
 * @param {Object} [params.db] - Database global
 */
export function clearMemory({ assistantId = 'default', sessionKey, db = global.db }) {
	if (!sessionKey) return;
	const id = String(assistantId).toLowerCase();

	const memMap = getAssistantMemoryMap(id);
	memMap.delete(sessionKey);

	if (db) {
		const dbMemoryKey = `${id}Memory`;
		if (db[dbMemoryKey]?.[sessionKey]) {
			delete db[dbMemoryKey][sessionKey];
		}
	}
}

/**
 * Memformat riwayat percakapan menjadi array terstandarisasi untuk prompt model
 * @param {Array<any>} history 
 * @param {number} [maxTurns=6] 
 * @returns {Array<{role: string, content: string}>}
 */
export function formatHistoryForModel(history = [], maxTurns = 6) {
	if (!Array.isArray(history)) return [];
	return history
		.slice(-maxTurns)
		.filter(h => h && h.role && h.content)
		.map(h => ({
			role: h.role === 'assistant' ? 'assistant' : 'user',
			content: String(h.content).trim()
		}));
}
