import '../settings.js';
import fs from 'fs';
import path from 'path';
import * as jimpPkg from 'jimp';
import chalk from 'chalk';
import { sleep, clockString } from './function.js'
import { addBankActivity } from './economy/bankaktivitas.js'
import { getLevelInfo } from './xpGlobal.js';

// Kompatibilitas universal Jimp v0.16.x dan Jimp v1.x (ESM tanpa default export)
const jimp = jimpPkg.default || jimpPkg.Jimp || jimpPkg;


function pickRandom(list) {
	return list[Math.floor(list.length * Math.random())]
}

const rdGame = (bd, id, tm) => Object.keys(bd).find(a => a.startsWith(id) && a.endsWith(tm));

const iGame = (bd, id) => (a => a && bd[a].id)(Object.keys(bd).find(a => a.startsWith(id)));

const tGame = (bd, id) => (a => a && bd[a].time)(Object.keys(bd).find(a => a.startsWith(id)));

const gameMerampok = async (m, db) => {
	let __timers = (new Date - db.users[m.sender].lastrampok)
	let _timers = (3600000 - __timers)
	let timers = clockString(_timers)
	if (new Date - db.users[m.sender].lastrampok > 3600000) {
		let dapat = (Math.floor(Math.random() * 10000))
		let who
		if (m.isGroup) who = m.mentionedJid ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.mentionedJid[0]
		else who = m.chat
		if (!who) return m.reply('Tag salah satu')
		if (!db.users[who]) return m.reply('Target tidak terdaftar di database!')
		if (10000 > db.users[who].money) return m.reply('Targetnya Kismin ngab🗿')
		db.users[who].money -= dapat
		db.users[m.sender].money += dapat
		db.users[m.sender].lastrampok = new Date * 1
		m.reply(`Berhasil Merampok Money Target Sebesar ${dapat}`)
	} else m.reply(`Anda Sudah merampok dan berhasil sembunyi, tunggu ${timers} untuk merampok lagi`)
}

// Konfigurasi 5 Tingkat Keamanan Brankas
export const BRANKAS_CONFIG = {
	1: {
		level: 1,
		name: 'Biasa',
		minLvl: 1,
		icon: '📦',
		deskripsi: 'Kotak penyimpanan dasar berkancing tanpa kunci ganda. Proteksi minimal.',
		winRate: 0.75, // Peluang begal sukses 75%
		surrenderRate: 0.45, // 45% peluang korban pasrah menyerahkan diri (100% uang ludes!)
		shootRate: 0.15, // 15% kena tembak korban
		policeRate: 0.10 // 10% tertangkap polisi
	},
	2: {
		level: 2,
		name: 'Normal',
		minLvl: 5,
		icon: '🔐',
		deskripsi: 'Gembok baja kombinasi ganda & kompartemen tersembunyi.',
		winRate: 0.60,
		surrenderRate: 0.35,
		shootRate: 0.22,
		policeRate: 0.18
	},
	3: {
		level: 3,
		name: 'Standar',
		minLvl: 10,
		icon: '📟',
		deskripsi: 'Brankas keypad digital anti-bobol dengan sensor getar.',
		winRate: 0.45,
		surrenderRate: 0.25,
		shootRate: 0.30,
		policeRate: 0.25
	},
	4: {
		level: 4,
		name: 'Baik',
		minLvl: 15,
		icon: '🛡️',
		deskripsi: 'Brankas biometrik sidik jari, alarm senyap terhubung kepolisian.',
		winRate: 0.30,
		surrenderRate: 0.15,
		shootRate: 0.35,
		policeRate: 0.35
	},
	5: {
		level: 5,
		name: 'Militer',
		minLvl: 25,
		icon: '🎖️',
		deskripsi: 'Brankas baja titanium ber-laser anti-balistik pertahanan militer.',
		winRate: 0.12,
		surrenderRate: 0.08,
		shootRate: 0.44,
		policeRate: 0.44
	}
};

// Katalog Persenjataan Begal Shop
export const BEGAL_WEAPONS = {
	pisau: {
		id: 'pisau',
		name: 'Pisau Lipat Taktis',
		category: 'melee',
		rangeType: 'Jarak Dekat',
		icon: '🔪',
		price: 50000,
		minLvl: 1,
		power: 1,
		deskripsi: 'Pisau saku baja tajam untuk menodong mangsa dari jarak dekat tanpa syarat level.'
	},
	katana: {
		id: 'katana',
		name: 'Katana Baja Hitam',
		category: 'melee',
		rangeType: 'Jarak Dekat',
		icon: '🗡️',
		price: 500000,
		minLvl: 1,
		power: 2,
		deskripsi: 'Pedang samurai tajam mengintimidasi korban hingga gemetar tanpa syarat level.'
	},
	pistol: {
		id: 'pistol',
		name: 'Pistol Glock 19 Taktis',
		category: 'firearm',
		rangeType: 'Jarak Jauh (Handgun)',
		icon: '🔫',
		price: 3500000, // 3,5 Juta Coin
		minLvl: 20, // Min Level 20
		power: 3,
		deskripsi: 'Pistol semi-otomatis 9mm berdaya tembak presisi, bisa menembak korban dari jauh & menyita seluruh uang/ATM!'
	},
	shotgun: {
		id: 'shotgun',
		name: 'Shotgun Remington 870',
		category: 'long_firearm',
		rangeType: 'Laras Panjang (Heavy)',
		icon: '💥',
		price: 5000000, // 5 Juta Coin
		minLvl: 28,
		power: 4,
		deskripsi: 'Senapan gentel laras panjang berdaya hancur tinggi, meremukkan perlawanan target.'
	},
	ak47: {
		id: 'ak47',
		name: 'Senapan Serbu AK-47 Kalashnikov',
		category: 'long_firearm',
		rangeType: 'Laras Panjang (Automatic)',
		icon: '⚔️',
		price: 7500000, // 7,5 Juta Coin
		minLvl: 35, // Min Level 35
		power: 5,
		deskripsi: 'Senapan serbu militer legendaris kaliber 7.62mm, tembakan beruntun mematikan mendominasi baku tembak!'
	},
	sniper: {
		id: 'sniper',
		name: 'Sniper Rifle AWP Magnum',
		category: 'long_firearm',
		rangeType: 'Laras Panjang (Sniper Jarak Ekstrem)',
		icon: '🎯',
		price: 12000000, // 12 Juta Coin
		minLvl: 45,
		power: 6,
		deskripsi: 'Senapan runduk optik kaliber .338 Lapua, melumpuhkan target seketika dari kejauhan tanpa ampun!'
	}
};

// Ambil senjata terbaik yang dimiliki pemain
export function getUserBestWeapon(user) {
	if (!user || !Array.isArray(user.begalWeapons) || user.begalWeapons.length === 0) return null;
	const order = ['sniper', 'ak47', 'shotgun', 'pistol', 'katana', 'pisau'];
	for (const id of order) {
		if (user.begalWeapons.includes(id) && BEGAL_WEAPONS[id]) {
			return BEGAL_WEAPONS[id];
		}
	}
	return null;
}

const BEGAL_COOLDOWN_MS = 30 * 60 * 1000; // 30 Menit (1.800.000 ms)
const POLICE_DEATH_COOLDOWN_MS = 60 * 60 * 1000; // 1 Jam (3.600.000 ms) jika mati ditembak beruntun polisi!

// Cache riwayat korban terakhir per grup agar rotasi acak merata dan tidak membidik orang yang sama berulang kali
const recentVictimsHistory = new Map();

function resolveCanonicalJid(p, conn, store) {
	if (!p) return null;
	let phone = p?.phoneNumber || store?.contacts?.[p?.id]?.phoneNumber;
	if (!phone && typeof conn?.findJidByLid === 'function' && String(p?.id || '').endsWith('@lid')) {
		phone = conn.findJidByLid(p.id, store, false);
	}
	let raw = phone || p?.id || p;
	if (!raw) return null;
	let decoded = conn?.decodeJid ? conn.decodeJid(raw) : raw;
	if (!decoded.includes('@')) decoded += '@s.whatsapp.net';
	return decoded;
}

// Kirim sticker Polisi Oguri Cap resmi
async function sendPoliceSticker(conn, m) {
	try {
		const targetChat = typeof m === 'string' ? m : (m?.chat || m?.key?.remoteJid);
		const policeStickerPath = [
			path.resolve(__dirname, '../assets/oguricap_police_sticker.webp'),
			path.resolve(process.cwd(), 'OguriCap/assets/oguricap_police_sticker.webp'),
			path.resolve(process.cwd(), 'assets/oguricap_police_sticker.webp'),
			path.resolve(__dirname, '../../OguriCap/assets/oguricap_police_sticker.webp'),
			path.resolve('OguriCap/assets/oguricap_police_sticker.webp'),
			path.resolve('assets/oguricap_police_sticker.webp')
		].find(p => p && fs.existsSync(p));

		if (policeStickerPath) {
			const stickerBuf = fs.readFileSync(policeStickerPath);
			if (typeof conn?.sendMessage === 'function' && targetChat) {
				const opts = (typeof m === 'object' && m?.key) ? { quoted: m } : {};
				await conn.sendMessage(targetChat, { sticker: stickerBuf }, opts);
				return true;
			} else if (typeof m?.reply === 'function') {
				await m.reply({ sticker: stickerBuf });
				return true;
			}
		}
	} catch (err) {
		console.error('[POLICE-STICKER-ERROR]', err);
	}
	return false;
}

