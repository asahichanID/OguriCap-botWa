/**
 * SISTEM XP GLOBAL OGURI CAP
 * - Base XP random 5–50 dan scaling mengikuti level
 * - Level 0–5: 100 XP/level
 * - Level 6–15: 200 XP/level
 * - Level 16–25: 300 XP/level
 * - Level 26+: 500 XP/level tanpa batas
 */

// Batas kumulatif XP untuk setiap bracket
// Level 0..5 (6 level @ 100 XP) -> 600 XP (mencapai Level 6)
const BRACKET_1_LEVELS = 6;
const BRACKET_1_XP_PER_LEVEL = 100;
const BRACKET_1_MAX_XP = BRACKET_1_LEVELS * BRACKET_1_XP_PER_LEVEL; // 600

// Level 6..15 (10 level @ 200 XP) -> 2000 XP -> kumulatif 2600 XP (mencapai Level 16)
const BRACKET_2_LEVELS = 10;
const BRACKET_2_XP_PER_LEVEL = 200;
const BRACKET_2_MAX_XP = BRACKET_1_MAX_XP + (BRACKET_2_LEVELS * BRACKET_2_XP_PER_LEVEL); // 2600

// Level 16..25 (10 level @ 300 XP) -> 3000 XP -> kumulatif 5600 XP (mencapai Level 26)
const BRACKET_3_LEVELS = 10;
const BRACKET_3_XP_PER_LEVEL = 300;
const BRACKET_3_MAX_XP = BRACKET_2_MAX_XP + (BRACKET_3_LEVELS * BRACKET_3_XP_PER_LEVEL); // 5600

// Level 26+ (500 XP per level tanpa batas)
const BRACKET_4_XP_PER_LEVEL = 500;

/**
 * Menghitung detail level berdasarkan total akumulasi XP
 * @param {number} exp - Total akumulasi XP user
 * @returns {{ level: number, currentLevelExp: number, expNeededForNextLevel: number, progressPercent: number, totalExp: number }}
 */
export function getLevelInfo(exp = 0) {
    const totalExp = Math.max(0, Math.floor(Number(exp) || 0));

    if (totalExp < BRACKET_1_MAX_XP) {
        // Level 0 - 5
        const level = Math.floor(totalExp / BRACKET_1_XP_PER_LEVEL);
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
export function generateBaseXP(level = 0) {
    const safeLevel = Math.max(0, Math.floor(Number(level) || 0));
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
export function calculateTebakBomXP(difficulty = 'easy', level = 0) {
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
 * @returns {number}
 */
export function addExp(db, jid, amount) {
    if (!db || !db.users || !jid) return 0;
    if (!db.users[jid]) {
        db.users[jid] = { exp: 0 };
    }
    const gain = Math.max(0, Math.floor(Number(amount) || 0));
    db.users[jid].exp = (db.users[jid].exp || 0) + gain;
    global._dbDirty = true;
    return gain;
}
