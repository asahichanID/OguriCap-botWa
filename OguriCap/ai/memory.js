/**
 * OguriCap/ai/memory.js
 * -----------------------------------------------------------------------
 * Re-export Mahiru memory.
 */

import { getMahiruMemory, addMahiruMessage, clearMahiruMemory } from './mahiru/memory.js';

export function getMemory(db, key) {
	const history = getMahiruMemory(db, key);
	return { history };
}

export function addUserMemory(db, key, text) {
	addMahiruMessage(db, key, 'user', text);
}

export function addBotMemory(db, key, text) {
	addMahiruMessage(db, key, 'assistant', text);
}

export function clearMemory(db, key) {
	clearMahiruMemory(db, key);
}

export { getMahiruMemory, addMahiruMessage, clearMahiruMemory };