const gameBegal = async (conn, m, db, text = '', args = [], store = null) => {
	let user = db.users[m.sender];
	if (!user) {
		db.users[m.sender] = { money: 1000, lastbegal: 0, brankas: 1, begalWeapons: [], begalSkill: { level: 1, points: 0 } };
		user = db.users[m.sender];
	}

	if (!Array.isArray(user.begalWeapons)) user.begalWeapons = [];
	if (!user.begalSkill) user.begalSkill = { level: 1, points: 0 };

	const botNumber = conn.decodeJid(conn.user.id);
	const now = Date.now();

	// 1. Cek Cooldown Begal
	const activeCdDuration = user.begalCdDuration || BEGAL_COOLDOWN_MS;
	if (user.lastbegal && (now - user.lastbegal < activeCdDuration)) {
		const sisaMs = activeCdDuration - (now - user.lastbegal);
		const sisaStr = clockString(sisaMs);
		const cdLabel = activeCdDuration >= 60 * 60 * 1000 ? '1 Jam (Ditembak Mati Regu Polisi)' : '30 Menit';
		return m.reply(
			`⏳ *[BURONAN / PEMULIHAN BEGAL]*\n\n` +
			`Kamu masih dalam masa pemulihan kritis setelah insiden sebelumnya atau sedang bersembunyi dari kejaran polisi!\n` +
			`⏱️ *Sisa Cooldown:* *${sisaStr}* (${cdLabel})\n\n` +
			`_Tunggu hingga kondisimu pulih dan situasi jalanan akademi aman kembali._`
		);
	}

	// Reset durasi cooldown ke default jika sudah lewat
	user.begalCdDuration = BEGAL_COOLDOWN_MS;

	// 2. Pemilihan Target Korban Secara Acak Merata (Tanpa Hardcore Menarget 1 Orang)
	let who = null;
	let targetLid = null;

	if (m.mentionedJid && m.mentionedJid.length > 0) {
		const targetCand = m.mentionedJid[0];
		if (targetCand !== m.sender && targetCand !== botNumber && !targetCand.startsWith(botNumber.split('@')[0])) {
			who = targetCand;
		}
	} else if (m.quoted && m.quoted.sender) {
		const targetCand = m.quoted.sender;
		if (targetCand !== m.sender && targetCand !== botNumber && !targetCand.startsWith(botNumber.split('@')[0])) {
			who = targetCand;
		}
	}

	// JIKA HANYA KETIK .begal (Sistem Begal Acak Jalanan Murni)
	if (!who) {
		const candidateMap = new Map();

		if (m.isGroup) {
			const groupParticipants = (
				m.metadata?.participants ||
				store?.groupMetadata?.[m.chat]?.participants ||
				[]
			);

			for (const p of groupParticipants) {
				const canonJid = resolveCanonicalJid(p, conn, store);
				if (!canonJid) continue;
				if (
					canonJid !== m.sender &&
					canonJid !== botNumber &&
					!canonJid.startsWith(botNumber.split('@')[0])
				) {
					candidateMap.set(canonJid, p?.id || canonJid);
				}
			}
		}

		if (candidateMap.size === 0 && db?.users) {
			for (const u of Object.keys(db.users)) {
				if (
					u !== m.sender &&
					u !== botNumber &&
					!u.startsWith(botNumber.split('@')[0]) &&
					!u.endsWith('@g.us')
				) {
					candidateMap.set(u, u);
				}
			}
		}

		const allCandidates = Array.from(candidateMap.keys());
		if (allCandidates.length === 0) {
			return m.reply(
				`🏙️ *[JALANAN SEPI]*\n\n` +
				`Suasana jalanan di sekitarmu sedang sepi sekali, tidak ada orang yang melintas untuk dibegal! Cobalah di grup yang lebih ramai.`
			);
		}

		const history = recentVictimsHistory.get(m.chat) || [];
		let eligible = allCandidates.filter(jid => !history.includes(jid));
		if (eligible.length === 0) {
			eligible = allCandidates.filter(jid => jid !== history[history.length - 1]);
			if (eligible.length === 0) eligible = allCandidates;
		}

		const withCarrots = eligible.filter(jid => (db.users[jid]?.money || 0) > 0);
		if (withCarrots.length > 0) {
			who = pickRandom(withCarrots);
		} else {
			who = pickRandom(eligible);
		}

		targetLid = candidateMap.get(who) || who;

		history.push(who);
		if (history.length > 5) history.shift();
		recentVictimsHistory.set(m.chat, history);
	}

	if (!who || who === m.sender || who === botNumber || who.startsWith(botNumber.split('@')[0])) {
		return m.reply('❌ Tidak menemukan target yang valid di jalanan sekitar!');
	}

	// 3. Pastikan Akun Korban Valid di Database (Carrot Asli)
	if (!db.users[who]) {
		db.users[who] = {
			name: 'Trainer',
			money: global.money?.free || 10000,
			limit: global.limit?.free || 5,
			exp: 0,
			brankas: 1,
			begalWeapons: [],
			begalSkill: { level: 1, points: 0 },
			lastclaim: 0,
			lastbegal: 0,
			lastrampok: 0
		};
	}

	const targetUser = db.users[who];
	if (!Array.isArray(targetUser.begalWeapons)) targetUser.begalWeapons = [];
	if (!targetUser.begalSkill) targetUser.begalSkill = { level: 1, points: 0 };

	const targetTag = who.split('@')[0];
	const victimCarrots = Math.max(0, Number(targetUser.money) || 0);

	// Jika korban benar-benar sudah kere / 0 Carrot akibat begal sebelumnya
	if (victimCarrots <= 0) {
		return m.reply(
			`💸 *[KORBAN SUDAH KERE / DOMPET KOSONG]*\n\n` +
			`Kamu menyergap @${targetTag} di tikungan jalanan, namun saat dompet dan tasnya digeledah, isinya kosong melompong (0 Carrot 🥕)!\n` +
			`Korban sudah jatuh miskin akibat begal sebelumnya dan tidak membawa sepeser pun uang.\n\n` +
			`_Cari mangsa lain yang masih memiliki simpanan Carrot!_`,
			{ mentions: [who, m.sender] }
		);
	}

	// 4. Deteksi Persenjataan Pelaku & Korban
	const robberWeapon = getUserBestWeapon(user);
	const victimWeapon = getUserBestWeapon(targetUser);

	const robberHasFirearm = robberWeapon && (robberWeapon.category === 'firearm' || robberWeapon.category === 'long_firearm');
	const victimHasFirearm = victimWeapon && (victimWeapon.category === 'firearm' || victimWeapon.category === 'long_firearm');

	// 5. Cek Pemicu Kehadiran Polisi (Misal: 25% jika menggunakan senjata api keras atau dari alarm brankas)
	const targetBrankas = Math.min(5, Math.max(1, Number(targetUser.brankas) || 1));
	const vaultCfg = BRANKAS_CONFIG[targetBrankas] || BRANKAS_CONFIG[1];

	const policeTriggerChance = robberHasFirearm ? 0.25 : vaultCfg.policeRate;
	const isPoliceAmbush = Math.random() < policeTriggerChance;

	if (isPoliceAmbush) {
		// 🚨 REGU POLISI MENGEPUNG! Polisi tidak sendiri!
		const robberSkillLv = Math.min(10, Math.max(1, Number(user.begalSkill?.level) || 1));
		// Skill polesan .begalskill meningkatkan peluang menang lawan regu polisi (10% s/d 55%)
		const policeWinChance = Math.min(0.55, 0.10 + (robberSkillLv - 1) * 0.05);
		const winAgainstPolice = Math.random() < policeWinChance;

		if (winAgainstPolice) {
			// MENANG LAWAN SELURUH POLISI BERKAT SKILL!
			const lootAmount = victimCarrots;
			targetUser.money = 0;
			if (targetUser.carrot !== undefined) targetUser.carrot = 0;
			user.money = (Number(user.money) || 0) + lootAmount;
			if (user.carrot !== undefined) user.carrot = user.money;

			user.lastbegal = 0;
			global._dbDirty = true;
			if (global.database?.write) global.database.write(global.db).catch(() => {});

			return m.reply(
				`🚨⚔️ *[DUEL SENGIT - MENANG LAWAN REGU POLISI!]*\n\n` +
				`Sirine polisi meraung-raung kencang! Regu Taktis Kepolisian Tracen yang dipimpin oleh *Polisi Oguri Cap* mengepung lokasi dan menembakkan tembakan peringatan!\n\n` +
				`Namun berkat *Skill Begal Level ${robberSkillLv}* milikmu yang telah dipoles dengan *.begalskill*, kamu mampu bermanuver taktis di balik pilar, melempar tabung asap, melumpuhkan barikade polisi satu per satu, dan kabur menembus kepungan!\n\n` +
				`💰 *Hasil Rampasan:* Berhasil mengamankan seluruh Carrot milik @${targetTag} sebesar *${lootAmount.toLocaleString('id-ID')} Carrot 🥕*!\n` +
				`✨ *Keberuntungan:* *GADA COOLDOWN!* Kamu resmi menjadi legenda gangster jalanan paling dicari!`,
				{ mentions: [who, m.sender] }
			);
		} else {
			// GAGAL LAWAN POLISI: BEGAL MATI KARENA POLISI TIDAK SENDIRIAN (DITEMBAK BERUNTUN -> COOLDOWN 1 JAM!)
			user.lastbegal = now;
			user.begalCdDuration = POLICE_DEATH_COOLDOWN_MS; // 1 Jam Cooldown!
			global._dbDirty = true;
			if (global.database?.write) global.database.write(global.db).catch(() => {});

			// Kirim sticker Polisi Oguri Cap resmi
			await sendPoliceSticker(conn, m);

			return m.reply(
				`🚨💀 *[BEGAL MOKAD - DIBERONDONG PELURU POLISI]*\n\n` +
				`🚨 *WII-UU-WII-UU-WII-UU!* 🚨\n` +
				`Regu Taktis Kepolisian Tracen yang dipimpin oleh *Polisi Oguri Cap* mengepungmu dari segala penjuru! Polisi tidak datang sendirian!\n\n` +
				`👮 *Polisi Oguri Cap:* _"BERHENTI! JANGAN BERGERAK! LEPASKAN SENJATAMU!"_\n\n` +
				`Melihatmu berusaha melawan, seluruh regu polisi serempak melepaskan tembakan beruntun (*rapid burst fire*)!\n` +
				`💥💥💥 *DOR-DOR-DOR-DORRRR!!* 💥💥💥\n` +
				`Puluhan peluru menembus tubuhmu tanpa ampun! Kamu tersungkur tewas di aspal jalanan akademi Tracen!\n\n` +
				`⛓️ *Status:* MATI DI TEMPAT KEJADIAN & BARANG BUKTI DISITA!\n` +
				`⏱️ *Sanksi:* Cooldown selama *1 JAM (60 MENIT)* untuk hidup dan pulih kembali!\n\n` +
				`💡 *Tips:* Asah kemampuan bertempurmu dengan command *.begalskill* agar bisa membalikkan keadaan saat dikepung polisi!`,
				{ mentions: [who, m.sender] }
			);
		}
	}

	// 6. SKENARIO ADU TEMBAK JIKA KEDUA PIHAK PUNYA SENJATA API
	if (robberHasFirearm && victimHasFirearm) {
		// Adu Tembak (Shootout): Korban menggunakan senjata terbaiknya (cth: AK-47 jika punya laras panjang)
		const shootoutRoll = Math.random();

		// ATURAN USER: "chance mati barengnya itu 90% jadi gada yang menang"
		if (shootoutRoll < 0.90) {
			// 💀 90% CHANCE: MATI BARENG (MUTUAL ANNIHILATION)
			user.lastbegal = now;
			user.begalCdDuration = BEGAL_COOLDOWN_MS;
			targetUser.lastbegal = now;
			targetUser.begalCdDuration = BEGAL_COOLDOWN_MS;
			global._dbDirty = true;
			if (global.database?.write) global.database.write(global.db).catch(() => {});

			return m.reply(
				`💥⚔️ *[ADU TEMBAK SENGIT - MOKAD BARENG (90% CHANCE)]*\n\n` +
				`Saat kamu menarik pelatuk *${robberWeapon.name}* ${robberWeapon.icon}, @${targetTag} ternyata adalah pembegal veteran yang langsung mencabut senjata andalannya, *${victimWeapon.name}* ${victimWeapon.icon}!\n\n` +
				`💥💥 *DUARRR! DORRR! DORRR!* 💥💥\n` +
				`Baku tembak jarak dekat meletus di tengah jalanan! Peluru saling bersilang di udara dan menembus dada kalian berdua pada detik yang sama!\n\n` +
				`☠️ *Hasil Duel:* KEDUA PEMBEGAL MOKAD BERSAMA DI ATAS ASPAL!\n` +
				`Tidak ada yang menang dan tidak ada Carrot yang berhasil dirampas!\n` +
				`⏱️ *Sanksi:* Cooldown selama *30 MENIT* bagi kedua pemain untuk evakuasi UGD.`,
				{ mentions: [who, m.sender] }
			);
		} else if (shootoutRoll < 0.95) {
			// 5% Begal berhasil mendahului menembak jatuh korban
			const stolen = victimCarrots;
			targetUser.money = 0;
			if (targetUser.carrot !== undefined) targetUser.carrot = 0;
			user.money = (Number(user.money) || 0) + stolen;
			if (user.carrot !== undefined) user.carrot = user.money;

			user.lastbegal = 0;
			global._dbDirty = true;
			if (global.database?.write) global.database.write(global.db).catch(() => {});

			let narasiMenangDuel = '';
			if (stolen >= 5000000) {
				narasiMenangDuel =
					`💥🏆 *[MENANG DUEL ADU TEMBAK - KARTU ATM DIBOBOL!]*\n\n` +
					`Adu tembak menegangkan! @${targetTag} sempat membalas dengan *${victimWeapon.name}*, namun tembakan *${robberWeapon.name}* milikmu lebih cepat menembus bahunya hingga korban tersungkur!\n\n` +
					`Sambil merintih tak berdaya, korban menyerahkan dompet tebal dan *Kartu ATM Prioritas Tracen Bank* miliknya beserta kode PIN!\n` +
					`🏧 *Pencairan ATM:* Kamu menguras seluruh saldo rekening sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕* yang LANGSUNG CAIR ke dompet utamamu!\n` +
					`✨ *Keberuntungan:* *GADA COOLDOWN!* Duel legendaris berakhir dengan kemenanganmu!`;
			} else {
				narasiMenangDuel =
					`💥🏆 *[MENANG DUEL ADU TEMBAK - SEMUA CARROT DIBAWA KABUR]*\n\n` +
					`Adu tembak menegangkan! @${targetTag} membalas dengan *${victimWeapon.name}*, namun peluru *${robberWeapon.name}* milikmu lebih cepat melumpuhkan korban!\n\n` +
					`💰 *Hasil Begal:* Mengambil *SEMUA* uang korban sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕*!\n` +
					`✨ *Keberuntungan:* *GADA COOLDOWN!* Korban tumbang dan kamu menguasai jalanan!`;
			}

			return m.reply(narasiMenangDuel, { mentions: [who, m.sender] });
		} else {
			// 5% Korban yang mendahului menembak mati begal
			user.lastbegal = now;
			user.begalCdDuration = BEGAL_COOLDOWN_MS;
			global._dbDirty = true;
			if (global.database?.write) global.database.write(global.db).catch(() => {});

			return m.reply(
				`💥💀 *[KALAH ADU TEMBAK - DITEMBAK MATI KORBAN]*\n\n` +
				`Kamu mengarahkan *${robberWeapon.name}*, namun @${targetTag} bergerak lebih gesit dengan *${victimWeapon.name}* ${victimWeapon.icon} miliknya!\n\n` +
				`💥 *DORRR!!* Peluru korban menghantam dadamu sebelum kamu sempat menarik pelatuk!\n` +
				`☠️ *Kondisi Begal:* MOKAD DI TEMPAT! Aksimu gagal total.\n` +
				`⏱️ *Sanksi:* Cooldown selama *30 MENIT* untuk pemulihan.`,
				{ mentions: [who, m.sender] }
			);
		}
	}

	// 7. SKENARIO JIKA BEGAL PUNYA SENJATA API & KORBAN TIDAK PUNYA SENJATA API
	if (robberHasFirearm && !victimHasFirearm) {
		// Tembak dari jauh dan ambil SEMUA uangnya (ATM jika >= 5jt)
		const stolen = victimCarrots;
		targetUser.money = 0;
		if (targetUser.carrot !== undefined) targetUser.carrot = 0;
		user.money = (Number(user.money) || 0) + stolen;
		if (user.carrot !== undefined) user.carrot = user.money;

		if (targetLid && targetLid !== who && db.users[targetLid]) {
			db.users[targetLid].money = 0;
			if (db.users[targetLid].carrot !== undefined) db.users[targetLid].carrot = 0;
		}

		user.lastbegal = 0;
		global._dbDirty = true;
		if (global.database?.write) global.database.write(global.db).catch(() => {});

		let narasiSenjataApi = '';
		if (stolen >= 5000000) {
			narasiSenjataApi =
				`🎯💳 *[TEMBAKAN JARAK JAUH - KARTU ATM DIBOBOL!]*\n\n` +
				`Dari kejauhan tanpa disadari korban, kamu mengokang *${robberWeapon.name}* ${robberWeapon.icon} dan melepaskan tembakan presisi yang melumpuhkan langkah kaki @${targetTag}!\n\n` +
				`Menyadari nyawanya di ujung tanduk, korban yang tak berdaya langsung melemparkan dompet dan *Kartu ATM Prioritas Tracen Bank* miliknya beserta nomor PIN rahasia!\n\n` +
				`🏧 *Pencairan ATM:* Kamu segera mendatangi mesin ATM terdekat dan menguras habis seluruh saldo rekening sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕* yang LANGSUNG CAIR ke dompet utamamu!\n` +
				`🛡️ *Pertahanan Korban:* Tingkat ${targetBrankas} (${vaultCfg.name}) ${vaultCfg.icon} [Tembus Total]\n` +
				`✨ *Keberuntungan:* *GADA COOLDOWN!* Aksi pembegalan profesional kelas kakap sukses sempurna!`;
		} else {
			narasiSenjataApi =
				`🎯🔫 *[TEMBAKAN JARAK JAUH - SEMUA CARROT DISITA!]*\n\n` +
				`Menggunakan *${robberWeapon.name}* ${robberWeapon.icon}, kamu melepaskan tembakan dari kejauhan tepat di depan langkah kaki @${targetTag}!\n\n` +
				`Korban terperanjat kaget, langsung mengangkat kedua tangan dan pasrah menyerahkan *SEMUA* uang saku dan simpanannya tanpa perlawanan!\n\n` +
				`💰 *Hasil Begal:* Mengambil *SEMUA* Carrot milik @${targetTag} sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕*!\n` +
				`🛡️ *Pertahanan Korban:* Tingkat ${targetBrankas} (${vaultCfg.name}) ${vaultCfg.icon}\n` +
				`✨ *Keberuntungan:* *GADA COOLDOWN!* Korban tidak berkutik di bawah todongan senjata apimu!`;
		}

		return m.reply(narasiSenjataApi, { mentions: [who, m.sender] });
	}

	// 8. SKENARIO BEGAL DENGAN SENJATA JARAK DEKAT (PISAU / KATANA) ATAU TANGAN KOSONG
	const roll = Math.random();

	if (roll < vaultCfg.winRate) {
		const surrenderChance = vaultCfg.surrenderRate || 0.35;
		const isSurrender = (Math.random() < surrenderChance) || (victimCarrots <= 2500);

		let stolen = 0;
		let narasiSukses = '';

		if (isSurrender) {
			stolen = victimCarrots;
			narasiSukses =
				`😱 *[KORBAN MENYERAHKAN DIRI - SEMUA CARROT DISITA!]*\n\n` +
				`Melihat ancamanmu${robberWeapon ? ` dengan ${robberWeapon.name} ${robberWeapon.icon}` : ''}, @${targetTag} gemetar ketakutan dan langsung berlutut mengangkat kedua tangan sambil memohon ampun!\n` +
				`Korban tidak berani melawan dan dengan pasrah menyerahkan *SELURUH* isi dompet dan brankasnya kepadamu!\n\n` +
				`💰 *Hasil Begal (Sapubersih):* Berhasil merampas *SEMUA* Carrot milik @${targetTag} sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕*!\n` +
				`🛡️ *Pertahanan Korban:* Tingkat ${targetBrankas} (${vaultCfg.name}) ${vaultCfg.icon} [Tunduk Ketakutan]\n` +
				`✨ *Keberuntungan:* *GADA COOLDOWN!* Kamu membawa kabur seluruh harta mangsa dan bebas beraksi lagi!`;
		} else {
			const lootPct = 0.50 + Math.random() * 0.35;
			stolen = Math.floor(victimCarrots * lootPct);
			stolen = Math.max(500, Math.min(victimCarrots, stolen));

			if (targetBrankas === 1) {
				narasiSukses =
					`🗡️ *[AKSI BEGAL SUKSES - BRANKAS BIASA]*\n\n` +
					`Kamu mencegat @${targetTag} di tikungan sepi dekat gerbang akademi${robberWeapon ? ` bersenjatakan ${robberWeapon.name}` : ''}. Karena korban hanya memakai kantong biasa tanpa kunci ganda, kamu dengan mudah menodong dan merampas simpanannya!\n\n` +
					`💰 *Hasil Begal:* Berhasil membegal @${targetTag} sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕*!\n` +
					`🛡️ *Pertahanan Korban:* Tingkat 1 (Biasa) ${vaultCfg.icon}\n` +
					`✨ *Keberuntungan:* *GADA COOLDOWN!* Kamu bebas melancarkan aksi berikutnya kapan saja!`;
			} else if (targetBrankas === 2) {
				narasiSukses =
					`🗡️ *[AKSI BEGAL SUKSES - BRANKAS NORMAL]*\n\n` +
					`Kamu membuntuti @${targetTag} dan menyergapnya saat lengah. Brankas tas sampingnya terkunci gembok kombinasi ganda, namun berkat kecepatan tanganmu, penguncinya berhasil dicongkel sebelum ia sempat berteriak!\n\n` +
					`💰 *Hasil Begal:* Berhasil membegal @${targetTag} sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕*!\n` +
					`🛡️ *Pertahanan Korban:* Tingkat 2 (Normal) ${vaultCfg.icon}\n` +
					`✨ *Keberuntungan:* *GADA COOLDOWN!* Kamu berhasil kabur dengan gesit membawa pundi-pundi mangsa!`;
			} else if (targetBrankas === 3) {
				narasiSukses =
					`🗡️ *[AKSI BEGAL SUKSES - BRANKAS STANDAR]*\n\n` +
					`Operasi berisiko tinggi! @${targetTag} menggunakan brankas digital ber-keypad dengan sensor getar standar. Menggunakan alat peretas sirkuit mini, kamu membobol kode akses tepat sesaat sebelum alarm berbunyi!\n\n` +
					`💰 *Hasil Begal:* Berhasil membegal @${targetTag} sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕*!\n` +
					`🛡️ *Pertahanan Korban:* Tingkat 3 (Standar) ${vaultCfg.icon}\n` +
					`✨ *Keberuntungan:* *GADA COOLDOWN!* Aksi brilian, dompet korban terkuras hebat!`;
			} else if (targetBrankas === 4) {
				narasiSukses =
					`🗡️ *[AKSI BEGAL SUKSES - BRANKAS BAIK]*\n\n` +
					`HEBAT! @${targetTag} memiliki sistem keamanan brankas biometrik tingkat tinggi. Kamu melempar granat asap pengacau sensor optik dan memotong kabel daya darurat, berhasil merebut kantong Carrot berharga sebelum sistem lockdown aktif!\n\n` +
					`💰 *Hasil Begal:* Berhasil membegal @${targetTag} sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕*!\n` +
					`🛡️ *Pertahanan Korban:* Tingkat 4 (Baik) ${vaultCfg.icon}\n` +
					`✨ *Keberuntungan:* *GADA COOLDOWN!* Nyali bajamu membungkam teknologi tinggi korban!`;
			} else {
				narasiSukses =
					`🗡️ *[AKSI BEGAL LEGENDARIS - BRANKAS MILITER 🎖️]*\n\n` +
					`LUAR BIASA & NEKAT! Brankas pertahanan Militer milik @${targetTag} yang dilapisi titanium anti-balistik dan perimeter laser berhasil kamu tembus secara spektakuler! Menggunakan pemotong plasma dan emp jammer, kamu mencuri jarahan tepat sebelum pertahanan otomatis menembakkan rudal balistik!\n\n` +
					`💰 *Hasil Begal:* Berhasil membegal @${targetTag} sebesar *${stolen.toLocaleString('id-ID')} Carrot 🥕*!\n` +
					`🛡️ *Pertahanan Korban:* Tingkat 5 (Militer) ${vaultCfg.icon}\n` +
					`✨ *Keberuntungan:* *GADA COOLDOWN!* Kamu menjadi legenda begal jalanan paling ditakuti!`;
			}
		}

		targetUser.money = Math.max(0, victimCarrots - stolen);
		if (targetUser.carrot !== undefined) targetUser.carrot = targetUser.money;

		user.money = (Number(user.money) || 0) + stolen;
		if (user.carrot !== undefined) user.carrot = user.money;

		if (targetLid && targetLid !== who && db.users[targetLid]) {
			db.users[targetLid].money = targetUser.money;
			if (db.users[targetLid].carrot !== undefined) db.users[targetLid].carrot = targetUser.money;
		}

		user.lastbegal = 0;
		global._dbDirty = true;
		if (global.database?.write) global.database.write(global.db).catch(() => {});

		return m.reply(narasiSukses, { mentions: [who, m.sender] });
	}

	// B. JIKA GAGAL: ADA 2 BAD ENDING
	// 1. Kena Tembak Korban (Begal Mokad -> GADA STICKER, Cooldown 30 Menit)
	// 2. Tertangkap / Disergap Polisi Oguri Cap (Resmi Tertangkap Polisi -> WAJIB KIRIM STICKER POLISI, Cooldown 1 Jam / 30 Menit)
	const failTypeRoll = Math.random();
	const isShotByTarget = failTypeRoll < (vaultCfg.shootRate / (vaultCfg.shootRate + vaultCfg.policeRate));

	if (isShotByTarget) {
		// Bad Ending 1: Kena Tembak Korban (Begal Mokad)
		// ATURAN USER: "kalau matinya ditangan target ya gada sticker" -> TIDAK MENGIRIM STICKER!
		user.lastbegal = now;
		user.begalCdDuration = BEGAL_COOLDOWN_MS;
		global._dbDirty = true;
		if (global.database?.write) global.database.write(global.db).catch(() => {});

		return m.reply(
			`💥 *[BEGAL GAGAL - MOKAD KENA TEMBAK KORBAN]*\n\n` +
			`Nahas bagi pembegal! Saat kamu mendekat hendak menyergap @${targetTag}, korban ternyata sudah menyadari gerak-gerikmu dan bersiap dengan senjata api perlawanan!\n\n` +
			`💥 *DORRRR!!* Satu tembakan telak menembus dadamu!\n` +
			`☠️ *Kondisi Begal:* *MOKAD DI TEMPAT KEJADIAN!*\n` +
			`🩸 Tubuhmu tersungkur tak berdaya dan dilarikan ke Unit Gawat Darurat Tracen.\n\n` +
			`⏱️ *Sanksi:* Langsung Cooldown selama *30 MENIT* untuk pemulihan luka tembak.\n` +
			`_Carrot korban tetap aman terlindungi._`,
			{ mentions: [who, m.sender] }
		);
	} else {
		// Bad Ending 2: Ditangkap Polisi (Resmi Tertangkap oleh Polisi Oguri Cap)
		// ATURAN USER: "bot ngirim sticker oguri cap versi polisi dengan pose nyuruh berhenti... artinya ketangkap polisi"
		user.lastbegal = now;
		user.begalCdDuration = POLICE_DEATH_COOLDOWN_MS;
		global._dbDirty = true;
		if (global.database?.write) global.database.write(global.db).catch(() => {});

		// Kirim sticker Polisi Oguri Cap resmi
		await sendPoliceSticker(conn, m);

		return m.reply(
			`🚨👮 *[BEGAL TERCIDUK - TERTANGKAP RESMI OLEH POLISI]*\n\n` +
			`🚨 *WII-UU-WII-UU-WII-UU!* 🚨\n` +
			`Alarm keamanan milik @${targetTag} berbunyi kencang! Sebelum kamu sempat melarikan diri, Tim Patroli Kepolisian Tracen yang dipimpin oleh *Polisi Oguri Cap* langsung mengepung dan menghadang jalanmu!\n\n` +
			`👮 *Polisi Oguri Cap:* _"BERHENTI! JANGAN BERGERAK! TANGAN DI ATAS KEPALA!"_\n\n` +
			`⛓️ *Status:* DIBORGOL & DIJEBLOSKAN KE SEL TAHANAN!\n` +
			`⏱️ *Sanksi:* Langsung Cooldown selama *1 JAM (60 MENIT)* untuk menjalani hukuman kurungan penjara.\n` +
			`_Aksimu gagal total dan barang bukti disita polisi._`,
			{ mentions: [who, m.sender] }
		);
	}
};

