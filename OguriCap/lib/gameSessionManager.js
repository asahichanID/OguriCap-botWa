import { jidNormalizedUser } from 'baileys';
import { normalizeAnswer, similarity, levenshtein } from './function.js';
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
 * Pembersih kata awalan/akhiran obrolan santai
 */
function cleanGuessText(raw) {
	if (!raw) return '';
	return String(raw)
		.replace(/^[.!#/$%^&+=~]+/, '')
		.replace(/^(jawab(annya)?|jwb|pasti|mungkin|kayaknya|keknya|tebak(an)?|itu|adalah|pilih)\s*[:=-]?\s*/i, '')
		.replace(/\s*(kak|bang|min|bot|deh|dong|kan|sih|ya|nih|lah|keknya|kali)$/i, '')
		.trim();
}

/**
 * Pembersih kata penggolong / kategori awalan umum (misal: "negara sri lanka" -> "sri lanka")
 */
function stripCategoryFiller(text) {
	if (!text) return '';
	return text.replace(/^(negara|provinsi|kota|kabupaten|desa|pulau|benua|hewan|binatang|ikan|burung|buah|kue|makanan|minuman|bunga|warna|alat|kendaraan|olahraga)\s+/i, '').trim();
}

/**
 * Pembersih imbuhan awalan/akhiran kata kerja bahasa Indonesia
 */
function stripIndonesianAffixes(word) {
	if (!word || word.length < 5) return word;
	return word
		.replace(/^(meng|meny|mem|me|ber|ter|di|pe|peng|peny|pem|se)/, '')
		.replace(/(kan|an|i)$/, '');
}

/**
 * Normalisasi fonetik ringan bahasa Indonesia
 * Mengatasi variasi ejaan umum seperti sri langka <-> srilangka, ikhlas <-> iklas, dll
 */
const phoneticIndo = s => s
	.replace(/ngk/g, 'nk')
	.replace(/kh/g, 'k')
	.replace(/sy/g, 's')
	.replace(/sh/g, 's')
	.replace(/ch/g, 'c')
	.replace(/v/g, 'f')
	.replace(/z/g, 'j')
	.replace(/(.)\1+/g, '$1');

/**
 * Pencocokan cerdas jawaban Family 100
 * Menangani toleransi spasi ("sri lanka" vs "srilangka"), variasi fonetik (ngk vs nk),
 * kata penggolong kategori ("negara sri lanka"), tanda kurung penjelasan, imbuhan kata,
 * serta kata kunci yang relevan/nyambung tanpa melenceng jauh.
 * @param {string} userGuess - Tebakan user
 * @param {string} targetAnswer - Kunci jawaban dari survei Family 100
 * @returns {boolean}
 */
export function isFamily100Match(userGuess, targetAnswer) {
	if (!userGuess || !targetAnswer) return false;

	const rawG = cleanGuessText(userGuess);
	const normG = normalizeAnswer(rawG);
	const strippedG = stripCategoryFiller(normG);
	const guessVariants = [normG, strippedG].filter(Boolean);

	// Bongkar variasi target jika terdapat penjelasan di dalam tanda kurung
	const targets = [targetAnswer];
	const bracketMatch = String(targetAnswer).match(/\(([^)]+)\)/);
	if (bracketMatch) targets.push(bracketMatch[1]);
	const noBracket = String(targetAnswer).replace(/\([^)]*\)/g, '').trim();
	if (noBracket && noBracket !== targetAnswer) targets.push(noBracket);

	for (const t of targets) {
		const tNorm = normalizeAnswer(t);
		const tStripped = stripCategoryFiller(tNorm);
		const targetVariants = [tNorm, tStripped].filter(Boolean);

		for (const g of guessVariants) {
			for (const tar of targetVariants) {
				// 1. Exact match
				if (g === tar) return true;

				// 2. Exact match tanpa spasi (misal "sri lanka" vs "srilangka", "sepak bola" vs "sepakbola")
				const gNoSpace = g.replace(/\s+/g, '');
				const tarNoSpace = tar.replace(/\s+/g, '');
				if (gNoSpace === tarNoSpace) return true;

				// 3. Normalisasi fonetik Indonesia (ngk <-> nk, srilangka <-> sri lanka, dll)
				if (phoneticIndo(gNoSpace) === phoneticIndo(tarNoSpace)) return true;

				// 4. Jarak Levenshtein pada no-space (mengatasi spasi + typo/variasi 1-2 huruf)
				const distNoSpace = levenshtein(gNoSpace, tarNoSpace);
				const maxLenNoSpace = Math.max(gNoSpace.length, tarNoSpace.length);
				const simNoSpace = similarity(gNoSpace, tarNoSpace);

				// Beda 1 huruf untuk kata >= 4 huruf (srilanka vs srilangka, singapur vs singapura)
				if (distNoSpace <= 1 && maxLenNoSpace >= 4) return true;
				// Beda 2 huruf untuk kata >= 6 huruf dengan sim >= 0.72
				if (distNoSpace <= 2 && maxLenNoSpace >= 6 && simNoSpace >= 0.72) return true;
				if (simNoSpace >= 0.75) return true;

				// 5. Similarity normal dengan spasi
				const sim = similarity(g, tar);
				if (sim >= 0.72) return true;

				// 6. Word-based token matching (kata-kata kunci cocok)
				const gWords = g.split(' ').filter(w => w.length >= 3);
				const tarWords = tar.split(' ').filter(w => w.length >= 3);

				// Jika tebakan mengandung kata kunci utama di target (panjang >= 4)
				const hasMajorWord = gWords.some(gw => gw.length >= 4 && tarWords.some(tw => tw === gw || phoneticIndo(tw) === phoneticIndo(gw) || similarity(gw, tw) >= 0.8));
				if (hasMajorWord && (gWords.length === 1 || tarWords.length <= 3)) return true;

				// Kecocokan bentuk dasar / kata imbuhan (contoh: "mencuci piring" vs "cuci piring")
				const gRoot = gWords.map(stripIndonesianAffixes).join(' ');
				const tarRoot = tarWords.map(stripIndonesianAffixes).join(' ');
				if (gRoot && tarRoot && gRoot === tarRoot) return true;

				// 7. Substring overlap untuk kata majemuk / frasa relevan
				if (gNoSpace.length >= 4 && tarNoSpace.length >= 4) {
					if (gNoSpace.includes(tarNoSpace) || tarNoSpace.includes(gNoSpace)) {
						const ratio = Math.min(gNoSpace.length, tarNoSpace.length) / Math.max(gNoSpace.length, tarNoSpace.length);
						if (ratio >= 0.45) return true;
					}
				}
			}
		}
	}

	return false;
}

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

	// Cek Family 100 secara komprehensif
	if (g.family100 && typeof g.family100 === 'object') {
		const fKeys = Object.keys(g.family100);
		for (const fk of fKeys) {
			if (
				fk === chatId ||
				fk === normChat ||
				fk.startsWith(chatId) ||
				fk.startsWith(normChat) ||
				(cleanChat && fk.includes(cleanChat)) ||
				g.family100[fk]?.chat === chatId ||
				g.family100[fk]?.chat === normChat
			) {
				return true;
			}
		}
	}

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

		// Toleransi no-space typo (misal kata majemuk / ejaan 1 huruf k/g)
		const distNoSpace = levenshtein(guessNoSpace, targetNoSpace);
		if (distNoSpace <= 1 && Math.max(guessNoSpace.length, targetNoSpace.length) >= 4) return true;
		const simNoSpace = similarity(guessNoSpace, targetNoSpace);
		if (simNoSpace >= 0.78) return true;

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
	const famObj = db.game?.family100 || global.db?.game?.family100;
	if (famObj && typeof famObj === 'object') {
		const famKey = Object.keys(famObj).find(k => (
			k === m.chat ||
			k === normChat ||
			k.startsWith(m.chat) ||
			k.startsWith(normChat) ||
			(cleanChat && k.includes(cleanChat)) ||
			famObj[k]?.chat === m.chat ||
			famObj[k]?.chat === normChat
		));

		if (famKey && famObj[famKey]) {
			const room = famObj[famKey];
			
			// Deteksi menyerah yang fleksibel (.nyerah, nyerah, surrender, aku nyerah, dll)
			let isSurender = false;
			for (const cand of guessCandidates) {
				const cStr = String(cand).trim().toLowerCase();
				const cClean = cStr.replace(/^[.!#/$%^&+=~]+/, '').trim();
				if (
					/^((me)?nyerah|surr?ender)(\s+(lah|dong|deh|aja|min|bot|dah|udah|wis))?$/i.test(cClean) ||
					/^(aku|kita|kami|saya|gw|gua)\s+((me)?nyerah|surr?ender)$/i.test(cClean)
				) {
					isSurender = true;
					break;
				}
			}

			let index = -1;

			if (!isSurender && Array.isArray(room.jawaban)) {
				// Cari terlebih dahulu di antara jawaban yang BELUM terjawab dengan pencocokan cerdas isFamily100Match
				for (const cand of guessCandidates) {
					const foundIdx = room.jawaban.findIndex((v, idx) => {
						if (room.terjawab[idx]) return false; // Abaikan yang sudah terjawab
						return isFamily100Match(cand, v);
					});
					if (foundIdx !== -1) {
						index = foundIdx;
						break;
					}
				}
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
				const terjawabCount = room.terjawab.filter(v => v).length;

				const listJawaban = room.jawaban.map((jawaban, idx) => {
					if (room.terjawab[idx]) {
						return `├  ${idx + 1}. *${jawaban}* (@${room.terjawab[idx].split('@')[0]}) ✅`;
					}
					return `├  ${idx + 1}. ${isSurender ? `*${jawaban}* (Terbuka)` : '• • • • • • • • • •'}`;
				}).join('\n');

				let caption =
`╭─❖「 🎮 𝐅𝐀𝐌𝐈𝐋𝐘 𝟏𝟎𝟎 🌸 」
│
├ 📜 *Survei:* ${room.soal}
│
├ 📊 *Progress:* ${terjawabCount} dari ${room.jawaban.length} Terjawab
│
${listJawaban}
│
├ 🎁 *Reward:* ${isSurender ? '🏳️ *Sesi Berakhir (Menyerah)*' : isWin ? '🏆 *SEMUA JAWABAN TERTEBAK!* Game Selesai.' : `+3.499 Money & +${bonusExpFam} EXP`}
╰─────────────❖`;

				if (isWin || isSurender) {
					if (room.timer) {
						try { clearTimeout(room.timer); } catch {}
					}
					delete famObj[famKey];
					if (global.db?.game?.family100) {
						delete global.db.game.family100[famKey];
						delete global.db.game.family100[m.chat];
						delete global.db.game.family100[normChat];
					}
					if (db.game?.family100) {
						delete db.game.family100[famKey];
						delete db.game.family100[m.chat];
						delete db.game.family100[normChat];
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
