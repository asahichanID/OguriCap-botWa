import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '../database/bansticker.json');

// In-memory cache untuk lookup secepat kilat (O(1))
let bannedList = [];
const bannedHashSet = new Set();

/**
 * Normalisasi data byte/Buffer Baileys dengan aman
 */
function fixBytesSafe(obj) {
	if (!obj) return null;
	if (Buffer.isBuffer(obj)) return obj;
	if (obj instanceof Uint8Array) return Buffer.from(obj);
	if (Array.isArray(obj)) return Buffer.from(obj);
	if (typeof obj === 'object') {
		const vals = Object.values(obj);
		if (vals.length > 0 && typeof vals[0] === 'number') {
			return Buffer.from(vals);
		}
	}
	return null;
}

/**
 * Konversi representasi hash (Buffer / Uint8Array / Hex / Base64) menjadi array string unik
 */
function normalizeHash(val) {
	if (!val) return [];
	const results = new Set();

	if (typeof val === 'string') {
		const trimmed = val.trim();
		if (trimmed) {
			results.add(trimmed);
			results.add(trimmed.toLowerCase());
			// Jika format hex 64 karakter (SHA-256)
			if (/^[0-9a-f]{64}$/i.test(trimmed)) {
				try {
					const b64 = Buffer.from(trimmed, 'hex').toString('base64');
					if (b64) {
						results.add(b64);
						results.add(b64.toLowerCase());
					}
				} catch {}
			}
			// Jika format base64
			if (/^[A-Za-z0-9+/=]{40,48}$/.test(trimmed)) {
				try {
					const hex = Buffer.from(trimmed, 'base64').toString('hex').toLowerCase();
					if (hex && hex.length === 64) results.add(hex);
				} catch {}
			}
		}
	} else {
		const buf = fixBytesSafe(val);
		if (buf && buf.length > 0) {
			const hex = buf.toString('hex').toLowerCase();
			const b64 = buf.toString('base64');
			if (hex) results.add(hex);
			if (b64) {
				results.add(b64);
				results.add(b64.toLowerCase());
			}
		}
	}
	return Array.from(results);
}

/**
 * Muat database ban sticker dari berkas lokal
 */
function loadDB() {
	try {
		if (fs.existsSync(DB_FILE)) {
			const raw = fs.readFileSync(DB_FILE, 'utf8');
			const parsed = JSON.parse(raw);
			bannedList = Array.isArray(parsed) ? parsed : [];
		} else {
			bannedList = [];
			saveDB();
		}
	} catch (e) {
		console.error('[BANSTICKER] Error loading database:', e.message);
		bannedList = [];
	}

	// Rebuild in-memory HashSet
	bannedHashSet.clear();
	for (const item of bannedList) {
		if (Array.isArray(item.hashes)) {
			for (const h of item.hashes) {
				if (h) {
					bannedHashSet.add(String(h));
					bannedHashSet.add(String(h).toLowerCase());
				}
			}
		}
	}
}

/**
 * Simpan database ban sticker ke berkas lokal
 */
function saveDB() {
	try {
		const dir = path.dirname(DB_FILE);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(DB_FILE, JSON.stringify(bannedList, null, 2), 'utf8');
	} catch (e) {
		console.error('[BANSTICKER] Error saving database:', e.message);
	}
}

// Inisialisasi awal saat modul dimuat
loadDB();

/**
 * Ekstrak seluruh kemungkinan hash / signature dari pesan stiker
 */
function extractHashesFromMessage(msgObj) {
	const hashes = new Set();
	if (!msgObj) return [];

	const target = msgObj.msg || msgObj;

	// 1. Cek fileSha256
	const shaCandidates = [
		target?.fileSha256,
		msgObj?.fileSha256,
		msgObj?.stickerMessage?.fileSha256,
		msgObj?.message?.stickerMessage?.fileSha256,
		msgObj?.message?.ephemeralMessage?.message?.stickerMessage?.fileSha256,
		msgObj?.message?.viewOnceMessage?.message?.stickerMessage?.fileSha256,
		msgObj?.message?.viewOnceMessageV2?.message?.stickerMessage?.fileSha256,
		target?.fileEncSha256,
		msgObj?.fileEncSha256,
		msgObj?.message?.stickerMessage?.fileEncSha256,
		msgObj?.message?.ephemeralMessage?.message?.stickerMessage?.fileEncSha256
	];

	for (const cand of shaCandidates) {
		if (cand) {
			for (const norm of normalizeHash(cand)) {
				hashes.add(norm);
				hashes.add(norm.toLowerCase());
			}
		}
	}

	return Array.from(hashes);
}