// 🛒 BEGAL SHOP (Toko Senjata Begal)
const gameBegalShop = async (conn, m, db, text = '', args = []) => {
	let user = db.users[m.sender];
	if (!user) {
		db.users[m.sender] = { money: 1000, lastbegal: 0, brankas: 1, begalWeapons: [], begalSkill: { level: 1, points: 0 } };
		user = db.users[m.sender];
	}

	if (!Array.isArray(user.begalWeapons)) user.begalWeapons = [];
	if (!user.begalSkill) user.begalSkill = { level: 1, points: 0 };

	const userExp = user.exp || 0;
	const userLevel = getLevelInfo(userExp).level;
	const userMoney = Number(user.money) || 0;

	const subCmd = (args[0] || '').toLowerCase();
	const itemQuery = (args[1] || text.replace(/^(beli|buy)\s+/i, '') || '').toLowerCase().trim();

	// Jika memilih membeli senjata: .begalshop beli <senjata>
	if (subCmd === 'beli' || subCmd === 'buy' || itemQuery) {
		const targetKey = itemQuery || subCmd;
		let selectedWeapon = null;

		for (const [k, item] of Object.entries(BEGAL_WEAPONS)) {
			if (k === targetKey || item.name.toLowerCase().includes(targetKey)) {
				selectedWeapon = item;
				break;
			}
		}

		if (!selectedWeapon) {
			return m.reply(
				`❌ Senjata *"${targetKey}"* tidak ditemukan di Begal Shop!\n\n` +
				`Ketik *.begalshop* untuk melihat daftar senjata yang tersedia.`
			);
		}

		if (user.begalWeapons.includes(selectedWeapon.id)) {
			return m.reply(
				`ℹ️ Kamu sudah memiliki senjata *${selectedWeapon.name}* ${selectedWeapon.icon} di tas persenjataanmu!`
			);
		}

		if (userLevel < selectedWeapon.minLvl) {
			return m.reply(
				`⚠️ *[LEVEL TIDAK CUKUP]*\n\n` +
				`Kamu membutuhkan minimal *Level ${selectedWeapon.minLvl}* untuk membeli senjata *${selectedWeapon.name}* ${selectedWeapon.icon}!\n` +
				`Level kamu saat ini: *Level ${userLevel}*. Tingkatkan XP kamu terlebih dahulu!`
			);
		}

		if (userMoney < selectedWeapon.price) {
			return m.reply(
				`💸 *[SALDO TIDAK CUKUP]*\n\n` +
				`Harga *${selectedWeapon.name}* adalah *${selectedWeapon.price.toLocaleString('id-ID')} Carrot 🥕*.\n` +
				`Saldo Carrot kamu saat ini: *${userMoney.toLocaleString('id-ID')} Carrot* (Kurang *${(selectedWeapon.price - userMoney).toLocaleString('id-ID')} Carrot*).`
			);
		}

		// Eksekusi Pembelian
		user.money = userMoney - selectedWeapon.price;
		if (user.carrot !== undefined) user.carrot = user.money;
		user.begalWeapons.push(selectedWeapon.id);

		global._dbDirty = true;
		if (global.database?.write) global.database.write(global.db).catch(() => {});

		return m.reply(
			`🎉 *[PEMBELIAN SENJATA BERHASIL!]*\n\n` +
			`Kamu resmi membeli senjata *${selectedWeapon.name}* ${selectedWeapon.icon}!\n\n` +
			`💰 *Biaya:* -${selectedWeapon.price.toLocaleString('id-ID')} Carrot 🥕\n` +
			`💳 *Sisa Saldo:* ${(user.money).toLocaleString('id-ID')} Carrot\n` +
			`⚔️ *Kategori:* ${selectedWeapon.rangeType}\n` +
			`📖 *Deskripsi:* ${selectedWeapon.deskripsi}\n\n` +
			`_Senjata ini otomatis siap digunakan saat kamu melancarkan aksi .begal atau bertahan dari begal lain!_`
		);
	}

	// Tampilkan Katalog Begal Shop
	let listToko = '';
	for (const [k, w] of Object.entries(BEGAL_WEAPONS)) {
		const isOwned = user.begalWeapons.includes(w.id);
		const canLevel = userLevel >= w.minLvl;
		const canMoney = userMoney >= w.price;

		const badge = isOwned
			? '✅ [SUDAH DIMILIKI]'
			: (!canLevel ? `🔒 [Butuh Lv ${w.minLvl}]` : (!canMoney ? '💸 [Kurang Saldo]' : '🛒 [Siap Beli]'));

		listToko +=
			`${w.icon} *${w.name}* ${badge}\n` +
			`   ├ 💵 Harga: *${w.price.toLocaleString('id-ID')} Carrot 🥕*\n` +
			`   ├ ⚡ Syarat: Min Level ${w.minLvl} (Level kamu: Lv ${userLevel})\n` +
			`   ├ 🎯 Tipe: ${w.rangeType}\n` +
			`   ├ 📜 ${w.deskripsi}\n` +
			`   └ 🛒 Beli: *.begalshop beli ${w.id}*\n\n`;
	}

	const caption =
		`╔══════════════════════════════╗\n` +
		`   🛒 𝗕𝗘𝗚𝗔𝗟 𝗦𝗛𝗢𝗣 - 𝗣𝗘𝗥𝗦𝗘𝗡𝗝𝗔𝗧𝗔𝗔𝗡\n` +
		`╚══════════════════════════════╝\n\n` +
		`👤 *Pembeli:* @${m.sender.split('@')[0]}\n` +
		`⚡ *Level Kamu:* Level ${userLevel} (${userExp.toLocaleString('id-ID')} XP)\n` +
		`💰 *Saldo Carrot:* ${userMoney.toLocaleString('id-ID')} Carrot 🥕\n` +
		`🎒 *Senjata Aktif:* ${getUserBestWeapon(user)?.name || 'Tangan Kosong'}\n\n` +
		`📋 *Katalog Persenjataan Pasar Gelap:*\n\n` +
		listToko +
		`💡 *Cara Membeli Senjata:*\n` +
		`Ketik: *.begalshop beli <id_senjata>*\n` +
		`Contoh: *.begalshop beli pistol* atau *.begalshop beli ak47*\n\n` +
		`_Senjata api memungkinkanmu menembak dari jauh dan menguras semua saldo korban (termasuk ATM jika saldo 5jt+)!_`;

	return m.reply(caption, { mentions: [m.sender] });
};

