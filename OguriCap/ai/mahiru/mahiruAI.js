/**
 * OguriCap/ai/mahiru/mahiruAI.js
 * -----------------------------------------------------------------------
 * Handler Asisten Mahiru Shiina AI (The Angel Next Door).
 * 
 * Menggunakan arsitektur AI Engine terpusat:
 * - Scraper fleksibel tanpa hardcode karakter
 * - Memori percakapan terisolasi dan fleksibel
 * - Relasi permanen berbasis relationship.json
 */

import chalk from 'chalk';
import { buildMahiruPrompt } from './prompt.js';
import { isMahiruTrigger, mahiruTrigger } from './trigger.js';
import {
	getMahiruRelationship,
	setMahiruRelationship,
	removeMahiruRelationship,
	listMahiruRelationships,
	parseOwnerRelationIntent
} from './relationship.js';

import {
	callAiModel,
	getMemory,
	addMessage,
	clearMemory,
	recordSentMessage,
	isReplyToAssistant,
	formatHistoryForModel,
	checkCooldown,
	cleanTriggerFromText,
	getTimeOfDay,
	sendTyping,
	sleep,
	isUserOwner,
	extractMentionedEntities
} from '../aiengine/index.js';

import { isBotSentMessage } from '../../src/botGuard.js';

const ASSISTANT_ID = 'mahiru';

/**
 * Mengambil konfigurasi model untuk Mahiru AI
 */
function getMahiruConfig() {
	const conf = global.mahiruAI || {};
	const apiUrl = (conf.apiUrl || global.mahiruApiUrl || global.mahiruUrl || '').trim();
	const apiKey = (conf.apiKey || global.mahiruApiKey || '').trim();
	const customModel = (conf.customModel || conf.model || global.mahiruModel || 'gpt-4o-mini').trim();
	const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || conf.geminiKey || global.mahiruGeminiKey || global.geminiKey || '').trim();
	const geminiModel = (conf.geminiModel || global.mahiruGeminiModel || 'gemini-2.5-flash').trim();

	return {
		apiUrl,
		apiKey,
		customModel,
		geminiKey,
		geminiModel,
		timeoutMs: 12000,
		temperature: 0.8
	};
}