/**
 * Cek apakah pesan merupakan stiker
 */
function isStickerMessage(m) {
	if (!m) return false;
	try {
		if (m.type === 'stickerMessage' || m.mtype === 'stickerMessage') return true;
		if (m.msg && (m.msg.mimetype === 'image/webp' || m.msg.isAnimated !== undefined)) return true;
		if (typeof m.mime === 'string' && /webp/i.test(m.mime)) return true;
		if (m.message?.stickerMessage) return true;
		if (m.message?.ephemeralMessage?.message?.stickerMessage) return true;
		if (m.message?.viewOnceMessage?.message?.stickerMessage) return true;
		if (m.message?.viewOnceMessageV2?.message?.stickerMessage) return true;
	} catch {}
	return false;
}

/**
 * Cek apakah pesan yang di-quoted merupakan stiker
 */
function isQuotedSticker(m) {
	const q = m?.quoted;
	if (!q) return false;
	try {
		if (q.type === 'stickerMessage' || q.mtype === 'stickerMessage') return true;
		if (q.msg && (q.msg.mimetype === 'image/webp' || q.msg.isAnimated !== undefined)) return true;
		if (typeof q.mime === 'string' && /webp/i.test(q.mime)) return true;
		if (q.message?.stickerMessage) return true;
	} catch {}
	return false;
}

/**
 * Cek secepat kilat apakah sebuah stiker terdaftar di banned list (O(1))
 */
function isStickerBanned(m) {
	if (!m || bannedHashSet.size === 0) return false;
	try {
		const hashes = extractHashesFromMessage(m);
		for (const h of hashes) {
			if (bannedHashSet.has(h) || bannedHashSet.has(String(h).toLowerCase())) return true;
		}
	} catch (e) {
		console.error('[BANSTICKER] Error checking sticker:', e.message);
	}
	return false;
}

/**
 * Deteksi dan langsung hapus stiker terlarang di grup secara silent dan secepat kilat
 * @returns {Promise<boolean>} true jika stiker terdeteksi dan ditangani, false jika bukan
 */
async function checkAndHandleBannedSticker({ naze, m }) {
	// Fitur auto-delete khusus grup
	if (!m || !m.isGroup) return false;

	try {
		if (!isStickerMessage(m)) return false;

		const banned = isStickerBanned(m);
		if (!banned) return false;

		// Jika terbukti stiker terlarang dan bot adalah admin di grup:
		if (m.isBotAdmin) {
			await naze.sendMessage(m.chat, {
				delete: {
					remoteJid: m.chat,
					fromMe: false,
					id: m.id || m.key?.id,
					participant: m.sender || m.key?.participant
				}
			}, { urgent: true }).catch(() => {});
		}
		// Logging jelas di console server
		console.log(`[BANSTICKER] ⚡ Berhasil menghapus stiker terlarang dari @${(m.sender || '').split('@')[0]} di grup ${m.chat}`);
		return true;
	} catch (e) {
		console.error('[BANSTICKER] Error in checkAndHandleBannedSticker:', e.message);
		return false;
	}
}

/**
 * Command Owner: Ban Sticker (.bans)
 */