// 🎯 BEGAL SKILL (Latihan Memoles Kemampuan Begal)
const gameBegalSkill = async (conn, m, db, text = '', args = []) => {
	let user = db.users[m.sender];
	if (!user) {
		db.users[m.sender] = { money: 1000, lastbegal: 0, brankas: 1, begalWeapons: [], begalSkill: { level: 1, points: 0 } };
		user = db.users[m.sender];
	}

	if (!user.begalSkill) user.begalSkill = { level: 1, points: 0 };
	const now = Date.now();
	const SKILL_TRAIN_COOLDOWN = 10 * 60 * 1000; // 10 Menit Cooldown Latihan
	const TRAINING_COST = 50000; // 50.000 Carrot untuk amunisi & instruktur gelap

	if (user.begalSkill.lastTraining && (now - user.begalSkill.lastTraining < SKILL_TRAIN_COOLDOWN)) {
		const sisaMs = SKILL_TRAIN_COOLDOWN - (now - user.begalSkill.lastTraining);
		return m.reply(
			`⏳ *[LAPANGAN TEMBAK DALAM PENDINGINAN]*\n\n` +
			`Otot dan fokusmu masih lelah setelah sesi latihan sebelumnya!\n` +
			`⏱️ *Bisa Latihan Lagi:* *${clockString(sisaMs)}* (10 Menit)`
		);
	}

	const userMoney = Number(user.money) || 0;
	if (userMoney < TRAINING_COST) {
		return m.reply(
			`💸 *[SALDO KURANG]* Latihan memoles skill membutuhkan biaya amunisi dan target tembak sebesar *${TRAINING_COST.toLocaleString('id-ID')} Carrot 🥕*.\n` +
			`Saldo kamu saat ini: *${userMoney.toLocaleString('id-ID')} Carrot*.`
		);
	}

	// Potong biaya latihan
	user.money = userMoney - TRAINING_COST;
	if (user.carrot !== undefined) user.carrot = user.money;

	// Dapatkan poin skill
	const gainedPoints = Math.floor(Math.random() * 16) + 15; // +15 s/d +30 poin
	user.begalSkill.points = (user.begalSkill.points || 0) + gainedPoints;
	user.begalSkill.lastTraining = now;

	const currentLevel = user.begalSkill.level || 1;
	const pointsNeeded = currentLevel * 100;
	let levelUpTeks = '';

	if (user.begalSkill.points >= pointsNeeded && currentLevel < 10) {
		user.begalSkill.level = currentLevel + 1;
		user.begalSkill.points -= pointsNeeded;
		levelUpTeks =
			`\n\n🔥 *LEVEL SKILL BEGAL NAIK!* 🔥\n` +
			`Keahlian bertempurmu kini naik ke *Level ${user.begalSkill.level}*!\n` +
			`Peluang memenangkan duel melawan seluruh regu polisi kini meningkat menjadi *${10 + (user.begalSkill.level - 1) * 5}%*!`;
	}

	global._dbDirty = true;
	if (global.database?.write) global.database.write(global.db).catch(() => {});

	return m.reply(
		`🎯 *[LATIHAN SKILL BEGAL SELESAI]*\n\n` +
		`Kamu menghabiskan 500 butir peluru di lapangan tembak bawah tanah Kasamatsu, melatih reaksi cepat, manuver menembak di balik barikade beton, dan teknik melumpuhkan regu SWAT!\n\n` +
		`📈 *Hasil Latihan:* +${gainedPoints} Poin Skill Begal!\n` +
		`⭐ *Total Poin:* ${user.begalSkill.points} / ${user.begalSkill.level * 100} Poin\n` +
		`🎖️ *Level Skill Saat Ini:* Level ${user.begalSkill.level}\n` +
		`🛡️ *Peluang Menang vs Polisi:* ~${10 + (user.begalSkill.level - 1) * 5}%` +
		levelUpTeks +
		`\n\n_Ketik .begalskillinfo untuk melihat rincian lengkap atribut skillmu!_`
	);
};

