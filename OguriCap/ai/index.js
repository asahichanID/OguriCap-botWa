/**
 * OguriCap/ai/index.js
 * -----------------------------------------------------------------------
 * Central Entry Point untuk Seluruh Layanan AI Asisten WhatsApp Bot.
 * 
 * Mengekspor modul:
 * 1. Mahiru Shiina AI (./mahiru/index.js)
 * 2. Itsuki Nakano AI (./itsuki/index.js)
 * 3. AI Core Engine (./aiengine/index.js)
 */

export * from './mahiru/index.js';
export * from './itsuki/index.js';
export * from './aiengine/index.js';

// Default export: objek gabungan asisten
import { mahiruAI } from './mahiru/index.js';
import { itsukiAI } from './itsuki/index.js';

export default {
	mahiru: mahiruAI,
	itsuki: itsukiAI
};
