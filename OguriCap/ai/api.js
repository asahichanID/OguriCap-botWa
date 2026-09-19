/**
 * OguriCap/ai/api.js
 * -----------------------------------------------------------------------
 * Re-export Mahiru scraper.
 */

import { scrapeMahiruChat } from './mahiru/scraper.js';
import { MAHIRU_BASE_PROMPT } from './mahiru/prompt.js';

export async function chatOguri(messages = []) {
	return scrapeMahiruChat(messages, MAHIRU_BASE_PROMPT);
}

export { scrapeMahiruChat as chatMahiru, scrapeMahiruChat };