// 📊 BEGAL SKILL INFO (Dashboard Status Skill & Persenjataan)
const gameBegalSkillInfo = async (conn, m, db, text = '', args = []) => {
	let user = db.users[m.sender];
	if (!user) {
		db.users[m.sender] = { money: 1000, lastbegal: 0, brankas: 1, begalWeapons: [], begalSkill: { level: 1, points: 0 } };
		user = db.users[m.sender];
	}

	if (!user.begalSkill) user.begalSkill = { level: 1, points: 0 };
	if (!Array.isArray(user.begalWeapons)) user.begalWeapons = [];

	const skillLv = user.begalSkill.level || 1;
	const skillPts = user.begalSkill.points || 0;
	const nextReq = skillLv * 100;
	const bestWp = getUserBestWeapon(user);

	const titles = {
		1: 'Copet Magang Jalanan',
		2: 'Begundal Pinggiran',
		3: 'Bandit Jalanan Berbahaya',
		4: 'Penodong Berdarah Dingin',
		5: 'Penembak Runduk Taktis',
		6: 'Spesialis Pembobol Brankas',
		7: 'Komandan Pasukan Bayaran',
		8: 'Bos Gangster Bawah Tanah',
		9: 'Buronan Kelas Kakap Nasional',
		10: 'Legenda Mafia Tracen Tak Terkalahkan'
	};

	const policeWinRate = Math.min(55, 10 + (skillLv - 1) * 5);

	let ownedList = user.begalWeapons.length > 0
		? user.begalWeapons.map(id => `• ${BEGAL_WEAPONS[id]?.icon} ${BEGAL_WEAPONS[id]?.name}`).join('\n')
		: '_Belum memiliki senjata. Belilah di .begalshop!_';

	const caption =
		`╔══════════════════════════════╗\n` +
		`   🎯 𝗜𝗡𝗙𝗢 𝗦𝗞𝗜𝗟𝗟 & 𝗔𝗥𝗦𝗘𝗡𝗔𝗟 𝗕𝗘𝗚𝗔𝗟\n` +
		`╚══════════════════════════════╝\n\n` +
		`👤 *Nama:* @${m.sender.split('@')[0]}\n` +
		`🎖️ *Gelar Reputasi:* *${titles[skillLv] || titles[1]}*\n` +
		`⭐ *Level Skill Begal:* *Level ${skillLv} / 10*\n` +
		`📊 *Poin Progres:* ${skillPts} / ${nextReq} Poin Skill\n\n` +
		`⚔️ *Senjata Utama Terkuat:* ${bestWp ? `${bestWp.name} ${bestWp.icon}` : 'Tangan Kosong'}\n` +
		`🛡️ *Peluang Menang Lawan Regu Polisi:* *${policeWinRate}%*\n\n` +
		`🎒 *Senjata yang Dimiliki:*\n${ownedList}\n\n` +
		`💡 *Manfaat Memoles Skill Begal:*\n` +
		`• Saat polisi datang mengepung, polisi menembak beruntun dan membunuh begal (cooldown 1 jam).\n` +
		`• Namun jika skill begalmu tinggi, kamu bisa *MENANG DUEL* melawan seluruh polisi dan kabur membawa semua Carrot tanpa cooldown!\n` +
		`• Ketik *.begalskill* untuk berlatih di lapangan tembak rahasia!`;

	return m.reply(caption, { mentions: [m.sender] });
};

