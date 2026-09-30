import {
	unbanSticker,
	banSticker,
	isQuotedSticker,
	addPermanentBannedUser,
	removePermanentBannedUser,
	clearPermanentBannedUsers,
	isUserStickerBannedPermanently
} from './bansticker.js';

/**
 * Helper untuk membersihkan dan menormalisasi nomor telepon internasional
 */
function formatPhoneNumber(jid = '') {
	const num = String(jid).replace(/[^0-9]/g, '');
	if (num.startsWith('62')) {
		return `+62 ${num.slice(2)}`;
	}
	return num ? `+${num}` : '-';
}

/**
 * Mencari target JID dari tag mention, reply quoted message, atau input teks nomor
 */
function resolveTargetJid({ naze, m, text = '', args = [], store }) {
	// 1. Tag mention
	if (m?.mentionedJid && m.mentionedJid.length > 0) {
		return m.mentionedJid[0];
	}

	// 2. Reply pesan user (baik text, sticker, foto, video, dll)
	if (m?.quoted && m.quoted.sender) {
		return m.quoted.sender;
	}

	// 3. Teks input nomor atau JID (abaikan argumen 'p' / 'permanen')
	const combined = [text, ...args].join(' ');
	// Cari angka nomor telepon (panjang 5 - 20 digit)
	const matches = combined.match(/[0-9]{5,20}/g);
	if (matches && matches.length > 0) {
		const numOnly = matches[0];
		const findJid = typeof naze?.findJidByLid === 'function'
			? naze.findJidByLid(numOnly + '@lid', store)
			: null;
		const klss = numOnly + (findJid ? '@lid' : '@s.whatsapp.net');
		return typeof naze?.findJidByLid === 'function'
			? naze.findJidByLid(klss, store, true)
			: klss;
	}

	if (text && (text.includes('@s.whatsapp.net') || text.includes('@lid'))) {
		const parts = text.split(/\s+/);
		const jidPart = parts.find(p => p.includes('@s.whatsapp.net') || p.includes('@lid'));
		if (jidPart) return jidPart;
	}

	return null;
}

/**
 * Mengambil nama tampilan user yang valid dan manusiawi (bukan nomor!)
 */
async function resolveUserName(naze, jid, userObj = {}) {
	let name = userObj?.customName || userObj?.name;
	if (name && typeof name === 'string' && name.trim() && name !== 'Trainer' && !name.includes('@')) {
		return name.trim();
	}

	try {
		if (typeof naze?.getName === 'function') {
			const contactName = await naze.getName(jid);
			if (contactName && typeof contactName === 'string' && contactName.trim() && !contactName.includes('@')) {
				return contactName.trim();
			}
		}
	} catch {}

	return (name && typeof name === 'string' && name.trim()) ? name.trim() : 'Trainer';
}

/**
 * Handler Utama Perintah Unbans (.unbans / .unban / .unbansp / .unbanp / .delbans)
 */