/**
 * Handler utama Mahiru AI untuk dipanggil pada setiap pesan masuk WhatsApp
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

		// Hindari loop jika pesan adalah pesan otomatis dari bot
		if (isBotSentMessage(m.id || m.key?.id)) return;

		const text = (typeof m.text === 'string' ? m.text : m.body || '').trim();
		if (!text) return;

		// 2. Cek status grup & trigger
		const isGroup = Boolean(m.isGroup);
		const groupData = isGroup && db?.groups ? db.groups[m.chat] : (global.db?.groups?.[m.chat] || null);

		const isEnabledInGroup = Boolean(
			groupData?.mahiruAI?.enable === true ||
			groupData?.mahiruAI === true ||
			groupData?.oguriAI?.enable === true ||
			groupData?.oguriAI === true
		);

		// Periksa apakah pesan mereply chat Mahiru
		const replyToMahiru = isReplyToAssistant({ assistantId: ASSISTANT_ID, m, db });
		const hasTrigger = isMahiruTrigger(text);

		if (isGroup) {
			if (!isEnabledInGroup) return;
			if (!hasTrigger && !replyToMahiru) return;
		} else {
			if (!hasTrigger && !replyToMahiru) return;
		}

		// 3. Filter command prefix (kecuali pesan eksplisit command .mahiru)
		const listprefix = global.listprefix || ['.', '!', '+', '/'];
		const isPrefixCmd = listprefix.some(p => text.startsWith(p));
		const isDirectCmd = /^[.!\/+](mahiru|mahiruai|tenshi|oguriai)\b/i.test(text);
		if (isPrefixCmd && !isDirectCmd) return;

		// 4. Identifikasi owner & cek instruksi penetapan relasi natural
		const isOwner = isUserOwner(m);

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

					console.log(chalk.magentaBright('🌸 [MAHIRU AI - RELASI DITETAPKAN]'), chalk.greenBright(`Target: ${targetNum} sebagai ${relationIntent.role} atas izin Shiro-sama (Permanen ke JSON)`));
					await sendTyping(naze, m.chat);
					await sleep(1200);
					const sentRel = await naze.sendMessage(m.chat, {
						text: replyText,
						mentions: [relationIntent.targetJid, m.sender]
					}, { quoted: m });

					if (sentRel?.key?.id) {
						recordSentMessage({ assistantId: ASSISTANT_ID, messageId: sentRel.key.id, text: replyText });
					}
					return;
				} else if (relationIntent.action === 'remove') {
					removeMahiruRelationship(db, relationIntent.targetJid);
					const replyText = `Baik, Shiro-sama. Status hubungan khusus dengan @${targetNum} telah Mahiru hapus sesuai arahan Shiro-sama. Sekarang Mahiru akan memperlakukannya seperti teman biasa. 🌸`;

					console.log(chalk.magentaBright('🌸 [MAHIRU AI - RELASI DIHAPUS]'), chalk.yellowBright(`Target: ${targetNum} dihapus atas arahan Shiro-sama`));
					await sendTyping(naze, m.chat);
					await sleep(1000);
					const sentDel = await naze.sendMessage(m.chat, {
						text: replyText,
						mentions: [relationIntent.targetJid]
					}, { quoted: m });

					if (sentDel?.key?.id) {
						recordSentMessage({ assistantId: ASSISTANT_ID, messageId: sentDel.key.id, text: replyText });
					}
					return;
				}
			}
		}

		// 5. Cooldown interaksi (2.5 detik)
		const cooldownKey = `${ASSISTANT_ID}:${m.chat}:${m.sender}`;
		if (!checkCooldown(cooldownKey, 2500)) return;

		// 6. Bersihkan teks pesan dari nama trigger
		let cleanText = replyToMahiru && !hasTrigger
			? text
			: cleanTriggerFromText(text, mahiruTrigger);

		if (isDirectCmd) {
			cleanText = text.replace(/^[.!\/+](mahiru|mahiruai|tenshi|oguriai)\s*/i, '').trim() || 'Halo Mahiru';
		}

		if (!cleanText || cleanText.trim().length === 0) {
			cleanText = text.trim() || 'Halo Mahiru';
		}

		// 7. Ambil relasi pengguna & kumpulkan data entitas yang dimention
		const relationship = isOwner ? null : getMahiruRelationship(db, m.sender);
		const allRelationships = listMahiruRelationships(db);
		const mentionedEntities = extractMentionedEntities(m, text, (jid) => getMahiruRelationship(db, jid));

		let userName = m.pushName || (isOwner ? 'Shiro-sama' : 'Teman');
		if (isOwner) userName = 'Shiro-sama';

		const relTag = relationship ? ` [Relasi: ${relationship.role}]` : '';
		console.log(chalk.magentaBright('🌸 [MAHIRU AI]'), chalk.cyanBright(`Memproses pesan dari ${userName}${relTag} (${(m.sender || '').split('@')[0]}):`), chalk.yellow(`"${cleanText}"`));

		// 8. Ambil riwayat memori percakapan
		const memKey = `${m.chat}:${m.sender}`;
		const history = getMemory({ assistantId: ASSISTANT_ID, sessionKey: memKey, db });

		// Simpan pesan user ke memori
		addMessage({ assistantId: ASSISTANT_ID, sessionKey: memKey, role: 'user', content: cleanText, db });

		// 9. Bangun prompt Mahiru
		const timeOfDay = getTimeOfDay();
		const systemPrompt = buildMahiruPrompt({
			userName,
			isOwner,
			relationship,
			allRelationships,
			mentionedEntities,
			timeOfDay
		});

		// 10. Indikator mengetik & jeda alami
		await sendTyping(naze, m.chat);
		const randomDelay = Math.floor(Math.random() * 800) + 900;
		await sleep(randomDelay);

		// 11. Format pesan & panggil AI Scraper Engine
		const messagesForAI = [
			...formatHistoryForModel(history, 6),
			{ role: 'user', content: cleanText }
		];

		const config = getMahiruConfig();
		const mahiruReply = await callAiModel({
			messages: messagesForAI,
			systemPrompt,
			config,
			options: { maxParagraphs: 2 }
		});

		if (!mahiruReply || typeof mahiruReply !== 'string' || mahiruReply.trim().length === 0) {
			console.warn(chalk.yellow('[MAHIRU AI] Respon dari scraper kosong, mengabaikan'));
			return;
		}

		// 12. Simpan balasan Mahiru ke memori
		addMessage({ assistantId: ASSISTANT_ID, sessionKey: memKey, role: 'assistant', content: mahiruReply, db });

		// 13. Kumpulkan mention balasan
		const replyMentions = [];
		for (const entity of mentionedEntities) {
			if (entity.jid && !replyMentions.includes(entity.jid)) {
				replyMentions.push(entity.jid);
			}
		}
		const replyNumMatches = mahiruReply.matchAll(/@?(\d{8,16})/g);
		for (const match of replyNumMatches) {
			const jid = `${match[1]}@s.whatsapp.net`;
			if (!replyMentions.includes(jid)) {
				replyMentions.push(jid);
			}
		}

		// 14. Kirim balasan ke WhatsApp
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
			recordSentMessage({ assistantId: ASSISTANT_ID, messageId: sentMsg.key.id, text: mahiruReply });
		} else {
			recordSentMessage({ assistantId: ASSISTANT_ID, messageId: '', text: mahiruReply });
		}

	} catch (err) {
		console.error(chalk.redBright('[MAHIRU AI Error]:'), err.message || err);
	}
}

/**
 * Helper fungsi clear memory untuk Mahiru
 */
export function clearMahiruMemory(db, sessionKey) {
	clearMemory({ assistantId: ASSISTANT_ID, sessionKey, db });
}

export { clearMahiruMemory as clearMemory };
export default mahiruAI;