const gameBrankas = async (conn, m, db, text = '', args = []) => {
	let user = db.users[m.sender];
	if (!user) {
		db.users[m.sender] = { money: 1000, lastbegal: 0, brankas: 1 };
		user = db.users[m.sender];
	}

	const userExp = user.exp || 0;
	const userLevel = getLevelInfo(userExp).level;
	const currentTier = Math.min(5, Math.max(1, Number(user.brankas) || 1));
	const currentCfg = BRANKAS_CONFIG[currentTier] || BRANKAS_CONFIG[1];

	const targetInput = (args[0] || text || '').trim();

	// Jika tanpa parameter: Tampilkan menu info brankas lengkap
	if (!targetInput || targetInput === 'info' || targetInput === 'cek') {
		let listMenu = '';
		for (let i = 1; i <= 5; i++) {
			const cfg = BRANKAS_CONFIG[i];
			const isUnlocked = userLevel >= cfg.minLvl;
			const isCurrent = currentTier === i;
			const statusBadge = isCurrent ? '👈 [SEDANG AKTIF]' : isUnlocked ? '🔓 [Terbuka]' : `🔒 [Butuh Lv ${cfg.minLvl}]`;
			listMenu +=
				`${i}️⃣ *Tingkat ${i}: ${cfg.name}* ${cfg.icon} ${statusBadge}\n` +
				`   ├ 📜 ${cfg.deskripsi}\n` +
				`   ├ ⚡ Syarat: Minimal Level ${cfg.minLvl}\n` +
				`   └ 🛡️ Ketahanan: Peluang Begal Lolos hanya ~${Math.round(cfg.winRate * 100)}%\n\n`;
		}

		const caption =
			`╔══════════════════════════════╗\n` +
			`   🏦 𝗞𝗘𝗔𝗠𝗔𝗡𝗔𝗡 𝗕𝗥𝗔𝗡𝗞𝗔𝗦 𝗞𝗘𝗨𝗔𝗡𝗚𝗔𝗡\n` +
			`╚══════════════════════════════╝\n\n` +
			`👤 *Pemilik:* @${m.sender.split('@')[0]}\n` +
			`⚡ *Level Kamu:* Level ${userLevel} (${(userExp).toLocaleString('id-ID')} XP)\n` +
			`💰 *Saldo Carats:* ${(user.money || 0).toLocaleString('id-ID')} Carats\n` +
			`🛡️ *Keamanan Aktif:* *Tingkat ${currentTier} (${currentCfg.name})* ${currentCfg.icon}\n\n` +
			`📋 *Daftar Tingkat Keamanan Brankas:*\n` +
			listMenu +
			`💡 *Cara Mengganti Tingkat Keamanan:*\n` +
			`Ketik: *.brankas <1-5>*\n` +
			`Contoh: *.brankas 2* atau *.brankas 5*\n\n` +
			`_Makin tinggi tingkat keamanan brankasmu, peluang begal berhasil semakin kecil dan begal rawan kena tembak / diciduk polisi!_`;

		return m.reply(caption, m.chat, { mentions: [m.sender] });
	}

	const chosenTier = parseInt(targetInput, 10);
	if (isNaN(chosenTier) || chosenTier < 1 || chosenTier > 5) {
		return m.reply(
			`❌ Pilihan tingkat tidak valid! Gunakan angka 1 sampai 5.\n` +
			`Contoh: *.brankas 2* atau *.brankas 5*`
		);
	}

	const targetCfg = BRANKAS_CONFIG[chosenTier];

	// ATURAN USER: "kalau user maksa tingkat yang belum kebuka bot cuma ngirim peringatan doang seterusnya gada biar ga spam"
	if (userLevel < targetCfg.minLvl) {
		return m.reply(
			`⚠️ *[PERINGATAN BRANKAS]* Level kamu belum mencukupi untuk mengaktifkan Keamanan Tingkat ${chosenTier} (${targetCfg.name}).\n` +
			`Syarat: Minimal Level ${targetCfg.minLvl} (Level kamu saat ini: Level ${userLevel}).`
		);
	}

	if (currentTier === chosenTier) {
		return m.reply(
			`ℹ️ Keamanan brankas keuanganmu sudah berada di Tingkat ${chosenTier} (${targetCfg.name}) ${targetCfg.icon}.`
		);
	}

	// Berhasil update tingkat brankas
	user.brankas = chosenTier;

	return m.reply(
		`✅ *[KEAMANAN BRANKAS DIPERBARUI]*\n\n` +
		`Berhasil mengaktifkan *Keamanan Tingkat ${chosenTier}: ${targetCfg.name}* ${targetCfg.icon}!\n\n` +
		`🛡️ *Spesifikasi Pertahanan:* ${targetCfg.deskripsi}\n` +
		`📊 *Ketahanan Begal:* Peluang pembegal menembus brankasmu kini ditekan hingga ~${Math.round(targetCfg.winRate * 100)}%.\n` +
		`🔒 Dompet & Carats kamu di profil kini jauh lebih aman dari ancaman begal jalanan!`
	);
};

