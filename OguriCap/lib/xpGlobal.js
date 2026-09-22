/**
 * SISTEM XP GLOBAL OGURI CAP
 * - Level awal dimulai dari Level 1 (bukan 0)
 * - Base XP random 5–50 dan scaling mengikuti level
 * - Level 1–5: 100 XP/level (5 level @ 100 XP = 500 XP untuk mencapai Level 6)
 * - Level 6–15: 200 XP/level (10 level @ 200 XP = 2000 XP -> kumulatif 2500 XP untuk mencapai Level 16)
 * - Level 16–25: 300 XP/level (10 level @ 300 XP = 3000 XP -> kumulatif 5500 XP untuk mencapai Level 26)
 * - Level 26+: 500 XP/level tanpa batas
 */

// Batas kumulatif XP untuk setiap bracket
// Level 1..5 (5 level @ 100 XP) -> 500 XP (mencapai Level 6)
const BRACKET_1_LEVELS = 5;
const BRACKET_1_XP_PER_LEVEL = 100;
const BRACKET_1_MAX_XP = BRACKET_1_LEVELS * BRACKET_1_XP_PER_LEVEL; // 500

// Level 6..15 (10 level @ 200 XP) -> 2000 XP -> kumulatif 2500 XP (mencapai Level 16)
const BRACKET_2_LEVELS = 10;
const BRACKET_2_XP_PER_LEVEL = 200;
const BRACKET_2_MAX_XP = BRACKET_1_MAX_XP + (BRACKET_2_LEVELS * BRACKET_2_XP_PER_LEVEL); // 2500

// Level 16..25 (10 level @ 300 XP) -> 3000 XP -> kumulatif 5500 XP (mencapai Level 26)
const BRACKET_3_LEVELS = 10;
const BRACKET_3_XP_PER_LEVEL = 300;
const BRACKET_3_MAX_XP = BRACKET_2_MAX_XP + (BRACKET_3_LEVELS * BRACKET_3_XP_PER_LEVEL); // 5500

// Level 26+ (500 XP per level tanpa batas)
const BRACKET_4_XP_PER_LEVEL = 500;

/**
 * Menghitung detail level berdasarkan total akumulasi XP
 * Level awal dimulai dari Level 1 (saat exp = 0).
 * @param {number} exp - Total akumulasi XP user
 * @returns {{ level: number, currentLevelExp: number, expNeededForNextLevel: number, progressPercent: number, totalExp: number }}
 */
export function getLevelInfo(exp = 0) {
    const totalExp = Math.max(0, Math.floor(Number(exp) || 0));

    if (totalExp < BRACKET_1_MAX_XP) {
        // Level 1 - 5
        const level = 1 + Math.floor(totalExp / BRACKET_1_XP_PER_LEVEL);
        const currentLevelExp = totalExp % BRACKET_1_XP_PER_LEVEL;
        const expNeededForNextLevel = BRACKET_1_XP_PER_LEVEL;
        const progressPercent = Math.min(100, Math.floor((currentLevelExp / expNeededForNextLevel) * 100));
        return { level, currentLevelExp, expNeededForNextLevel, progressPercent, totalExp };
    }

    if (totalExp < BRACKET_2_MAX_XP) {
        // Level 6 - 15
        const rem = totalExp - BRACKET_1_MAX_XP;
        const level = 6 + Math.floor(rem / BRACKET_2_XP_PER_LEVEL);
        const currentLevelExp = rem % BRACKET_2_XP_PER_LEVEL;
        const expNeededForNextLevel = BRACKET_2_XP_PER_LEVEL;
        const progressPercent = Math.min(100, Math.floor((currentLevelExp / expNeededForNextLevel) * 100));
        return { level, currentLevelExp, expNeededForNextLevel, progressPercent, totalExp };
    }

    if (totalExp < BRACKET_3_MAX_XP) {
        // Level 16 - 25
        const rem = totalExp - BRACKET_2_MAX_XP;
        const level = 16 + Math.floor(rem / BRACKET_3_XP_PER_LEVEL);
        const currentLevelExp = rem % BRACKET_3_XP_PER_LEVEL;
        const expNeededForNextLevel = BRACKET_3_XP_PER_LEVEL;
        const progressPercent = Math.min(100, Math.floor((currentLevelExp / expNeededForNextLevel) * 100));
        return { level, currentLevelExp, expNeededForNextLevel, progressPercent, totalExp };
    }

    // Level 26+
    const rem = totalExp - BRACKET_3_MAX_XP;
    const level = 26 + Math.floor(rem / BRACKET_4_XP_PER_LEVEL);
    const currentLevelExp = rem % BRACKET_4_XP_PER_LEVEL;
    const expNeededForNextLevel = BRACKET_4_XP_PER_LEVEL;
    const progressPercent = Math.min(100, Math.floor((currentLevelExp / expNeededForNextLevel) * 100));
    return { level, currentLevelExp, expNeededForNextLevel, progressPercent, totalExp };
}

