import chalk from 'chalk';
import { buildMahiruPrompt } from './prompt.js';
import { isMahiruTrigger } from './trigger.js';
import { scrapeMahiruChat } from './scraper.js';
import { getMahiruMemory, addMahiruMessage, clearMahiruMemory } from './memory.js';
import { checkMahiruCooldown, cleanMahiruMessage, getTimeOfDay, sendMahiruTyping, sleep } from './helper.js';
import { getMahiruRelationship, setMahiruRelationship, removeMahiruRelationship, parseOwnerRelationIntent } from './relationship.js';
import { isBotSentMessage } from '../../src/botGuard.js';

/**
 * Memeriksa apakah user adalah owner / creator bot.
 */
function isUserOwner(m) {
	if (m.isOwner || m.isCreator) return true;
	const senderNumber = (m.sender || '').split('@')[0];
	const owners = [...(global.owner || []), ...(global.ownerNumber || [])];
	return owners.some(o => {
		if (typeof o === 'string') return o.replace(/[^0-9]/g, '') === senderNumber;
		if (Array.isArray(o)) return String(o[0]).replace(/[^0-9]/g, '') === senderNumber;
		if (o && typeof o === 'object' && o.id) return String(o.id).replace(/[^0-9]/g, '') === senderNumber;
		return false;
	});
}

/**
 * Memeriksa apakah pesan ini me-reply pesan dari bot Mahiru
 */
function isReplyToBot(naze, m) {
	if (!m || !m.quoted) return false;
	if (m.quoted.fromMe === true || m.quoted.key?.fromMe === true) return true;

	const botNumber = naze?.decodeJid ? naze.decodeJid(naze.user?.id || '') : '';
	const botLid = naze?.decodeJid ? naze.decodeJid(naze.user?.lid || '') : '';
	const botNumClean = botNumber.replace(/[^0-9]/g, '');
	const senderClean = (m.quoted.sender || '').replace(/[^0-9]/g, '');

	if (botNumClean && senderClean && botNumClean === senderClean) return true;
	if (botNumber && (m.quoted.sender === botNumber || m.quoted.chat === botNumber)) return true;
	if (botLid && (m.quoted.sender === botLid || m.quoted.chat === botLid)) return true;
	if (m.quoted.id && isBotSentMessage(m.quoted.id)) return true;

	return false;
}

/**
 * Memeriksa apakah bot di-tag / di-mention di pesan
 */
function isBotMentioned(naze, m) {
	if (!m || !m.mentionedJid || !Array.isArray(m.mentionedJid) || m.mentionedJid.length === 0) return false;
	const botNumber = naze?.decodeJid ? naze.decodeJid(naze.user?.id || '') : '';
	const botLid = naze?.decodeJid ? naze.decodeJid(naze.user?.lid || '') : '';
	const botNumClean = botNumber.replace(/[^0-9]/g, '');

	return m.mentionedJid.some(jid => {
		if (!jid) return false;
		if (botNumber && jid === botNumber) return true;
		if (botLid && jid === botLid) return true;
		const clean = jid.replace(/[^0-9]/g, '');
		return botNumClean && clean && botNumClean === clean;
	});
}

/**
 * Handler utama Mahiru AI untuk dipanggil pada setiap pesan masuk.
 *
 * @param {Object} naze - Baileys socket client
 * @param {Object} m - Objek pesan WhatsApp
 * @param {Object} db - Global database
 */
