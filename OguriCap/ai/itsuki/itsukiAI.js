/**
 * OguriCap/itsuki/itsukiAI.js
 * -----------------------------------------------------------------------
 * Core Handler Itsuki Nakano AI (中野 五月) untuk Chat WhatsApp Baileys.
 */

import chalk from 'chalk';
import { buildItsukiPrompt } from './prompt.js';
import { isItsukiTrigger } from './trigger.js';
import { scrapeItsukiChat } from './scraper.js';
import { getItsukiMemory, addItsukiMessage, clearItsukiMemory, recordItsukiSentMessage, isReplyToItsuki } from './memory.js';
import { checkItsukiCooldown, cleanItsukiMessage, getTimeOfDay, sendItsukiTyping, sleep } from './helper.js';
import { getItsukiRelationship, setItsukiRelationship, removeItsukiRelationship, parseOwnerItsukiRelationIntent, listItsukiRelationships } from './relationship.js';
import { isBotSentMessage } from '../../src/botGuard.js';

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
 * Handler utama Itsuki Nakano AI untuk dipanggil pada setiap pesan masuk.
 *
 * @param {Object} naze - Baileys socket client
 * @param {Object} m - Objek pesan WhatsApp
 * @param {Object} db - Global database
 */
export async function itsukiAI(naze, m, db = global.db) {
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

		const isEnabledInGroup = Boolean(
			groupData?.itsukiAI?.enable === true ||
			groupData?.itsukiAI === true ||
			groupData?.itsuki === true
		);

		const replyToItsuki = isReplyToItsuki(m, db);
		const hasTrigger = isItsukiTrigger(text);

		// Di grup: hanya merespon jika fitur aktif DAN (ada trigger nama Itsuki ATAU reply chat AI Itsuki)
		if (isGroup) {
			// Izinkan owner mengaktifkan/menonaktifkan Itsuki AI secara langsung
			if (isUserOwner(m) && /^(itsuki|eatsuki)\s+(on|enable|aktifkan|1)$/i.test(text)) {
				db.groups[m.chat].itsukiAI ??= { enable: false };
				db.groups[m.chat].itsukiAI.enable = true;
				global._dbDirty = true;
				console.log(chalk.redBright('⭐ [ITSUKI AI]'), chalk.greenBright(`Itsuki AI diaktifkan di grup ${m.chat} oleh Shiro-sama!`));
				return m.reply('⭐ *Itsuki Nakano AI diaktifkan oleh Shiro-sama!* 🥟✨\n\nKamu bisa mengajak Itsuki mengobrol dengan mengetik:\n• itsuki <pesanmu>\n• hai itsuki <pesanmu>\n• halo/pagi/siang/malam itsuki\n• eatsuki <pesanmu>\n\nAtau reply langsung pesan Itsuki untuk melanjutkan obrolan ⭐🥟');
			}
			if (isUserOwner(m) && /^(itsuki|eatsuki)\s+(off|disable|matikan|0)$/i.test(text)) {
				db.groups[m.chat].itsukiAI ??= { enable: false };
				db.groups[m.chat].itsukiAI.enable = false;
				global._dbDirty = true;
				console.log(chalk.redBright('⭐ [ITSUKI AI]'), chalk.yellowBright(`Itsuki AI dinonaktifkan di grup ${m.chat} oleh Shiro-sama`));
				return m.reply('🔴 *Itsuki Nakano AI dinonaktifkan.* Aku mau lanjut belajar dulu ya~ ⭐📖');
			}

			if (!isEnabledInGroup) {
				if (hasTrigger || replyToItsuki) {
					console.log(chalk.redBright('⭐ [ITSUKI AI]'), chalk.yellow(`Pesan terdeteksi di grup ${m.chat} tetapi Itsuki AI belum diaktifkan (Gunakan: .itsuki on)`));
				}
				return;
			}
			if (!hasTrigger && !replyToItsuki) return;
		} else {
			// Di private chat: respon jika ada trigger nama Itsuki atau reply chat AI Itsuki
			if (!hasTrigger && !replyToItsuki) return;
		}

		// 3. Jangan proses jika pesan adalah command bot dengan prefix lain
		const listprefix = global.listprefix || ['.', '!', '+', '/'];
		const isPrefixCmd = listprefix.some(p => text.startsWith(p));
		const isDirectItsukiCmd = /^[.!\/+](itsuki|itsukiai|eatsuki|nakano)\b/i.test(text);
		if (isPrefixCmd && !isDirectItsukiCmd) return;

		// 4. Identifikasi user & status owner
		const isOwner = isUserOwner(m);

		// Handler Relasi Khusus dari Owner (Shiro-sama)
		if (isOwner) {
			const relationIntent = parseOwnerItsukiRelationIntent(text, m.mentionedJid || [], m.quoted?.sender);
			if (relationIntent) {
				const targetNum = (relationIntent.targetJid || '').split('@')[0];
				const targetName = global.db?.users?.[relationIntent.targetJid]?.name || `@${targetNum}`;

				if (relationIntent.action === 'set') {
					setItsukiRelationship(db, relationIntent.targetJid, {
						role: relationIntent.role,
						targetName: targetName,
						note: `Disetujui oleh Shiro-sama pada ${new Date().toLocaleDateString('id-ID')}`
					});

					const roleDesc = relationIntent.role;
					const replyText = `(tersipu malu sambil merapikan jepit bintang) B-Baiklah Shiro-sama... Jika ini adalah arahan dari Anda, mulai sekarang aku akan memperlakukan @${targetNum} sebagai *${roleDesc}* ku. Semoga aku bisa belajar menjadi pasangan yang baik dan tidak membuatnya repot ⭐🥟💕`;

					console.log(chalk.magentaBright('⭐ [ITSUKI AI - RELASI DITETAPKAN]'), chalk.greenBright(`Target: ${targetNum} sebagai ${relationIntent.role}`));
					await naze.sendPresenceUpdate?.('composing', m.chat);
					await sleep(1000);
					const sentRel = await naze.sendMessage(m.chat, {
						text: replyText,
						mentions: [relationIntent.targetJid, m.sender]
					}, { quoted: m });
					if (sentRel?.key?.id) {
						recordItsukiSentMessage(sentRel.key.id, replyText);
					}
					return;
				} else if (relationIntent.action === 'delete') {
					removeItsukiRelationship(db, relationIntent.targetJid);
					const replyText = `(mengangguk sopan) Baik Shiro-sama, status relasi khusus dengan @${targetNum} telah kuhapus sesuai instruksi Anda. Sekarang kami berteman biasa ⭐`;

					console.log(chalk.magentaBright('⭐ [ITSUKI AI - RELASI DIHAPUS]'), chalk.yellowBright(`Target: ${targetNum}`));
					await naze.sendPresenceUpdate?.('composing', m.chat);
					await sleep(1000);
					const sentDel = await naze.sendMessage(m.chat, {
						text: replyText,
						mentions: [relationIntent.targetJid]
					}, { quoted: m });
					if (sentDel?.key?.id) {
						recordItsukiSentMessage(sentDel.key.id, replyText);
					}
					return;
				}
			}
		}

		// 5. Cooldown per user (2.5 detik)
		const cooldownKey = `${m.chat}:${m.sender}`;
		if (!checkItsukiCooldown(cooldownKey, 2500)) return;

		// 6. Bersihkan teks dari nama trigger
		let cleanText = replyToItsuki && !hasTrigger
			? text
			: cleanItsukiMessage(text);

		if (isDirectItsukiCmd) {
			cleanText = text.replace(/^[.!\/+](itsuki|itsukiai|eatsuki|nakano)\s*/i, '').trim() || 'Halo Itsuki';
		}

		if (!cleanText || cleanText.trim().length === 0) {
			cleanText = text.trim() || 'Halo Itsuki';
		}

		// 7. Cek relasi khusus pengguna
		const relationship = isOwner ? null : getItsukiRelationship(db, m.sender);
		const allRelationships = listItsukiRelationships(db);

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
			const targetRel = getItsukiRelationship(db, jid);
			const targetName = global.db?.users?.[jid]?.name || targetRel?.targetName || `@${cleanNum}`;
			mentionedEntities.push({
				jid,
				number: cleanNum,
				name: targetName,
				relationship: targetRel ? targetRel.role : null
			});
		}

		// Log proses eksekusi AI mirip Mahiru AI
		let userName = m.pushName || (isOwner ? 'Shiro-sama' : 'Teman');
		if (isOwner) {
			userName = 'Shiro-sama';
		}
		const relTag = relationship ? ` [Relasi: ${relationship.role}]` : '';
		console.log(chalk.redBright('⭐ [ITSUKI AI]'), chalk.cyanBright(`Memproses pesan dari ${userName}${relTag} (${(m.sender || '').split('@')[0]}) di ${isGroup ? (m.metadata?.subject || 'Grup') : 'Private Chat'}:`), chalk.yellow(`"${cleanText}"`));

		// 8. Ambil Memori Riwayat Chat
		const memKey = `${m.chat}:${m.sender}`;
		const history = getItsukiMemory(db, memKey);

		// Simpan pesan user ke memori
		addItsukiMessage(db, memKey, 'user', cleanText);

		// 9. Bangun prompt karakter Itsuki Nakano
		const timeOfDay = getTimeOfDay();

		const systemPrompt = buildItsukiPrompt({
			userName,
			isOwner,
			relationship,
			allRelationships,
			mentionedEntities,
			timeOfDay
		});

		// 10. Kirim typing presence ke WA
		await sendItsukiTyping(naze, m.chat);

		// Natural delay (1.0 - 2.0 detik)
		const randomDelay = Math.floor(Math.random() * 800) + 800;
		await sleep(randomDelay);

		// 11. Format pesan untuk AI Scraper
		const messagesForAI = [
			...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
			{ role: 'user', content: cleanText }
		];

		// 12. Scrape respon AI Itsuki Nakano
		const itsukiReply = await scrapeItsukiChat(messagesForAI, systemPrompt, {
			userName,
			isOwner,
			relationship,
			allRelationships,
			mentionedEntities
		});

		if (!itsukiReply || typeof itsukiReply !== 'string' || itsukiReply.trim().length === 0) {
			console.warn(chalk.yellow('[ITSUKI AI] Respon scraper kosong, mengabaikan'));
			return;
		}

		// 13. Simpan balasan bot ke memori
		addItsukiMessage(db, memKey, 'assistant', itsukiReply);

		// 14. Kumpulkan mentions jika ada
		const replyMentions = [];
		for (const entity of mentionedEntities) {
			if (entity.jid && !replyMentions.includes(entity.jid)) {
				replyMentions.push(entity.jid);
			}
		}
		const replyNumMatches = itsukiReply.matchAll(/@?(\d{8,16})/g);
		for (const match of replyNumMatches) {
			const jid = `${match[1]}@s.whatsapp.net`;
			if (!replyMentions.includes(jid)) {
				replyMentions.push(jid);
			}
		}

		// 15. Balas ke chat
		console.log(chalk.redBright('⭐ [ITSUKI AI]'), chalk.greenBright(`Berhasil membalas ke ${m.chat}:`), chalk.white(itsukiReply.slice(0, 50) + '...'));

		let sentMsg = null;
		if (replyMentions.length > 0 && naze?.sendMessage) {
			sentMsg = await naze.sendMessage(m.chat, {
				text: itsukiReply,
				mentions: replyMentions
			}, { quoted: m });
		} else {
			sentMsg = await m.reply(itsukiReply);
		}

		if (sentMsg?.key?.id) {
			recordItsukiSentMessage(sentMsg.key.id, itsukiReply);
		} else {
			recordItsukiSentMessage(null, itsukiReply);
		}

	} catch (err) {
		console.error(chalk.redBright('[ITSUKI AI Error]:'), err.message || err);
	}
}

export { clearItsukiMemory };
export default itsukiAI;