const daily = async (m, db) => {

	try {

		let user = db.users[m.sender]

		if (!user.lastclaim)
			user.lastclaim = 0

		let now = Date.now()

		let cooldown = 86400000

		let sisa = cooldown - (
			now - user.lastclaim
		)

		if (sisa > 0)

			return m.reply(

`🎓 𝐓𝐑𝐀𝐂𝐄𝐍 𝐃𝐀𝐈𝐋𝐘

💸 Tunjangan harian sudah diambil.

⏳ ${clockString(sisa)}`

			)

		let limit = 10

		let carats = Math.min(
			20000,
			db.bank.kas
		)

		user.limit += limit
		user.limitNotified = false

		user.money += carats

		db.bank.kas -= carats

		user.lastclaim = now

		return m.reply(

`🎓 𝐓𝐑𝐀𝐂𝐄𝐍 𝐃𝐀𝐈𝐋𝐘

🏫 Akademi memberikan tunjangan harian.

🎫 +${limit} Limit
💰 +${carats.toLocaleString('id-ID')} Carats

🏇 Semangat berlatih bersama Uma favoritmu 😹`

		)

	}

	catch (err) {

		console.log(
			'\n❌ [TRACEN DAILY]'
		)

		console.log(err)

		return m.reply(
			'❌ Daily Error'
		)

	}

}

console.log(
	'🎓 TRACEN DAILY LOADED'
)
const buy = async (m,args,db) => {

	let user = db.users[m.sender]

	if (args[0] !== 'limit')

	return m.reply(
`🏪 𝐓𝐑𝐀𝐂𝐄𝐍 𝐄𝐍𝐄𝐑𝐆𝐘 𝐒𝐇𝐎𝐏

🎫 Energy : 500 🥕 Carats

💡 Tips:
🏦 Ambil dana bantuan di .banktracen

Contoh:
${m.prefix + m.command} limit 3`
	)

	if (!args[1])

	return m.reply(
`🏪 𝐓𝐑𝐀𝐂𝐄𝐍 𝐄𝐍𝐄𝐑𝐆𝐘 𝐒𝐇𝐎𝐏

Contoh:
${m.prefix + m.command} limit 3`
	)

	let count = parseInt(args[1])

	if (isNaN(count) || count < 1)

	return m.reply(
		'❌ Jumlah tidak valid.'
	)

	let harga = count * 500

	if (user.money < harga)

	return m.reply(
`🏪 𝐓𝐑𝐀𝐂𝐄𝐍 𝐄𝐍𝐄𝐑𝐆𝐘 𝐒𝐇𝐎𝐏

❌ Carats tidak cukup.

🥕 Carats : ${user.money.toLocaleString('id-ID')}
💰 Dibutuhkan : ${harga.toLocaleString('id-ID')}

💡 Dana bantuan harian tersedia di .banktracen`
	)

	let nama =
	user.name ||
	m.pushName ||
	m.sender
		.split('@')[0]

    user.money -= harga
    user.limit += count
    user.limitNotified = false
    db.bank.kas += harga    
    db.bank.danaMasuk += harga    
    db.bank.totalPembelian++    
    addBankActivity(
    
    	db,
    
    `🎫 ${nama} telah membeli Energy sebanyak ${count} seharga ${harga.toLocaleString('id-ID')} Carats`
    
    )
    
	console.log('\n🏪 [ENERGY SHOP]')
	console.log('👤',m.sender)
	console.log('🎫 Energy :',count)
	console.log('🥕 Harga :',harga)

	return m.reply(
`🏪 𝐓𝐑𝐀𝐂𝐄𝐍 𝐄𝐍𝐄𝐑𝐆𝐘 𝐒𝐇𝐎𝐏

✅ Pembelian berhasil!

🎫 Energy +${count}
🥕 Carats -${harga.toLocaleString('id-ID')}

💬 Mejiro McQueen

"☕ Energy yang cukup akan membantu latihan berjalan lebih efektif."
`
	)

}


const setLimit = (m, db) => db.users[m.sender].limit -= 1

const addLimit = (jumlah, no, db) => {
	if (db.users[no]) {
		db.users[no].limit += parseInt(jumlah);
		db.users[no].limitNotified = false;
	}
}

const setMoney = (m, db) => db.users[m.sender].money -= 1000

const addMoney = (jumlah, no, db) => db.users[no].money += parseInt(jumlah)