export async function mahiruAI(naze, m, db = global.db) {
	try {
		// 1. Validasi pesan dasar
		if (!m || (!m.text && !m.body)) return;
		if (m.isBaileys) return;

		// Hindari loop jika pesan adalah pesan otomatis yang dikirim oleh proses bot ini
		if (isBotSentMessage(m.id || m.key?.id)) return;

		const text = (typeof m.text === 'string' ? m.text : m.body || '').trim();
		if (!text) return;

		// 2. Cek apakah ini di grup atau private chat
		const isGroup = Boolean(m.isGroup);
		const groupData = isGroup && db?.groups ? db.groups[m.chat] : (global.db?.groups?.[m.chat] || null);

		// Jika di grup, periksa apakah fitur Mahiru AI diaktifkan
		const isEnabledInGroup = Boolean(
			groupData?.mahiruAI?.enable === true ||
			groupData?.mahiruAI === true ||
			groupData?.oguriAI?.enable === true ||
			groupData?.oguriAI === true
		);

		const replyToBot = isReplyToBot(naze, m);
		const mentioned = isBotMentioned(naze, m);
		const hasTrigger = isMahiruTrigger(text);

		// Di grup: hanya merespon jika fitur aktif DAN (ada trigger nama Mahiru / reply bot / mention bot)
		if (isGroup) {
			if (!isEnabledInGroup) return;
			if (!hasTrigger && !replyToBot && !mentioned) return;
		} else {
			// Di private chat: respon jika ada trigger, reply, atau mention
			if (!hasTrigger && !replyToBot && !mentioned) return;
		}

		// 3. Jangan proses jika pesan adalah command bot dengan prefix (kecuali pesan eksplisit command .mahiru)
		const listprefix = global.listprefix || ['.', '!', '+', '/'];
		const isPrefixCmd = listprefix.some(p => text.startsWith(p));
		const isDirectMahiruCmd = /^[.!\/+](mahiru|mahiruai|tenshi|oguriai)\b/i.test(text);
		if (isPrefixCmd && !isDirectMahiruCmd) return;

		// 4. Identifikasi user & status owner
		const isOwner = isUserOwner(m);

		// JIKA PESAN BERASAL DARI SHIRO-SAMA (OWNER):
		// Cek apakah Shiro-sama sedang memberikan instruksi relasi khusus (misal: Mahiru tolong anggap @user pacarmu)
		if (isOwner) {
			const relationIntent = parseOwnerRelationIntent(text, m.mentionedJid, m.quoted?.sender);
			if (relationIntent) {
				const targetNum = (relationIntent.targetJid || '').split('@')[0];
				const targetName = global.db?.users?.[relationIntent.targetJid]?.name || `@${targetNum}`;

				if (relationIntent.action === 'set') {
					setMahiruRelationship(db, relationIntent.targetJid, {
						role: relationIntent.role,
						targetName: targetName,
						note: `Disetujui dan diperintahkan oleh Shiro-sama pada ${new Date().toLocaleDateString('id-ID')}`
					});

					const roleDesc = relationIntent.role === 'pacar' ? 'pacar tercinta' : relationIntent.role;
					const replyText = `(⁄ ⁄•⁄ω⁄•⁄ ⁄) E-Eh?! Shiro-sama serius...? \n\nB-Baiklah, jika itu adalah perintah dan keinginan Shiro-sama... Mulai sekarang Mahiru akan memperlakukan @${targetNum} layaknya *${roleDesc}* sendiri... Semoga Mahiru bisa menjadi ${roleDesc} yang baik dan tidak mengecewakan Shiro-sama ya! 🌸💕✨`;

					console.log(chalk.magentaBright('🌸 [MAHIRU AI - RELASI DITETAPKAN]'), chalk.greenBright(`Target: ${targetNum} sebagai ${relationIntent.role} atas izin Shiro-sama`));
					await naze.sendPresenceUpdate('composing', m.chat);
					await sleep(1200);
					return await naze.sendMessage(m.chat, {
						text: replyText,
						mentions: [relationIntent.targetJid, m.sender]
					}, { quoted: m });
				} else if (relationIntent.action === 'remove') {
					removeMahiruRelationship(db, relationIntent.targetJid);
					const replyText = `Baik, Shiro-sama. Status hubungan khusus dengan @${targetNum} telah Mahiru hapus sesuai arahan Shiro-sama. Sekarang Mahiru akan memperlakukannya seperti teman biasa. 🌸`;

					console.log(chalk.magentaBright('🌸 [MAHIRU AI - RELASI DIHAPUS]'), chalk.yellowBright(`Target: ${targetNum} dihapus atas arahan Shiro-sama`));
					await naze.sendPresenceUpdate('composing', m.chat);
					await sleep(1000);
					return await naze.sendMessage(m.chat, {
						text: replyText,
						mentions: [relationIntent.targetJid]
					}, { quoted: m });
				}
			}
		}

		// 5. Cooldown per user (2.5 detik)
		const cooldownKey = `${m.chat}:${m.sender}`;
		if (!checkMahiruCooldown(cooldownKey, 2500)) return;

		// 6. Bersihkan teks dari nama trigger
		let cleanText = (replyToBot || mentioned) && !hasTrigger
			? text
			: cleanMahiruMessage(text);

		// Jika direct command seperti .mahiru halo
		if (isDirectMahiruCmd) {
			cleanText = text.replace(/^[.!\/+](mahiru|mahiruai|tenshi|oguriai)\s*/i, '').trim() || 'Halo Mahiru';
		}

		if (!cleanText || cleanText.trim().length === 0) {
			cleanText = text.trim() || 'Halo Mahiru';
		}

		// 7. Cek relasi khusus pengguna (misal status Pacar yang diizinkan Shiro-sama)
		const relationship = isOwner ? null : getMahiruRelationship(db, m.sender);

		let userName = m.pushName || (isOwner ? 'Shiro-sama' : 'Teman');
		if (isOwner) {
			userName = 'Shiro-sama';
		}

		const relTag = relationship ? ` [Relasi: ${relationship.role}]` : '';
		console.log(chalk.magentaBright('🌸 [MAHIRU AI]'), chalk.cyanBright(`Memproses pesan dari ${userName}${relTag} (${(m.sender || '').split('@')[0]}) di ${isGroup ? (m.metadata?.subject || 'Grup') : 'Private Chat'}:`), chalk.yellow(`"${cleanText}"`));

		// 8. Ambil context memori percakapan
		const memKey = `${m.chat}:${m.sender}`;
		const history = getMahiruMemory(db, memKey);

		// Simpan pesan user ke memori
		addMahiruMessage(db, memKey, 'user', cleanText);

		// 9. Bangun prompt Mahiru
		const timeOfDay = getTimeOfDay();
		const systemPrompt = buildMahiruPrompt({
			userName,
			isOwner,
			relationship,
			timeOfDay
		});

		// 10. Kirim typing presence ke WA
		await sendMahiruTyping(naze, m.chat);

		// Natural delay (1.0 - 2.0 detik)
		const randomDelay = Math.floor(Math.random() * 1000) + 1000;
		await sleep(randomDelay);

		// 11. Format pesan untuk AI Scraper
		const messagesForAI = [
			...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
			{ role: 'user', content: cleanText }
		];

		// 12. Scrape respon AI Mahiru Shiina
		const mahiruReply = await scrapeMahiruChat(messagesForAI, systemPrompt, {
			userName,
			isOwner,
			relationship
		});

		if (!mahiruReply || typeof mahiruReply !== 'string' || mahiruReply.trim().length === 0) {
			console.warn(chalk.yellow('[MAHIRU AI] Respon scraper kosong, mengabaikan'));
			return;
		}

		// 13. Simpan balasan bot ke memori
		addMahiruMessage(db, memKey, 'assistant', mahiruReply);

		// 14. Balas ke chat
		console.log(chalk.magentaBright('🌸 [MAHIRU AI]'), chalk.greenBright(`Berhasil membalas ke ${m.chat}:`), chalk.white(mahiruReply.slice(0, 50) + '...'));
		await m.reply(mahiruReply);

	} catch (err) {
		console.error(chalk.redBright('[MAHIRU AI Error]:'), err.message || err);
	}
}

// Re-export untuk backward-compatibility & direct command usage
export { clearMahiruMemory, clearMahiruMemory as clearMemory };
export default mahiruAI;
