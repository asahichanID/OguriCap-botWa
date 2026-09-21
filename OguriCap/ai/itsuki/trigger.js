/**
 * OguriCap/itsuki/trigger.js
 * -----------------------------------------------------------------------
 * Kata kunci pemicu obrolan interaktif dengan Itsuki Nakano (中野 五月)
 * dari anime "5-toubun no Hanayome" (The Quintessential Quintuplets).
 */

export const itsukiTrigger = [
	'itsuki',
	'itsuki?',
	'itsuki!',
	'itsuki.',
	'itsuki,',
	'itsuki-chan',
	'itsuki-san',
	'itsuki chan',
	'itsuki san',
	'itsukii',
	'itsukii~',
	'itsuki nakano',
	'nakano itsuki',
	'nakano-san',
	'nakano san',
	'nakano',
	'eatsuki',
	'borgar queen',
	'meatbun monster',
	'nikuman monster',
	'hai itsuki',
	'halo itsuki',
	'hei itsuki',
	'oi itsuki',
	'oy itsuki',
	'pagi itsuki',
	'siang itsuki',
	'malam itsuki',
	'sore itsuki',
	'itsuki sensei',
	'itsuki-sensei',
	'itsuki makan'
];

/**
 * Memeriksa apakah suatu teks mengandung trigger Itsuki Nakano.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isItsukiTrigger(text = '') {
	if (!text || typeof text !== 'string') return false;
	const lower = text.trim().toLowerCase();
	
	// Cek regex kata per kata / frasa
	const keywordPattern = /\b(itsuki|itsukii|itsukiai|eatsuki|nakano|nikuman)\b/i;
	if (keywordPattern.test(lower)) return true;

	return itsukiTrigger.some(trig => {
		return lower.includes(trig);
	});
}