const transfer = async (m, args, db) => {
	if (args[0] == 'limit') {
		if (!args[1].length > 7) return m.reply(`Transfer Menu :\nExample : ${m.prefix + m.command} limit @tag 11\n• ${m.prefix + m.command} limit @tag jumlah\n• ${m.prefix + m.command} uang @tag jumlah`);
		let count = parseInt(args[2] && args[2].length > 0 ? Math.min(9999999, Math.max(parseInt(args[2]), 1)) : Math.min(1))
		let who = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : args[1] ? (args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net') : false
		if (!who) return m.reply('Siapa yg mau di transfer?')
		if (db.users[who]) {
			if (db.users[m.sender].limit >= count * 1) {
				try {
					db.users[m.sender].limit -= count * 1
					db.users[who].limit += count * 1
					db.users[who].limitNotified = false
					m.reply(`Berhasil mentransfer limit sebesar ${count}, kepada @${who.split('@')[0]}`)
				} catch (e) {
					db.users[m.sender].limit += count * 1
					m.reply('Gagal Transfer')
				}
			} else m.reply(`Limit tidak mencukupi!!\nLimit mu tersisa : *${db.users[m.sender].limit}*`)
		} else m.reply(`Nomer ${who.split('@')[0]} Bukan User bot!`)
	} else if (args[0] == 'uang') {
		if (!args[1].length > 7) return m.reply(`Transfer Menu :\nExample : ${m.prefix + m.command} limit @tag 11\n• ${m.prefix + m.command} limit @tag jumlah\n• ${m.prefix + m.command} uang @tag jumlah`);
		let count = parseInt(args[2] && args[2].length > 0 ? Math.min(9999999, Math.max(parseInt(args[2]), 1)) : Math.min(1))
		let who = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : args[1] ? (args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net') : false
		if (!who) return m.reply('Siapa yg mau di transfer?')
		if (db.users[who]) {
			if (db.users[m.sender].money >= count * 1) {
				try {
					db.users[m.sender].money -= count * 1
					db.users[who].money += count * 1
					m.reply(`Berhasil mentransfer uang sebesar ${count}, kepada @${who.split('@')[0]}`)
				} catch (e) {
					db.users[m.sender].money += count * 1
					m.reply('Gagal Transfer')
				}
			} else m.reply(`Uang tidak mencukupi!!\Uang mu tersisa : *${db.users[m.sender].money}*`)
		} else m.reply(`Nomer ${who.split('@')[0]} Bukan User bot!`)
	} else m.reply(`Transfer Menu :\nExample : ${m.prefix + m.command} limit @tag 11\n• ${m.prefix + m.command} limit @tag jumlah\n• ${m.prefix + m.command} uang @tag jumlah`);
}

/*
	* Create By Naze
	* Follow https://github.com/nazedev
	* Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
*/

class Blackjack {
	constructor(data) {
		this.id = data.id || '';
		this.skip = data.skip || [];
		this.host = data.host || '';
		this.leader = data.leader || '';
		this.winner = data.winner || [];
		this.players = data.players || [];
		this.started = data.started || false;
		this.startCard = data.startCard || {};
		this.submitCard = data.submitCard || [];
		this.secondDeck = data.secondDeck || [];
		this.deck = data.deck || this.generateDeck();
	}
	
	generateDeck() {
		let deck = [];
		const suits = ['♥️', '♦️', '♣️', '♠️'];
		const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
		for (let suit of suits) {
			for (let rank of ranks) {
				deck.push({ rank: rank, suit: suit });
			}
		}
		return deck;
	}
	
	shuffleDeck() {
		for (let i = this.deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
		}
	}
	
	distributeCards() {
		this.shuffleDeck();
		for (let player of this.players) {
			player.cards.push(...this.deck.splice(0, { 2: 10, 3: 7, 4: 7, 5: 6, 6: 6, 7: 5, 8: 5, 9: 4, 10: 4 }[this.players.length]));
		}
		this.startCard = this.deck.shift();
		this.secondDeck.push(this.startCard);
		this.started = true;
	}
	
	hasMatching(player) {
		return this.players.find(p => p.id === player)?.cards?.some(card => card?.suit === this.startCard.suit) || false;
	}
	
	resolveRound() {
		const rankToValue = (rank) => rank === 'A' ? 14 : rank === 'K' ? 13 :  rank === 'Q' ? 12 : rank === 'J' ? 11 : parseInt(rank) || 0;
		let highestCard = this.submitCard[0];
		let leaderId = highestCard.id;
		for (let c of this.submitCard) {
			if (rankToValue(c.card.rank) > rankToValue(highestCard.card.rank)) {
				highestCard = c;
				leaderId = c.id;
			}
		}
		if (leaderId) {
			this.leader = leaderId;
			this.startCard = {};
			this.submitCard = [];
			return `@${leaderId.split('@')[0]} memimpin ronde berikutnya!`
		}
	}
	
	reuseSubmitCardsForDrinking() {
		const drinkers = this.players.filter(p => !this.hasMatching(p.id) && !this.skip.includes(p.id));
		const cards = this.submitCard.map(s => s.card);
		if ((this.submitCard.length + this.skip.length) === this.players.length && cards.length === 1) {
			const owner = this.submitCard[0].id;
			this.leader = owner;
			for (const player of this.players) {
				if (player.id !== owner) this.skip.push(player.id);
			}
			return {
				msg: `Hanya @${owner.split('@')[0]} yang punya kartu, dia jadi pemimpin baru. Sesi lanjut.`,
				continue: true
			}
		} else {
			let index = 0;
			for (const card of cards) {
				if (!drinkers.length) break;
				const player = this.players.find(p => p.id === drinkers[index % drinkers.length].id);
				player.cards.push(card);
				if (!this.skip.find(a => a.id === player.id)) this.skip.push({ id: player.id });
				index++;
			}
			return {
				msg: `Kartu dari submitCard dibagi ke pemain yang harus minum.`,
				continue: true
			}
		}
	}
}

class SnakeLadder {
	constructor(data) {
		this.turn = data.turn || 0;
		this.host = data.host || null;
		this.start = data.start || false;
		this.players = data.players || [];
		this.map = data.map || this.createMap();
	}
	
	rollDice() {
		return Math.floor(Math.random() * 6) + 1;
	}
	
	createMap () {
		const data = [{
			url: 'https://raw.githubusercontent.com/nazedev/database/master/games/images/map/map1.jpg',
			move: { 4: 56, 12: 50, 14: 55, 22: 58, 41: 79, 54: 88, 96: 42, 94: 71, 75: 32, 48: 16, 37: 3, 28: 10 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nazedev/database/master/games/images/map/map2.jpg',
			move: { 7: 36, 21: 58, 31: 51, 34: 84, 54: 89, 63: 82, 96: 72, 78: 59, 66: 12, 56: 20, 43: 24, 33: 5 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nazedev/database/master/games/images/map/map3.jpg',
			move: { 8: 29, 10: 32, 20: 39, 27: 85, 51: 67, 72: 91, 79: 100, 98: 65, 94: 75, 93: 73, 64: 60, 62: 19, 56: 24, 53: 50, 17: 7 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nazedev/database/master/games/images/map/map4.jpg',
			move: { 8: 29, 10: 32, 20: 39, 27: 85, 51: 67, 72: 91, 79: 100, 98: 65, 94: 75, 93: 73, 64: 60, 62: 19, 56: 24, 53: 50, 17: 7 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nazedev/database/master/games/images/map/map5.jpg',
			move: { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 51: 67, 72: 91, 80: 99, 98: 79, 94: 75, 93: 73, 87: 36, 64: 60, 62: 19, 54: 34, 17: 7 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nazedev/database/master/games/images/map/map6.jpg',
			move: { 4: 23, 13: 46, 33: 52, 42: 63, 50: 69, 62: 81, 74: 93, 99: 41, 95: 76, 89: 53, 66: 45, 54: 31, 43: 17, 40: 2, 27: 5 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nazedev/database/master/games/images/map/map7.jpg',
			move: { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 51: 67, 71: 91, 80: 100, 98: 79, 95: 75, 93: 73, 87: 24, 64: 60, 62: 19, 54: 34, 17: 7 },
			mode: ''
		}, {
			url: 'https://raw.githubusercontent.com/nazedev/database/master/games/images/map/map8.jpg',
			move: { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98, 87: 94, 99: 80, 95: 75, 92: 88, 89: 68, 74: 53, 64: 60, 62: 19, 49: 11, 46: 25, 16: 6 },
			mode: ''
		}];
		return data[Math.floor(Math.random() * data.length)];
	}
	
	nextTurn() {
		this.turn = (this.turn + 1) % this.players.length;
	}
	
	async drawBoard(boardUrl, players = []) {
		try {
			const readFn = jimp.read || jimpPkg.Jimp?.read || (jimpPkg.default && jimpPkg.default.read);
			const board = await readFn(boardUrl);
			if (board.resize) {
				if (board.resize.length >= 2) board.resize(612, 612);
				else board.resize({ w: 612, h: 612 });
			}
			const width = typeof board.getWidth === 'function' ? board.getWidth() : board.width;
			const height = typeof board.getHeight === 'function' ? board.getHeight() : board.height;
			const size = Math.min(width, height);
			if (typeof board.crop === 'function') {
				try { board.crop((width - size) / 2, (height - size) / 2, size, size); }
				catch { board.crop({ x: (width - size) / 2, y: (height - size) / 2, w: size, h: size }); }
			}
			const tileSize = size / 10;
			players.filter(a => a.move !== null);
			for (let i = 0; i < players.length; i++) {
				const position = players[i].move;
				const row = Math.floor((position - 1) / 10);
				const col = (row % 2 === 0) ? (position - 1) % 10 : 9 - (position - 1) % 10;
				const x = col * tileSize;
				const y = (9 - row) * tileSize;
				const player = await readFn(`https://raw.githubusercontent.com/nazedev/database/master/games/images/player${i + 1}.png`);
				const pionSize = tileSize * 0.7;
				if (player.resize) {
					if (player.resize.length >= 2) player.resize(pionSize, pionSize);
					else player.resize({ w: pionSize, h: pionSize });
				}
				const blendMode = jimp.BLEND_SOURCE_OVER || jimpPkg.BlendMode?.SRC_OVER || 'srcOver';
				board.composite(player, x + tileSize / 2 - pionSize / 2, y + tileSize / 2 - pionSize / 2, {
					mode: blendMode
				});
			}
			const mimeJpeg = jimp.MIME_JPEG || jimpPkg.JimpMime?.jpeg || 'image/jpeg';
			const result = typeof board.getBufferAsync === 'function' ? await board.getBufferAsync(mimeJpeg) : (typeof board.getBuffer === 'function' ? await board.getBuffer(mimeJpeg) : null);
			return result;
		} catch (e) {
			return null;
		}
	}
}

export {
	rdGame,
	iGame,
	tGame,
	gameMerampok,
	gameBegal,
	gameBrankas,
	gameBegalShop,
	gameBegalSkill,
	gameBegalSkillInfo,
	daily,
	buy,
	setLimit,
	addLimit,
	addMoney,
	setMoney,
	transfer,
	Blackjack,
	SnakeLadder,
	sendPoliceSticker
};
