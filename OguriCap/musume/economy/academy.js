import fs from 'fs';
import { pickRandom } from '../helperquotes.js';

/**
 * Validasi apakah pengirim adalah Head Trainer (Owner)
 * Menjamin pemilik bot tidak tertolak meskipun parameter dari caller bervariasi
 */
function isHeadTrainer(m, isCreator, extraCreator) {
	if (typeof isCreator === 'boolean' && isCreator) return true;
	if (typeof extraCreator === 'boolean' && extraCreator) return true;
	if (m?.key?.fromMe) return true;
	if (global.isOwner) return true;

	const senderNum = (m?.sender || '').split('@')[0].replace(/[^0-9]/g, '');
	if (!senderNum) return false;

	const ownerList = [
		...(Array.isArray(global.owner) ? global.owner : [global.owner]),
		...(Array.isArray(global.set?.owner) ? global.set.owner : [global.set?.owner])
	]
		.filter(Boolean)
		.map(v => String(v).replace(/[^0-9]/g, ''));

	return ownerList.includes(senderNum);
}

/**
 * Fitur Audit Tracen Academy (Khusus Head Trainer / Owner)
 * Menyita Carats dari trainer (perorangan, grup 10%, atau global)
 */
export const audit = async (naze, m, db, args, isCreator, participants) => {
	try {
		// Toleransi urutan parameter jika dipanggil dengan tanda tangan lama (participants duluan)
		let actualCreator = isCreator;
		let actualParticipants = participants;
		if (Array.isArray(isCreator) && typeof participants === 'boolean') {
			actualParticipants = isCreator;
			actualCreator = participants;
		} else if (Array.isArray(isCreator) && participants === undefined) {
			actualParticipants = isCreator;
			actualCreator = undefined;
		}

		if (!isHeadTrainer(m, actualCreator)) {
			return m.reply('❌ Khusus Head Trainer (Owner)!');
		}

		const mode = (args[0] || '').toLowerCase();

		// ====================
		// 1. AUDIT SEMUA (10% DARI GRUP)
		// ====================
		if (mode === 'semua' || mode === 'all_group') {
			if (!m.isGroup) {
				return m.reply('❌ Perintah audit semua hanya bisa digunakan di dalam grup.');
			}

			const groupMembers = Array.isArray(actualParticipants) && actualParticipants.length > 0
				? actualParticipants
				: (m.metadata?.participants || global.store?.groupMetadata?.[m.chat]?.participants || []);

			if (!groupMembers.length) {
				return m.reply('❌ Gagal memuat daftar anggota grup.');
			}

			let total = 0;
			let warga = 0;
			const botNum = naze.decodeJid(naze.user?.id || '');

			for (const user of groupMembers) {
				let id = user?.phoneNumber || user?.id;
				if (id?.endsWith('@lid') && typeof naze.findJidByLid === 'function') {
					id = naze.findJidByLid(id, global.store) || id;
				}
				if (!id || id === m.sender || id === botNum) continue;
				if (!db.users?.[id]) continue;

				const uang = db.users[id].money || 0;
				if (uang <= 0) continue;

				const pajak = Math.floor(uang * 0.1);
				if (pajak <= 0) continue;

				db.users[id].money -= pajak;
				total += pajak;
				warga++;
			}

			db.users[m.sender] ??= {};
			db.users[m.sender].money = (db.users[m.sender].money || 0) + total;
			if (global._dbDirty !== undefined) global._dbDirty = true;

			return m.reply(
`🏇 𝐓𝐑𝐀𝐂𝐄𝐍 𝐂𝐎𝐋𝐋𝐄𝐂𝐓𝐈𝐎𝐍 🏇

👥 Trainer terdampak : ${warga}
💰 ${total.toLocaleString('id-ID')} Carats berhasil dikumpulkan untuk operasional akademi 🥕`
			);
		}

		// ====================
		// 2. AUDIT GLOBAL (100% SELURUH DATABASE)
		// ====================
		if (mode === 'global') {
			let total = 0;
			let warga = 0;
			const botNum = naze.decodeJid(naze.user?.id || '');

			for (const id in (db.users || {})) {
				if (!id || id === m.sender || id === botNum) continue;

				const uang = db.users[id]?.money || 0;
				if (uang <= 0) continue;

				db.users[id].money = 0;
				total += uang;
				warga++;
			}

			db.users[m.sender] ??= {};
			db.users[m.sender].money = (db.users[m.sender].money || 0) + total;
			if (global._dbDirty !== undefined) global._dbDirty = true;

			return m.reply(
`🚨 𝐓𝐑𝐀𝐂𝐄𝐍 𝐄𝐌𝐄𝐑𝐆𝐄𝐍𝐂𝐘 𝐀𝐔𝐃𝐈𝐓 🚨

👥 Trainer terdampak : ${warga}
💰 ${total.toLocaleString('id-ID')} Carats berhasil diamankan untuk dana akademi 🏇`
			);
		}

		// ====================
		// 3. TARGET PERSEORANGAN
		// ====================
		let target = null;
		let nominalStr = null;

		if (m.mentionedJid && m.mentionedJid.length > 0) {
			target = m.mentionedJid[0];
			nominalStr = args.find(a => !a.includes('@') && (a.toLowerCase() === 'all' || /^\d+$/.test(a))) || args[1];
		} else if (m.quoted?.sender) {
			target = m.quoted.sender;
			nominalStr = (args[0]?.toLowerCase() === 'all' || /^\d+$/.test(args[0])) ? args[0] : args[1];
		} else if (args[0] && /^[0-9+]+$/.test(args[0])) {
			const cleanNum = args[0].replace(/[^0-9]/g, '');
			if (cleanNum.length >= 7) {
				const phone = cleanNum.startsWith('0') ? '62' + cleanNum.slice(1) : cleanNum;
				target = phone + '@s.whatsapp.net';
				nominalStr = args[1];
			}
		}

		if (target && target.endsWith('@lid') && typeof naze.findJidByLid === 'function') {
			target = naze.findJidByLid(target, global.store) || target;
		}

		if (!target) {
			return m.reply(
`🏇 *TRACEN ACADEMY AUDIT* 🏇
_Khusus Head Trainer_

*Format Penggunaan:*
• .audit @tag <jumlah> — Sita sejumlah Carats dari trainer
• .audit @tag all — Sita seluruh Carats milik trainer
• .audit <jumlah> _(reply pesan)_ — Sita Carats dari target reply
• .audit semua — Sita 10% Carats dari seluruh member grup
• .audit global — Sita 100% Carats dari seluruh database`
			);
		}

		if (!db.users?.[target]) {
			return m.reply('❌ Trainer tidak ditemukan di database.');
		}

		if (!nominalStr) {
			return m.reply('❌ Masukkan jumlah Carats yang ingin diaudit (contoh: .audit @tag 5000 atau .audit @tag all).');
		}

		const currentTargetMoney = db.users[target].money || 0;
		if (currentTargetMoney <= 0) {
			return m.reply(`❌ Trainer @${target.split('@')[0]} tidak memiliki saldo Carats.`, { mentions: [target] });
		}

		// Mode All
		if (nominalStr.toLowerCase() === 'all') {
			db.users[target].money = 0;
			db.users[m.sender] ??= {};
			db.users[m.sender].money = (db.users[m.sender].money || 0) + currentTargetMoney;
			if (global._dbDirty !== undefined) global._dbDirty = true;

			return m.reply(
`🏇 *Audit Selesai!*

👤 Target : @${target.split('@')[0]}
💰 ${currentTargetMoney.toLocaleString('id-ID')} Carats berhasil diamankan ke kas Head Trainer.`,
				{ mentions: [target] }
			);
		}

		// Mode Nominal Spesifik
		const nominal = parseInt(nominalStr);
		if (isNaN(nominal) || nominal <= 0) {
			return m.reply('❌ Jumlah tidak valid! Masukkan angka positif atau "all".');
		}

		const sita = Math.min(currentTargetMoney, nominal);
		db.users[target].money -= sita;
		db.users[m.sender] ??= {};
		db.users[m.sender].money = (db.users[m.sender].money || 0) + sita;
		if (global._dbDirty !== undefined) global._dbDirty = true;

		const catatan = sita < nominal ? `\n_(Catatan: Saldo target hanya tersisa ${currentTargetMoney.toLocaleString('id-ID')})_` : '';
		return m.reply(
`🏇 *Audit Selesai!*

👤 Target : @${target.split('@')[0]}
💰 ${sita.toLocaleString('id-ID')} Carats berhasil diamankan ke kas Head Trainer.${catatan}`,
			{ mentions: [target] }
		);
	} catch (err) {
		console.error('❌ Error on audit:', err);
		return m.reply('❌ Terjadi kesalahan saat menjalankan audit.');
	}
};

