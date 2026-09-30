import {
	unbanSticker,
	banSticker,
	isQuotedSticker,
	addPermanentBannedUser,
	removePermanentBannedUser,
	clearPermanentBannedUsers,
	isUserStickerBannedPermanently,
	getBannedStickers,
	unbanAllStickers
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

	// 2. Reply pesan user
	if (m?.quoted && m.quoted.sender) {
		return m.quoted.sender;
	}

	// 3. Teks input nomor atau JID (abaikan argumen 'p' / 'permanen')
	const combined = [text, ...args].join(' ');
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
 * Handler Khusus Fitur .bans (.bans reply stiker / .bans p @user)
 */
export async function handleBans({ naze, m, args = [], text = '', isCreator, prefix, command, db, store }) {
	try {
		if (!isCreator) {
			return m.reply(global.mess?.owner || '⚠️ *Fitur ini khusus Owner!*');
		}

		const lowerCmd = (command || '').toLowerCase();
		const firstArg = (args[0] || '').toLowerCase();

		// Deteksi apakah mengaktifkan mode bans permanen stiker (.bans p / .bans permanen / .bansp)
		const isPermMode = lowerCmd === 'bansp' ||
			firstArg === 'p' || firstArg === 'perm' || firstArg === 'permanen' || firstArg === 'permanent' ||
			(text && /\b(permanen|permanent|\bp\b)/i.test(text));

		// ==============================================================
		// 1. MODE BANS PERMANEN STIKER (.bans p / .bans permanen)
		// ==============================================================
		if (isPermMode) {
			const targetJid = resolveTargetJid({ naze, m, text, args, store });

			if (!targetJid) {
				return m.reply(
					`🚫 *[ PANDUAN BANS PERMANEN STIKER ]* 🚫\n\n` +
					`Fitur ini mem-ban stiker permanen untuk user tertentu.\n` +
					`⚡ *Efek:* Semua stiker yang dikirim oleh user ini di grup akan otomatis langsung dihapus oleh bot (silent auto-delete)!\n\n` +
					`📌 *Cara Penggunaan:*\n` +
					`• Tag user: \`${prefix}bans p @user\`\n` +
					`• Reply chat/stiker user lalu ketik: \`${prefix}bans p\`\n` +
					`• Masukkan nomor: \`${prefix}bans p 62xxx\`\n\n` +
					`🔓 *Cara Membuka Ban:* Ketik \`${prefix}unbans\` (pilih dari panel mengambang) atau \`${prefix}unbans all\``
				);
			}

			const botNumber = naze.decodeJid(naze.user.id);
			if (targetJid === botNumber) return m.reply('❌ Tidak dapat mem-ban nomor bot sendiri!');
			if (targetJid === m.sender) return m.reply('❌ Tidak dapat mem-ban nomor Anda sendiri!');

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
			replyText += `│ ⚡ *Efek Aktif :* Semua stiker apa pun yang dikirim\n`;
			replyText += `│                 user ini di grup akan langsung\n`;
			replyText += `│                 dihapus otomatis oleh bot (silent)!\n`;
			replyText += `│\n`;
			replyText += `│ 💡 *Cara Membuka Ban:*\n`;
			replyText += `│ • Ketik \`${prefix}unbans\` untuk memilih via panel\n`;
			replyText += `│ • Ketik \`${prefix}unbans all\` untuk unban massal stiker\n`;
			replyText += `╰───────────────────────────❖`;

			return await naze.sendMessage(m.chat, {
				text: replyText,
				mentions: [targetJid]
			}, { quoted: m });
		}

		// ==============================================================
		// 2. REPLY STIKER BIASA (.bans biasa -> ban stiker spesifik)
		// ==============================================================
		if (m.quoted && isQuotedSticker(m)) {
			return await banSticker({ naze, m, args, text, isCreator, prefix, command });
		}

		// Jika tanpa argumen dan tanpa reply stiker
		return m.reply(
			`🚫 *[ PANDUAN FITUR BANS STIKER ]* 🚫\n\n` +
			`1️⃣ *Ban Stiker Spesifik (.bans):*\n` +
			`• Reply stiker target di grup lalu ketik: \`${prefix}bans\`\n` +
			`• Stiker tersebut akan otomatis dihapus jika dikirim siapa pun di grup.\n\n` +
			`2️⃣ *Ban Stiker Permanen User (.bans p):*\n` +
			`• Ketik \`${prefix}bans p @user\` (atau reply pesan lalu ketik \`${prefix}bans p\`)\n` +
			`• Semua stiker apa pun yang dikirim user ini akan otomatis langsung dihapus.\n\n` +
			`🔓 *Untuk Membuka Ban:* Ketik \`${prefix}unbans\` (menampilkan tombol panel mengambang) atau \`${prefix}unbans all\``
		);

	} catch (err) {
		console.error('[BANS_MANAGER] Error in handleBans:', err);
		m.reply(`❌ Terjadi kendala saat memproses bans: ${err.message}`);
	}
}

/**
 * Handler Khusus Fitur .unbans (Button List Panel Mengambang & Unbans All)
 */
export async function handleUnbans({ naze, m, args = [], text = '', isCreator, prefix, command, db, store }) {
	try {
		if (!isCreator) {
			return m.reply(global.mess?.owner || '⚠️ *Fitur ini khusus Owner!*');
		}

		// Jika me-reply stiker langsung, unban stiker via banSticker modul
		if (m.quoted && isQuotedSticker(m)) {
			return await unbanSticker({ naze, m, args, text, isCreator, prefix, command });
		}

		const cleanArg = (args[0] || text || '').trim().toLowerCase();

		// ==============================================================
		// 1. OPSI MANUAL: UNBAN SEMUA STIKER & BANS P (.unbans all / semua)
		// ==============================================================
		const isUnbanAll = ['all', 'semua', '-all', '--all', 'global'].includes(cleanArg);
		if (isUnbanAll) {
			const usersDb = db?.users || {};
			const permEntries = Object.entries(usersDb).filter(([k, u]) =>
				u && (u.banStickerPermanent === true || isUserStickerBannedPermanently(k))
			);
			const stickerCount = unbanAllStickers();

			const unbannedUsers = [];
			for (const [jid, userObj] of permEntries) {
				userObj.banStickerPermanent = false;
				removePermanentBannedUser(jid);
				const userName = await resolveUserName(naze, jid, userObj);
				unbannedUsers.push({ jid, name: userName });
			}

			clearPermanentBannedUsers();
			global._dbDirty = true;

			if (permEntries.length === 0 && stickerCount === 0) {
				return m.reply(
					`╭───❖「 🔓 *UNBAN MASSAL STIKER* 」\n` +
					`│\n` +
					`│ ✅ *Tidak ada stiker atau user bans stiker saat ini!*\n` +
					`│ Daftar ban stiker kosong dan bersih.\n` +
					`╰───────────────────────────❖`
				);
			}

			let caption = `╭───❖「 🔓 𝗨𝗡𝗕𝗔𝗡 𝗠𝗔𝗦𝗦𝗔𝗟 𝗦𝗧𝗜𝗞𝗘𝗥 𝗦𝗘𝗟𝗘𝗦𝗔𝗜 」\n`;
			caption += `│ 👥 *User Bans P Di-Unban :* ${unbannedUsers.length} Pengguna\n`;
			caption += `│ 🖼️ *Stiker Di-Unban      :* ${stickerCount} Stiker\n`;
			caption += `│ ⚡ *Status               :* Sukses & Bebas Mengirim Stiker\n`;
			caption += `│\n`;

			if (unbannedUsers.length > 0) {
				caption += `│ 📋 *User Bans Permanen yang Dibebaskan:*\n`;
				unbannedUsers.slice(0, 20).forEach((item, idx) => {
					caption += `│ ${idx + 1}. *${item.name}* (@${item.jid.replace(/[^0-9]/g, '')})\n`;
				});
				if (unbannedUsers.length > 20) {
					caption += `│ ... dan ${unbannedUsers.length - 20} user lainnya\n`;
				}
				caption += `│\n`;
			}

			caption += `╰───────────────────────────❖\n\n`;
			caption += `✨ Seluruh status ban stiker telah dicabut. Anggota kini dapat mengirimkan stiker secara normal.`;

			return await naze.sendMessage(m.chat, {
				text: caption,
				mentions: unbannedUsers.slice(0, 20).map(u => u.jid)
			}, { quoted: m });
		}

		// ==============================================================
		// 2. UNBAN SPESIFIK (Dari Tap Row Panel Ngambang / Input ID Stiker / Mention)
		// ==============================================================
		// A. Jika meng-input ID stiker (format: bans_xxx) atau nomor index
		if (text && (text.startsWith('bans_') || /^\d+$/.test(text.trim()))) {
			return await unbanSticker({ naze, m, args, text, isCreator, prefix, command });
		}

		// B. Jika meng-unban user yang terkena .bans p
		const targetJid = resolveTargetJid({ naze, m, text, args, store });
		if (targetJid && targetJid !== m.chat) {
			if (!db.users) db.users = {};
			if (!db.users[targetJid]) db.users[targetJid] = {};

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
			replyText += `│ User kini dapat mengirim stiker kembali di grup!\n`;
			replyText += `╰───────────────────────────❖`;

			return await naze.sendMessage(m.chat, {
				text: replyText,
				mentions: [targetJid]
			}, { quoted: m });
		}

		// ==============================================================
		// 3. TAMPILAN UTAMA: PANEL NGAMBANG (single_select) UNTUK UNBANS
		// ==============================================================
		const usersDb = db?.users || {};
		const permJids = Object.keys(usersDb).filter(j =>
			usersDb[j]?.banStickerPermanent === true || isUserStickerBannedPermanently(j)
		);
		const bannedStickers = getBannedStickers();

		if (permJids.length === 0 && bannedStickers.length === 0) {
			return m.reply(
				`╭───❖「 🛡️ 𝗣𝗔𝗡𝗘𝗟 𝗨𝗡𝗕𝗔𝗡𝗦 𝗦𝗧𝗜𝗞𝗘𝗥 」\n` +
				`│\n` +
				`│ ✅ *Tidak ada stiker atau user yang di-ban stiker!*\n` +
				`│ Seluruh pengguna bebas mengirimkan stiker di grup.\n` +
				`╰───────────────────────────❖`
			);
		}

		// Ambil data nama user bans permanen (Wajib nama user, bukan nomor!)
		const resolvedPermUsers = await Promise.all(
			permJids.map(async (jid, idx) => {
				const userObj = usersDb[jid] || {};
				const name = await resolveUserName(naze, jid, userObj);
				const phone = jid.replace(/[^0-9]/g, '');
				return { jid, name, phone, userObj };
			})
		);

		const sections = [];

		// Section 1: User Bans Stiker Permanen (.bans p)
		if (resolvedPermUsers.length > 0) {
			const permRows = resolvedPermUsers.slice(0, 30).map((item, idx) => {
				const safeTitle = item.name.length > 24 ? item.name.slice(0, 21) + '...' : item.name;
				const phoneFmt = formatPhoneNumber(item.phone);
				return {
					header: `Bans P #${idx + 1}`,
					title: safeTitle,
					description: `📱 ${phoneFmt} | Tap utk Unban Stiker`,
					id: `${prefix}unbans ${item.jid}`
				};
			});

			sections.push({
				title: `👥 USER BANS STIKER PERMANEN (${resolvedPermUsers.length})`,
				highlight_label: 'BANS P',
				rows: permRows
			});
		}

		// Section 2: Stiker Spesifik Terlarang
		if (bannedStickers.length > 0) {
			const stickerRows = bannedStickers.slice(0, 30).map((stk, idx) => {
				const safeTitle = `Stiker #${idx + 1} (${stk.chatName || 'Grup'})`.slice(0, 24);
				const shortHash = stk.primaryHash ? `${stk.primaryHash.slice(0, 12)}...` : '-';
				return {
					header: `Stiker ID: ${stk.id}`,
					title: safeTitle,
					description: `🔑 ${shortHash} | Tap utk Unban`,
					id: `${prefix}unbans ${stk.id}`
				};
			});

			sections.push({
				title: `🖼️ DAFTAR STIKER DIBAN (${bannedStickers.length})`,
				highlight_label: 'STIKER',
				rows: stickerRows
			});
		}

		const botTitle = global.set?.botname || global.botname || 'Oguri Cap';
		let menuText = `╭───❖「 🛡️ 𝗣𝗔𝗡𝗘𝗟 𝗨𝗡𝗕𝗔𝗡𝗦 𝗦𝗧𝗜𝗞𝗘𝗥 」\n`;
		menuText += `│ 👥 *User Bans P  :* ${resolvedPermUsers.length} Pengguna\n`;
		menuText += `│ 🖼️ *Stiker Terban :* ${bannedStickers.length} Stiker\n`;
		menuText += `│\n`;
		menuText += `│ Sentuh tombol *🔓 Pilih Yang Di-Unban* di bawah\n`;
		menuText += `│ untuk menampilkan panel mengambang dan memilih\n`;
		menuText += `│ user berdasarkan nama mereka (tanpa perlu mencari nomor).\n`;
		menuText += `│\n`;
		menuText += `│ 💡 *Opsi Unban Semua (Manual):*\n`;
		menuText += `│ Ketik: \`${prefix}unbans all\`\n`;
		menuText += `╰───────────────────────────❖`;

		try {
			if (typeof naze.sendListMsg === 'function') {
				return await naze.sendListMsg(m.chat, {
					text: menuText,
					footer: botTitle,
					buttons: [
						{
							name: 'single_select',
							buttonParamsJson: {
								title: '🔓 Pilih Yang Di-Unban',
								sections: sections
							}
						}
					]
				}, { quoted: m });
			}
		} catch (err) {
			console.warn('[UNBANS] Gagal mengirim sendListMsg interaktif, beralih ke fallback teks:', err.message);
		}

		let fallbackText = menuText + `\n\n📋 *Daftar Bans:* \n`;
		resolvedPermUsers.forEach((item, idx) => {
			fallbackText += `${idx + 1}. *${item.name}* (${formatPhoneNumber(item.phone)})\n   👉 Ketik: \`${prefix}unbans ${item.phone}\`\n`;
		});
		return await m.reply(fallbackText);

	} catch (err) {
		console.error('[UNBANS_MANAGER] Error in handleUnbans:', err);
		m.reply(`❌ Terjadi kendala saat memproses unbans: ${err.message}`);
	}
}
