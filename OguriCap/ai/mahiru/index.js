/**
 * OguriCap/ai/mahiru/index.js
 * -----------------------------------------------------------------------
 * Index ekspor modul Mahiru Shiina AI.
 */

import { mahiruAI, clearMahiruMemory, clearMemory } from './mahiruAI.js';
import { isReplyToAssistant, getMemory, addMessage, recordSentMessage } from '../aiengine/index.js';

export { mahiruAI, clearMahiruMemory, clearMemory, default } from './mahiruAI.js';
export { buildMahiruPrompt, MAHIRU_BASE_PROMPT } from './prompt.js';
export { mahiruTrigger, isMahiruTrigger } from './trigger.js';
export {
	getMahiruRelationship,
	setMahiruRelationship,
	removeMahiruRelationship,
	listMahiruRelationships,
	parseOwnerRelationIntent,
	MAHIRU_RELATIONSHIP_FILE
} from './relationship.js';

// Backward-compatible wrappers for external callers
export function isReplyToMahiru(m, db = global.db) {
	return isReplyToAssistant({ assistantId: 'mahiru', m, db });
}

export function getMahiruMemory(db, sessionKey) {
	return getMemory({ assistantId: 'mahiru', sessionKey, db });
}

export function addMahiruMessage(db, sessionKey, role, content) {
	return addMessage({ assistantId: 'mahiru', sessionKey, role, content, db });
}

export function recordMahiruSentMessage(id, text = '') {
	return recordSentMessage({ assistantId: 'mahiru', messageId: id, text });
}