export async function handleUnbans({ naze, m, args = [], text = '', isCreator, prefix, command, db, store }) {
	try {
		if (!isCreator) {
			return m.reply(global.mess?.owner || '⚠️ *Fitur ini khusus Owner!*');
		}

		// Backward compatibility: Jika me-reply stiker atau command khusus sticker
		if ((m.quoted && isQuotedSticker(m)) || command === 'unbansticker') {
			return await unbanSticker({ naze, m, args, text, isCreator, prefix, command });
		}

		const lowerCmd = (command || '').toLowerCase();
		const cleanArg = (args[0] || text || '').trim().toLowerCase();
		const isPermUnban = lowerCmd === 'unbansp' || lowerCmd === 'unbanp' ||
			cleanArg === 'p' || cleanArg === 'perm' || cleanArg === 'permanen' || cleanArg === 'permanent';

		// ==============================================================
		// 1. OPSI MANUAL: UNBAN SEMUA USER SEKALIGUS (.unbans all / semua)
		// ==============================================================
		const isUnbanAll = ['all', 'semua', '-all', '--all', 'global'].includes(cleanArg);
		if (isUnbanAll) {
			const usersDb = db?.users || {};
			const bannedEntries = Object.entries(usersDb).filter(([k, u]) =>
				u && (u.ban === true || u.banStickerPermanent === true || isUserStickerBannedPermanently(k))
			);

			if (bannedEntries.length === 0) {
				return m.reply(
					`╭───❖「 🔓 *UNBAN MASSAL* 」\n` +
					`│\n` +
					`│ ✅ *Tidak ada user yang sedang di-ban!*\n` +
					`│ Seluruh pengguna saat ini dalam kondisi aktif.\n` +
					`╰───────────────────────────❖`
				);
			}

			const unbannedList = [];
			for (const [jid, userObj] of bannedEntries) {
				const hadAccountBan = Boolean(userObj.ban);
				const hadStickerBan = Boolean(userObj.banStickerPermanent) || isUserStickerBannedPermanently(jid);

				userObj.ban = false;
				userObj.banStickerPermanent = false;
				removePermanentBannedUser(jid);

				const userName = await resolveUserName(naze, jid, userObj);
				unbannedList.push({ jid, name: userName, hadAccountBan, hadStickerBan });
			}

			clearPermanentBannedUsers();
			global._dbDirty = true;

			let caption = `╭───❖「 🔓 𝗨𝗡𝗕𝗔𝗡 𝗠𝗔𝗦𝗦𝗔𝗟 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟 」\n`;
			caption += `│ 👥 *Total Di-Unban :* ${unbannedList.length} Pengguna\n`;
			caption += `│ ⚡ *Status :* Sukses & Semua Bebas\n`;
			caption += `│ 🛡️ *Cakupan :* Ban Akun & Ban Stiker Permanen (.bans p)\n`;
			caption += `│\n`;
			caption += `│ 📋 *Daftar User yang Dibebaskan:*\n`;

			const displayLimit = 25;
			unbannedList.slice(0, displayLimit).forEach((item, idx) => {
				const phoneClean = item.jid.replace(/[^0-9]/g, '');
				const tags = [];
				if (item.hadAccountBan) tags.push('Akun');
				if (item.hadStickerBan) tags.push('Stiker');
				const tagStr = tags.length > 0 ? ` [${tags.join(' & ')}]` : '';
				caption += `│ ${idx + 1}. *${item.name}* (@${phoneClean})${tagStr}\n`;
			});

			if (unbannedList.length > displayLimit) {
				caption += `│ ... dan ${unbannedList.length - displayLimit} user lainnya\n`;
			}

			caption += `╰───────────────────────────❖\n\n`;
			caption += `✨ Seluruh status ban akun dan ban stiker permanen telah dicabut.`;

			return await naze.sendMessage(m.chat, {
				text: caption,
				mentions: unbannedList.slice(0, displayLimit).map(u => u.jid)
			}, { quoted: m });
		}

		// ==============================================================
		// 2. UNBAN SPESIFIK (Klik Row Panel Ngambang / Input Nomor / Mention)
		// ==============================================================
		const targetJid = resolveTargetJid({ naze, m, text, args, store });

		if (targetJid && targetJid !== m.chat) {
			if (!db.users) db.users = {};
			if (!db.users[targetJid]) db.users[targetJid] = {};

			const hadAccountBan = Boolean(db.users[targetJid].ban);
			const hadStickerBan = Boolean(db.users[targetJid].banStickerPermanent) || isUserStickerBannedPermanently(targetJid);

			// Jika pemanggil meminta khusus unban permanent sticker (.unbans p @user)
			if (isPermUnban) {
				db.users[targetJid].banStickerPermanent = false;
				removePermanentBannedUser(targetJid);
				global._dbDirty = true;

				const userName = await resolveUserName(naze, targetJid, db.users[targetJid]);
				const phoneNum = targetJid.replace(/[^0-9]/g, '');

				let replyText = `╭───❖「 🔓 𝗨𝗡𝗕𝗔𝗡 𝗦𝗧𝗜𝗞𝗘𝗥 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟 」\n`;
				replyText += `│\n`;
				replyText += `│ 👤 *Nama User  :* *${userName}*\n`;
				replyText += `│ 📱 *Nomor WA   :* @${phoneNum}\n`;
				replyText += `│ 🔰 *Status Baru :* Bebas Mengirim Stiker\n`;
				replyText += `│\n`;
				replyText += `│ ✨ Status ban stiker permanen (.bans p) telah dicabut.\n`;
				replyText += `│ User kini dapat mengirimkan stiker kembali di grup.\n`;
				replyText += `╰───────────────────────────❖`;

				return await naze.sendMessage(m.chat, {
					text: replyText,
					mentions: [targetJid]
				}, { quoted: m });
			}

			// Unban komprehensif (mencabut ban akun dan ban stiker permanen sekaligus)
			db.users[targetJid].ban = false;
			db.users[targetJid].banStickerPermanent = false;
			removePermanentBannedUser(targetJid);
			global._dbDirty = true;

			const userName = await resolveUserName(naze, targetJid, db.users[targetJid]);
			const phoneNum = targetJid.replace(/[^0-9]/g, '');

			let statusDesc = 'Bebas / Aktif Kembali';
			if (hadAccountBan && hadStickerBan) {
				statusDesc = 'Bebas Akun & Bebas Stiker';
			} else if (hadStickerBan) {
				statusDesc = 'Bebas Mengirim Stiker';
			}

			let replyText = `╭───❖「 🔓 𝗨𝗡𝗕𝗔𝗡 𝗨𝗦𝗘𝗥 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟 」\n`;
			replyText += `│\n`;
			replyText += `│ 👤 *Nama User  :* *${userName}*\n`;
			replyText += `│ 📱 *Nomor WA   :* @${phoneNum}\n`;
			replyText += `│ 🔰 *Status Baru :* ${statusDesc}\n`;
			replyText += `│\n`;
			replyText += `│ ✨ Seluruh sanksi pada user *${userName}* telah dicabut.\n`;
			replyText += `│ User dapat berinteraksi kembali secara normal!\n`;
			replyText += `╰───────────────────────────❖`;

			return await naze.sendMessage(m.chat, {
				text: replyText,
				mentions: [targetJid]
			}, { quoted: m });
		}

		// ==============================================================
		// 3. TAMPILAN UTAMA: PANEL NGAMBANG (single_select) BERISI NAMA USER
		// ==============================================================
		const usersDb = db?.users || {};
		const allCandidateJids = new Set([
			...Object.keys(usersDb).filter(j => usersDb[j]?.ban === true || usersDb[j]?.banStickerPermanent === true)
		]);

		const bannedJids = Array.from(allCandidateJids);

		if (bannedJids.length === 0) {
			return m.reply(
				`╭───❖「 🛡️ 𝗣𝗔𝗡𝗘𝗟 𝗨𝗡𝗕𝗔𝗡𝗦 」\n` +
				`│\n` +
				`│ ✅ *Tidak ada user yang sedang di-ban!*\n` +
				`│ Seluruh pengguna saat ini memiliki akses aktif.\n` +
				`╰───────────────────────────❖`
			);
		}

		// Ambil nama user untuk setiap user yang di-ban (Wajib nama user, bukan nomor!)
		const resolvedBannedList = await Promise.all(
			bannedJids.map(async (jid, idx) => {
				const userObj = usersDb[jid] || {};
				const name = await resolveUserName(naze, jid, userObj);
				const phone = jid.replace(/[^0-9]/g, '');
				const isAcc = Boolean(userObj.ban);
				const isStk = Boolean(userObj.banStickerPermanent) || isUserStickerBannedPermanently(jid);
				return { jid, name, phone, isAcc, isStk, userObj };
			})
		);

		// Buat baris pilihan interaktif untuk panel mengambang
		const rows = resolvedBannedList.slice(0, 50).map((item, idx) => {
			const safeTitle = item.name.length > 24 ? item.name.slice(0, 21) + '...' : item.name;
			const phoneFmt = formatPhoneNumber(item.phone);

			let label = '🔒 Ban Akun';
			if (item.isAcc && item.isStk) {
				label = '🔒 Ban Akun & 🚫 Stiker (p)';
			} else if (item.isStk) {
				label = '🚫 Ban Stiker Permanen (.bans p)';
			}

			return {
				header: `Banned User #${idx + 1}`,
				title: safeTitle,
				description: `📱 ${phoneFmt} | ${label}`,
				id: `${prefix}unbans ${item.jid}`
			};
		});

		const botTitle = global.set?.botname || global.botname || 'Oguri Cap';
		const sections = [
			{
				title: `👥 DAFTAR USER TER-BAN (${resolvedBannedList.length} User)`,
				highlight_label: 'BANNED',
				rows: rows
			}
		];

		let menuText = `╭───❖「 🛡️ 𝗣𝗔𝗡𝗘𝗟 𝗨𝗡𝗕𝗔𝗡𝗦 𝗨𝗦𝗘𝗥 」\n`;
		menuText += `│ 👥 *Total User Ter-ban :* ${resolvedBannedList.length} Pengguna\n`;
		menuText += `│\n`;
		menuText += `│ Sentuh tombol *🔓 Pilih User Di-Unban* di bawah\n`;
		menuText += `│ untuk menampilkan panel mengambang dan memilih\n`;
		menuText += `│ user berdasarkan nama mereka (tanpa perlu mencari nomor).\n`;
		menuText += `│\n`;
		menuText += `│ 💡 *Opsi Unban Manual:*\n`;
		menuText += `│ • Unban Semua: \`${prefix}unbans all\`\n`;
		menuText += `│ • Unban Stiker Saja: \`${prefix}unbans p @user\`\n`;
		menuText += `│ • Unban per Nomor: \`${prefix}unbans <nomor>\`\n`;
		menuText += `╰───────────────────────────❖`;

		// Kirim Native Flow Button (Panel Ngambang single_select)
		try {
			if (typeof naze.sendListMsg === 'function') {
				return await naze.sendListMsg(m.chat, {
					text: menuText,
					footer: botTitle,
					buttons: [
						{
							name: 'single_select',
							buttonParamsJson: {
								title: '🔓 Pilih User Di-Unban',
								sections: sections
							}
						}
					]
				}, { quoted: m });
			}
		} catch (err) {
			console.warn('[UNBANS] Gagal mengirim sendListMsg interaktif, beralih ke fallback teks:', err.message);
		}

		// Fallback teks jika perangkat WhatsApp pengirim tidak mendukung interactive message
		let fallbackText = menuText + `\n\n📋 *Daftar User Ter-ban:*\n`;
		resolvedBannedList.slice(0, 30).forEach((item, idx) => {
			const typeStr = item.isStk ? '[STIKER P]' : '[AKUN]';
			fallbackText += `${idx + 1}. *${item.name}* ${typeStr} (${formatPhoneNumber(item.phone)})\n   👉 Ketik: \`${prefix}unbans ${item.phone}\`\n`;
		});
		return await m.reply(fallbackText);

	} catch (err) {
		console.error('[USER_BAN] Error in handleUnbans:', err);
		m.reply(`❌ Terjadi kendala saat memproses unbans: ${err.message}`);
	}
}

