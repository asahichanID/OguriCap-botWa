import { addBankActivity } from './bankaktivitas.js';

export const audit = async (naze, m, db, args = [], isCreator, participants, store) => {
	try {
		const isOwner = Boolean(
			isCreator || 
			m?.key?.fromMe || 
			(global.owner && global.owner.some(o => (m?.sender || '').includes(String(o).replace(/[^0-9]/g, ''))))
		);
		if (!isOwner) return m.reply(global.mess?.owner || '❌ Khusus Owner Bot!');

		let targetJid = null;
		let modeAll = false;
		let sitaOption = { type: 'percent', value: 10 }; // default 10%

		const rawArgs = (args || []).map(a => (a || '').trim());
		const lowerArgs = rawArgs.map(a => a.toLowerCase());

		const isSemuaKeyword = (str) => ['semua', 'all', 'grup', 'group', 'member', 'members', 'all_group', 'everyone', 'allmember'].includes(str);

		// 1. Cek Mention / Quoted
		if (m.mentionedJid && m.mentionedJid.length > 0) {
			targetJid = m.mentionedJid[0];
		} else if (m.quoted?.sender) {
			targetJid = m.quoted.sender;
		}

		// 2. Parse argumen
		if (!targetJid) {
			if (lowerArgs.length > 0 && isSemuaKeyword(lowerArgs[0])) {
				modeAll = true;
				const second = lowerArgs[1] || '';
				if (['all', 'semua', 'full', '100%'].includes(second)) {
					sitaOption = { type: 'all' };
				} else if (second.endsWith('%')) {
					const p = parseFloat(second.replace('%', ''));
					if (!isNaN(p) && p > 0) sitaOption = { type: 'percent', value: Math.min(100, p) };
				} else if (/^\d+$/.test(second)) {
					const num = parseInt(second);
					if (num > 0) sitaOption = { type: 'amount', value: num };
				} else {
					sitaOption = { type: 'percent', value: 10 };
				}
			} else if (lowerArgs.length > 0 && /^\d{5,}$/.test(lowerArgs[0].replace(/[^0-9]/g, ''))) {
				const num = lowerArgs[0].replace(/[^0-9]/g, '');
				const findJid = typeof naze.findJidByLid === 'function' ? naze.findJidByLid(num + '@lid', store) : null;
				let parsedJid = num + (findJid ? '@lid' : '@s.whatsapp.net');
				if (typeof naze.findJidByLid === 'function') {
					parsedJid = naze.findJidByLid(parsedJid, store, true) || parsedJid;
				}
				targetJid = parsedJid;

				const second = lowerArgs[1] || '';
				if (['all', 'semua', 'full', '100%'].includes(second)) {
					sitaOption = { type: 'all' };
				} else if (second.endsWith('%')) {
					const p = parseFloat(second.replace('%', ''));
					if (!isNaN(p) && p > 0) sitaOption = { type: 'percent', value: Math.min(100, p) };
				} else if (/^\d+$/.test(second)) {
					const val = parseInt(second);
					if (val > 0) sitaOption = { type: 'amount', value: val };
				} else {
					sitaOption = { type: 'percent', value: 10 };
				}
			}
		}

		// 3. Jika target spesifik ditemukan (via mention atau quoted atau nomor)
		if (targetJid) {
			const nonTagArgs = lowerArgs.filter(a => !a.startsWith('@') && !/^\d{8,}@/.test(a) && !/^\d{8,}$/.test(a));
			const opt = nonTagArgs[0] || '';

			if (['all', 'semua', 'full', '100%'].includes(opt)) {
				sitaOption = { type: 'all' };
			} else if (opt.endsWith('%')) {
				const p = parseFloat(opt.replace('%', ''));
				if (!isNaN(p) && p > 0) sitaOption = { type: 'percent', value: Math.min(100, p) };
			} else if (/^\d+$/.test(opt)) {
				const val = parseInt(opt);
				if (val > 0) sitaOption = { type: 'amount', value: val };
			} else {
				sitaOption = { type: 'percent', value: 10 };
			}
		}

		// EKSEKUSI A: Mode Semua / Massal
		if (modeAll) {
			let targetList = [];
			let scopeName = 'Grup';

			if (m.isGroup) {
				const groupMembers = Array.isArray(participants) && participants.length > 0
					? participants
					: (m.metadata?.participants || []);
				targetList = groupMembers.map(item => item.id || item.jid || item);
				scopeName = m.metadata?.subject || 'Grup Ini';
			} else {
				targetList = Object.keys(db.users || {});
				scopeName = 'Database Global';
			}

			if (!targetList || targetList.length === 0) {
				return m.reply('❌ Tidak ada anggota/pengguna yang ditemukan untuk diaudit.');
			}

			let totalDisita = 0;
			let totalUserTerdampak = 0;
			const botNum = typeof naze.decodeJid === 'function' ? naze.decodeJid(naze.user?.id) : '';

			for (const jid of targetList) {
				if (!jid) continue;
				if (botNum && jid.includes(botNum.split('@')[0])) continue;
				if (global.owner && global.owner.some(o => jid.includes(String(o).replace(/[^0-9]/g, '')))) continue;

				const u = db.users?.[jid];
				if (!u || typeof u.money !== 'number' || u.money <= 0) continue;

				let sita = 0;
				if (sitaOption.type === 'all') {
					sita = u.money;
				} else if (sitaOption.type === 'percent') {
					sita = Math.floor(u.money * (sitaOption.value / 100));
				} else if (sitaOption.type === 'amount') {
					sita = Math.min(u.money, sitaOption.value);
				}

				if (sita > 0) {
					u.money = Math.max(0, u.money - sita);
					totalDisita += sita;
					totalUserTerdampak++;
				}
			}

			if (!db.bank) db.bank = {};
			db.bank.kas = (db.bank.kas || 0) + totalDisita;
			db.bank.danaMasuk = (db.bank.danaMasuk || 0) + totalDisita;
			db.bank.totalPajak = (db.bank.totalPajak || 0) + totalDisita;
			db.bank.totalTransaksi = (db.bank.totalTransaksi || 0) + 1;

			const labelSita = sitaOption.type === 'all'
				? '100% (Semua Saldo)'
				: sitaOption.type === 'percent'
				? `${sitaOption.value}% Saldo`
				: `${sitaOption.value.toLocaleString('id-ID')} Carats`;

			addBankActivity(db, `Audit Massal (${scopeName}): ${totalDisita.toLocaleString('id-ID')} Carats disita dari ${totalUserTerdampak} member.`);

			const replyText = 
`╭─❖「 ⚖️ 𝐀𝐔𝐃𝐈𝐓 𝐄𝐊𝐎𝐍𝐎𝐌𝐈 𝐌𝐀𝐒𝐒𝐀𝐋 」
│
│ 🏛️ *Lingkup:* ${scopeName}
│ 📊 *Tipe Audit:* ${labelSita}
│ 👥 *Member Terdampak:* ${totalUserTerdampak} Pengguna
│ 🔻 *Total Carats Disita:* ${totalDisita.toLocaleString('id-ID')} Carats
│ 🏦 *Total Kas Bank:* ${(db.bank.kas || 0).toLocaleString('id-ID')} Carats
│
│ ✅ Seluruh dana sitaan telah berhasil dialokasikan ke Kas Bank Tracen.
╰───────────────────────────❖`;

			return m.reply(replyText);
		}

		// EKSEKUSI B: Mode Target User Spesifik
		if (targetJid) {
			if (!db.users) db.users = {};
			if (!db.users[targetJid]) {
				db.users[targetJid] = {
					money: 0,
					limit: 5,
					vip: false,
					ban: false
				};
			}

			const u = db.users[targetJid];
			const saldoAwal = typeof u.money === 'number' ? u.money : 0;

			let sita = 0;
			let labelSita = '';

			if (sitaOption.type === 'all') {
				sita = Math.max(0, saldoAwal);
				labelSita = '100% (Semua Saldo)';
			} else if (sitaOption.type === 'percent') {
				sita = Math.floor(saldoAwal * (sitaOption.value / 100));
				labelSita = `${sitaOption.value}% Saldo`;
			} else if (sitaOption.type === 'amount') {
				sita = Math.min(saldoAwal, sitaOption.value);
				labelSita = `${sitaOption.value.toLocaleString('id-ID')} Carats`;
			}

			u.money = Math.max(0, saldoAwal - sita);

			if (!db.bank) db.bank = {};
			db.bank.kas = (db.bank.kas || 0) + sita;
			db.bank.danaMasuk = (db.bank.danaMasuk || 0) + sita;
			db.bank.totalPajak = (db.bank.totalPajak || 0) + sita;
			db.bank.totalTransaksi = (db.bank.totalTransaksi || 0) + 1;

			addBankActivity(db, `Audit @${targetJid.split('@')[0]}: ${sita.toLocaleString('id-ID')} Carats disita ke kas bank.`);

			const targetTag = `@${targetJid.split('@')[0]}`;
			const textMsg = 
`╭─❖「 ⚖️ 𝐀𝐔𝐃𝐈𝐓 𝐄𝐊𝐎𝐍𝐎𝐌𝐈 𝐔𝐒𝐄𝐑 」
│
│ 👤 *Target:* ${targetTag}
│ 📊 *Jenis Audit:* ${labelSita}
│ 💰 *Saldo Awal:* ${saldoAwal.toLocaleString('id-ID')} Carats
│ 🔻 *Jumlah Disita:* -${sita.toLocaleString('id-ID')} Carats
│ 💵 *Sisa Saldo:* ${(u.money).toLocaleString('id-ID')} Carats
│ 🏛️ *Total Kas Bank:* ${(db.bank.kas || 0).toLocaleString('id-ID')} Carats
│
│ ✅ Dana sitaan telah berhasil dimasukkan ke Kas Bank Tracen.
╰───────────────────────────❖`;

			return naze.sendMessage(m.chat, {
				text: textMsg,
				mentions: [targetJid]
			}, { quoted: m });
		}

		// PANDUAN PENGGUNAAN JIKA TANPA ARGUMEN
		const helpText = 
`╭─❖「 ⚖️ 𝐏𝐀𝐍𝐃𝐔𝐀𝐍 𝐀𝐔𝐃𝐈𝐓 𝐎𝐖𝐍𝐄𝐑 」
│
│ 👑 *Fitur Khusus Owner Bot*
│ Digunakan untuk menyita saldo Carats pengguna & mengalokasikannya ke Kas Bank Tracen.
│
│ 📌 *Format Perintah User:*
│ ├ • *.audit @user all* (Sita 100% seluruh saldo user)
│ ├ • *.audit @user* (Sita 10% saldo user)
│ ├ • *.audit @user <persen/nominal>* (Contoh: *.audit @user 50%* / *.audit @user 50000*)
│ ├ • *(Reply Pesan)* *.audit all* / *.audit 50%*
│ └ • *.audit 628xxx all*
│
│ 📌 *Format Perintah Massal:*
│ ├ • *.audit semua all* (Sita 100% seluruh saldo member grup)
│ ├ • *.audit semua* (Sita 10% saldo member grup)
│ └ • *.audit semua <persen/nominal>* (Contoh: *.audit semua 25%*)
│
╰───────────────────────────❖`;

		return m.reply(helpText);
	} catch (err) {
		console.error('[AUDIT ERROR]', err);
		return m.reply('❌ Terjadi kesalahan saat menjalankan audit: ' + (err.message || err));
	}
};

export const bansos = async (naze, m, db, args, isCreator, participants) => {
	try {
		const isOwner = Boolean(isCreator || m?.key?.fromMe);
		if (!isOwner) return m.reply('❌ Khusus Owner Bot!');

		const nominal = parseInt(args[0]) || 5000;
		if (!m.isGroup) return m.reply('❌ Bansos hanya bisa dibagikan di dalam grup.');

		const groupMembers = Array.isArray(participants) && participants.length > 0
			? participants
			: (m.metadata?.participants || []);

		let count = 0;
		for (const member of groupMembers) {
			if (!db.users[member.id]) continue;
			db.users[member.id].money = (db.users[member.id].money || 0) + nominal;
			count++;
		}

		return m.reply(`🎁 *BANSOS DIBAGIKAN!*\nSebesar ${nominal.toLocaleString('id-ID')} Carats dibagikan kepada ${count} anggota grup.`);
	} catch (err) {
		console.error('[BANSOS]', err);
		return m.reply('❌ Gagal membagikan bansos.');
	}
};
