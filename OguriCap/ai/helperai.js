/**
 * OguriCap/ai/helperai.js
 * -----------------------------------------------------------------------
 * Re-export Mahiru helpers.
 */

import { cleanMahiruMessage, sendMahiruTyping, sleep } from './mahiru/helper.js';

export function buildKey(chat, sender) {
	return `${chat}:${sender}`;
}

export function cleanMessage(text = '') {
	return cleanMahiruMessage(text);
}

export function randomDelay(min = 1200, max = 2500) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export { sleep };

export function shouldIgnore(m) {
	if (!m?.body && !m?.text) return true;
	if (m.isBaileys) return true;
	if (m.fromMe) return true;
	if (m.type !== 'conversation' && m.type !== 'extendedTextMessage') return true;
	return false;
}

export async function sendTyping(naze, chat) {
	return sendMahiruTyping(naze, chat);
}

export function formatHistory(history = [], prompt = '') {
	return [
		{ role: 'system', content: prompt },
		...history
	];
}
