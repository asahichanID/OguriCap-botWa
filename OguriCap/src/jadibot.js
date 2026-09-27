import '../settings.js';
import fs from 'fs';
import pino from 'pino';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { Boom } from '@hapi/boom';
import NodeCache from 'node-cache';
import WAConnection, {
	useMultiFileAuthState,
	Browsers,
	DisconnectReason,
	jidNormalizedUser,
	makeCacheableSignalKeyStore,
	fetchLatestWaWebVersion
} from 'baileys';

import { GroupUpdate, GroupParticipantsUpdate, MessagesUpsert, Solving } from './message.js';

const __filename = fileURLToPath(import.meta.url);

global.client = global.client || {};

const msgRetryCounterCache = new NodeCache();

/**
 * Format durasi uptime jadibot menjadi string human-readable
 * @param {number} ms 
 * @returns {string}
 */
function formatUptime(ms) {
	const seconds = Math.floor((ms / 1000) % 60);
	const minutes = Math.floor((ms / (1000 * 60)) % 60);
	const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
	const days = Math.floor(ms / (1000 * 60 * 60 * 24));
	const parts = [];
	if (days > 0) parts.push(`${days}h`);
	if (hours > 0) parts.push(`${hours}j`);
	if (minutes > 0) parts.push(`${minutes}m`);
	parts.push(`${seconds}d`);
	return parts.join(' ');
}

/**
 * Inisialisasi Sub-Bot (JadiBot) Terisolasi
 * Berjalan pada panel/runtime yang sama, namun dengan state, settings, dan owner mandiri.
 *
 * @param {object} conn - Instance socket bot utama
 * @param {string} from - JID WhatsApp pengguna pembuat jadibot
 * @param {object} m - Message object pemanggil
 * @param {object} store - Store Baileys
 */
