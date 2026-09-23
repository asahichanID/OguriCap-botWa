/**
 * OguriCap/ai/itsuki/itsukiAI.js
 * -----------------------------------------------------------------------
 * Handler Asisten Itsuki Nakano AI (The Quintessential Quintuplets).
 * 
 * Menggunakan arsitektur AI Engine terpusat:
 * - Scraper fleksibel tanpa hardcode karakter
 * - Memori percakapan terisolasi dan fleksibel
 * - Relasi permanen berbasis relationship.json
 */

import chalk from 'chalk';
import { buildItsukiPrompt } from './prompt.js';
import { isItsukiTrigger, itsukiTrigger } from './trigger.js';
import {
	getItsukiRelationship,
	setItsukiRelationship,
	removeItsukiRelationship,
	listItsukiRelationships,
	parseOwnerItsukiRelationIntent
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

const ASSISTANT_ID = 'itsuki';

/**
 * Mengambil konfigurasi model untuk Itsuki AI
 */
function getItsukiConfig() {
	const conf = global.itsukiAI || {};
	const apiUrl = (conf.apiUrl || global.itsukiApiUrl || global.itsukiUrl || '').trim();
	const apiKey = (conf.apiKey || global.itsukiApiKey || '').trim();
	const customModel = (conf.customModel || conf.model || global.itsukiModel || 'gpt-4o-mini').trim();
	const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || conf.geminiKey || global.itsukiGeminiKey || global.geminiKey || '').trim();
	const geminiModel = (conf.geminiModel || global.itsukiGeminiModel || 'gemini-2.5-flash').trim();

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
 * Handler utama Itsuki Nakano AI untuk dipanggil pada setiap pesan masuk WhatsApp
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

		// Hindari loop jika pesan adalah pesan otomatis dari bot
		if (isBotSentMessage(m.id || m.key?.id)) return;

		const text = (typeof m.text === 'string' ? m.text : m.body || '').trim();
		if (!text) return;

		// 2. Cek status grup & trigger
		const isGroup = Boolean(m.isGroup);
		const groupData = isGroup && db?.groups ? db.groups[m.chat] : (global.db?.groups?.[m.chat] || null);

		const isEnabledInGroup = Boolean(
			groupData?.itsukiAI?.enable === true ||
			groupData?.itsukiAI === true
		);

		// Periksa apakah pesan mereply chat Itsuki
		const replyToItsuki = isReplyToAssistant({ assistantId: ASSISTANT_ID, m, db });
		const hasTrigger = isItsukiTrigger(text);

		if (isGroup) {
			if (!isEnabledInGroup) return;
			if (!hasTrigger && !replyToItsuki) return;
		} else {
			if (!hasTrigger && !replyToItsuki) return;
		}

		// 3. Filter command prefix (kecuali pesan eksplisit command .itsuki)
		const listprefix = global.listprefix || ['.', '!', '+', '/'];
		const isPrefixCmd = listprefix.some(p => text.startsWith(p));
		const isDirectCmd = /^[.!\/+](itsuki|itsukiai|eatsuki|nakano)\b/i.test(text);
		if (isPrefixCmd && !isDirectCmd) return;

		// 4. Identifikasi owner & cek instruksi penetapan relasi natural
		const isOwner = isUserOwner(m);

		if (isOwner) {
			const relationIntent = parseOwnerItsukiRelationIntent(text, m.mentionedJid, m.quoted?.sender);
			if (relationIntent) {
				const targetNum = (relationIntent.targetJid || '').split('@')[0];
				const targetName = global.db?.users?.[relationIntent.targetJid]?.name || `@${targetNum}`;

				if (relationIntent.action === 'set') {
					setItsukiRelationship(db, relationIntent.targetJid, {
						role: relationIntent.role,
						targetName: targetName,
						note: `Disetujui dan diperintahkan oleh Shiro-sama pada ${new Date().toLocaleDateString('id-ID')}`
					});

					const roleDesc = relationIntent.role === 'pacar' ? 'pacar' : relationIntent.role;
					const replyText = `(⁄ ⁄•⁄ω⁄•⁄ ⁄) E-Eh?! Shiro-sama...?! A-Apakah Anda bersungguh-sungguh...?\n\nB-Baiklah, jika itu adalah restu dari Shiro-sama... Mulai sekarang aku akan memperlakukan @${targetNum} sebagai *${roleDesc}*! Tapi ingat ya, kamu tetap harus belajar dengan rajin dan tidak boleh membuatku kelaparan! ⭐🥟💕`;

					console.log(chalk.yellowBright('⭐ [ITSUKI AI - RELASI DITETAPKAN]'), chalk.greenBright(`Target: ${targetNum} sebagai ${relationIntent.role} atas izin Shiro-sama (Permanen ke JSON)`));
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
					removeItsukiRelationship(db, relationIntent.targetJid);
					const replyText = `Baik, Shiro-sama. Status hubungan khusus dengan @${targetNum} telah aku hapus. Mulai sekarang aku akan memperlakukannya seperti teman biasa. ⭐`;

					console.log(chalk.yellowBright('⭐ [ITSUKI AI - RELASI DIHAPUS]'), chalk.yellowBright(`Target: ${targetNum} dihapus atas arahan Shiro-sama`));
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
		let cleanText = replyToItsuki && !hasTrigger
			? text
			: cleanTriggerFromText(text, itsukiTrigger);

		if (isDirectCmd) {
			cleanText = text.replace(/^[.!\/+](itsuki|itsukiai|eatsuki|nakano)\s*/i, '').trim() || 'Halo Itsuki';
		}

		if (!cleanText || cleanText.trim().length === 0) {
			cleanText = text.trim() || 'Halo Itsuki';
		}

		// 7. Ambil relasi pengguna & kumpulkan data entitas yang dimention
		const relationship = isOwner ? null : getItsukiRelationship(db, m.sender);
		const allRelationships = listItsukiRelationships(db);
		const mentionedEntities = extractMentionedEntities(m, text, (jid) => getItsukiRelationship(db, jid));

		let userName = m.pushName || (isOwner ? 'Shiro-sama' : 'Teman');
		if (isOwner) userName = 'Shiro-sama';

		const relTag = relationship ? ` [Relasi: ${relationship.role}]` : '';
		console.log(chalk.yellowBright('⭐ [ITSUKI AI]'), chalk.cyanBright(`Memproses pesan dari ${userName}${relTag} (${(m.sender || '').split('@')[0]}):`), chalk.yellow(`"${cleanText}"`));

		// 8. Ambil riwayat memori percakapan
		const memKey = `${m.chat}:${m.sender}`;
		const history = getMemory({ assistantId: ASSISTANT_ID, sessionKey: memKey, db });

		// Simpan pesan user ke memori
		addMessage({ assistantId: ASSISTANT_ID, sessionKey: memKey, role: 'user', content: cleanText, db });

		// 9. Bangun prompt Itsuki
		const timeOfDay = getTimeOfDay();
		const systemPrompt = buildItsukiPrompt({
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

		const config = getItsukiConfig();
		const itsukiReply = await callAiModel({
			messages: messagesForAI,
			systemPrompt,
			config,
			options: { maxParagraphs: 2 }
		});

		if (!itsukiReply || typeof itsukiReply !== 'string' || itsukiReply.trim().length === 0) {
			console.warn(chalk.yellow('[ITSUKI AI] Respon dari scraper kosong, mengabaikan'));
			return;
		}

		// 12. Simpan balasan Itsuki ke memori
		addMessage({ assistantId: ASSISTANT_ID, sessionKey: memKey, role: 'assistant', content: itsukiReply, db });

		// 13. Kumpulkan mention balasan
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

		// 14. Kirim balasan ke WhatsApp
		console.log(chalk.yellowBright('⭐ [ITSUKI AI]'), chalk.greenBright(`Berhasil membalas ke ${m.chat}:`), chalk.white(itsukiReply.slice(0, 50) + '...'));

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
			recordSentMessage({ assistantId: ASSISTANT_ID, messageId: sentMsg.key.id, text: itsukiReply });
		} else {
			recordSentMessage({ assistantId: ASSISTANT_ID, messageId: '', text: itsukiReply });
		}

	} catch (err) {
		console.error(chalk.redBright('[ITSUKI AI Error]:'), err.message || err);
	}
}

/**
 * Helper fungsi clear memory untuk Itsuki
 */
export function clearItsukiMemory(db, sessionKey) {
	clearMemory({ assistantId: ASSISTANT_ID, sessionKey, db });
}

export { clearItsukiMemory as clearMemory };
export default itsukiAI;
