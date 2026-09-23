/**
 * OguriCap/ai/itsuki/relationship.js
 * -----------------------------------------------------------------------
 * Manajemen Relasi Itsuki Nakano AI Berbasis File JSON Permanen.
 * Tersimpan secara permanen di relationship.json dan tersinkronisasi ke db.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import {
	getRelationship,
	setRelationship,
	removeRelationship,
	listRelationships,
	parseOwnerRelationIntent as engineParseOwnerRelationIntent
} from '../aiengine/relationship.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ITSUKI_RELATIONSHIP_FILE = path.join(__dirname, 'relationship.json');

/**
 * Mengambil relasi Itsuki untuk user tertentu
 */
export function getItsukiRelationship(db, userJid) {
	return getRelationship({
		userJid,
		filePath: ITSUKI_RELATIONSHIP_FILE,
		db,
		assistantId: 'itsuki'
	});
}

/**
 * Menetapkan relasi Itsuki untuk user tertentu (Permanen ke JSON)
 */
export function setItsukiRelationship(db, userJid, data = {}) {
	return setRelationship({
		userJid,
		data,
		filePath: ITSUKI_RELATIONSHIP_FILE,
		db,
		assistantId: 'itsuki'
	});
}

/**
 * Menghapus relasi Itsuki untuk user tertentu (Permanen dari JSON)
 */
export function removeItsukiRelationship(db, userJid) {
	return removeRelationship({
		userJid,
		filePath: ITSUKI_RELATIONSHIP_FILE,
		db,
		assistantId: 'itsuki'
	});
}

/**
 * Mendapatkan daftar seluruh relasi Itsuki
 */
export function listItsukiRelationships(db) {
	return listRelationships({
		filePath: ITSUKI_RELATIONSHIP_FILE,
		db,
		assistantId: 'itsuki'
	});
}

/**
 * Parsing instruksi penetapan relasi natural dari Shiro-sama untuk Itsuki
 */
export function parseOwnerItsukiRelationIntent(text, mentionedJids = [], quotedSender = null) {
	return engineParseOwnerRelationIntent(text, mentionedJids, quotedSender);
}
