/**
 * OguriCap/ai/aiengine/helper.js
 * -----------------------------------------------------------------------
 * Universal Helpers & Utilities for AI Assistant Engine.
 */

// Cooldown map: key -> timestamp
const cooldownMap = new Map();

/**
 * Memeriksa cooldown interaksi per user / chat
 * @param {string} key - Identifier (misal: assistantId:chat:sender)
 * @param {number} [cooldownMs=2500] - Durasi cooldown dalam ms
 * @returns {boolean} True jika diizinkan (cooldown berlalu)
 */
export function checkCooldown(key, cooldownMs = 2500) {
	if (!key) return true;
	const now = Date.now();
	const last = cooldownMap.get(key) || 0;
	if (now - last < cooldownMs) {
		return false;
	}
	cooldownMap.set(key, now);

	// Bersihkan memory cooldown secara periodik jika membesar
	if (cooldownMap.size > 2000) {
		for (const [k, time] of cooldownMap.entries()) {
			if (now - time > 60000) {
				cooldownMap.delete(k);
			}
		}
	}
	return true;
}

/**
 * Membersihkan trigger kata kunci dari teks pesan
 * @param {string} text - Teks asli
 * @param {Array<string>} triggers - Daftar trigger
 * @returns {string}
 */
export function cleanTriggerFromText(text = '', triggers = []) {
	if (!text || typeof text !== 'string') return '';
	let clean = text.trim();

	// Urutkan trigger dari yang terpanjang agar pencocokan maksimal
	const sorted = [...triggers].sort((a, b) => b.length - a.length);
	for (const trig of sorted) {
		if (!trig) continue;
		const escaped = trig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(^|\\s)${escaped}([,.!?~\\s]|$)`, 'gi');
		clean = clean.replace(regex, ' ').trim();
	}

	return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Mendapatkan keterangan waktu hari ini (pagi, siang, sore, malam)
 * Berdasarkan zona waktu WIB (UTC+7)
 * @returns {string}
 */
export function getTimeOfDay() {
	try {
		const now = new Date();
		const hour = (now.getUTCHours() + 7) % 24;
		if (hour >= 4 && hour < 11) return 'pagi';
		if (hour >= 11 && hour < 15) return 'siang';
		if (hour >= 15 && hour < 18) return 'sore';
		return 'malam';
	} catch (_) {
		return 'hari ini';
	}
}

/**
 * Mengirim status composing (mengetik) ke chat WhatsApp
 * @param {Object} naze - Baileys socket client
 * @param {string} jid - Remote JID
 */
export async function sendTyping(naze, jid) {
	if (!naze || !jid) return;
	try {
		if (typeof naze.sendPresenceUpdate === 'function') {
			await naze.sendPresenceUpdate('composing', jid);
		}
	} catch (_) {}
}

/**
 * Helper delay Promise
 * @param {number} ms 
 * @returns {Promise<void>}
 */
export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Memeriksa apakah pengirim pesan adalah Owner / Creator bot
 * @param {Object} m 
 * @returns {boolean}
 */
export function isUserOwner(m) {
	if (!m) return false;
	if (m.isOwner || m.isCreator) return true;
	const senderNumber = (m.sender || '').split('@')[0];
	const owners = [...(global.owner || []), ...(global.ownerNumber || [])];
	return owners.some(o => {
		if (typeof o === 'string') return o.replace(/[^0-9]/g, '') === senderNumber;
		if (Array.isArray(o)) return String(o[0]).replace(/[^0-9]/g, '') === senderNumber;
		if (o && typeof o === 'object' && o.id) return String(o.id).replace(/[^0-9]/g, '') === senderNumber;
		return false;
	});
}

/**
 * Mengumpulkan entitas mention dan quoted user beserta relasinya
 * @param {Object} m 
 * @param {string} text 
 * @param {Function} getRelationshipFn 
 * @returns {Array<Object>}
 */
export function extractMentionedEntities(m, text = '', getRelationshipFn = () => null) {
	const mentionedEntities = [];
	const rawMentions = [...(m?.mentionedJid || [])];
	if (m?.quoted?.sender && !rawMentions.includes(m.quoted.sender)) {
		rawMentions.push(m.quoted.sender);
	}

	// Ekstrak nomor telepon dari teks
	const matchesInText = text.matchAll(/@?(\d{8,16})/g);
	for (const match of matchesInText) {
		const jid = `${match[1]}@s.whatsapp.net`;
		if (!rawMentions.includes(jid)) {
			rawMentions.push(jid);
		}
	}

	for (const jid of rawMentions) {
		const cleanNum = String(jid).replace(/[^0-9]/g, '');
		if (!cleanNum) continue;
		const targetRel = getRelationshipFn(jid);
		const targetName = global.db?.users?.[jid]?.name || targetRel?.targetName || `@${cleanNum}`;
		mentionedEntities.push({
			jid,
			number: cleanNum,
			name: targetName,
			relationship: targetRel
		});
	}

	return mentionedEntities;
}