/**
 * Fitur Bansos Tracen Academy (Khusus Head Trainer / Owner)
 * Membagikan Carats dari kas Head Trainer ke seluruh member
 */
export const bansos = async (naze, m, db, args, isCreator, botNumber) => {
	try {
		if (!isHeadTrainer(m, isCreator)) {
			return m.reply('❌ Khusus Head Trainer (Owner)!');
		}

		const bansosQuote = [
			{ name: 'Oguri Cap', quote: '🥕 Kalau semua orang kenyang, latihan jadi lebih semangat!' },
			{ name: 'Symboli Rudolf', quote: '👴 Memberi bantuan itu investasi sosial, bukan cuma angka 😹' },
			{ name: 'Air Groove', quote: '😮‍💨 Setidaknya kali ini Rudolf tidak membuat lelucon...' },
			{ name: 'Gold Ship', quote: '😹 Wah, bagi-bagi Carats? Jangan lupa sisakan buat kekacauan besok!' },
			{ name: 'Tokai Teio', quote: '✨ Semoga bantuan ini membuat semua orang tersenyum!' },
			{ name: 'Mihono Bourbon', quote: '🤖 Distribusi bantuan selesai. Tingkat kebahagiaan meningkat.' }
		];

		const hashire = pickRandom(bansosQuote);

		let thumb = null;
		try {
			if (fs.existsSync('./src/media/oguri-bansos.jpg')) {
				thumb = fs.readFileSync('./src/media/oguri-bansos.jpg');
			}
		} catch (e) {}

		const nominal = parseInt(args[1]);
		if (isNaN(nominal) || nominal < 1) {
			return m.reply('❌ Masukkan nominal bantuan yang valid (minimal 1 Carats)!\nContoh: .bansos grup 5000 atau .bansos global 5000');
		}

		db.users[m.sender] ??= {};
		if ((db.users[m.sender].money || 0) < nominal) {
			return m.reply('💸 Carats kas Anda tidak mencukupi untuk membagikan bansos sejumlah itu!');
		}

		// ====================
		// BANSOS GLOBAL
		// ====================
		if (args[0]?.toLowerCase() === 'global') {
			let berhasil = 0;
			let totalKeluar = 0;
			let totalWarga = 0;

			for (const id in (db.users || {})) {
				if (!id || id === m.sender || !db.users[id]) continue;
				totalWarga++;

				if ((db.users[m.sender].money || 0) < nominal) break;

				db.users[m.sender].money -= nominal;
				db.users[id].money = (db.users[id].money || 0) + nominal;
				totalKeluar += nominal;
				berhasil++;
			}

			const gagal = totalWarga - berhasil;
			if (global._dbDirty !== undefined) global._dbDirty = true;

			return naze.sendMessage(
				m.chat,
				{
					text:
`🎁 𝐓𝐑𝐀𝐂𝐄𝐍 𝐒𝐎𝐂𝐈𝐀𝐋 𝐀𝐈𝐃 🎁

💰 Bantuan per Trainer : ${nominal.toLocaleString('id-ID')} Carats
🌍 Total Trainer Terdata : ${totalWarga}

👥 Trainer Menerima : ${berhasil}
🥀 Belum Menerima : ${gagal}

💸 Total Tersalurkan : ${totalKeluar.toLocaleString('id-ID')} Carats
🏦 Sisa Kas Head Trainer : ${db.users[m.sender].money.toLocaleString('id-ID')} Carats

💬 ${hashire.name}:
"${hashire.quote}"`,
					contextInfo: {
						externalAdReply: {
							title: '🎁 Tracen Social Aid',
							body: 'Distribusi bantuan global selesai 🏇',
							thumbnail: thumb,
							mediaType: 1,
							renderLargerThumbnail: true,
							showAdAttribution: false,
							sourceUrl: 'https://tracen-academy.jp'
						}
					}
				},
				{ quoted: m }
			);
		}

		// ====================
		// BANSOS GRUP
		// ====================
		if (!m.isGroup) {
			return m.reply('❌ Perintah bansos grup hanya bisa digunakan di dalam grup!');
		}

		const participants = m.metadata?.participants || global.store?.groupMetadata?.[m.chat]?.participants || [];
		if (!participants.length) {
			return m.reply('❌ Gagal memuat daftar anggota grup.');
		}

		let berhasil = 0;
		let totalKeluar = 0;
		let totalWarga = 0;
		const botNum = botNumber || naze.decodeJid(naze.user?.id || '');

		for (const member of participants) {
			let id = member?.phoneNumber || member?.id;
			if (id?.endsWith('@lid') && typeof naze.findJidByLid === 'function') {
				id = naze.findJidByLid(id, global.store) || id;
			}
			if (!id || id === m.sender || id === botNum || !db.users?.[id]) continue;

			totalWarga++;
			if ((db.users[m.sender].money || 0) < nominal) break;

			db.users[m.sender].money -= nominal;
			db.users[id].money = (db.users[id].money || 0) + nominal;
			totalKeluar += nominal;
			berhasil++;
		}

		const gagal = totalWarga - berhasil;
		if (global._dbDirty !== undefined) global._dbDirty = true;

		return naze.sendMessage(
			m.chat,
			{
				text:
`🎁 𝐓𝐑𝐀𝐂𝐄𝐍 𝐒𝐎𝐂𝐈𝐀𝐋 𝐀𝐈𝐃 🎁

💰 Bantuan per Trainer : ${nominal.toLocaleString('id-ID')} Carats

👥 Trainer Menerima : ${berhasil}
🥀 Belum Menerima : ${gagal}

💸 Total Tersalurkan : ${totalKeluar.toLocaleString('id-ID')} Carats
🏦 Sisa Kas Head Trainer : ${db.users[m.sender].money.toLocaleString('id-ID')} Carats

💬 ${hashire.name}:
"${hashire.quote}"`,
				contextInfo: {
					externalAdReply: {
						title: '🎁 Tracen Social Aid',
						body: 'Distribusi bantuan selesai 🏇',
						thumbnail: thumb,
						mediaType: 1,
						renderLargerThumbnail: true,
						showAdAttribution: false,
						sourceUrl: 'https://tracen-academy.jp'
					}
				}
			},
			{ quoted: m }
		);
	} catch (err) {
		console.error('❌ Error on bansos:', err);
		return m.reply('❌ Terjadi kesalahan saat menyalurkan bansos.');
	}
};
