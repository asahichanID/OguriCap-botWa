import { getLevelInfo, checkAndNotifyLevelUp } from '../lib/xpGlobal.js';

/**
 * Hitung EXP minimal yang dibutuhkan untuk mencapai target level
 * @param {number} targetLevel
 * @returns {number}
 */
const getExpForLevel = (targetLevel = 1) => {
	const lvl = Math.max(1, Math.floor(Number(targetLevel) || 1));
	if (lvl <= 1) return 0;
	if (lvl <= 5) return (lvl - 1) * 100;
	if (lvl <= 15) return 500 + (lvl - 6) * 200;
	if (lvl <= 25) return 2500 + (lvl - 16) * 300;
	return 5500 + (lvl - 26) * 500;
};

/**
 * Cheat Set Level (Khusus Owner)
 * @param {object} opt - { naze, m, args, text, db, isCreator, prefix, command }
 */
const setLvl = async ({ naze, m, args, text, db, isCreator, prefix, command }) => {
	if (!isCreator) {
		return m.reply(global.mess?.owner || '⚠️ *Fitur ini khusus Owner!*');
	}

	// Ekstrak target user: Mention -> Quoted Sender -> Diri Sendiri (Default)
	let target = m.sender;
	if (m.mentionedJid && m.mentionedJid.length > 0) {
		target = m.mentionedJid[0];
	} else if (m.quoted && m.quoted.sender) {
		target = m.quoted.sender;
	}

	// Ekstrak jumlah level dari input user
	const rawArgs = Array.isArray(args) ? args : [];
	let targetLevelNum = null;

	for (const arg of rawArgs) {
		const cleaned = String(arg).replace(/[^0-9]/g, '');
		if (cleaned && !arg.includes('@')) {
			targetLevelNum = parseInt(cleaned, 10);
			break;
		}
	}

	// Fallback jika diketik bersamaan di text
	if (!targetLevelNum && text) {
		const match = text.match(/\b\d+\b/);
		if (match) targetLevelNum = parseInt(match[0], 10);
	}

	if (!targetLevelNum || isNaN(targetLevelNum) || targetLevelNum < 1) {
		return m.reply(`⚙️ *PANDUAN CHEAT SET LEVEL*\n\n📌 *Format:* \`${prefix + command} <jumlah_level> [@tag/reply]\`\n💡 *Contoh:* \`${prefix + command} 50\` _(untuk diri sendiri)_\n💡 *Contoh:* \`${prefix + command} 100 @user\` _(atau reply pesan user)_`);
	}

	// Inisialisasi data target jika belum ada
	db.users ??= {};
	db.users[target] ??= { exp: 0, limit: 10, money: 1000 };

	const oldExp = Number(db.users[target].exp) || 0;
	const oldInfo = getLevelInfo(oldExp);
	const baseTargetExp = getExpForLevel(targetLevelNum);
	const targetLevelNeed = getLevelInfo(baseTargetExp).expNeededForNextLevel;

	// Pertahankan sisa progres XP user sebelumnya (carry-over) agar progres tidak terbuang
	const preservedProgress = Math.min(oldInfo.currentLevelExp, Math.max(0, targetLevelNeed - 1));
	const newExp = baseTargetExp + preservedProgress;
	db.users[target].exp = newExp;
	global._dbDirty = true;
	const levelInfo = getLevelInfo(newExp);

	const isSelf = target === m.sender;
	const targetTag = `@${target.split('@')[0]}`;
	const caption = `👑 *[ CHEAT OWNER — SET LEVEL ]* 👑\n\n✅ *Status:* Berhasil Diubah!\n👤 *Target:* ${targetTag} ${isSelf ? '_(Diri Sendiri)_' : ''}\n⚡ *Level Baru:* *Level ${levelInfo.level}*\n🔮 *Total EXP:* *${levelInfo.totalExp.toLocaleString('id-ID')} XP*\n📊 *Progres:* ${levelInfo.currentLevelExp.toLocaleString('id-ID')} / ${levelInfo.expNeededForNextLevel.toLocaleString('id-ID')} XP (${levelInfo.progressPercent}%)`;

	try {
		await naze.sendMessage(m.chat, {
			text: caption,
			mentions: [target]
		}, { quoted: m });
	} catch {
		await m.reply(caption);
	}

	// Kirim notifikasi level up 1 kali jika level meningkat
	await checkAndNotifyLevelUp({
		naze,
		m,
		db,
		jid: target,
		oldExp,
		newExp
	});
};

// Export semua fitur cheat di bagian paling bawah
export {
	setLvl,
	getExpForLevel
};

