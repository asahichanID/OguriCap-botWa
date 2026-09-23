/**
 * OguriCap/ai/itsuki/index.js
 * -----------------------------------------------------------------------
 * Index ekspor modul Itsuki Nakano AI (中野 五月).
 */

import { itsukiAI, clearItsukiMemory, clearMemory } from './itsukiAI.js';
import { isReplyToAssistant, getMemory, addMessage, recordSentMessage } from '../aiengine/index.js';

export { itsukiAI, clearItsukiMemory, clearMemory, default } from './itsukiAI.js';
export { buildItsukiPrompt, ITSUKI_BASE_PROMPT } from './prompt.js';
export { itsukiTrigger, isItsukiTrigger } from './trigger.js';
export {
	getItsukiRelationship,
	setItsukiRelationship,
	removeItsukiRelationship,
	listItsukiRelationships,
	parseOwnerItsukiRelationIntent,
	ITSUKI_RELATIONSHIP_FILE
} from './relationship.js';

// Backward-compatible wrappers for external callers
export function isReplyToItsuki(m, db = global.db) {
	return isReplyToAssistant({ assistantId: 'itsuki', m, db });
}

export function getItsukiMemory(db, sessionKey) {
	return getMemory({ assistantId: 'itsuki', sessionKey, db });
}

export function addItsukiMessage(db, sessionKey, role, content) {
	return addMessage({ assistantId: 'itsuki', sessionKey, role, content, db });
}

export function recordItsukiSentMessage(id, text = '') {
	return recordSentMessage({ assistantId: 'itsuki', messageId: id, text });
}