async function JadiBot(conn, from, m, store) {
	async function startJadiBot() {
		try {
			const sessionDir = `./database/jadibot/${from}`;
			if (!fs.existsSync(sessionDir)) {
				fs.mkdirSync(sessionDir, { recursive: true });
			}

			const { version } = await fetchLatestWaWebVersion();
			const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
			const level = pino({ level: 'silent' });

			const getMessage = async (key) => {
				if (store) {
					const msg = await store.loadMessage(key.remoteJid, key.id);
					return msg?.message || '';
				}
				return {
					conversation: 'Halo Saya Adalah Bot'
				};
			};

			// Inisialisasi Sub-Bot Socket
			client[from] = WAConnection({
				version,
				logger: level,
				getMessage,
				syncFullHistory: false,
				maxMsgRetryCount: 15,
				msgRetryCounterCache,
				retryRequestDelayMs: 10,
				defaultQueryTimeoutMs: 0,
				connectTimeoutMs: 60000,
				keepAliveIntervalMs: 30000,
				browser: Browsers.ubuntu('Chrome'),
				generateHighQualityLinkPreview: false,
				transactionOpts: {
					maxCommitRetries: 10,
					delayBetweenTriesMs: 10
				},
				appStateMacVerification: {
					patch: true,
					snapshot: true
				},
				auth: {
					creds: state.creds,
					keys: makeCacheableSignalKeyStore(state.keys, level)
				}
			});

			// Metadata Isolasi JadiBot
			client[from].isJadiBot = true;
			client[from].jadibotOwner = from;
			client[from].jadibotStartTime = Date.now();
			client[from].pairingStarted = false;
			client[from].public = true;

			await Solving(client[from], store);

			client[from].ev.on('creds.update', saveCreds);

			client[from].ev.on('connection.update', async (update) => {
				const { connection, lastDisconnect, receivedPendingNotifications } = update;

				// Request Pairing Code
				if (connection === 'connecting' && !client[from].authState.creds.registered && !client[from].pairingStarted) {
					setTimeout(async () => {
						if (!client[from]) return;
						try {
							client[from].pairingStarted = true;
							const rawPhone = from.replace(/[^0-9]/g, '');
							const code = await client[from].requestPairingCode(rawPhone);
							if (!client[from]) return;

							const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
							const senderNum = from.split('@')[0];

							const pairingTeks =
`╭─❖「 🤖 𝐉𝐀𝐃𝐈𝐁𝐎𝐓 𝐏𝐑𝐄𝐌𝐈𝐔𝐌 🌸 」
│
├ 👤 *Target User:* @${senderNum}
├ 🔑 *Pairing Code:* *${formattedCode}*
├ ⏳ *Masa Berlaku:* 2 Menit
│
├ 📌 *Panduan Login Cepat:*
│ 1. Buka *WhatsApp* di ponsel Anda
│ 2. Ketuk titik tiga (⋮) > *Perangkat Tertaut*
│ 3. Klik *Tautkan Perangkat*
│ 4. Pilih *"Tautkan dengan nomor telepon saja"*
│ 5. Masukkan kode di atas pada notifikasi
│
├ 🛡️ *Status:* Sub-Bot Terisolasi (1 Panel)
├ ⚙️ *Akses:* Mandiri (Mode Self/Public terpisah)
╰─────────────❖`;

							await conn.sendMessage(m.chat, {
								text: pairingTeks,
								mentions: [from]
							}, { quoted: m });
						} catch (pairingErr) {
							console.error(chalk.redBright(`[JADIBOT] Gagal request pairing code untuk ${from}:`), pairingErr?.message || pairingErr);
							await conn.sendMessage(m.chat, {
								text: `❌ Gagal membuat Pairing Code: ${pairingErr?.message || 'Silakan coba beberapa saat lagi.'}`
							}, { quoted: m });
						}
					}, 3000);
				}

				// Connection Close / Reconnect Handling
				if (connection === 'close') {
					if (!client[from]) return;
					const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
					console.log(chalk.yellowBright(`[JADIBOT] Sesi ${from} terputus, reason code: ${reason}`));

					if ([
						DisconnectReason.connectionLost,
						DisconnectReason.connectionClosed,
						DisconnectReason.restartRequired,
						DisconnectReason.timedOut,
						DisconnectReason.badSession,
						DisconnectReason.connectionReplaced
					].includes(reason)) {
						JadiBot(conn, from, m, store);
					} else if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.Multidevicemismatch) {
						await conn.sendMessage(m.chat, {
							text: `⚠️ Sesi JadiBot @${from.split('@')[0]} telah logout atau kadaluarsa. Silakan ketik *.jadibot* untuk membuat sesi baru.`,
							mentions: [from]
						}, { quoted: m }).catch(() => {});
						StopJadiBot(conn, from, m);
					} else {
						await conn.sendMessage(m.chat, {
							text: `ℹ️ Sesi JadiBot @${from.split('@')[0]} dihentikan.`,
							mentions: [from]
						}, { quoted: m }).catch(() => {});
					}
				}

				// Connection Open (Berhasil Terhubung)
				if (connection === 'open') {
					const botNumber = client[from].decodeJid(client[from].user.id);
					const senderNum = from.split('@')[0];

					// Inisialisasi Database Setting Khusus untuk Sub-Bot ini (Terpisah 100% dari Bot Utama)
					global.db = global.db || {};
					global.db.set = global.db.set || {};
					
					const existingSet = global.db.set[botNumber] || {};
					global.db.set[botNumber] = {
						lang: 'id',
						limit: 0,
						money: 0,
						status: 0,
						log: true,
						join: true,
						public: true, // Default public untuk sub-bot ini
						anticall: false,
						original: false, // Bukan bot utama
						readsw: false,
						autobio: false,
						autoread: false,
						antispam: true,
						autotyping: false,
						grouponly: false,
						multiprefix: false,
						privateonly: false,
						didyoumean: true,
						author: global.author || 'Shiro',
						authorPrefix: ['', 'tr>', '::', ';;'],
						autobackup: false,
						botname: `Oguri Cap (${senderNum})`,
						packname: global.packname || 'Bot WhatsApp',
						template: 'documentMessage',
						owner: [...new Set([senderNum, ...global.owner, botNumber.split('@')[0]])],
						...existingSet
					};

					global._dbDirty = true;

					const welcomeTeks =
`╭─❖「 🎉 𝐉𝐀𝐃𝐈𝐁𝐎𝐓 𝐓𝐄𝐑𝐇𝐔𝐁𝐔𝐍𝐆 🌸 」
│
├ 🤖 *Nomor Bot:* @${botNumber.split('@')[0]}
├ 👑 *Owner Sub-Bot:* @${senderNum}
├ ⚡ *Status:* Online & Aktif
├ 🛡️ *Arsitektur:* Isolated Worker (1 Panel)
│
├ 🚀 *Fitur & Panduan Penggunaan:*
│ • Ketik *.menu* di bot Anda untuk melihat semua fitur
│ • Ketik *.self* untuk mengunci bot hanya untuk Anda sendiri
│ • Ketik *.public* untuk mengaktifkan mode publik
│ • Mode .self di bot Anda *TIDAK* mempengaruhi bot utama
│ • Ketik *.stopjadibot* dari bot utama untuk berhenti
╰─────────────❖`;

					// Kirim ke pembuat di bot utama
					await conn.sendMessage(m.chat, {
						text: welcomeTeks,
						mentions: [from, botNumber]
					}, { quoted: m }).catch(() => {});

					// Kirim notifikasi sambutan langsung ke chat sub-bot
					await client[from].sendMessage(botNumber, {
						text: welcomeTeks,
						mentions: [from, botNumber]
					}).catch(() => {});

					console.log(chalk.greenBright(`[JADIBOT] Sub-Bot @${botNumber.split('@')[0]} (Owner: ${senderNum}) berhasil online!`));
				}

				if (receivedPendingNotifications === 'true') {
					client[from].ev.flush();
				}
			});

			// Call Event
			client[from].ev.on('call', async (call) => {
				const botNumber = await client[from].decodeJid(client[from].user.id);
				if (global.db?.set?.[botNumber]?.anticall) {
					for (let id of call) {
						if (id.status === 'offer') {
							let msg = await client[from].sendMessage(id.from, {
								text: `Saat ini bot tidak dapat menerima panggilan ${id.isVideo ? 'Video' : 'Suara'}.\nSilakan hubungi Owner bot ini :)`,
								mentions: [id.from]
							});
							await client[from].sendContact(id.from, global.owner, msg);
							await client[from].rejectCall(id.id, id.from);
						}
					}
				}
			});

			// Group Updates
			client[from].ev.on('groups.update', (update) => {
				for (let n of update) {
					if (store?.groupMetadata?.[n.id]) {
						Object.assign(store.groupMetadata[n.id], n);
					} else if (store) {
						store.groupMetadata[n.id] = n;
					}
				}
			});

			client[from].ev.on('group-participants.update', async (update) => {
				await GroupParticipantsUpdate(client[from], update, store);
			});

			// Messages Upsert (Dispatcher Mandiri)
			client[from].ev.on('messages.upsert', async (message) => {
				await MessagesUpsert(client[from], message, store);
			});

			return client[from];
		} catch (e) {
			console.log(chalk.redBright(`[JADIBOT ERROR] ${e?.message || e}`));
		}
	}

	return startJadiBot();
}

