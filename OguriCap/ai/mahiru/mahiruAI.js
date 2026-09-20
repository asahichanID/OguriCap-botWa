import chalk from 'chalk';
import { buildMahiruPrompt } from './prompt.js';
import { isMahiruTrigger } from './trigger.js';
import { scrapeMahiruChat } from './scraper.js';
import { getMahiruMemory, addMahiruMessage, clearMahiruMemory, recordMahiruSentMessage, isReplyToMahiru } from './memory.js';
import { checkMahiruCooldown, cleanMahiruMessage, getTimeOfDay, sendMahiruTyping, sleep } from './helper.js';
import { getMahiruRelationship, setMahiruRelationship, removeMahiruRelationship, parseOwnerRelationIntent, listMahiruRelationships } from './relationship.js';
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

		// PENTING: Hanya anggap reply jika pesan yang di-reply benar-benar pesan AI Mahiru
		// (bukan chat biasa / command lain dari nomor bot/owner)
		const replyToMahiru = isReplyToMahiru(m, db);
		const hasTrigger = isMahiruTrigger(text);

		// Di grup: hanya merespon jika fitur aktif DAN (ada trigger nama Mahiru ATAU reply chat AI Mahiru)
		if (isGroup) {
			if (!isEnabledInGroup) return;
			if (!hasTrigger && !replyToMahiru) return;
		} else {
			// Di private chat: respon jika ada trigger nama Mahiru atau reply chat AI Mahiru
			if (!hasTrigger && !replyToMahiru) return;
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
					const sentRel = await naze.sendMessage(m.chat, {
						text: replyText,
						mentions: [relationIntent.targetJid, m.sender]
					}, { quoted: m });
					if (sentRel?.key?.id) {
						recordMahiruSentMessage(sentRel.key.id, replyText);
					}
					return;
				} else if (relationIntent.action === 'remove') {
					removeMahiruRelationship(db, relationIntent.targetJid);
					const replyText = `Baik, Shiro-sama. Status hubungan khusus dengan @${targetNum} telah Mahiru hapus sesuai arahan Shiro-sama. Sekarang Mahiru akan memperlakukannya seperti teman biasa. 🌸`;

					console.log(chalk.magentaBright('🌸 [MAHIRU AI - RELASI DIHAPUS]'), chalk.yellowBright(`Target: ${targetNum} dihapus atas arahan Shiro-sama`));
					await naze.sendPresenceUpdate('composing', m.chat);
					await sleep(1000);
					const sentDel = await naze.sendMessage(m.chat, {
						text: replyText,
						mentions: [relationIntent.targetJid]
					}, { quoted: m });
					if (sentDel?.key?.id) {
						recordMahiruSentMessage(sentDel.key.id, replyText);
					}
					return;
				}
			}
		}

		// 5. Cooldown per user (2.5 detik)
		const cooldownKey = `${m.chat}:${m.sender}`;
		if (!checkMahiruCooldown(cooldownKey, 2500)) return;

		// 6. Bersihkan teks dari nama trigger
		let cleanText = replyToMahiru && !hasTrigger
			? text
			: cleanMahiruMessage(text);

		// Jika direct command seperti .mahiru halo
		if (isDirectMahiruCmd) {
			cleanText = text.replace(/^[.!\/+](mahiru|mahiruai|tenshi|oguriai)\s*/i, '').trim() || 'Halo Mahiru';
		}

		if (!cleanText || cleanText.trim().length === 0) {
			cleanText = text.trim() || 'Halo Mahiru';
		}

		// 7. Cek relasi khusus pengguna & kumpulkan data relasi global
		const relationship = isOwner ? null : getMahiruRelationship(db, m.sender);
		const allRelationships = listMahiruRelationships(db);

		// Kumpulkan entitas yang disebut / di-mention / di-reply di pesan ini
		const mentionedEntities = [];
		const rawMentions = [...(m.mentionedJid || [])];
		if (m.quoted?.sender && !rawMentions.includes(m.quoted.sender)) {
			rawMentions.push(m.quoted.sender);
		}

		// Ekstrak juga nomor di dalam teks jika ada (contoh: @628xxx atau 628xxx)
		const matchesInText = text.matchAll(/@?(\d{8,16})/g);
		for (const match of matchesInText) {
			const jid = `${match[1]}@s.whatsapp.net`;
			if (!rawMentions.includes(jid)) {
				rawMentions.push(jid);
			}
		}

		for (const jid of rawMentions) {
			const cleanNum = String(jid).replace(/[^0-9]/g, '');
			if (!cleanNum) continue;
			const targetRel = getMahiruRelationship(db, jid);
			const targetName = global.db?.users?.[jid]?.name || targetRel?.targetName || `@${cleanNum}`;
			mentionedEntities.push({
				jid,
				number: cleanNum,
				name: targetName,
				relationship: targetRel
			});
		}

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

		// 9. Bangun prompt Mahiru dengan data relasi & mention lengkap
		const timeOfDay = getTimeOfDay();
		const systemPrompt = buildMahiruPrompt({
			userName,
			isOwner,
			relationship,
			allRelationships,
			mentionedEntities,
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
			relationship,
			allRelationships,
			mentionedEntities
		});

		if (!mahiruReply || typeof mahiruReply !== 'string' || mahiruReply.trim().length === 0) {
			console.warn(chalk.yellow('[MAHIRU AI] Respon scraper kosong, mengabaikan'));
			return;
		}

		// 13. Simpan balasan bot ke memori
		addMahiruMessage(db, memKey, 'assistant', mahiruReply);

		// 14. Kumpulkan mentions untuk pesan balasan
		const replyMentions = [];
		for (const entity of mentionedEntities) {
			if (entity.jid && !replyMentions.includes(entity.jid)) {
				replyMentions.push(entity.jid);
			}
		}
		// Cek nomor yang ada di teks balasan mahiru
		const replyNumMatches = mahiruReply.matchAll(/@?(\d{8,16})/g);
		for (const match of replyNumMatches) {
			const jid = `${match[1]}@s.whatsapp.net`;
			if (!replyMentions.includes(jid)) {
				replyMentions.push(jid);
			}
		}

		// 15. Balas ke chat dan rekam ID & teks pesan yang dikirim
		console.log(chalk.magentaBright('🌸 [MAHIRU AI]'), chalk.greenBright(`Berhasil membalas ke ${m.chat}:`), chalk.white(mahiruReply.slice(0, 50) + '...'));

		let sentMsg = null;
		if (replyMentions.length > 0 && naze?.sendMessage) {
			sentMsg = await naze.sendMessage(m.chat, {
				text: mahiruReply,
				mentions: replyMentions
			}, { quoted: m });
		} else {
			sentMsg = await m.reply(mahiruReply);
		}

		if (sentMsg?.key?.id) {
			recordMahiruSentMessage(sentMsg.key.id, mahiruReply);
		} else {
			recordMahiruSentMessage(null, mahiruReply);
		}

	} catch (err) {
		console.error(chalk.redBright('[MAHIRU AI Error]:'), err.message || err);
	}
}

// Re-export untuk backward-compatibility & direct command usage
export { clearMahiruMemory, clearMahiruMemory as clearMemory };
export default mahiruAI;
