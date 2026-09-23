/**
 * OguriCap/ai/aiengine/relationship.js
 * -----------------------------------------------------------------------
 * Universal Permanent JSON Relationship Manager.
 * 
 * Fitur:
 * - 100% Permanen berbasis file JSON (.json) di folder asisten masing-masing
 * - Saat perintah setrelasi / delrelasi dieksekusi, langsung disimpan permanen ke .json
 * - Pengguna / bot owner dapat menambahkan nomor secara manual ke dalam file .json
 * - Parsing natural language otomatis untuk instruksi Shiro-sama (Owner)
 */

import fs from 'fs';
import path from 'path';

/**
 * Membaca data relasi dari file JSON secara aman
 * @param {string} filePath - Absolute atau relative path ke file relationship.json
 * @returns {Record<string, any>}
 */
export function loadRelationshipFile(filePath) {
	if (!filePath) return {};
	try {
		if (!fs.existsSync(filePath)) {
			const dir = path.dirname(filePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf-8');
			return {};
		}
		const raw = fs.readFileSync(filePath, 'utf-8');
		return JSON.parse(raw || '{}');
	} catch (err) {
		console.error(`[AIEngine:Relationship] Gagal membaca ${filePath}:`, err.message);
		return {};
	}
}

/**
 * Menyimpan data relasi ke file JSON secara permanen
 * @param {string} filePath - Path ke file relationship.json
 * @param {Record<string, any>} data - Data relasi yang akan disimpan
 */
export function saveRelationshipFile(filePath, data = {}) {
	if (!filePath) return;
	try {
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
	} catch (err) {
		console.error(`[AIEngine:Relationship] Gagal menyimpan ke ${filePath}:`, err.message);
	}
}

/**
 * Mengambil status relasi pengguna untuk asisten tertentu
 * @param {Object} params
 * @param {string} params.userJid - JID atau nomor telepon user
 * @param {string} params.filePath - Path ke file relationship.json
 * @param {Object} [params.db] - Database global
 * @param {string} [params.assistantId] - ID asisten (contoh: 'mahiru', 'itsuki')
 * @returns {Object|null}
 */
export function getRelationship({ userJid, filePath, db = global.db, assistantId = 'default' }) {
	if (!userJid) return null;
	const cleanNum = String(userJid).replace(/[^0-9]/g, '');
	if (!cleanNum) return null;

	// 1. Baca dari file JSON permanen
	const fileData = loadRelationshipFile(filePath);
	const match = fileData[cleanNum] || fileData[userJid] || fileData[`${cleanNum}@s.whatsapp.net`];
	if (match) {
		// Sinkronkan ke db memory jika ada
		if (db && assistantId) {
			const dbRelKey = `${assistantId.toLowerCase()}Relationships`;
			db[dbRelKey] ??= {};
			db[dbRelKey][cleanNum] = match;
		}
		return match;
	}

	// 2. Fallback cek ke db jika belum tersinkron
	if (db && assistantId) {
		const dbRelKey = `${assistantId.toLowerCase()}Relationships`;
		const dbMatch = db[dbRelKey]?.[cleanNum] || db[dbRelKey]?.[userJid];
		if (dbMatch) {
			// Simpan kembali ke file JSON agar permanen
			fileData[cleanNum] = dbMatch;
			saveRelationshipFile(filePath, fileData);
			return dbMatch;
		}
	}

	return null;
}

/**
 * Menyimpan / memperbarui relasi pengguna ke file JSON secara permanen
 * @param {Object} params
 * @param {string} params.userJid - JID atau nomor telepon user
 * @param {Object} params.data - Data relasi
 * @param {string} params.filePath - Path ke file relationship.json
 * @param {Object} [params.db] - Database global
 * @param {string} [params.assistantId] - ID asisten
 * @returns {Object} Data relasi yang disimpan
 */
export function setRelationship({ userJid, data = {}, filePath, db = global.db, assistantId = 'default' }) {
	const cleanNum = String(userJid || '').replace(/[^0-9]/g, '');
	const targetKey = cleanNum || String(userJid);
	const fullJid = userJid.includes('@') ? userJid : `${cleanNum}@s.whatsapp.net`;

	const relData = {
		jid: fullJid,
		number: cleanNum,
		role: (data.role || 'pacar').toLowerCase(),
		targetName: data.targetName || cleanNum,
		grantedBy: data.grantedBy || 'Shiro-sama',
		note: data.note || 'Ditetapkan atas restu dan izin Shiro-sama',
		createdAt: data.createdAt || Date.now(),
		updatedAt: Date.now()
	};

	// 1. Simpan permanen ke file JSON
	const fileData = loadRelationshipFile(filePath);
	fileData[targetKey] = relData;
	saveRelationshipFile(filePath, fileData);

	// 2. Sinkronkan ke db
	if (db && assistantId) {
		const dbRelKey = `${assistantId.toLowerCase()}Relationships`;
		db[dbRelKey] ??= {};
		db[dbRelKey][targetKey] = relData;
		if (global.db) global._dbDirty = true;
	}

	return relData;
}

/**
 * Menghapus relasi pengguna dari file JSON secara permanen
 * @param {Object} params
 * @param {string} params.userJid - JID atau nomor pengguna target
 * @param {string} params.filePath - Path ke file relationship.json
 * @param {Object} [params.db] - Database global
 * @param {string} [params.assistantId] - ID asisten
 * @returns {boolean}
 */
export function removeRelationship({ userJid, filePath, db = global.db, assistantId = 'default' }) {
	if (!userJid) return false;
	const cleanNum = String(userJid).replace(/[^0-9]/g, '');

	const fileData = loadRelationshipFile(filePath);
	let deleted = false;

	if (cleanNum && fileData[cleanNum]) {
		delete fileData[cleanNum];
		deleted = true;
	}
	if (fileData[userJid]) {
		delete fileData[userJid];
		deleted = true;
	}

	if (deleted) {
		saveRelationshipFile(filePath, fileData);
	}

	// Hapus dari db jika ada
	if (db && assistantId) {
		const dbRelKey = `${assistantId.toLowerCase()}Relationships`;
		if (db[dbRelKey]) {
			if (cleanNum) delete db[dbRelKey][cleanNum];
			delete db[dbRelKey][userJid];
			if (global.db) global._dbDirty = true;
		}
	}

	return deleted;
}

/**
 * Mengambil seluruh daftar relasi asisten dari file JSON permanen
 * @param {Object} params
 * @param {string} params.filePath - Path ke file relationship.json
 * @param {Object} [params.db] - Database global
 * @param {string} [params.assistantId] - ID asisten
 * @returns {Array<Object>}
 */
export function listRelationships({ filePath, db = global.db, assistantId = 'default' }) {
	const fileData = loadRelationshipFile(filePath);
	const items = Object.values(fileData);

	if (items.length > 0) return items;

	// Fallback ke db jika file masih kosong
	if (db && assistantId) {
		const dbRelKey = `${assistantId.toLowerCase()}Relationships`;
		return Object.values(db[dbRelKey] || {});
	}

	return [];
}

/**
 * Memeriksa apakah teks dari Shiro-sama (Owner) mengandung instruksi penetapan relasi khusus secara natural
 * @param {string} text - Teks pesan
 * @param {Array<string>} [mentionedJids=[]] - JID yang di-mention
 * @param {string|null} [quotedSender=null] - Pengirim pesan yang di-reply
 * @returns {Object|null} { action: 'set'|'remove', targetJid: string, role: string }
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
	} else {
		// Ekstrak nomor WhatsApp dari teks
		const numMatch = text.match(/@?(\d{8,16})/);
		if (numMatch && numMatch[1]) {
			targetJid = `${numMatch[1]}@s.whatsapp.net`;
		}
	}

	// Cek jika perintah hapus relasi
	const isRemove = /(hapus|cabut|batalkan|putus(in)?|hilangkan)\s+(relasi|hubungan|status|pacar|suami|istri|tunangan)/i.test(lower) ||
		/(jangan\s+anggap\s+.*(pacar|kekasih|suami|istri|pasangan))/i.test(lower);

	if (isRemove && targetJid) {
		return { action: 'remove', targetJid, role: 'teman' };
	}

	// Cek kata kunci penetapan relasi
	const isSetMatch = /(anggap|perlakukan|jadikan|buat|set|tetapkan)\s+(dia|mereka|kamu|kak|user|orang\s+ini|.*)?\s*(layaknya|sebagai|jadi)?\s*(pacar|kekasih|sahabat|adik|kakak|tunangan|istri|suami|pasangan)/i.test(lower) ||
		/(mulai\s+sekarang\s+.*(pacar|kekasih|suami|istri|tunangan|pasangan))/i.test(lower) ||
		/(pacaran\s+sama\s+.*|nikah\s+sama\s+.*|suami\s+kamu\s+.*|suamimu\s+.*)/i.test(lower);

	if (isSetMatch && targetJid) {
		let role = 'pacar';
		if (/suami/i.test(lower)) role = 'suami';
		else if (/istri/i.test(lower)) role = 'istri';
		else if (/tunangan/i.test(lower)) role = 'tunangan';
		else if (/pacar|kekasih/i.test(lower)) role = 'pacar';
		else if (/pasangan/i.test(lower)) role = 'pasangan';
		else if (/sahabat/i.test(lower)) role = 'sahabat';
		else if (/adik/i.test(lower)) role = 'adik';
		else if (/kakak/i.test(lower)) role = 'kakak';

		return { action: 'set', targetJid, role };
	}

	return null;
}