/**
 * Hentikan Sub-Bot (JadiBot) dan Bersihkan Session
 *
 * @param {object} conn - Socket bot pemanggil
 * @param {string} from - JID WhatsApp target
 * @param {object} m - Message object
 */
async function StopJadiBot(conn, from, m) {
	if (!client[from]) {
		return conn.sendMessage(m.chat, {
			text: `❌ Nomor @${from.split('@')[0]} saat ini tidak sedang aktif sebagai JadiBot!`,
			mentions: [from]
		}, { quoted: m });
	}

	try {
		client[from].ev.removeAllListeners();
		if (client[from].ws) client[from].ws.close();
		client[from].end?.('Stop');
	} catch (e) {
		console.log(chalk.redBright(`[JADIBOT STOP ERROR] ${e?.message || e}`));
	}

	delete client[from];

	try {
		const sessionDir = `./database/jadibot/${from}`;
		if (fs.existsSync(sessionDir)) {
			fs.rmSync(sessionDir, { recursive: true, force: true });
		}
	} catch (err) {
		// Ignore folder removal issue if already clean
	}

	const stopTeks =
`╭─❖「 🔌 𝐉𝐀𝐃𝐈𝐁𝐎𝐓 𝐃𝐈𝐇𝐄𝐍𝐓𝐈𝐊𝐀𝐍 🌸 」
│
├ 👤 *Target User:* @${from.split('@')[0]}
├ ✅ Sesi sub-bot berhasil dinonaktifkan
├ 🧹 Sesi multi-device database telah dibersihkan
├ ⚡ Runtime panel tetap berjalan stabil
╰─────────────❖`;

	return conn.sendMessage(m.chat, {
		text: stopTeks,
		mentions: [from]
	}, { quoted: m });
}