/**
 * Base XP random 5-50 dan scaling mengikuti level agar semakin tinggi level,
 * pendapatan XP ikut meningkat secara wajar.
 * @param {number} level 
 * @returns {number}
 */
export function generateBaseXP(level = 1) {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    const raw = Math.floor(Math.random() * (50 - 5 + 1)) + 5; // 5 - 50
    // Scaling wajar: setiap level menambah 3% keuntungan XP (maksimal 300% pada level 100)
    const scale = 1 + (Math.min(safeLevel, 100) * 0.03);
    return Math.max(5, Math.round(raw * scale));
}

/**
 * Hitung XP Tebak Bom berdasarkan difficulty dan level pemain:
 * - Easy: base + 0 bonus
 * - Normal: base + random 2-13 bonus
 * - Extreme: base + random 15-87 bonus
 * @param {string} difficulty 
 * @param {number} level 
 * @returns {{ baseXp: number, bonusXp: number, totalXp: number, difficulty: string }}
 */
export function calculateTebakBomXP(difficulty = 'easy', level = 1) {
    const baseXp = generateBaseXP(level);
    let bonusXp = 0;
    const rawDiff = String(difficulty || '').toLowerCase();
    let normDiff = 'Easy';

    if (rawDiff === 'extreme' || rawDiff === 'ekstrem' || rawDiff === 'x') {
        normDiff = 'Extreme';
        bonusXp = Math.floor(Math.random() * (87 - 15 + 1)) + 15; // 15 - 87
    } else if (rawDiff === 'normal' || rawDiff === 'n') {
        normDiff = 'Normal';
        bonusXp = Math.floor(Math.random() * (13 - 2 + 1)) + 2; // 2 - 13
    } else {
        normDiff = 'Easy';
        bonusXp = 0; // Easy: 0 bonus
    }

    return {
        baseXp,
        bonusXp,
        totalXp: baseXp + bonusXp,
        difficulty: normDiff
    };
}

/**
 * Tambah XP ke user di database
 * @param {object} db 
 * @param {string} jid 
 * @param {number} amount 
 * @param {object} [opt] - { naze, m }
 * @returns {number}
 */
export function addExp(db, jid, amount, opt = {}) {
    if (!db || !db.users || !jid) return 0;
    if (!db.users[jid]) {
        db.users[jid] = { exp: 0 };
    }
    const gain = Math.max(0, Math.floor(Number(amount) || 0));
    const oldExp = Number(db.users[jid].exp) || 0;
    const newExp = oldExp + gain;
    db.users[jid].exp = newExp;
    global._dbDirty = true;

    if (opt && opt.naze) {
        checkAndNotifyLevelUp({
            naze: opt.naze,
            m: opt.m,
            db,
            jid,
            oldExp,
            newExp
        }).catch(() => {});
    }

    return gain;
}

/**
 * Format Pesan Notifikasi Level Up yang Elegan, Simple & Meriah
 * @param {object} params
 * @returns {string}
 */
