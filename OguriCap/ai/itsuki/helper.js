/**
 * OguriCap/itsuki/helper.js
 * -----------------------------------------------------------------------
 * Fungsi-fungsi utilitas pendukung untuk Itsuki Nakano AI:
 * - Pembersihan prefix trigger
 * - Cooldown management
 * - Presence composing (indikator mengetik)
 * - Deteksi waktu lokal (pagi/siang/sore/malam)
 */

const cooldownMap = new Map();

/**
 * Memeriksa cooldown per-user agar tidak spam (3 detik)
 */
export function checkItsukiCooldown(userId, delayMs = 3000) {
	const now = Date.now();
	const last = cooldownMap.get(userId) || 0;
	if (now - last < delayMs) return false;
	cooldownMap.set(userId, now);
	setTimeout(() => cooldownMap.delete(userId), delayMs + 500);
	return true;
}

/**
 * Membersihkan pesan dari nama trigger Itsuki
 */
export function cleanItsukiMessage(text = '') {
	if (!text || typeof text !== 'string') return 'Halo Itsuki';
	
	const cleaned = text
		.replace(/^(hai|halo|hei|oi|oy|pagi|siang|sore|malam)?\s*(itsuki(-chan|-san|-sensei)?|itsuki\s*(chan|san|sensei)?|nakano(-san)?|nakano\s*itsuki|eatsuki|borgar queen)[,\s.:!?-]*/i, '')
		.replace(/(itsuki(-chan|-san|-sensei)?|itsuki\s*(chan|san|sensei)?|nakano(-san)?|nakano\s*itsuki|eatsuki|borgar queen)[,\s.:!?-]*$/i, '')
		.trim();

	if (!cleaned) {
		return text.trim() || 'Halo Itsuki';
	}
	return cleaned;
}

/**
 * Mendapatkan estimasi waktu hari (WIB/lokal)
 */
export function getTimeOfDay() {
	try {
		const hour = new Date().getHours();
		if (hour >= 4 && hour < 11) return 'pagi';
		if (hour >= 11 && hour < 15) return 'siang';
		if (hour >= 15 && hour < 18) return 'sore';
		return 'malam';
	} catch {
		return '';
	}
}

/**
 * Mengirim status typing / composing ke WhatsApp
 */
export async function sendItsukiTyping(naze, chatJid) {
	try {
		if (naze && typeof naze.sendPresenceUpdate === 'function') {
			await naze.sendPresenceUpdate('composing', chatJid);
		}
	} catch {
		// Non-blocking
	}
}

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