/**
 * Menampilkan Daftar Seluruh JadiBot yang Sedang Aktif
 *
 * @param {object} conn - Socket bot pemanggil
 * @param {object} m - Message object
 */
async function ListJadiBot(conn, m) {
	const activeEntries = Object.entries(client).filter(([_, jb]) => jb?.user?.id);

	if (activeEntries.length === 0) {
		return conn.sendMessage(m.chat, {
			text:
`╭─❖「 📋 𝐉𝐀𝐃𝐈𝐁𝐎𝐓 𝐀𝐊𝐓𝐈𝐅 🌸 」
│
├ ℹ️ Saat ini belum ada Sub-Bot yang terhubung.
├ 💡 Ketik *.jadibot* untuk menyewa & mengaktifkan bot Anda!
╰─────────────❖`
		}, { quoted: m });
	}

	let listTeks = '';
	activeEntries.forEach(([ownerJid, jb], idx) => {
		const botNum = conn.decodeJid(jb.user.id).split('@')[0];
		const ownerNum = ownerJid.split('@')[0];
		const uptime = jb.jadibotStartTime ? formatUptime(Date.now() - jb.jadibotStartTime) : '-';
		const mode = jb.public === false ? '🔒 Self' : '🌐 Public';

		listTeks += `├ *${idx + 1}.* @${botNum}\n`;
		listTeks += `│   👑 *Owner:* @${ownerNum}\n`;
		listTeks += `│   ⏳ *Uptime:* ${uptime}\n`;
		listTeks += `│   🛡️ *Mode:* ${mode}\n`;
		if (idx < activeEntries.length - 1) listTeks += '│\n';
	});

	const mentions = [];
	activeEntries.forEach(([ownerJid, jb]) => {
		mentions.push(ownerJid);
		mentions.push(conn.decodeJid(jb.user.id));
	});

	const fullTeks =
`╭─❖「 📋 𝐃𝐀𝐅𝐓𝐀𝐑 𝐉𝐀𝐃𝐈𝐁𝐎𝐓 𝐀𝐊𝐓𝐈𝐅 🌸 」
│
├ 📊 *Total Aktif:* ${activeEntries.length} Sub-Bot
│
${listTeks}
│
├ 💡 Ketik *.stopjadibot* untuk menghentikan sesi Anda
╰─────────────❖`;

	return conn.sendMessage(m.chat, {
		text: fullTeks,
		mentions
	}, { quoted: m });
}

export { JadiBot, StopJadiBot, ListJadiBot };