const banSticker = async ({ naze, m, args, text, isCreator, prefix, command }) => {
	try {
		if (!isCreator) {
			return m.reply(global.mess?.owner || '⚠️ *Fitur ini khusus Owner!*');
		}

		const q = m.quoted;
		if (!q || !isQuotedSticker(m)) {
			return m.reply(
				`🚫 *[ PANDUAN BAN STICKER ]* 🚫\n\n` +
				`Fitur ini khusus untuk mem-ban stiker permanen dari grup.\n\n` +
				`📌 *Cara Penggunaan:*\n` +
				`1. Reply stiker target yang ingin di-ban.\n` +
				`2. Ketik perintah: \`${prefix + command}\`\n\n` +
				`💡 *Efek:*\n` +
				`• Stiker yang di-reply akan langsung dihapus dari grup saat itu juga.\n` +
				`• Seterusnya, jika ada yang mengirim stiker tersebut di grup mana pun, bot akan otomatis menghapusnya secepat kilat (silent).\n\n` +
				`📋 *Perintah Terkait:*\n` +
				`• \`${prefix}unbans\` — Unban stiker (reply stiker / input ID)\n` +
				`• \`${prefix}listbans\` — Lihat daftar stiker yang di-ban`
			);
		}

		// Kumpulkan semua signature hash dari stiker yang di-reply
		const collectedHashes = new Set(extractHashesFromMessage(q));

		// Unduh buffer stiker untuk menghasilkan SHA-256 murni
		let directSha = null;
		let fileLength = q.size || q.msg?.fileLength || 0;
		try {
			if (typeof q.download === 'function') {
				const buf = await q.download().catch(() => null);
				if (buf && buf.length > 0) {
					fileLength = buf.length;
					directSha = crypto.createHash('sha256').update(buf).digest('hex').toLowerCase();
					for (const norm of normalizeHash(directSha)) {
						collectedHashes.add(norm.toLowerCase());
					}
					const b64 = crypto.createHash('sha256').update(buf).digest('base64');
					collectedHashes.add(b64.toLowerCase());
				}
			}
		} catch (e) {
			console.error('[BANSTICKER] Error downloading quoted sticker:', e.message);
		}

		const hashArray = Array.from(collectedHashes).filter(Boolean);
		if (hashArray.length === 0) {
			return m.reply('❌ Gagal mengekstrak signature stiker. Pastikan pesan yang di-reply adalah stiker yang valid!');
		}

		// Cek apakah stiker sudah terdaftar
		const isAlreadyBanned = hashArray.some(h => bannedHashSet.has(h));
		if (isAlreadyBanned) {
			// Coba hapus pesan stiker yang di-reply jika belum terhapus
			if (m.isGroup && m.isBotAdmin && q.id) {
				await naze.sendMessage(m.chat, {
					delete: {
						remoteJid: m.chat,
						fromMe: Boolean(q.fromMe),
						id: q.id,
						...(q.sender ? { participant: q.sender } : {})
					}
				}).catch(() => {});
			}
			return m.reply('⚠️ *Stiker ini sudah ada dalam daftar ban stiker!* Stiker telah diproteksi dan akan otomatis dihapus jika dikirim.');
		}

		// Simpan record ban baru
		const banId = `bans_${Date.now()}`;
		const newRecord = {
			id: banId,
			primaryHash: directSha || hashArray[0],
			hashes: hashArray,
			fileLength: fileLength,
			addedBy: m.sender,
			addedAt: Date.now(),
			chat: m.chat,
			chatName: m.isGroup ? (m.metadata?.subject || m.chat) : 'Private Chat'
		};

		bannedList.push(newRecord);
		for (const h of hashArray) {
			bannedHashSet.add(h);
		}
		saveDB();

		// Hapus stiker target yang di-reply dari grup untuk semua orang
		let deletedStatus = 'Belum Dihapus (Bukan Grup)';
		if (m.isGroup) {
			if (m.isBotAdmin && q.id) {
				await naze.sendMessage(m.chat, {
					delete: {
						remoteJid: m.chat,
						fromMe: Boolean(q.fromMe),
						id: q.id,
						...(q.sender ? { participant: q.sender } : {})
					}
				}).catch(() => {});
				deletedStatus = '✅ Terhapus untuk Semua Orang';
			} else {
				deletedStatus = '⚠️ Bot belum menjadi admin grup (Jadikan bot admin agar dapat menghapus stiker)';
			}
		}

		const adminNote = (m.isGroup && !m.isBotAdmin)
			? '\n\n⚠️ *Perhatian:* Bot saat ini belum menjadi admin di grup ini. Jadikan bot sebagai admin agar sistem dapat menghapus stiker secara otomatis secepat kilat.'
			: '';

		await m.reply(
			`🚫 *[ STIKER BERHASIL DI-BAN ]* 🚫\n\n` +
			`✅ *Status:* Resmi Masuk Daftar Banned\n` +
			`🆔 *ID Ban:* \`${banId}\`\n` +
			`🗑️ *Tindakan Langsung:* ${deletedStatus}\n` +
			`⚡ *Proteksi Otomatis:* Seterusnya, jika ada anggota yang mengirimkan stiker ini di grup, bot akan langsung menghapusnya secepat kilat tanpa spam (silent).${adminNote}`
		);
	} catch (err) {
		console.error('[BANSTICKER] Error in banSticker command:', err);
		m.reply(`❌ Terjadi kendala saat memproses ban stiker: ${err.message}`);
	}
};

/**
 * Command Owner: Unban Sticker (.unbans)
 */
