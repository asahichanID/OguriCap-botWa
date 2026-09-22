import { jidNormalizedUser } from 'baileys';
import { normalizeAnswer, similarity } from './function.js';
import { getLevelInfo, generateBaseXP, addExp } from './xpGlobal.js';

export const TEXT_GAME_KEYS = [
	'tekateki',
	'tebaklirik',
	'tebakkata',
	'susunkata',
	'tebakkimia',
	'caklontong',
	'tebaknegara',
	'tebakgambar',
	'tebakbendera',
	'tebakangka',
	'tebaklagu'
];

/**
 * Cek apakah ada sesi game aktif di chat tertentu
 * @param {string} chatId - JID grup atau private chat
 * @returns {boolean}
 */
export function hasAnyActiveGame(chatId) {
	if (!chatId || !global.db?.game) return false;
	const g = global.db.game;
	const normChat = jidNormalizedUser(chatId);
	const cleanChat = String(chatId).split('@')[0].split(':')[0];

	// Cek Family 100
	if (g.family100 && (g.family100[chatId] || g.family100[normChat])) return true;

	for (const k of TEXT_GAME_KEYS) {
		const sessionObj = g[k];
		if (!sessionObj || typeof sessionObj !== 'object') continue;
		const keys = Object.keys(sessionObj);
		for (const key of keys) {
			if (
				key === chatId ||
				key === normChat ||
				key.startsWith(chatId) ||
				key.startsWith(normChat) ||
				(cleanChat && key.includes(cleanChat)) ||
				sessionObj[key]?.chat === chatId ||
				sessionObj[key]?.chat === normChat
			) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Normalisasi dan uji kecocokan jawaban tebakan
 * @param {string} userText - Teks tebakan pemain
 * @param {string} targetAnswer - Kunci jawaban game
 * @param {string} gameName - Nama jenis game
 * @returns {boolean}
 */
export function isAnswerCorrect(userText, targetAnswer, gameName = '') {
	if (!userText || !targetAnswer) return false;

	const rawTarget = String(targetAnswer).trim();
	const targetNorm = normalizeAnswer(rawTarget);
	if (!targetNorm) return false;
	const targetNoSpace = targetNorm.replace(/\s+/g, '');

	// Kumpulkan variasi tebakan user
	const cleanRaw = String(userText).trim();
	const noPrefix = cleanRaw.replace(/^[.!#/$%^&+=~]/, '').trim();
	const noPrefixAndLead = noPrefix.replace(/^(jawab(annya)?|jwb|itu|adalah|pilih|tebak)\s*[:=-]?\s*/i, '').trim();

	const candidates = [cleanRaw, noPrefix, noPrefixAndLead];

	for (const cand of candidates) {
		if (!cand) continue;
		const guessNorm = normalizeAnswer(cand);
		if (!guessNorm) continue;
		const guessNoSpace = guessNorm.replace(/\s+/g, '');

		// 1. Exact match normalisasi
		if (guessNorm === targetNorm) return true;

		// 2. Exact match tanpa spasi
		if (guessNoSpace && targetNoSpace && guessNoSpace === targetNoSpace) return true;

		// 3. Substring match jika cukup panjang (>= 4 karakter dan panjang mirip)
		if (targetNorm.length >= 4 && guessNorm.length >= 4) {
			if (guessNorm.includes(targetNorm) || targetNorm.includes(guessNorm)) {
				const lenRatio = Math.min(guessNorm.length, targetNorm.length) / Math.max(guessNorm.length, targetNorm.length);
				if (lenRatio >= 0.7) return true;
			}
		}

		// 4. Similarity Levenshtein dengan toleransi typo cerdas
		const sim = similarity(guessNorm, targetNorm);
		if (sim >= 0.75) return true;
		if (sim >= 0.65 && /tekateki|tebaklirik|tebaklagu|tebakkata|tebaknegara|tebakbendera|tebakgambar|susunkata|caklontong/.test(gameName)) {
			return true;
		}
	}

	return false;
}

/**
 * Handle jawaban game yang masuk
 * @param {object} params
 * @returns {Promise<boolean>} True jika jawaban berhasil diproses (benar), False jika tidak ada game / salah
 */
export async function handleIncomingGameAnswer({ naze, m, budy, body, db }) {
	if (!naze || !m || !db) return false;

	const normChat = jidNormalizedUser(m.chat);
	const cleanChat = String(m.chat).split('@')[0].split(':')[0];

	// Ekstrak teks tebakan pemain dari semua kemungkinan field
	const guessCandidates = [
		budy,
		body,
		m.text,
		m.body,
		m.msg?.text,
		m.msg?.caption,
		m.message?.conversation,
		m.message?.extendedTextMessage?.text,
		m.quoted?.text,
		m.quoted?.body
	].filter(t => typeof t === 'string' && t.trim().length > 0);

	if (guessCandidates.length === 0) return false;
	const primaryGuess = guessCandidates[0].trim();

	// 1. PEMERIKSAAN GAME TEKS STANDARD
	for (const gameName of TEXT_GAME_KEYS) {
		const gameObj = db.game?.[gameName];
		if (!gameObj || typeof gameObj !== 'object') continue;

		// Temukan sesi yang cocok untuk chat ini
		const sessionKeys = Object.keys(gameObj);
		let matchedSessionKey = null;
		let matchedSessionData = null;

		for (const sKey of sessionKeys) {
			const sData = gameObj[sKey];
			if (!sData) continue;

			const isMatch = (
				sKey === m.chat ||
				sKey === normChat ||
				sKey.startsWith(m.chat) ||
				sKey.startsWith(normChat) ||
				(cleanChat && sKey.includes(cleanChat)) ||
				sData.chat === m.chat ||
				sData.chat === normChat ||
				(m.quoted && (sKey.endsWith(m.quoted.id) || sData.id === m.quoted.id))
			);

			if (isMatch && sData.jawaban) {
				matchedSessionKey = sKey;
				matchedSessionData = sData;
				break;
			}
		}

		if (!matchedSessionKey || !matchedSessionData) continue;

		// Cek apakah ada di antara kandidat teks yang cocok
		let isCorrect = false;
		for (const cand of guessCandidates) {
			if (isAnswerCorrect(cand, matchedSessionData.jawaban, gameName)) {
				isCorrect = true;
				break;
			}
		}

		if (isCorrect) {
			// Berikan reward Money & EXP Global
			const baseMoney = gameName === 'caklontong' ? 9999 : gameName === 'tebaklirik' ? 4299 : gameName === 'susunkata' ? 2989 : 3499;
			db.users ??= {};
			db.users[m.sender] ??= { exp: 0, limit: 10, money: 1000 };

			db.users[m.sender].money = (db.users[m.sender].money || 0) + baseMoney;
			const userLevel = getLevelInfo(db.users[m.sender]?.exp || 0).level;
			const bonusExpGame = generateBaseXP(userLevel);
			addExp(db, m.sender, bonusExpGame, { naze, m });

			const answerText = matchedSessionData.jawaban;
			const descText = matchedSessionData.deskripsi ? `\n"${matchedSessionData.deskripsi}"` : '';
			const winText = `🎉 *JAWABAN BENAR!* 🎉\n\n👤 Pemenang: @${m.sender.split('@')[0]}\n💡 Jawaban: *${answerText}*${descText}\n💰 Hadiah Money: *+${baseMoney.toLocaleString('id-ID')}*\n🌟 Bonus EXP: *+${bonusExpGame.toLocaleString('id-ID')}*`;

			// Hapus sesi game agar tidak bisa dijawab ganda
			delete gameObj[matchedSessionKey];
			if (global.db?.game?.[gameName]) {
				delete global.db.game[gameName][matchedSessionKey];
			}

			// Kirim pesan kemenangan dengan mekanisme fallback anti-gagal
			try {
				await naze.sendMessage(m.chat, { text: winText, mentions: [m.sender] }, { quoted: m });
			} catch {
				try {
					await m.reply(winText);
				} catch {
					await naze.sendMessage(m.chat, { text: winText }).catch(() => {});
				}
			}

			return true;
		}

		// JIKA SALAH: Bot tetap diam (100% silent)
	}

	// 2. PEMERIKSAAN FAMILY 100
	const famObj = db.game?.family100;
	if (famObj && typeof famObj === 'object') {
		const famKey = Object.keys(famObj).find(k => k === m.chat || k === normChat || (cleanChat && k.includes(cleanChat)));
		if (famKey && famObj[famKey]) {
			const room = famObj[famKey];
			const teks = normalizeAnswer(primaryGuess);
			const isSurender = /^((me)?nyerah|surr?ender)$/i.test(teks);
			let index = -1;

			if (!isSurender && Array.isArray(room.jawaban)) {
				index = room.jawaban.findIndex(v => {
					const jNorm = normalizeAnswer(v);
					if (jNorm === teks) return true;
					if (jNorm.replace(/\s+/g, '') === teks.replace(/\s+/g, '')) return true;
					if (similarity(teks, jNorm) >= 0.8) return true;
					return false;
				});
			}

			if (isSurender || (index !== -1 && !room.terjawab[index])) {
				let bonusExpFam = 0;
				if (!isSurender) {
					room.terjawab[index] = m.sender;
					db.users ??= {};
					db.users[m.sender] ??= { exp: 0, limit: 10, money: 1000 };
					db.users[m.sender].money = (db.users[m.sender].money || 0) + 3499;
					const userLevel = getLevelInfo(db.users[m.sender]?.exp || 0).level;
					bonusExpFam = generateBaseXP(userLevel);
					addExp(db, m.sender, bonusExpFam, { naze, m });
				}

				const isWin = room.terjawab.length === room.terjawab.filter(v => v).length;
				let caption = `
🎮 *FAMILY 100* 🎮

📜 *Soal:* ${room.soal}

💡 *Terditeksi:* ${room.terjawab.filter(v => v).length} dari ${room.jawaban.length} Terjawab
${isSurender ? '\n🏳️ *Menyerah! Jawaban Terbuka:*' : ''}
${room.jawaban.map((jawaban, idx) => {
	return `(${idx + 1}) ${room.terjawab[idx] ? `${jawaban} (@${room.terjawab[idx].split('@')[0]})` : (isSurender ? jawaban : '.............')}`;
}).join('\n')}

${isSurender ? 'Game dibatalkan karena menyerah.' : isWin ? `🏆 *SEMUA JAWABAN TERTEBAK!* Game Selesai.` : `💰 +3.499 Money & 🌟 +${bonusExpFam} EXP tiap jawaban benar!`}`.trim();

				if (isWin || isSurender) {
					delete famObj[famKey];
					if (global.db?.game?.family100) {
						delete global.db.game.family100[famKey];
					}
				}

				const mentions = parseMention(caption);
				try {
					await naze.sendMessage(m.chat, { text: caption, mentions }, { quoted: m });
				} catch {
					await naze.sendMessage(m.chat, { text: caption }).catch(() => {});
				}

				return true;
			}
		}
	}

	return false;
}

function parseMention(text = '') {
	return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net');
}
