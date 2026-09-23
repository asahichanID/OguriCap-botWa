/**
 * OguriCap/ai/mahiru/relationship.js
 * -----------------------------------------------------------------------
 * Manajemen Relasi Mahiru Shiina AI Berbasis File JSON Permanen.
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
export const MAHIRU_RELATIONSHIP_FILE = path.join(__dirname, 'relationship.json');

/**
 * Mengambil relasi Mahiru untuk user tertentu
 */
export function getMahiruRelationship(db, userJid) {
	return getRelationship({
		userJid,
		filePath: MAHIRU_RELATIONSHIP_FILE,
		db,
		assistantId: 'mahiru'
	});
}

/**
 * Menetapkan relasi Mahiru untuk user tertentu (Permanen ke JSON)
 */
export function setMahiruRelationship(db, userJid, data = {}) {
	return setRelationship({
		userJid,
		data,
		filePath: MAHIRU_RELATIONSHIP_FILE,
		db,
		assistantId: 'mahiru'
	});
}

/**
 * Menghapus relasi Mahiru untuk user tertentu (Permanen dari JSON)
 */
export function removeMahiruRelationship(db, userJid) {
	return removeRelationship({
		userJid,
		filePath: MAHIRU_RELATIONSHIP_FILE,
		db,
		assistantId: 'mahiru'
	});
}

/**
 * Mendapatkan daftar seluruh relasi Mahiru
 */
export function listMahiruRelationships(db) {
	return listRelationships({
		filePath: MAHIRU_RELATIONSHIP_FILE,
		db,
		assistantId: 'mahiru'
	});
}

/**
 * Parsing instruksi penetapan relasi natural dari Shiro-sama
 */
export function parseOwnerRelationIntent(text, mentionedJids = [], quotedSender = null) {
	return engineParseOwnerRelationIntent(text, mentionedJids, quotedSender);
}