const unbanSticker = async ({ naze, m, args, text, isCreator, prefix, command }) => {
	try {
		if (!isCreator) {
			return m.reply(global.mess?.owner || '⚠️ *Fitur ini khusus Owner!*');
		}

		if (bannedList.length === 0) {
			return m.reply('📋 *Daftar ban stiker masih kosong.* Belum ada stiker yang di-ban.');
		}

		let targetIndex = -1;

		// 1. Cek jika me-reply stiker
		if (m.quoted && isQuotedSticker(m)) {
			const hashes = extractHashesFromMessage(m.quoted);
			let directSha = null;
			try {
				if (typeof m.quoted.download === 'function') {
					const buf = await m.quoted.download().catch(() => null);
					if (buf && buf.length > 0) {
						directSha = crypto.createHash('sha256').update(buf).digest('hex').toLowerCase();
						hashes.push(...normalizeHash(directSha));
					}
				}
			} catch {}

			const searchSet = new Set(hashes.map(h => String(h).toLowerCase()));
			targetIndex = bannedList.findIndex(item =>
				Array.isArray(item.hashes) && item.hashes.some(h => searchSet.has(String(h).toLowerCase()))
			);
		}

		// 2. Cek jika memberikan ID atau nomor urut
		if (targetIndex === -1 && text) {
			const cleanText = text.trim();
			// Cek nomor urut (1-based index)
			if (/^\d+$/.test(cleanText)) {
				const num = parseInt(cleanText, 10);
				if (num >= 1 && num <= bannedList.length) {
					targetIndex = num - 1;
				}
			} else {
				// Cek ID ban
				targetIndex = bannedList.findIndex(item => item.id && item.id.toLowerCase() === cleanText.toLowerCase());
			}
		}

		if (targetIndex === -1) {
			return m.reply(
				`⚙️ *[ PANDUAN UNBAN STICKER ]*\n\n` +
				`Reply stiker yang ingin di-unban lalu ketik: \`${prefix + command}\`\n` +
				`Atau masukkan nomor/ID dari list: \`${prefix + command} <nomor/ID>\`\n\n` +
				`💡 Ketik \`${prefix}listbans\` untuk melihat daftar stiker yang sedang di-ban.`
			);
		}

		const removed = bannedList.splice(targetIndex, 1)[0];

		// Bersihkan in-memory HashSet
		if (removed && Array.isArray(removed.hashes)) {
			for (const h of removed.hashes) {
				// Pastikan tidak ada record lain yang menggunakan hash ini
				const stillUsed = bannedList.some(item => item.hashes?.includes(h));
				if (!stillUsed) {
					bannedHashSet.delete(String(h).toLowerCase());
				}
			}
		}

		saveDB();

		await m.reply(
			`✅ *[ STIKER BERHASIL DI-UNBAN ]*\n\n` +
			`🆔 *ID:* \`${removed.id}\`\n` +
			`🔓 *Status:* Stiker telah dihapus dari daftar ban.\n` +
			`✨ Anggota grup kini dapat mengirimkan stiker ini kembali secara normal.`
		);
	} catch (err) {
		console.error('[BANSTICKER] Error in unbanSticker command:', err);
		m.reply(`❌ Terjadi kendala saat unban stiker: ${err.message}`);
	}
};

/**
 * Command Owner: List Banned Stickers (.listbans)
 */
const listBanSticker = async ({ naze, m, isCreator, prefix }) => {
	try {
		if (!isCreator) {
			return m.reply(global.mess?.owner || '⚠️ *Fitur ini khusus Owner!*');
		}

		if (bannedList.length === 0) {
			return m.reply(
				`📋 *[ DAFTAR BANNED STICKER ]* 📋\n\n` +
				`Belum ada stiker yang di-ban.\n` +
				`Untuk mem-ban stiker, reply stiker target lalu ketik \`${prefix}bans\`.`
			);
		}

		let caption = `📋 *[ DAFTAR BANNED STICKER (${bannedList.length}) ]* 📋\n\n`;
		bannedList.forEach((item, idx) => {
			const dateStr = item.addedAt ? new Date(item.addedAt).toLocaleString('id-ID') : '-';
			const shortHash = item.primaryHash ? `${item.primaryHash.slice(0, 16)}...` : '-';
			caption += `*${idx + 1}.* 🆔 \`${item.id}\`\n`;
			caption += `   📅 *Tanggal:* ${dateStr}\n`;
			caption += `   🔑 *Hash:* \`${shortHash}\`\n`;
			caption += `   📍 *Asal:* ${item.chatName || item.chat || '-'}\n\n`;
		});

		caption += `💡 *Tips:*\n`;
		caption += `• Unban via reply: reply stiker lalu ketik \`${prefix}unbans\`\n`;
		caption += `• Unban via nomor: ketik \`${prefix}unbans <nomor>\``;

		await m.reply(caption);
	} catch (err) {
		console.error('[BANSTICKER] Error in listBanSticker command:', err);
		m.reply(`❌ Terjadi kendala saat menampilkan daftar ban stiker: ${err.message}`);
	}
};

// Export semua fungsi utama di bagian paling bawah
export {
	banSticker,
	unbanSticker,
	listBanSticker,
	checkAndHandleBannedSticker,
	isStickerBanned
};