export function formatLevelUpMessage({ jid, oldLevel, newLevel, totalExp, currentLevelExp, expNeededForNextLevel, progressPercent }) {
    const userTag = jid ? `@${jid.split('@')[0]}` : 'Trainer';
    return `🎉 *[ CONGRATULATIONS! LEVEL UP ]* 🎉\n` +
           `━━━━━━━━━━━━━━━━━━━━━━\n` +
           `Selamat ${userTag}, kamu berhasil naik level!\n\n` +
           `⚡ *Level:* Level ${oldLevel} ➔ *Level ${newLevel}*\n` +
           `🔮 *Total EXP:* ${totalExp.toLocaleString('id-ID')} XP\n` +
           `📊 *Next Level:* ${currentLevelExp.toLocaleString('id-ID')} / ${expNeededForNextLevel.toLocaleString('id-ID')} XP (${progressPercent}%)\n` +
           `━━━━━━━━━━━━━━━━━━━━━━\n` +
           `_Terus beraktivitas dan capai level tertinggi!_ ✨`;
}

/**
 * Cek dan kirim notifikasi Level Up jika level meningkat
 * @param {object} opt - { naze, m, db, jid, oldExp, newExp }
 * @returns {Promise<boolean>} - true jika terjadi level up dan notifikasi terkirim
 */
export async function checkAndNotifyLevelUp({ naze, m, db, jid, oldExp = 0, newExp = 0 }) {
    if (!naze || !jid) return false;
    const oldInfo = getLevelInfo(oldExp);
    const newInfo = getLevelInfo(newExp);

    if (newInfo.level > oldInfo.level) {
        const text = formatLevelUpMessage({
            jid,
            oldLevel: oldInfo.level,
            newLevel: newInfo.level,
            totalExp: newInfo.totalExp,
            currentLevelExp: newInfo.currentLevelExp,
            expNeededForNextLevel: newInfo.expNeededForNextLevel,
            progressPercent: newInfo.progressPercent
        });

        const targetChat = m?.chat || jid;
        try {
            await naze.sendMessage(targetChat, {
                text,
                mentions: [jid]
            }, m ? { quoted: m } : {});
        } catch {
            if (m && typeof m.reply === 'function') {
                await m.reply(text);
            }
        }
        return true;
    }
    return false;
}

/**
 * Memberikan XP di balik layar untuk setiap command yang valid (1-7 XP)
 * Hanya dicatat di log console tanpa output chat biasa, kecuali jika terjadi level up!
 * @param {object} opt - { db, jid, command, naze, m }
 * @returns {Promise<number>} - jumlah XP yang didapat
 */
export async function handleBackgroundCommandXp({ db, jid, command, naze, m }) {
    if (!db || !jid || !command) return 0;
    db.users ??= {};
    db.users[jid] ??= { exp: 0, limit: 10, money: 1000 };

    const oldExp = Number(db.users[jid].exp) || 0;
    // XP kecil random 1-7 per command
    const gainXp = Math.floor(Math.random() * 7) + 1; // 1 s/d 7
    const newExp = oldExp + gainXp;
    db.users[jid].exp = newExp;
    global._dbDirty = true;

    const oldLevel = getLevelInfo(oldExp).level;
    const newLevelInfo = getLevelInfo(newExp);

    // Log ke console terminal dibalik layar
    const senderName = (jid || '').split('@')[0];
    console.log(`\x1b[32m[XP-COMMAND]\x1b[0m +${gainXp} XP -> ${senderName} (cmd: .${command}) | Total: ${newExp} XP (Lvl ${newLevelInfo.level})`);

    // Jika naik level, kirim notifikasi congratulation yang bagus
    if (newLevelInfo.level > oldLevel) {
        await checkAndNotifyLevelUp({
            naze,
            m,
            db,
            jid,
            oldExp,
            newExp
        });
    }

    return gainXp;
}