/**
 * Handler Utama Perintah Ban (.ban / .banned / .bans / .bansp / .banp)
 */
export async function handleBans({ naze, m, args = [], text = '', isCreator, prefix, command, db, store }) {
	try {
		if (!isCreator) {
			return m.reply(global.mess?.owner || '⚠️ *Fitur ini khusus Owner!*');
		}

		const lowerCmd = (command || '').toLowerCase();
		const firstArg = (args[0] || '').toLowerCase();

		// Deteksi apakah pemanggil mengaktifkan mode permanen stiker (.bans p / .bans permanen / .bansp / .banp)
		const isPermMode = lowerCmd === 'bansp' || lowerCmd === 'banp' ||
			firstArg === 'p' || firstArg === 'perm' || firstArg === 'permanen' || firstArg === 'permanent' ||
			(text && /\b(permanen|permanent|\bp\b)/i.test(text));

		// ==============================================================
		// 1. MODE BANS PERMANEN STIKER (.bans p / .bans permanen)
		// ==============================================================
		if (isPermMode) {
			// Cari target JID (bisa dari tag @user, reply chat/stiker user, atau input nomor telepon)
			const targetJid = resolveTargetJid({ naze, m, text, args, store });

			if (!targetJid) {
				return m.reply(
					`🚫 *[ PANDUAN BANS PERMANEN STIKER ]* 🚫\n\n` +
					`Fitur ini akan mem-ban user secara permanen dari mengirim stiker di grup.\n` +
					`⚡ *Efek:* Semua stiker apa pun yang dia kirim akan langsung dihapus oleh bot (silent auto-delete), berbeda dengan bans biasa yang hanya menghapus stiker spesifik.\n\n` +
					`📌 *Cara Penggunaan:*\n` +
					`• Tag user: \`${prefix}bans p @user\`\n` +
					`• Reply stiker/pesan user lalu ketik: \`${prefix}bans p\`\n` +
					`• Masukkan nomor: \`${prefix}bans p 62xxx\`\n\n` +
					`🔓 *Cara Membuka Ban:*\n` +
					`• Ketik \`${prefix}unbans\` (pilih dari panel mengambang)\n` +
					`• Ketik \`${prefix}unbans p @user\` atau \`${prefix}unbans all\``
				);
			}

			// Proteksi self-ban
			const botNumber = naze.decodeJid(naze.user.id);
			if (targetJid === botNumber) {
				return m.reply('❌ Tidak dapat mem-ban nomor bot sendiri!');
			}
			if (targetJid === m.sender) {
				return m.reply('❌ Tidak dapat mem-ban nomor Anda sendiri!');
			}

			if (!db.users) db.users = {};
			if (!db.users[targetJid]) db.users[targetJid] = {};

			const userName = await resolveUserName(naze, targetJid, db.users[targetJid]);
			db.users[targetJid].name = userName;
			db.users[targetJid].banStickerPermanent = true;
			db.users[targetJid].banStickerPermanentAt = Date.now();
			addPermanentBannedUser(targetJid);
			global._dbDirty = true;

			const phoneNum = targetJid.replace(/[^0-9]/g, '');

			let replyText = `╭───❖「 🚫 𝗕𝗔𝗡 𝗦𝗧𝗜𝗞𝗘𝗥 𝗣𝗘𝗥𝗠𝗔𝗡𝗘𝗡 」\n`;
			replyText += `│\n`;
			replyText += `│ 👤 *Nama User  :* *${userName}*\n`;
			replyText += `│ 📱 *Nomor WA   :* @${phoneNum}\n`;
			replyText += `│ 🔒 *Tipe Ban   :* PERMANEN STIKER (.bans p)\n`;
			replyText += `│ ⚡ *Efek Aktif :* Semua stiker yang dikirim oleh\n`;
			replyText += `│                 user ini di grup akan otomatis\n`;
			replyText += `│                 langsung dihapus (silent)!\n`;
			replyText += `│\n`;
			replyText += `│ 💡 *Cara Membuka Ban:*\n`;
			replyText += `│ • Ketik \`${prefix}unbans\` untuk memilih via panel\n`;
			replyText += `│ • Ketik \`${prefix}unbans p @user\` atau \`${prefix}unbans all\`\n`;
			replyText += `╰───────────────────────────❖`;

			return await naze.sendMessage(m.chat, {
				text: replyText,
				mentions: [targetJid]
			}, { quoted: m });
		}

		// ==============================================================
		// 2. JIKA REPLY STIKER BIASA (.bans biasa -> ban stiker spesifik)
		// ==============================================================
		if (m.quoted && isQuotedSticker(m)) {
			return await banSticker({ naze, m, args, text, isCreator, prefix, command });
		}

		// ==============================================================
		// 3. BAN USER AKUN BOT BIASA (.ban @user / .bans @user)
		// ==============================================================
		const targetJid = resolveTargetJid({ naze, m, text, args, store });

		if (!targetJid) {
			return m.reply(
				`🚫 *[ PANDUAN LENGKAP FITUR BANS ]* 🚫\n\n` +
				`1️⃣ *Ban Stiker Permanen User (.bans p):*\n` +
				`• \`${prefix}bans p @user\` — Semua stiker yang dia kirim akan langsung dihapus otomatis di grup.\n\n` +
				`2️⃣ *Ban Akun User (.ban / .bans):*\n` +
				`• \`${prefix}ban @user\` — Memblokir user dari menggunakan semua fitur bot.\n\n` +
				`3️⃣ *Ban Stiker Tertentu (.bans):*\n` +
				`• Reply stiker lalu ketik \`${prefix}bans\` — Menghapus stiker spesifik tersebut jika dikirim siapa pun di grup.\n\n` +
				`🔓 *Untuk Membuka Ban:*\n` +
				`• Ketik \`${prefix}unbans\` (menampilkan panel mengambang interaktif)\n` +
				`• Ketik \`${prefix}unbans all\` (unban semua user sekaligus)`
			);
		}

		// Proteksi dari self-ban bot dan owner
		const botNumber = naze.decodeJid(naze.user.id);
		if (targetJid === botNumber) {
			return m.reply('❌ Tidak dapat mem-ban nomor bot sendiri!');
		}
		if (targetJid === m.sender) {
			return m.reply('❌ Tidak dapat mem-ban nomor Anda sendiri!');
		}

		if (!db.users) db.users = {};
		if (!db.users[targetJid]) db.users[targetJid] = {};

		const userName = await resolveUserName(naze, targetJid, db.users[targetJid]);
		db.users[targetJid].name = userName;
		db.users[targetJid].ban = true;
		global._dbDirty = true;

		const phoneNum = targetJid.replace(/[^0-9]/g, '');

		let replyText = `╭───❖「 🚫 𝗕𝗔𝗡 𝗨𝗦𝗘𝗥 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟 」\n`;
		replyText += `│\n`;
		replyText += `│ 👤 *Nama User  :* *${userName}*\n`;
		replyText += `│ 📱 *Nomor WA   :* @${phoneNum}\n`;
		replyText += `│ 🔒 *Status Baru :* BANNED (Diblokir Bot)\n`;
		replyText += `│\n`;
		replyText += `│ User tersebut kini tidak dapat menggunakan\n`;
		replyText += `│ perintah bot lagi di chat manapun.\n`;
		replyText += `│\n`;
		replyText += `│ 💡 *Cara Membuka Ban:*\n`;
		replyText += `│ • Ketik \`${prefix}unbans\` untuk memilih via panel\n`;
		replyText += `│ • Ketik \`${prefix}unbans all\` untuk unban massal\n`;
		replyText += `╰───────────────────────────❖`;

		return await naze.sendMessage(m.chat, {
			text: replyText,
			mentions: [targetJid]
		}, { quoted: m });

	} catch (err) {
		console.error('[USER_BAN] Error in handleBans:', err);
		m.reply(`❌ Terjadi kendala saat memproses ban: ${err.message}`);
	}
}
