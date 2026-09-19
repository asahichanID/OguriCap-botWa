/**
 * OguriCap/ai/mahiru/trigger.js
 * -----------------------------------------------------------------------
 * Kata kunci pemicu obrolan interaktif dengan Mahiru Shiina.
 */

export const mahiruTrigger = [
	'mahiru',
	'mahiru?',
	'mahiru!',
	'mahiru.',
	'mahiru,',
	'mahiru-chan',
	'mahiru-san',
	'mahiru chan',
	'mahiru san',
	'shiina',
	'shina',
	'shiina-san',
	'shiina mahiru',
	'tenshi',
	'tenshi-sama',
	'tenshisama',
	'tenshi sama',
	'hai mahiru',
	'halo mahiru',
	'hei mahiru',
	'oi mahiru',
	'oy mahiru',
	'pagi mahiru',
	'siang mahiru',
	'malam mahiru',
	'sore mahiru',
	'oguri',
	'oguricap',
	'oguri-chan'
];

/**
 * Memeriksa apakah suatu teks mengandung trigger Mahiru.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isMahiruTrigger(text = '') {
	if (!text || typeof text !== 'string') return false;
	const lower = text.trim().toLowerCase();
	
	// Cek regex kata per kata / frasa
	const keywordPattern = /\b(mahiru|shiina|shina|tenshi|tenshisama|oguri|oguricap)\b/i;
	if (keywordPattern.test(lower)) return true;

	return mahiruTrigger.some(trig => {
		return lower.includes(trig);
	});
}
