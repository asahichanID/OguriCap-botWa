/**
 * OguriCap/random/cekrandom.js
 * ---------------------------------------------------------
 * Command Handler untuk `.cek <kategori>` (Random Check).
 * 
 * Karakteristik:
 * - Tidak lagi mentrigger menu profile/me
 * - Target fleksibel: diri sendiri, reply chat, atau tag/mention
 * - Mengambil persentase 0 - 100% dan respon kontekstual:
 *     0 - 40% : Ejekan / roast
 *    41 - 80% : Normal / seimbang (50-80% kategori)
 *    81 - 100%: Pujian / reaksi ekstrem (90-100% kategori)
 * - Didukung Anti-Repeat Shuffled Queue pada engine terpisah
 * - Jika kategori tidak dikenal dalam dataset, tetap hitung persentase
 *   dengan format rapi tanpa error
 * - Tanpa dependensi API luar (100% offline, cepat & stabil)
 */

import {
	findCategoryData,
	getShuffledPercentage,
	getContextualText,
	generateProgressBar,
	getRatingBadge,
	normalizeCategory,
	getAllCategories,
	getRandomCategory
} from './cekEngine.js';

/**
 * Handler utama perintah .cek
 * @param {Object} naze - Instance Baileys bot
 * @param {Object} m - Objek pesan masuk
 * @param {Object} extra - Objek parameter ekstra ({ text, args, prefix, command, db, ... })
 */
export async function cekRandomHandler(naze, m, extra = {}) {
	const rawText = (extra.text || '').trim();
	const prefix = extra.prefix || '.';
	const command = extra.command || 'cek';

	// 1. Tentukan Target Pengguna (Tag mention, reply quoted, atau pengirim sendiri)
	let targetJid = m.sender;
	let targetName = m.pushName || 'Kamu';

	if (m.mentionedJid && m.mentionedJid.length > 0) {
		targetJid = m.mentionedJid[0];
	} else if (m.quoted && m.quoted.sender) {
		targetJid = m.quoted.sender;
	}

	// Ambil display name target jika orang lain
	if (targetJid !== m.sender) {
		try {
			if (naze && typeof naze.getName === 'function') {
				const fetched = await naze.getName(targetJid);
				if (fetched && !/^\d+$/.test(fetched)) {
					targetName = fetched;
				} else {
					targetName = global.db?.data?.users?.[targetJid]?.name ||
						global.db?.data?.users?.[targetJid]?.register?.name ||
						`@${targetJid.split('@')[0]}`;
				}
			} else {
				targetName = `@${targetJid.split('@')[0]}`;
			}
		} catch {
			targetName = `@${targetJid.split('@')[0]}`;
		}
	}

	// 2. Ekstrak Kategori dari input teks (bersihkan mention @xxxx jika ada di teks)
	let cleanedCategoryText = rawText
		.replace(/@\d{8,16}/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	// Jika pengguna secara eksplisit meminta petunjuk atau daftar kategori (.cek help / .cek list / .cek menu)
	if (/^(help|bantuan|list|menu)$/i.test(cleanedCategoryText)) {
		const sampleCategories = ['ganteng', 'cantik', 'gila', 'stress', 'tengil', 'linglung', 'receh', 'cringe', 'santuy', 'wibu', 'sabar', 'hoki', 'sial'];
		const sampleList = sampleCategories.map(c => `• ${prefix}${command} ${c}`).join('\n');
		const totalAvailable = getAllCategories().length;

		const helpText = [
			`🎲 *RANDOM CHECK SISTEM* 🎲`,
			`━━━━━━━━━━━━━━━━━━━━━━`,
			`Ketik *${prefix + command}* untuk cek acak langsung otomatis!`,
			`Atau ketik *${prefix + command} <kategori>* untuk cek kategori tertentu.`,
			``,
			`🎯 *Target Pengecekan:*`,
			`• Diri sendiri : *${prefix + command}* / *${prefix + command} <kategori>*`,
			`• Tag teman   : *${prefix + command} @tag* / *${prefix + command} <kategori> @tag*`,
			`• Reply pesan : Balas pesan target lalu ketik *${prefix + command}*`,
			``,
			`✨ *Contoh Kategori Populer:*`,
			sampleList,
			`_(Tersedia lebih dari ${totalAvailable}+ kategori unik & gaul!)_`,
			`━━━━━━━━━━━━━━━━━━━━━━`
		].join('\n');

		return m.reply(helpText);
	}

	// 2.1 Jika input kategori kosong, OTOMATIS ambil kategori acak dengan Anti-Repeat Shuffled Queue!
	let isRandomAutoPicked = false;
	if (!cleanedCategoryText) {
		cleanedCategoryText = getRandomCategory(`${m.chat}:${targetJid}`);
		isRandomAutoPicked = true;
	}

	// 3. Normalisasi & Pencarian Data Kategori
	const normQuery = normalizeCategory(cleanedCategoryText);
	const match = findCategoryData(normQuery);

	const isKnownCategory = Boolean(match && match.data);
	const categoryTitle = isKnownCategory
		? match.data.title
		: cleanedCategoryText.charAt(0).toUpperCase() + cleanedCategoryText.slice(1);
	const categoryEmoji = isKnownCategory ? (match.data.emoji || '🎲') : '🎲';

	// 4. Kunci Anti-Repeat Shuffled Queue
	// Format key: chat:targetJid:categoryKey
	const poolCategoryKey = isKnownCategory ? match.key : normQuery;
	const poolKey = `${m.chat}:${targetJid}:${poolCategoryKey}`;

	// 5. Eksekusi Persentase & Teks Kontekstual dari Engine
	const percent = getShuffledPercentage(poolKey);
	const progressBar = generateProgressBar(percent);
	const ratingBadge = getRatingBadge(percent);

	let responseText = '';
	if (isKnownCategory) {
		const ctxText = getContextualText(poolKey, match.data, percent);
		if (ctxText) {
			responseText = `\n💬 *Komentar:* \n"${ctxText}"\n`;
		}
	} else {
		// Kategori tidak dikenal tetap ditampilkan dengan persentase dan bar rapi
		responseText = `\n_Catatan: Kategori '${cleanedCategoryText}' tidak memiliki tanggapan khusus, persentase tetap dihitung murni secara acak._\n`;
	}

	// 6. Format Pesan Akhir
	const targetMention = `@${targetJid.split('@')[0]}`;
	const categoryDisplay = isRandomAutoPicked ? `${categoryTitle} 🎲 _(Acak)_` : categoryTitle;
	const caption = [
		`╭───❖「 ${categoryEmoji} *CEK ${categoryTitle.toUpperCase()}* 」❖`,
		`│`,
		`│ 👤 *Target*   : ${targetName} (${targetMention})`,
		`│ 🏷️ *Kategori* : ${categoryDisplay}`,
		`│ 📊 *Hasil*    : *${percent}%*`,
		`│ 📈 *Status*   : ${ratingBadge}`,
		`│ [${progressBar}]`,
		`│`,
		`╰────────────────────❖`,
		responseText.trim(),
		``,
		`✨ _Hasil random check ini murni untuk hiburan kawan-kawan!_`
	].filter(Boolean).join('\n');

	// Kirim pesan dengan mention ke target
	return naze.sendMessage(m.chat, {
		text: caption,
		mentions: [targetJid]
	}, { quoted: m });
}
