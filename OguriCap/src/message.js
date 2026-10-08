import '../settings.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';
import chalk from 'chalk';
import crypto from 'crypto';
import * as fileTypePkg from 'file-type';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import PhoneNumber from 'awesome-phonenumber';

// Kompatibilitas universal file-type v16 (CommonJS) dan v22 (ESM named export)
const FileType = fileTypePkg.default || {
	fromBuffer: fileTypePkg.fileTypeFromBuffer || (fileTypePkg.default && fileTypePkg.default.fromBuffer),
	fromFile: fileTypePkg.fileTypeFromFile || (fileTypePkg.default && fileTypePkg.default.fromFile),
	fromStream: fileTypePkg.fileTypeFromStream || (fileTypePkg.default && fileTypePkg.default.fromStream),
	...fileTypePkg
};

import { checkStatus } from './database.js';
import { isLocked } from '../group/kunci.js';
import { acquireCommandSlot } from './guard.js';
import { hasAnyActiveGame } from '../lib/gameSessionManager.js';
import { installOutgoingGuard, isBotSentMessage, recordSentBotMessage } from './botGuard.js';
import { checkAndHandleBannedSticker } from '../plugins/bansticker.js';
import { hasStickerPackSession } from '../plugins/stickerpack.js';
import { runHeavyTask } from './heavyEngine.js';
import { createSticker } from '../lib/sticker/sticker.js';
import { imageToWebp, videoToWebp, writeExif, gifToWebp } from '../lib/exif.js';
import { getBuffer, getSizeMedia, fetchJson, sleep, axiosss, fixBytes } from '../lib/function.js';
import { jidNormalizedUser, proto, getBinaryNodeChildren, getBinaryNodeChildString, getBinaryNodeChild, generateMessageIDV2, jidEncode, encodeSignedDeviceIdentity, generateWAMessageContent, generateForwardMessageContent, prepareWAMessageMedia, delay, areJidsSameUser, extractMessageContent, generateMessageID, downloadContentFromMessage, generateWAMessageFromContent, jidDecode, generateWAMessage, toBuffer, getContentType, getDevice, normalizeMessageContent } from 'baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nazePath = fileURLToPath(new URL('../naze.js', import.meta.url));

let nazeHandler = null;
const botStartTime = Date.now();
const groupMetadataTimers = {};

// ============================================================
// ⚡ FAST GROUP METADATA CACHE & IN-FLIGHT DEDUPLICATION
// ============================================================
const metadataFetchPromises = new Map();
const metadataCacheTime = new Map();
const METADATA_TTL_MS = 10 * 60 * 1000; // 10 menit TTL

export async function getOrFetchGroupMetadata(naze, jid, store) {
	if (!jid || !jid.endsWith('@g.us')) return {};
	store.groupMetadata ??= {};
	const now = Date.now();
	const cached = store.groupMetadata[jid];
	const lastFetched = metadataCacheTime.get(jid) || 0;

	// 1. Jika ada cache dan memiliki participants: RETURN INSTAN tanpa menunggu network!
	if (cached && Array.isArray(cached.participants) && cached.participants.length > 0) {
		// Jika cache sudah lebih dari 10 menit, jadwalkan background update non-blocking
		if (now - lastFetched >= METADATA_TTL_MS && !metadataFetchPromises.has(jid)) {
			metadataCacheTime.set(jid, now);
			Promise.race([
				naze.groupMetadata(jid),
				new Promise((_, r) => setTimeout(() => r(new Error('bg_timeout')), 5000))
			]).then((data) => {
				if (data && Array.isArray(data.participants) && data.participants.length > 0) {
					store.groupMetadata[jid] = data;
					metadataCacheTime.set(jid, Date.now());
					if (typeof global.recordGroupParticipants === 'function') {
						global.recordGroupParticipants(data.participants);
					}
				}
			}).catch(() => {});
		}
		return cached;
	}

	// 2. In-flight deduplication: gunakan Promise yang sedang berjalan
	if (metadataFetchPromises.has(jid)) {
		return await metadataFetchPromises.get(jid);
	}

	// 3. Jika belum pernah ada cache sama sekali, fetch dengan batas timeout aman (4.5 detik)
	const promise = (async () => {
		try {
			const data = await Promise.race([
				naze.groupMetadata(jid),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Metadata timeout')), 4500))
			]);
			if (data && Array.isArray(data.participants) && data.participants.length > 0) {
				store.groupMetadata[jid] = data;
				metadataCacheTime.set(jid, Date.now());
				if (typeof global.recordGroupParticipants === 'function') {
					global.recordGroupParticipants(data.participants);
				}
				return data;
			}
			return cached || data || { id: jid, participants: [] };
		} catch (e) {
			return cached || { id: jid, participants: [] };
		} finally {
			metadataFetchPromises.delete(jid);
		}
	})();

	metadataFetchPromises.set(jid, promise);
	return await promise;
}

export function invalidateGroupMetadataCache(jid) {
	if (jid) {
		metadataCacheTime.delete(jid);
		metadataFetchPromises.delete(jid);
	}
}

/*
	* Create By Naze
	* Follow https://github.com/nazedev
	* Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
*/

const reloadHandler = async () => {
	try {
		nazeHandler = (await import(`../naze.js?update=${Date.now()}`)).default;
	} catch (err) {
		console.error(chalk.redBright(`[ERROR] ${err}`));
	}
};

reloadHandler();

// ============================================================
// 🧵 QUEUE (audit): SELURUH command wajib lewat absoluteGuard.js
// ============================================================
// Titik masuk TUNGGAL untuk semua pesan/command. Dengan menaruh
// queue di sini (bukan menyalin-ulang ke setiap file command),
// otomatis SELURUH command (.play, .tiktok, .ai, .menu, dst)
// ikut ter-queue tanpa perlu mengedit satu-satu.
//
// - Command dari sender+chat yang SAMA di-antrikan (tidak boleh
//   berjalan bersamaan / anti race condition kalau user spam).
// - Command dari user/chat LAIN tidak terpengaruh sama sekali.
// - Error di dalam handler ditangkap di sini (tidak lagi jadi
//   unhandled rejection yang berisiko menjatuhkan bot).
async function dispatchNazeHandler(naze, m, msg, store) {
	// 🛡️ ANTI SELF-REPLY & BOT ISOLATION: Jangan pernah memproses pesan yang dikirim oleh proses bot ini
	if (isBotSentMessage(m.id || msg?.key?.id)) return;
	const senderNum = m.sender ? m.sender.split('@')[0] : '';
	const senderNormalized = m.sender ? jidNormalizedUser(m.sender) : '';
	const isOwner = Boolean(
		(global.owner && Array.isArray(global.owner) && global.owner.some(o => {
			const clean = String(o).replace(/[^0-9]/g, '');
			return clean && (clean === senderNum || senderNormalized.startsWith(clean));
		})) ||
		(global.ownerNumber && Array.isArray(global.ownerNumber) && global.ownerNumber.some(o => {
			const clean = String(o).replace(/[^0-9]/g, '');
			return clean && (clean === senderNum || senderNormalized.startsWith(clean));
		})) ||
		m.fromMe ||
		m.key?.fromMe
	);
	const hasActiveMath = Boolean(global.__oguriMathSessionManager?.hasSession(m.chat));
	const hasActiveGameSession = Boolean(hasAnyActiveGame(m.chat));
	if (!isOwner && !hasActiveMath && !hasActiveGameSession && m.fromMe && isBotSentMessage(m.id || msg?.key?.id)) return;
	const isButtonAction = Boolean(
		m.interactiveId?.startsWith('lock_') ||
		m.interactiveId?.startsWith('unlock_') ||
		m.body?.startsWith('lock_') ||
		m.body?.startsWith('unlock_') ||
		m.text?.startsWith('lock_') ||
		m.text?.startsWith('unlock_')
	);
	if (!hasActiveMath && !hasActiveGameSession && m.fromMe && !m.isCmd && !isButtonAction && !isOwner) return;

	const slot = await acquireCommandSlot(m.sender, m.chat, m);
	if (!slot || slot.ok === false) return;
	try {
		await nazeHandler(naze, m, msg, store);
	} catch (err) {
		console.error(chalk.redBright(`[HANDLER ERROR] ${err?.stack || err}`));
	} finally {
		if (slot && typeof slot.release === 'function') {
			await slot.release();
		}
	}
}

async function GroupUpdate(naze, m, store) {
	function clearParse(parse) {
		try {
			return JSON.parse(parse);
		} catch {
			return parse;
		}
	}
	if (!m.messageStubType || !m.isGroup || isLocked(m.chat)) return
	if (global.db?.groups?.[m.chat] && store?.groupMetadata?.[m.chat]) {
		const admin = `@${(m.sender || '').split('@')[0]}`
		const metadata = store.groupMetadata[m.chat];
		const normalizedTarget = clearParse(m.messageStubParameters[0]);
		const type = m.messageStubType;
		const messages = {
			1: 'mereset link grup!',
			21: `mengubah Subject Grup menjadi :\n*${normalizedTarget}*`,
			22: 'telah mengubah icon grup.',
			23: 'mereset link grup!',
			24: `mengubah deskripsi grup.\n\n${normalizedTarget}`,
			25: `telah mengatur agar *${normalizedTarget == 'on' ? 'hanya admin' : 'semua peserta'}* yang dapat mengedit info grup.`,
			26: `telah *${normalizedTarget == 'on' ? 'menutup' : 'membuka'}* grup!\nSekarang ${normalizedTarget == 'on' ? 'hanya admin yang' : 'semua peserta'} dapat mengirim pesan.`,
			29: `telah menjadikan @${normalizedTarget?.id?.split('@')?.[0]} sebagai admin.`,
			30: `telah memberhentikan @${normalizedTarget?.id?.split('@')?.[0]} dari admin.`,
			72: `mengubah durasi pesan sementara menjadi *@${normalizedTarget}*`,
			123: 'menonaktifkan pesan sementara.',
			132: 'mereset link grup!',
			172: `@${normalizedTarget?.pn?.split('@')?.[0]} meminta bergabung`,
		}
		if (naze.public && global.db?.groups?.[m.chat]?.setinfo && messages[type]) {
			await naze.sendMessage(m.chat, { text: `${admin} ${messages[type]}`, mentions: [m.sender, ...((normalizedTarget?.id || normalizedTarget)?.includes('@') ? [`${normalizedTarget.id || normalizedTarget}`] : [])].filter(Boolean)}, { ephemeralExpiration: m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		}
		if (type === 20) {
			clearTimeout(groupMetadataTimers[m.chat])
			groupMetadataTimers[m.chat] = setTimeout(async () => {
				store.groupMetadata[m.chat] = await naze.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] }));
			}, 5000);
		} else if (type === 29 || type === 30) {
			const target = jidNormalizedUser(normalizedTarget.id || normalizedTarget)
			const newAdminValue = type === 29 ? 'admin' : null
			if (metadata?.participants?.length) {
				metadata.participants = metadata.participants.map(p => {
					const key = metadata.addressingMode === 'lid' ? jidNormalizedUser(p.id) : jidNormalizedUser(p.phoneNumber)
					if (key === target) {
						return { ...p, admin: newAdminValue }
					}
					return p
				})
			}
		} else if (type === 27) {
			if (!metadata.participants.some(a => (a.id === (normalizedTarget.id || normalizedTarget) || a.phoneNumber === (normalizedTarget.id || normalizedTarget)))) {
				clearTimeout(groupMetadataTimers[m.chat])
				groupMetadataTimers[m.chat] = setTimeout(async () => {
					store.groupMetadata[m.chat] = await naze.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] }));
				}, 5000);
			}
		} else if (type === 28 || type === 32) {
			if (m.fromMe && ((jidNormalizedUser(naze.user.id) == (normalizedTarget.id || normalizedTarget)) || (jidNormalizedUser(naze.user.lid) == (normalizedTarget.id || normalizedTarget)))) {
				delete store.messages[m.chat];
				delete store.presences[m.chat];
				delete store.groupMetadata[m.chat];
			}
			if(!!metadata) metadata.participants = metadata.participants.filter(p => {
				const key = metadata.addressingMode === 'lid' ? jidNormalizedUser(p.id) : jidNormalizedUser(p.phoneNumber)
				return key !== (normalizedTarget.id || normalizedTarget)
			});
		}
	}
}

async function GroupParticipantsUpdate(naze, update, store) {
	try {
		const { id, participants, author, action } = update;

		// 🛡️ Proteksi: Abaikan update peserta jika grup dikunci atau bot dalam self mode
		if (isLocked(id)) return;
		const myBotId = naze.user?.id ? jidNormalizedUser(naze.user.id) : null;
		if (naze.public === false || (myBotId && global.db?.set?.[myBotId]?.public === false)) return;

		function updateAdminStatus(participants, metadataParticipants, status) {
			for (const participant of metadataParticipants) {
				if (
					participants.includes(jidNormalizedUser(participant.id)) ||
					participants.includes(jidNormalizedUser(participant.phoneNumber))
				) {
					participant.admin = status;
				}
			}
		}

		if (global.db?.groups?.[id] && store?.groupMetadata?.[id]) {
			const metadata = store.groupMetadata[id];

			const jids = participants.map(v =>
				typeof v === 'string'
					? v
					: (v?.id || v?.phoneNumber || '')
			);

			const fallback =
				'https://telegra.ph/file/95670d63378f7f4210f03.png';

			const profileResults = await Promise.allSettled(
				jids.map(jid => naze.profilePictureUrl(jid, 'image'))
			);

			for (let i = 0; i < jids.length; i++) {

				const jid = jids[i];

				const profile =
					profileResults[i]?.status === 'fulfilled'
						? profileResults[i].value
						: fallback;

				let messageText;

				if (action === 'add') {

					if (global.db.groups[id]?.welcome)
						messageText =
							global.db.groups[id]?.text?.setwelcome ||
							`Welcome to ${metadata.subject}\n@`;

					clearTimeout(groupMetadataTimers[id]);

					groupMetadataTimers[id] = setTimeout(async () => {
						store.groupMetadata[id] =
							await naze.groupMetadata(id).catch(() => ({
								...store.groupMetadata[id]
							}));
					}, 5000);

				} else if (action === 'remove') {

					if (global.db.groups[id]?.leave)
						messageText =
							global.db.groups[id]?.text?.setleave ||
							`@\nLeaving From ${metadata.subject}`;

					if (
						jidNormalizedUser(naze.user.lid) === jidNormalizedUser(jid) ||
						jidNormalizedUser(naze.user.id) === jidNormalizedUser(jid)
					) {
						delete store.messages[id];
						delete store.presences[id];
						delete store.groupMetadata[id];
					}

					if (metadata) {
						metadata.participants =
							metadata.participants.filter(
								p =>
									!participants.includes(
										metadata.addressingMode === 'lid'
											? jidNormalizedUser(p.id)
											: jidNormalizedUser(p.phoneNumber)
									)
							);
					}

				} else if (action === 'promote') {

					if (global.db.groups[id]?.promote)
						messageText =
							global.db.groups[id]?.text?.setpromote ||
							`@\nPromote From ${metadata.subject}\nBy @admin`;

					updateAdminStatus(
						participants,
						metadata.participants,
						'admin'
					);

				} else if (action === 'demote') {

					if (global.db.groups[id]?.demote)
						messageText =
							global.db.groups[id]?.text?.setdemote ||
							`@\nDemote From ${metadata.subject}\nBy @admin`;

					updateAdminStatus(
						participants,
						metadata.participants,
						null
					);

				}

				if (messageText && naze.public) {

					await naze.sendMessage(
						id,
						{
							text: messageText
								.replace('@subject', metadata.subject)
								.replace(
									'@admin',
									author
										? `@${author.split('@')[0]}`
										: '@admin'
								)
								.replace(
									/(?<=\s|^)@(?!\w)/g,
									`@${jid.split('@')[0]}`
								),

							contextInfo: {
								mentionedJid: [jid, author].filter(Boolean),

								externalAdReply: {
									title:
										action === 'add'
											? 'Welcome'
											: action === 'remove'
											? 'Leaving'
											: action.charAt(0).toUpperCase() +
											  action.slice(1),

									mediaType: 1,
									previewType: 0,
									thumbnailUrl: profile,
									renderLargerThumbnail: true,
									sourceUrl: global.my.gh
								}
							}
						},
						{
							ephemeralExpiration:
								metadata?.ephemeralDuration ||
								store?.messages[id]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration ||
								0
						}
					);

				}
			}
		}
	} catch (e) {
		throw e;
	}
}

async function LoadDataBase(naze, m) {
	try {
		const botNumber = naze.decodeJid(naze.user.id);
		let game = global.db.game || {};
		let premium = global.db.premium || [];
		let user = global.db.users[m.sender] || {};
		let setBot = global.db.set[botNumber] || {};
		
		global.db.game = game;
		global.db.users[m.sender] = user;
		global.db.set[botNumber] = setBot;
		global.db.oguriAI ??= {};
		global.db.mahiruMemory ??= {};
		if (!global.db.bank)
    	global.db.bank = {
		kas: 1000000000,
		totalPajak: 0,
		totalTarik: 0,
		totalTransaksi: 0,
		danaMasuk: 0,
		danaKeluar: 0,
		totalRace: 0,
		totalFeed: 0,
		totalPembelian: 0,
		aktivitas: [],
		createdAt: Date.now()
	    }

        let bank = global.db.bank

if (bank.danaMasuk == null)
	bank.danaMasuk = 0

if (bank.danaKeluar == null)
	bank.danaKeluar = 0

if (bank.totalRace == null)
	bank.totalRace = 0

if (bank.totalFeed == null)
	bank.totalFeed = 0

if (bank.totalPembelian == null)
	bank.totalPembelian = 0

if (bank.kas == null)
	bank.kas = 1000000000

if (!Array.isArray(bank.aktivitas))
	bank.aktivitas = []
		
		const defaultSetBot = {
			lang: 'id',
			limit: 0,
			money: 0,
			status: 0,
			log: true,
			join: false,
			public: true,
			anticall: false,
			original: true,
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
			botname: global.botname || 'Oguri Bot',
			packname: global.packname || 'Bot WhatsApp',
			template: 'documentMessage',
			owner: global.owner,
		};
		for (let key in defaultSetBot) {
			if (!(key in setBot)) setBot[key] = defaultSetBot[key];
		}
		
		const isPremium = checkStatus(m.sender, premium)

        const limitUser = user.vip
          ? global.limit.vip
          : isPremium
          ? global.limit.premium
          : global.limit.free
        
        const moneyUser = user.vip
          ? global.money.vip
          : isPremium
          ? global.money.premium
          : global.money.free
		
		const defaultUser = {
			vip: false,
			ban: false,
			name: m.pushName || 'Trainer',
			customName: '',
			age: '',
			keterangan: '',
			tagTitle: '',
			exp: 0,
			afkTime: -1,
			afkReason: '',
			afkMentioned: false,
			afkMentionedChats: {},
			register: false,
			limit: limitUser,
			limitNotified: false,
			money: moneyUser,
			brankas: 1,
			lastclaim: 0,
			lastbegal: 0,
			lastrampok: 0,
			lastBank: 0,
			lastFeature: '-'
		};
		for (let key in defaultUser) {
			if (!(key in user)) user[key] = defaultUser[key];
		}

		if (typeof user.brankas !== 'number' || isNaN(user.brankas)) {
			user.brankas = 1;
		}

		// 🛡️ Pastikan limit bertindak sebagai saldo yang aman & valid
		if (typeof user.limit !== 'number' || isNaN(user.limit)) {
			user.limit = limitUser;
		}
		user.limitNotified = Boolean(user.limitNotified);
		
		if (m.isGroup) {
			let group = global.db.groups[m.chat] || {};
			global.db.groups[m.chat] = group;
			
			const defaultGroup = {
				url: '',
				text: {},
				warn: {},
				tagsw: {},
				nsfw: false,
				lock: false,
				leave: false,
				setinfo: false,
				antilink: false,
				demote: false,
				antitoxic: false,
				promote: false,
				welcome: false,
				antivirtex: false,
				antitagsw: false,
				antidelete: false,
				antihidetag: false,
				waktusholat: false,
				
				oguriAI: {
				   enable: false,
				},
				mahiruAI: {
				   enable: false,
				}
			};
			for (let key in defaultGroup) {
				if (!(key in group)) group[key] = defaultGroup[key];
			}
		}
		
		const defaultGame = {
			suit: {},
			chess: {},
			chat_ai: {},
			menfes: {},
			tekateki: {},
			tictactoe: {},
			tebaklirik: {},
			kuismath: {},
			blackjack: {},
			tebaklagu: {},
			tebakkata: {},
			family100: {},
			susunkata: {},
			tebakbom: {},
			ulartangga: {},
			tebakkimia: {},
			caklontong: {},
			tebakangka: {},
			tebaknegara: {},
			tebakgambar: {},
			tebakbendera: {},
		};
		for (let key in defaultGame) {
			if (!(key in game)) game[key] = defaultGame[key];
		}
		
	} catch (e) {
		throw e
	}
}

async function MessagesUpsert(naze, message, store) {
	try {
		if (!message?.messages || !Array.isArray(message.messages) || message.messages.length === 0) return;
		let botNumber = naze.decodeJid(naze.user?.id || '');

		for (const msg of message.messages) {
			if (!msg || !msg.message) continue;

			// Ekstraksi timestamp yang akurat (menangani format Long object maupun number di protobuf)
			const rawTimestamp = msg.messageTimestamp;
			const timestampSec = typeof rawTimestamp === 'number'
				? rawTimestamp
				: (rawTimestamp?.low ?? Number(rawTimestamp) ?? 0);
			const msgTime = timestampSec * 1000;

			// ⚡ ULTRA-FAST STALE FILTER: Abaikan pesan lama sebelum bot online atau pesan sync offline (> 2 menit yang lalu)
			if (msgTime > 0 && (msgTime < botStartTime || (Date.now() - msgTime > 2 * 60 * 1000))) {
				continue;
			}

			// 🛡️ ANTI SELF-REPLY / DOUBLE COMMAND:
			// Abaikan seluruh pesan yang dikirim oleh proses bot ini atau bot Baileys
			if (isBotSentMessage(msg.key?.id)) continue;
			const remoteJid = msg.key?.remoteJid;
			const hasActiveMath = Boolean(global.__oguriMathSessionManager?.hasSession(remoteJid));
			const hasActiveGameSession = Boolean(hasAnyActiveGame(remoteJid));
			const hasActiveStickerPack = Boolean(hasStickerPackSession(remoteJid, msg.key?.participant || remoteJid, msg));
			if (!hasActiveMath && !hasActiveGameSession && !hasActiveStickerPack && msg.key?.fromMe && (
				msg.key.id?.startsWith('3EB0') ||
				msg.key.id?.includes('STARFALL') ||
				msg.key.id?.startsWith('BAE5') ||
				msg.key.id?.startsWith('HSK') ||
				msg.key.id?.startsWith('B1E')
			)) {
				continue;
			}

			(store.messages ??= {})[remoteJid] ??= {};
			store.messages[remoteJid].array ??= [];
			store.messages[remoteJid].keyId ??= new Set();
			if (!(store.messages[remoteJid].keyId instanceof Set)) {
				store.messages[remoteJid].keyId = new Set(store.messages[remoteJid].array.map(m => m.key.id));
			}
			if (store.messages[remoteJid].keyId.has(msg.key.id)) continue;
			store.messages[remoteJid].array.push(msg);
			store.messages[remoteJid].keyId.add(msg.key.id);
			if (store.messages[remoteJid].array.length > 20) {
				const old = store.messages[remoteJid].array.shift();
				if (old?.key?.id) store.messages[remoteJid].keyId.delete(old.key.id);
			}
			const type = msg.message ? (getContentType(msg.message) || Object.keys(msg.message)[0]) : '';
			const m = await Serialize(naze, msg, store);

			// ⚡ ULTRA-FAST SILENT DELETE UNTUK BANNED STICKER (SOCKET LEVEL INSTANT)
			if (m && m.isGroup && (m.type === 'stickerMessage' || m.msg?.mimetype === 'image/webp' || m.mime === 'image/webp')) {
				try {
					const isBanned = await checkAndHandleBannedSticker({ naze, m });
					if (isBanned) continue;
				} catch (e) {}
			}

			if (nazeHandler) {
				dispatchNazeHandler(naze, m, msg, store);
			} else {
				await reloadHandler();
				if (nazeHandler) dispatchNazeHandler(naze, m, msg, store);
			}
			if (global.db?.set?.[botNumber]?.readsw && msg.key.remoteJid === 'status@broadcast') {
				await naze.readMessages([msg.key]).catch(() => {});
				const rawPart = msg.key.participant || msg.participant || '';
				const resolvedJid = (naze.resolveRealJid ? naze.resolveRealJid(rawPart, store) : (naze.findJidByLid ? naze.findJidByLid(rawPart, store) : null)) || rawPart;
				const cleanPhone = (resolvedJid && resolvedJid.includes('@s.whatsapp.net')) ? resolvedJid.split('@')[0] : (rawPart.includes('@s.whatsapp.net') ? rawPart.split('@')[0] : '');
				const pushName = await naze.getName(resolvedJid || rawPart).catch(() => '') || '';
				const displayName = pushName ? `${pushName}${cleanPhone ? ' (@' + cleanPhone + ')' : ''}` : (cleanPhone ? `@${cleanPhone}` : 'User');
				const mentionList = [resolvedJid, rawPart].filter(j => j && j.includes('@s.whatsapp.net'));
				const ownerTarget = global.db?.set?.[botNumber]?.owner || global.owner;

				if (/protocolMessage/i.test(type)) {
					await naze.sendFromOwner(ownerTarget, `🗑️ *Status dari ${displayName} Telah Dihapus*`, msg, { mentions: mentionList }).catch(() => {});
				}
				if (/(audioMessage|imageMessage|videoMessage)/i.test(type)) {
					try {
						const mediaBuffer = await naze.downloadMediaMessage(msg.message[type]).catch(() => null);
						const caption = msg.message[type]?.caption || '';
						const captionText = `📥 *Status WhatsApp (Intip SW)*\n👤 *Dari:* ${displayName}${caption ? '\n📝 *Caption:* ' + caption : ''}`;
						if (mediaBuffer && mediaBuffer.length > 0) {
							if (type === 'imageMessage') {
								await naze.sendFromOwner(ownerTarget, { image: mediaBuffer, caption: captionText, mentions: mentionList }, msg).catch(() => {});
							} else if (type === 'videoMessage') {
								await naze.sendFromOwner(ownerTarget, { video: mediaBuffer, caption: captionText, mentions: mentionList }, msg).catch(() => {});
							} else if (type === 'audioMessage') {
								await naze.sendFromOwner(ownerTarget, { audio: mediaBuffer, mimetype: msg.message.audioMessage?.mimetype || 'audio/mp4', ptt: true, mentions: mentionList }, msg).catch(() => {});
							}
						} else {
							let keke = (type === 'imageMessage') ? `Story Gambar ${caption ? 'dengan Caption : ' + caption : ''}` : (type === 'videoMessage') ? `Story Video ${caption ? 'dengan Caption : ' + caption : ''}` : 'Story Audio';
							await naze.sendFromOwner(ownerTarget, `Melihat story dari ${displayName}\n${keke}`, msg, { mentions: mentionList }).catch(() => {});
						}
					} catch (eMedia) {
						let keke = (type === 'imageMessage') ? 'Story Gambar' : (type === 'videoMessage') ? 'Story Video' : 'Story Audio';
						await naze.sendFromOwner(ownerTarget, `Melihat story dari ${displayName}\n${keke}`, msg, { mentions: mentionList }).catch(() => {});
					}
				} else if (/(extendedTextMessage|conversation)/i.test(type)) {
					const textContent = msg.message.extendedTextMessage?.text || msg.message.conversation || '';
					await naze.sendFromOwner(ownerTarget, `📥 *Status WhatsApp (Teks)*\n👤 *Dari:* ${displayName}\n\n📝 *Isi:* \n${textContent}`, msg, { mentions: mentionList }).catch(() => {});
				}
			}
		}
	} catch (e) {
		console.error('[MESSAGES UPSERT ERROR]', e?.message || e);
	}
}

// ============================================================
// 🔘 INTERACTIVE MESSAGE ENGINE V2 (audit — root cause fix)
// ============================================================
//
// ROOT CAUSE (bukti lengkap ada di CHANGELOG_BUTTON_V2.md di root project):
//   `buttonsMessage` (dipakai sendButtonMsg versi lama) adalah tipe pesan
//   LEGACY yang server & official client WhatsApp (Android/iOS/Web) sudah
//   menghentikan dukungannya, TERLEPAS dari Baileys ataupun kode project
//   ini. Client yang masih menampilkannya biasanya adalah bot lain (mis.
//   sesama Baileys) yang membaca protobuf mentah secara lokal — bukan
//   render resmi WhatsApp. Ini sebabnya:
//     - pengirim melihat preview  -> echo lokal dari device pengirim sendiri
//     - bot lain kadang melihat   -> bot lain decode protobuf mentah, bukan
//                                    render client resmi
//     - sebagian besar user WA
//       TIDAK melihat apa-apa     -> client resmi sudah drop buttonsMessage
//   Sedangkan sendListMsg SELALU normal karena dari awal sudah memakai
//   `interactiveMessage` + `nativeFlowMessage`, jalur yang MASIH didukung
//   resmi. Payload contextInfo/externalAdReply pada kedua helper LAMA
//   terbukti identik (sama-sama spread `contextInfo` mentah tanpa
//   transformasi) — jadi bukan itu akar masalahnya. Satu-satunya variabel
//   pembeda struktural adalah container pesannya: `buttonsMessage` vs
//   `interactiveMessage`. Kesimpulan: bukan bug protobuf/relayMessage di
//   project ini, melainkan deprecation di sisi platform WhatsApp — solusi
//   yang benar adalah migrasi total ke InteractiveMessage, bukan patch.
//
// Ditemukan pula BUG SEKUNDER (kontributif, bukan akar utama): sendButtonMsg
// lama mengirim `buttonsMessage` tapi TETAP melampirkan additionalNodes
// biz/interactive/native_flow (metadata yang hanya relevan utk native flow)
// — payload & sinyal biner tidak konsisten. Di V2 ini otomatis tidak lagi
// terjadi karena sendButtonMsg & sendListMsg kini memakai jalur pengiriman
// yang 100% sama (sendInteractiveCore).
//
// Helper murni (tidak butuh `naze`) di bawah, dipakai BERSAMA oleh
// sendListMsg() dan sendButtonMsg() supaya tidak ada lagi celah dua
// implementasi contextInfo/header/media yang diam-diam berbeda.
// ============================================================

// ── convertExternalAdReply(): titik tunggal utk field externalAdReply ────
// (title, body, thumbnail/jpegThumbnail/thumbnailUrl, showAdAttribution,
//  renderLargerThumbnail, mediaType, sourceUrl — semua passthrough apa
//  adanya karena field ContextInfo.ExternalAdReplyPreview dipakai bersama
//  oleh SEMUA tipe pesan WhatsApp/Baileys, tidak butuh transformasi struktur)
const convertExternalAdReply = (externalAdReply) => {
	if (!externalAdReply || typeof externalAdReply !== 'object') return undefined
	return { ...externalAdReply }
}

// ── convertContext(): gabungkan contextInfo + quoted + mentions ──────────
const convertContext = (contextInfo = {}, options = {}, mentions = []) => {
	const merged = {
		...contextInfo,
		...options.contextInfo
	}
	if (merged.externalAdReply) merged.externalAdReply = convertExternalAdReply(merged.externalAdReply)
	return {
		...merged,
		mentionedJid: options.mentions || mentions,
		...(options.quoted ? {
			stanzaId: options.quoted.key.id,
			remoteJid: options.quoted.key.remoteJid,
			participant: options.quoted.key.participant || options.quoted.key.remoteJid,
			fromMe: options.quoted.key.fromMe,
			quotedMessage: options.quoted.message
		} : {})
	}
}

// ── convertMedia(): upload image/video/document/location, dll ───────────
const convertMedia = async (media, uploadFn) => {
	if (!media || typeof media !== 'object' || Object.keys(media).length === 0) return {}
	return generateWAMessageContent(media, { upload: uploadFn })
}

// ── convertHeader(): bangun InteractiveMessage.Header ────────────────────
// Tipe header (text/image/video/document/location) otomatis terdeteksi dari
// KEY media yang dikirim (persis seperti sendListMsg) — tidak lagi butuh
// angka `headerType` manual seperti buttonsMessage lama.
const convertHeader = async ({ title, subtitle, media = {}, uploadFn }) => {
	const hasMedia = media && typeof media === 'object' && Object.keys(media).length > 0
	return proto.Message.InteractiveMessage.Header.create({
		title,
		subtitle,
		hasMediaAttachment: hasMedia,
		...(hasMedia ? await convertMedia(media, uploadFn) : {})
	})
}

// ── convertNativeFlow(): normalisasi satu tombol -> {name, buttonParamsJson} ──
const convertNativeFlow = (name, paramsJson) => ({
	name,
	buttonParamsJson: JSON.stringify(
		paramsJson && typeof paramsJson === 'object'
			? paramsJson
			: (() => { try { return JSON.parse(paramsJson || '{}') } catch { return {} } })()
	)
})

// ── convertLegacyButtons(): buttonsMessage lama -> NativeFlow buttons ────
// WAJIB backward compatible dgn ±334 command lama. Menangani SEMUA bentuk
// yang benar-benar dipakai di project ini plus checklist yang diminta:
//   1. Native modern     : { name, buttonParamsJson }               (passthrough)
//   2. Hybrid (sudah ada di lib/template_menu.js):
//                          { buttonId, buttonText, nativeFlowInfo:{name,paramsJson}, type }
//   3. cta_url            : { urlButton: { displayText, url } }
//   4. cta_call           : { callButton: { displayText, phoneNumber } }
//   5. cta_copy           : { copyButton: { displayText, copyCode } } / copyCode langsung
//   6. Legacy polos       : { buttonId, buttonText:{ displayText }, type:1 } -> quick_reply
const convertLegacyButtons = (buttons = []) => {
	if (!Array.isArray(buttons)) return []
	return buttons.map((btn) => {
		if (!btn || typeof btn !== 'object') return null

		if (btn.name && btn.buttonParamsJson !== undefined) {
			return convertNativeFlow(btn.name, btn.buttonParamsJson)
		}
		if (btn.nativeFlowInfo && btn.nativeFlowInfo.name) {
			return convertNativeFlow(btn.nativeFlowInfo.name, btn.nativeFlowInfo.paramsJson)
		}
		if (btn.urlButton) {
			return convertNativeFlow('cta_url', {
				display_text: btn.urlButton.displayText,
				url: btn.urlButton.url
			})
		}
		if (btn.callButton) {
			return convertNativeFlow('cta_call', {
				display_text: btn.callButton.displayText,
				phone_number: btn.callButton.phoneNumber
			})
		}
		if (btn.copyButton || btn.copyCode) {
			return convertNativeFlow('cta_copy', {
				display_text: btn.copyButton?.displayText ?? btn.buttonText?.displayText ?? '',
				copy_code: btn.copyButton?.copyCode ?? btn.copyCode ?? ''
			})
		}

		const displayText = (btn.buttonText?.displayText ?? '').toString().trim()
		return convertNativeFlow('quick_reply', {
			display_text: displayText,
			id: btn.buttonId ?? ''
		})
	}).filter(Boolean)
}

// ── sendInteractiveCore(): satu-satunya jalur bangun+kirim InteractiveMessage ──
// Dipakai oleh sendListMsg() DAN sendButtonMsg() -> menjamin payload
// contextInfo/header/relayMessage kedua helper 100% identik selamanya.
//
// AUDIT (bug: menu hanya sampai ke pengirim, audio sampai ke semua):
// Fakta yang BISA dibuktikan langsung dari project ini (bukan tebakan):
//   1. `naze.relayMessage` TIDAK PERNAH di-override di project ini — itu
//      murni method bawaan Baileys yang menempel ke socket.
//   2. SELURUH pemanggilan relayMessage() langsung di project ini (helper
//      ini, anti-toxic, menfes, dll) TIDAK PERNAH melakukan fetch/refresh
//      metadata grup sebelum relay.
//   3. Audio dikirim lewat `naze.sendMessage()` — fungsi tingkat tinggi
//      BAWAAN Baileys yang menurut dokumentasi resminya "will try to get
//      the group participant list (to encrypt the message to each
//      participant)" ketika tujuannya grup — sebuah langkah yang TIDAK ADA
//      di jalur relayMessage() manual.
//   4. Socket di index.js TIDAK dikonfigurasi dengan `cachedGroupMetadata`
//      (dicek langsung, tidak ada di opsi WAConnection()).
// Yang TIDAK bisa dipastikan dari sandbox ini (jujur, bukan disembunyikan):
// apakah relayMessage() level Baileys RC13 melakukan sendiri fetch
// participant grup itu atau tidak — source literalnya tidak bisa diakses
// dari lingkungan audit ini (tanpa akses npm/GitHub raw). Karena itu,
// perbaikan di bawah dibuat SUPAYA BENAR di kedua kemungkinan: kita
// paksa metadata grup selalu segar SEBELUM relay (persis langkah yang
// didokumentasikan dipakai sendMessage()), dan kita sediakan log
// diagnostik opt-in (NAZE_RELAY_DEBUG=1) supaya saat dijalankan di sesi
// WhatsApp nyata, ada bukti pasti (bukan dugaan) apa yang sebenarnya
// terjadi di level ack/relay.
const sendInteractiveCore = async (naze, jid, content = {}, options = {}, store) => {
	// Samakan dengan langkah yang didokumentasikan dipakai sendMessage()
	// bawaan Baileys untuk grup: pastikan metadata partisipan grup segar
	// SEBELUM relay lewat in-memory cache berkecepatan tinggi (O(1)).
	if (jid.endsWith('@g.us') && store) {
		try {
			await getOrFetchGroupMetadata(naze, jid, store);
		} catch (e) {
			// Biarkan lanjut walau gagal refresh -> tetap pakai cache lama jika ada
		}
	}

	const { text, caption, footer = '', title, subtitle, ai, contextInfo = {}, buttons = [], messageParamsJson = {}, mentions = [], ...media } = content
	const msg = await generateWAMessageFromContent(jid, {
		viewOnceMessage: {
			message: {
				messageContextInfo: {
					deviceListMetadata: {},
					deviceListMetadataVersion: 2,
				},
				interactiveMessage: proto.Message.InteractiveMessage.create({
					body: proto.Message.InteractiveMessage.Body.create({ text: text || caption || '' }),
					footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
					header: await convertHeader({ title, subtitle, media, uploadFn: naze.waUploadToServer }),
					nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
						...(messageParamsJson && typeof messageParamsJson === 'object' && Object.keys(messageParamsJson).length > 0 ? messageParamsJson : {}),
						buttons
					}),
					contextInfo: convertContext(contextInfo, options, mentions)
				})
			}
		}
	}, {});
	const relayOpts = {
		messageId: msg.key.id,
		additionalNodes: [{
			tag: 'biz',
			attrs: {},
			content: [{
				tag: 'interactive',
				attrs: {
					type: 'native_flow',
					v: '1'
				},
				content: [{
					tag: 'native_flow',
					attrs: {
						v: '9',
						name: 'mixed'
					}
				}]
			}]
		}, ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
	}

	// Diagnostik opt-in (set NAZE_RELAY_DEBUG=1 di env) — TIDAK aktif secara
	// default. Tujuannya supaya saat dites di sesi WhatsApp NYATA, ada bukti
	// konkret (bukan dugaan) apakah pesan benar-benar direlay dgn metadata
	// participant yang valid, dan apa hasil relayMessage()-nya.
	if (process.env.NAZE_RELAY_DEBUG === '1') {
		const isGroup = jid.endsWith('@g.us')
		const participantCount = isGroup ? (store?.groupMetadata?.[jid]?.participants?.length ?? 'UNKNOWN') : 'n/a (private chat)'
		console.log(`[NAZE_RELAY_DEBUG] sendInteractiveCore -> jid=${jid} isGroup=${isGroup} participantCount=${participantCount} messageId=${msg.key.id}`)
	}

	const hasil = await naze.relayMessage(msg.key.remoteJid, msg.message, relayOpts)

	if (process.env.NAZE_RELAY_DEBUG === '1') {
		console.log(`[NAZE_RELAY_DEBUG] relayMessage() selesai utk messageId=${msg.key.id} ->`, JSON.stringify(hasil))
	}

	return hasil
}


async function Solving(naze, store) {
	installOutgoingGuard(naze);
	naze.serializeM = (m) => MessagesUpsert(naze, m, store)
	
	global.lidPhoneRegistry ??= {
		lidToPhone: new Map(),
		phoneToLid: new Map(),
		lidToName: new Map()
	};

	global.recordLidMapping = (lid, phone, name = null) => {
		if (!lid || !phone) return;
		const cleanLid = String(lid).replace(/[^0-9]/g, '');
		let cleanPhone = String(phone).replace(/[^0-9]/g, '');
		if (cleanPhone.startsWith('08')) cleanPhone = '628' + cleanPhone.slice(2);
		if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return;
		if (cleanPhone.length >= 8 && cleanPhone.length <= 15) {
			const phoneJid = cleanPhone + '@s.whatsapp.net';
			global.lidPhoneRegistry.lidToPhone.set(cleanLid, phoneJid);
			global.lidPhoneRegistry.phoneToLid.set(cleanPhone, cleanLid + '@lid');
			if (name && typeof name === 'string' && name.trim()) {
				global.lidPhoneRegistry.lidToName.set(cleanLid, name.trim());
			}
		}
	};

	global.recordGroupParticipants = (participants) => {
		if (!Array.isArray(participants)) return;
		for (const p of participants) {
			if (!p) continue;
			const pLid = p.lid || (String(p.id || '').endsWith('@lid') ? p.id : null);
			const pPhone = p.phoneNumber || (String(p.id || '').endsWith('@s.whatsapp.net') ? p.id : null);
			if (pLid && pPhone) {
				global.recordLidMapping(pLid, pPhone, p.name || p.notify);
			}
		}
	};

	naze.decodeJid = (jid) => {
		if (!jid) return jid
		if (/:\d+@/gi.test(jid)) {
			let decode = jidDecode(jid) || {}
			return decode.user && decode.server && decode.user + '@' + decode.server || jid
		} else return jid
	}

	naze.resolveRealJid = (jid, m = null) => {
		if (!jid || typeof jid !== 'string') return jid;
		jid = naze.decodeJid(jid);
		if (jid === '0@s.whatsapp.net') return jid;
		if (naze?.user?.id && areJidsSameUser(jid, naze.decodeJid(naze.user.id))) {
			return naze.decodeJid(naze.user.id);
		}

		// Jika sudah berakhiran @s.whatsapp.net
		if (jid.endsWith('@s.whatsapp.net')) {
			const clean = jid.replace(/[^0-9]/g, '');
			// Periksa apakah ini sebenarnya LID yang salah diberi domain @s.whatsapp.net
			if (global.lidPhoneRegistry?.lidToPhone?.has(clean)) {
				return global.lidPhoneRegistry.lidToPhone.get(clean);
			}
			return jid;
		}

		const cleanLid = jid.replace(/[^0-9]/g, '');
		if (!cleanLid) return jid;

		// 1. Cek fast in-memory map
		if (global.lidPhoneRegistry?.lidToPhone?.has(cleanLid)) {
			return global.lidPhoneRegistry.lidToPhone.get(cleanLid);
		}

		// 2. Cek message context jika ada
		if (m) {
			if (m.key?.participantAlt && typeof m.key.participantAlt === 'string' && m.key.participantAlt.endsWith('@s.whatsapp.net')) {
				const altNum = m.key.participantAlt.replace(/[^0-9]/g, '');
				if (m.key.participant && m.key.participant.includes(cleanLid)) {
					const res = altNum + '@s.whatsapp.net';
					global.recordLidMapping(cleanLid, res, m.pushName);
					return res;
				}
			}
			if (m.msg?.contextInfo?.participantAlt && typeof m.msg.contextInfo.participantAlt === 'string' && m.msg.contextInfo.participantAlt.endsWith('@s.whatsapp.net')) {
				const altNum = m.msg.contextInfo.participantAlt.replace(/[^0-9]/g, '');
				if (m.msg.contextInfo.participant && m.msg.contextInfo.participant.includes(cleanLid)) {
					const res = altNum + '@s.whatsapp.net';
					global.recordLidMapping(cleanLid, res, null);
					return res;
				}
			}
			if (Array.isArray(m.metadata?.participants)) {
				for (const p of m.metadata.participants) {
					if (!p) continue;
					const pLid = String(p.lid || '').replace(/[^0-9]/g, '');
					const pId = String(p.id || '').replace(/[^0-9]/g, '');
					const pPhone = p.phoneNumber ? String(p.phoneNumber).replace(/[^0-9]/g, '') : (p.id?.endsWith('@s.whatsapp.net') ? pId : null);
					if ((pLid === cleanLid || pId === cleanLid) && pPhone) {
						let cleanP = pPhone;
						if (cleanP.startsWith('08')) cleanP = '628' + cleanP.slice(2);
						const res = cleanP + '@s.whatsapp.net';
						global.recordLidMapping(cleanLid, res, p.name || p.notify);
						return res;
					}
				}
			}
		}

		// 3. Panggil findJidByLid
		const fromLid = naze.findJidByLid(jid, store, false);
		if (fromLid && fromLid.endsWith('@s.whatsapp.net')) {
			return fromLid;
		}

		return jid;
	};

	naze.findJidByLid = (lid, store, resolve = false) => {
		if (!lid || typeof lid !== 'string') return resolve ? lid : null;

		// Jika sudah berupa nomor telepon valid @s.whatsapp.net
		if (lid.endsWith('@s.whatsapp.net')) {
			let numOnly = lid.replace(/[^0-9]/g, '');
			if (numOnly.length >= 7 && numOnly.length <= 16) {
				if (global.lidPhoneRegistry?.lidToPhone?.has(numOnly)) {
					return global.lidPhoneRegistry.lidToPhone.get(numOnly);
				}
				return lid;
			}
		}

		const cleanLid = lid.replace(/[^0-9]/g, '');
		if (!cleanLid) return resolve ? lid : null;

		if (global.lidPhoneRegistry?.lidToPhone?.has(cleanLid)) {
			return global.lidPhoneRegistry.lidToPhone.get(cleanLid);
		}

		const formatPhone = (val) => {
			if (!val) return null;
			let num = String(val).replace(/[^0-9]/g, '');
			if (!num) return null;
			if (num === cleanLid || String(val).endsWith('@lid')) return null;
			if (global.lidPhoneRegistry?.lidToPhone?.has(num)) {
				return global.lidPhoneRegistry.lidToPhone.get(num);
			}
			if (num.startsWith('08')) num = '628' + num.slice(2);
			if (num.length >= 8 && num.length <= 15) {
				return num + '@s.whatsapp.net';
			}
			return null;
		};

		// 1. Cari di store.groupMetadata
		const groupMeta = store?.groupMetadata;
		if (groupMeta) {
			for (const g of Object.values(groupMeta)) {
				if (!Array.isArray(g?.participants)) continue;
				for (const contact of g.participants) {
					if (!contact) continue;
					const cId = String(contact.id || '');
					const cLid = String(contact.lid || '');
					const match = cLid === lid || cLid.includes(cleanLid) || cId === lid || cId.includes(cleanLid);
					if (match) {
						const res = formatPhone(contact.phoneNumber) || (cId.endsWith('@s.whatsapp.net') ? formatPhone(cId) : null);
						if (res) {
							global.recordLidMapping(cleanLid, res, contact.name || contact.notify);
							return res;
						}
					}
				}
			}
		}

		// 2. Cari di store.contacts
		const contacts = store?.contacts;
		if (contacts) {
			const direct = contacts[lid] || contacts[cleanLid + '@lid'] || contacts[cleanLid];
			if (direct) {
				const res = formatPhone(direct.phoneNumber) || (direct.id?.endsWith('@s.whatsapp.net') ? formatPhone(direct.id) : null);
				if (res) {
					global.recordLidMapping(cleanLid, res, direct.name || direct.notify);
					return res;
				}
			}

			for (const [key, contact] of Object.entries(contacts)) {
				if (!contact) continue;
				const cId = String(contact.id || key || '');
				const cLid = String(contact.lid || '');
				const match = cLid === lid || cLid.includes(cleanLid) || cId === lid || cId.includes(cleanLid);
				if (match) {
					const res = formatPhone(contact.phoneNumber) || (cId.endsWith('@s.whatsapp.net') ? formatPhone(cId) : null);
					if (res) {
						global.recordLidMapping(cleanLid, res, contact.name || contact.notify);
						return res;
					}
				}
			}
		}

		// 3. Cari di global.db.users
		if (global.db?.users) {
			for (const [userJid, uData] of Object.entries(global.db.users)) {
				if (!uData) continue;
				if (uData.lid === lid || (uData.lid && uData.lid.includes(cleanLid))) {
					const res = formatPhone(userJid);
					if (res) {
						global.recordLidMapping(cleanLid, res, uData.name);
						return res;
					}
				}
			}
		}

		if (resolve) return lid;
		return null;
	};

	naze.findLidByJid = (jid, store) => {
		if (!jid || typeof jid !== 'string') return null;
		const cleanPhone = jid.replace(/[^0-9]/g, '');
		if (!cleanPhone) return null;

		if (global.lidPhoneRegistry?.phoneToLid?.has(cleanPhone)) {
			return global.lidPhoneRegistry.phoneToLid.get(cleanPhone);
		}

		const groupMeta = store?.groupMetadata;
		if (groupMeta) {
			for (const g of Object.values(groupMeta)) {
				if (!Array.isArray(g?.participants)) continue;
				for (const contact of g.participants) {
					if (!contact) continue;
					const cPhone = String(contact.phoneNumber || contact.id || '').replace(/[^0-9]/g, '');
					if (cPhone === cleanPhone && contact.lid) {
						const lidRes = contact.lid.endsWith('@lid') ? contact.lid : contact.lid + '@lid';
						global.recordLidMapping(lidRes, jid);
						return lidRes;
					}
				}
			}
		}
		return null;
	};

	naze.getName = (jid, withoutContact = false) => {
		let id = naze.decodeJid(jid);
		if (!id) return '';
		if (id.endsWith('@lid') || !id.includes('@')) {
			const resolved = naze.resolveRealJid(id, null);
			if (resolved && resolved.endsWith('@s.whatsapp.net')) id = resolved;
		}

		if (id.endsWith('@g.us')) {
			const groupInfo = store?.contacts?.[id] || store?.groupMetadata?.[id] || {};
			return Promise.resolve(groupInfo.name || groupInfo.subject || 'Group');
		} else {
			if (id === '0@s.whatsapp.net') {
				return 'WhatsApp';
			}
			const cleanNum = id.replace(/[^0-9]/g, '');
			const contactInfo = store?.contacts?.[id] || store?.contacts?.[cleanNum + '@s.whatsapp.net'] || store?.contacts?.[cleanNum + '@lid'] || {};
			let name = contactInfo.name || contactInfo.subject || contactInfo.verifiedName || contactInfo.notify;
			if (!name && global.db?.users?.[id]?.name) {
				name = global.db.users[id].name;
			}
			if (!name && global.lidPhoneRegistry?.lidToName?.has(cleanNum)) {
				name = global.lidPhoneRegistry.lidToName.get(cleanNum);
			}
			if (withoutContact) return name || '';
			// JANGAN PERNAH parsing nomor LID sebagai international phone number (agar tidak muncul nomor palsu negara lain)
			if (id.endsWith('@lid') || (!id.endsWith('@s.whatsapp.net') && cleanNum.length > 13 && !cleanNum.startsWith('62'))) {
				return name || 'User';
			}
			const pn = PhoneNumber('+' + cleanNum);
			const formattedIntl = pn?.number?.international || (typeof pn?.getNumber === 'function' ? pn.getNumber('international') : null);
			return name || formattedIntl || cleanNum;
		}
	};

	// Wrapper global naze.sendMessage agar reply, tag, dan mention selalu menggunakan nomor asli dan tidak bocor format LID
	const _originalSendMessage = naze.sendMessage.bind(naze);
	naze.sendMessage = async (jid, content, options = {}) => {
		let targetJid = jid;
		if (targetJid && typeof targetJid === 'string' && targetJid.endsWith('@lid')) {
			targetJid = naze.resolveRealJid(targetJid, null) || targetJid;
		}

		let opts = { ...options };
		if (opts.quoted && typeof opts.quoted === 'object') {
			let q = { ...opts.quoted };
			if (q.key) {
				q.key = { ...q.key };
				if (q.key.fromMe || q.fromMe) {
					q.key.participant = naze.decodeJid(naze.user.id);
					q.participant = naze.decodeJid(naze.user.id);
				} else {
					let part = q.key.participant || q.participant;
					if (part) {
						const real = naze.resolveRealJid(part, null);
						if (real && real.endsWith('@s.whatsapp.net')) {
							q.key.participant = real;
							q.participant = real;
						}
					}
				}
			}
			if (q.participant) {
				const real = naze.resolveRealJid(q.participant, null);
				if (real && real.endsWith('@s.whatsapp.net')) q.participant = real;
			}
			opts.quoted = q;
		}

		if (content && typeof content === 'object') {
			if (content.contextInfo) {
				content.contextInfo = { ...content.contextInfo };
				if (content.contextInfo.participant) {
					const real = naze.resolveRealJid(content.contextInfo.participant, null);
					if (real && real.endsWith('@s.whatsapp.net')) {
						content.contextInfo.participant = real;
					}
				}
			}
			let text = content.text || content.caption;
			if (typeof text === 'string') {
				const tagMatches = [...text.matchAll(/@(\d{5,20})/g)];
				for (const match of tagMatches) {
					const tagNum = match[1];
					const phoneFromLid = naze.resolveRealJid(tagNum + '@lid', null);
					if (phoneFromLid && phoneFromLid.endsWith('@s.whatsapp.net')) {
						const realCleanPhone = phoneFromLid.split('@')[0];
						text = text.replaceAll(`@${tagNum}`, `@${realCleanPhone}`);
					} else if (global.lidPhoneRegistry?.lidToName?.has(tagNum)) {
						const userName = global.lidPhoneRegistry.lidToName.get(tagNum);
						text = text.replaceAll(`@${tagNum}`, `${userName}`);
					}
				}
				if (content.text) content.text = text;
				if (content.caption) content.caption = text;
			}

			if (Array.isArray(content.mentions)) {
				content.mentions = content.mentions.map(m => {
					if (typeof m === 'string') {
						const real = naze.resolveRealJid(m, null);
						if (real && real.endsWith('@s.whatsapp.net')) return real;
					}
					return m;
				});
			}
			if (content.contextInfo && Array.isArray(content.contextInfo.mentionedJid)) {
				content.contextInfo.mentionedJid = content.contextInfo.mentionedJid.map(m => {
					if (typeof m === 'string') {
						const real = naze.resolveRealJid(m, null);
						if (real && real.endsWith('@s.whatsapp.net')) return real;
					}
					return m;
				});
			}
		}

		return _originalSendMessage(targetJid, content, opts);
	};
	
	naze.sendContact = async (jid, kon, quoted = '', opts = {}) => {
		let list = []
		for (let i of kon) {
			const name = await naze.getName(i + '@s.whatsapp.net')
        list.push({
          displayName: name,
        
          vcard:
        `BEGIN:VCARD
        VERSION:3.0
        N:${name}
        FN:${name}
        item1.TEL;waid=${i}:${i}
        item1.X-ABLabel:Ponsel
        item2.ADR:;;Indonesia;;;;
        item2.X-ABLabel:Region
        END:VCARD`
        })
		}
		naze.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
	}
	
	naze.profilePictureUrl = async (jid, type = 'image', timeoutMs) => {
		const result = await naze.query({
			tag: 'iq',
			attrs: {
				target: jidNormalizedUser(jid),
				to: '@s.whatsapp.net',
				type: 'get',
				xmlns: 'w:profile:picture'
			},
			content: [{
				tag: 'picture',
				attrs: {
					type, query: 'url'
				},
			}]
		}, timeoutMs);
		const child = getBinaryNodeChild(result, 'picture');
		return child?.attrs?.url;
	}
	
	naze.setStatus = (status) => {
		naze.query({
			tag: 'iq',
			attrs: {
				to: '@s.whatsapp.net',
				type: 'set',
				xmlns: 'status',
			},
			content: [{
				tag: 'status',
				attrs: {},
				content: Buffer.from(status, 'utf-8')
			}]
		})
		return status
	}
	
	naze.relayMessageV2 = async (jid, message, options) => {
		const msg = generateWAMessageFromContent(jid, message, {
			upload: naze.waUploadToServer,
			messageId: generateMessageID(),
			...options
		});
		const hasil = await naze.relayMessage(jid, msg.message, {
			messageId: msg.key.id,
			...options
		});
		return hasil;
	}

	naze.sendPoll = (jid, name = '', values = [], quoted, selectableCount = 1) => {
		return naze.sendMessage(jid, { poll: { name, values, selectableCount }}, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	}
	
	naze.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
		const quotedOptions = { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 }
		try {
			const res = await axios.head(url, { timeout: 3500 });
			let mime = res.headers['content-type'];
			if (mime && mime.includes('gif')) {
				return naze.sendMessage(jid, { video: { url }, caption: caption, gifPlayback: true, ...options }, quotedOptions);
			} else if (mime && mime === 'application/pdf') {
				return naze.sendMessage(jid, { document: { url }, mimetype: 'application/pdf', caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('image')) {
				return naze.sendMessage(jid, { image: { url }, caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('video')) {
				return naze.sendMessage(jid, { video: { url }, caption: caption, mimetype: 'video/mp4', ...options }, quotedOptions);
			} else if (mime && mime.includes('audio')) {
				return naze.sendMessage(jid, { audio: { url }, mimetype: 'audio/mpeg', ...options }, quotedOptions);
			} else {
				return naze.sendMessage(jid, { document: { url }, caption: caption, mimetype: mime, ...options }, quotedOptions);
			}
		} catch (e) {
			return naze.sendMessage(jid, { text: url, ...options }, quotedOptions);
		}
	}
	
	naze.sendGroupInviteV4 = async (jid, participant, inviteCode, inviteExpiration, groupName = 'Unknown Subject', caption = 'Invitation to join my WhatsApp group', jpegThumbnail = null, options = {}) => {
		const msg = proto.Message.create({
			groupInviteMessage: {
				inviteCode,
				inviteExpiration: parseInt(inviteExpiration) || + new Date(new Date + (3 * 86400000)),
				groupJid: jid,
				groupName,
				jpegThumbnail: Buffer.isBuffer(jpegThumbnail) ? jpegThumbnail : null,
				caption,
				contextInfo: {
					mentionedJid: options.mentions || []
				}
			}
		});
		const message = generateWAMessageFromContent(participant, msg, options);
		const invite = await naze.relayMessage(participant, message.message, { messageId: message.key.id })
		return invite
	}
	
	naze.sendFromOwner = async (jids, text, quoted, options = {}) => {
		for (const a of jids) {
			const jid = a.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
			await naze.sendMessage(jid, { text, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		}
	}
	
	naze.sendText = async (jid, text, quoted, options = {}) => naze.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'), ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	
	naze.sendAsSticker = async (jid, pathMedia, quoted, options = {}) => {
		return runHeavyTask(async () => {
			let buff = Buffer.isBuffer(pathMedia) ? pathMedia : /^data:.*?\/.*?;base64,/i.test(pathMedia) ? Buffer.from(pathMedia.split`,`[1], 'base64') : /^https?:\/\//.test(pathMedia) ? await (await getBuffer(pathMedia)) : (typeof pathMedia === 'string' && fs.existsSync(pathMedia)) ? pathMedia : Buffer.alloc(0);
			// Sticker Engine V2: Media->Metadata->Image/Video(FFmpeg)->WebP->Exif,
			// mengembalikan Buffer WEBP langsung (Buffer First, tanpa temp file
			// tambahan untuk hasil akhir). Seluruh proses berjalan lokal (Sharp/
			// Canvas/FFmpeg), tanpa API internet.
			try {
				const result = await createSticker(buff, options);
				let anu = await naze.sendMessage(jid, { sticker: result, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
				return anu;
			} finally {
				// Cleanup SELALU berjalan (termasuk saat createSticker gagal) —
				// memperbaiki kebocoran temp file pada implementasi lama yang
				// hanya membersihkan pathMedia ketika proses berhasil.
				if (typeof pathMedia === 'string' && fs.existsSync(pathMedia)) fs.unlinkSync(pathMedia);
			}
		}, { name: 'sendAsSticker' });
	}
	
	naze.downloadMediaMessage = async (message) => {
		let msg = message.msg || message;
		// Jika msg masih membungkus inner message (misal { imageMessage: { ... } })
		if (msg && typeof msg === 'object') {
			const subKey = Object.keys(msg).find(k => k.endsWith('Message'));
			if (subKey && msg[subKey]?.mediaKey) {
				msg = msg[subKey];
			}
		}
		msg.mediaKey = fixBytes(msg.mediaKey);
		msg.fileSha256 = fixBytes(msg.fileSha256);
		msg.fileEncSha256 = fixBytes(msg.fileEncSha256);
		const mime = msg.mimetype || message.mime || '';

		let messageType = (message.type || '').replace(/Message/gi, '');
		if (/webp/i.test(mime) || messageType === 'sticker') {
			messageType = 'sticker';
		} else if (mime.startsWith('video/') || messageType === 'video') {
			messageType = 'video';
		} else if (mime.startsWith('audio/') || messageType === 'audio') {
			messageType = 'audio';
		} else if (mime.startsWith('image/') || messageType === 'image') {
			messageType = 'image';
		} else if (messageType === 'document' || messageType === 'documentWithCaption' || mime) {
			messageType = 'document';
		} else {
			messageType = 'image';
		}

		const stream = await downloadContentFromMessage(msg, messageType);
		let buffer = Buffer.from([]);
		for await (const chunk of stream) {
			buffer = Buffer.concat([buffer, chunk]);
		}
		return buffer;
	}
	
	naze.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
	const msg = message.msg || message

	msg.mediaKey = fixBytes(msg.mediaKey)
	msg.fileSha256 = fixBytes(msg.fileSha256)
	msg.fileEncSha256 = fixBytes(msg.fileEncSha256)

	const mime = msg.mimetype || ''
	let messageType = (message.type || '').replace(/Message/gi, '')
	if (!messageType || messageType === 'image') {
		if (/webp/i.test(mime)) {
			messageType = 'sticker'
		} else if (mime.startsWith('video/')) {
			messageType = 'video'
		} else if (mime.startsWith('audio/')) {
			messageType = 'audio'
		} else if (mime.startsWith('image/')) {
			messageType = 'image'
		}
	}
	if (messageType === 'viewOnce') {
		messageType = mime.startsWith('video') ? 'video' : 'image'
	}
	const ext = mime.split('/')[1]?.split(';')[0] || 'bin'

	const dir = path.join(__dirname, '../database/temp')
	if (!fs.existsSync(dir))
		fs.mkdirSync(dir, { recursive: true })

	const randomName = crypto.randomBytes(6).readUIntLE(0, 6).toString(36)

	const trueFileName = attachExtension
		? path.join(dir, `${filename || randomName}.${ext}`)
		: path.join(dir, filename || randomName)

	let lastError = null

	for (let retry = 1; retry <= 3; retry++) {
		try {
			const stream = await downloadContentFromMessage(msg, messageType || 'image')

			await new Promise((resolve, reject) => {
				const writeStream = fs.createWriteStream(trueFileName)

				stream.pipe(writeStream)

				writeStream.on('finish', resolve)
				writeStream.on('error', reject)
			})

			return trueFileName

		} catch (err) {
			lastError = err

			console.log(`[MEDIA] Download gagal (${retry}/3): ${err.code || err.message}`)

			if (retry < 3)
				await new Promise(r => setTimeout(r, 1500))
		}
	}

	if (fs.existsSync(trueFileName))
		fs.unlinkSync(trueFileName)

	console.log('[MEDIA] Semua percobaan gagal')
	console.log(lastError)

	return null
}
	
	naze.getFile = async (PATH) => {
		let filename;
		let mime = 'application/octet-stream';
		let ext = 'bin';
		let isTemp = false;
		
		const dir = path.join(__dirname, '../database/temp');
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		
		const randomName = crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
		
		if (Buffer.isBuffer(PATH)) {
			let type = await FileType.fromBuffer(PATH) || { mime, ext };
			mime = type.mime; ext = type.ext;
			filename = path.join(dir, `${randomName}.${ext}`);
			fs.writeFileSync(filename, PATH);
			isTemp = true;
		} else if (/^data:.*?\/.*?;base64,/i.test(PATH)) {
			let buffer = Buffer.from(PATH.split`,`[1], 'base64');
			let type = await FileType.fromBuffer(buffer) || { mime, ext };
			mime = type.mime; ext = type.ext;
			filename = path.join(dir, `${randomName}.${ext}`);
			fs.writeFileSync(filename, buffer);
			isTemp = true;
		} else if (typeof PATH === 'string' && /^https?:\/\//.test(PATH)) {
			const res = await axios.get(PATH, { responseType: 'stream' });
			mime = res.headers['content-type'] || 'application/octet-stream';
			ext = mime.split('/')[1]?.split(';')[0] || 'tmp';
			if (ext === 'jpeg') ext = 'jpg';
			filename = path.join(dir, `${randomName}.${ext}`);
			const writeStream = fs.createWriteStream(filename);
			res.data.pipe(writeStream);
			await new Promise((resolve, reject) => {
				writeStream.on('finish', resolve);
				writeStream.on('error', reject);
			});
			isTemp = true;
		} else if (typeof PATH === 'string' && fs.existsSync(PATH)) {
			let type = await FileType.fromFile(PATH) || { mime, ext };
			mime = type.mime; ext = type.ext;
			filename = PATH;
			isTemp = false;
		} else {
			throw new Error("Format media tidak didukung");
		}
		return { filename, mime, ext, isTemp };
	}
	
	naze.appendResponseMessage = async (m, text) => {
		let apb = await generateWAMessage(m.chat, { text, mentions: m.mentionedJid }, { userJid: naze.user.id, quoted: m.quoted && m.quoted.fakeObj(), ephemeralExpiration: m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
		apb.key = m.key
		apb.key.id = [...Array(32)].map(() => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
		apb.key.fromMe = areJidsSameUser(m.sender, naze.user.id);
		if (m.isGroup) apb.participant = m.sender;
		naze.ev.emit('messages.upsert', {
			...m,
			messages: [proto.WebMessageInfo.create(apb)],
			type: 'append'
		});
	}
	
	naze.sendMedia = async (jid, pathMedia, fileName = '', caption = '', quoted = '', options = {}) => {
		const { mime, filename, isTemp } = await naze.getFile(pathMedia);
		const botNumber = naze.decodeJid(naze.user.id);
		const isWebpSticker = options.asSticker || /webp/.test(mime);
		let type = 'document', mimetype = mime, pathFile = filename;
		let filesToDelete = [];
		if (isTemp) filesToDelete.push(filename);
		try {
			if (isWebpSticker) {
				pathFile = await writeExif(filename, {
					packname: options.packname || global.db?.set?.[botNumber]?.packname || 'Bot WhatsApp',
					author: options.author || global.db?.set?.[botNumber]?.author || 'Nazedev',
					categories: options.categories || [],
				});
				filesToDelete.push(pathFile);
				type = 'sticker';
				mimetype = 'image/webp';
			} else if (/image|video|audio/.test(mime)) {
				type = mime.split('/')[0];
				mimetype = type == 'video' ? 'video/mp4' : type == 'audio' ? 'audio/mpeg' : mime;
			}
			let anu = await naze.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, ...options });
			return anu;
		} finally {
			filesToDelete.forEach(file => {
				if (fs.existsSync(file)) fs.unlinkSync(file);
			});
		}
	}
	
	naze.sendAlbumMessage = async (jid, content = {}, options = {}) => {
		const { album, mentions, contextInfo, ...others } = content;
		for (const media of album) {
			if (!media.image && !media.video) throw new TypeError(`album[i] must have image or video property`);
		}
		if (album.length < 2) throw new RangeError("Minimum 2 media");
		const medias = await generateWAMessageFromContent(jid, {
			albumMessage: {
				expectedImageCount: album.filter(m => m.image).length,
				expectedVideoCount: album.filter(m => m.video).length,
			}
		}, { quoted: options?.quoted || null });
		await naze.relayMessage(jid, medias.message, { messageId: medias.key.id });
		for (const media of album) {
			const msg = await generateWAMessage(jid, { ...others, ...media }, { upload: naze.waUploadToServer });
			msg.message.messageContextInfo = {
				messageAssociation: {
					associationType: 1,
					parentMessageKey: medias.key
				}
			}
			await naze.relayMessage(jid, msg.message, { messageId: msg.key.id });
		}
		return medias;
	}
	
	naze.sendListMsg = async (jid, content = {}, options = {}) => {
		const { buttons = [], ...rest } = content;
		const nativeButtons = buttons.map(a => {
			return {
				name: a.name,
				buttonParamsJson: JSON.stringify(a.buttonParamsJson ? (typeof a.buttonParamsJson === 'string' ? JSON.parse(a.buttonParamsJson) : a.buttonParamsJson) : '')
			}
		})
		return sendInteractiveCore(naze, jid, { ...rest, buttons: nativeButtons }, options, store)
	}
	
	// sendButtonMsg V2 (audit — root cause fix, lihat blok komentar di atas
	// Solving() & CHANGELOG_BUTTON_V2.md utk detail lengkap + bukti).
	// TIDAK LAGI memakai buttonsMessage. Backward compatible 100% dengan
	// ±334 command lama lewat convertLegacyButtons() — caller tidak perlu
	// diubah sama sekali.
	naze.sendButtonMsg = async (jid, content = {}, options = {}) => {
		// `headerType` (audit): konsep header numerik milik buttonsMessage
		// lama sudah TIDAK RELEVAN di InteractiveMessage — tipe header kini
		// otomatis terdeteksi dari key media yang dikirim (sama seperti
		// sendListMsg). Tetap diterima di sini (didestrukturkan & dibuang)
		// SEMATA agar caller lama yang masih mengirim `headerType` tidak
		// error dan tidak bocor jadi field media palsu.
		const { headerType, buttons, ...rest } = content;
		return sendInteractiveCore(naze, jid, { ...rest, buttons: convertLegacyButtons(buttons) }, options, store)
	}
	
	naze.newsletterMsg = async (key, content = {}, timeout = 5000) => {
		const { type: rawType = 'INFO', name, description = '', picture = null, react, id, newsletter_id = key, ...media } = content;
		const type = rawType.toUpperCase();
		if (react) {
			if (!(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) throw [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			if (!id) throw [{ message: 'Use Id Newsletter Message', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			const hasil = await naze.query({
				tag: 'message',
				attrs: {
					to: key,
					type: 'reaction',
					'server_id': id,
					id: generateMessageID()
				},
				content: [{
					tag: 'reaction',
					attrs: {
						code: react
					}
				}]
			});
			return hasil
		} else if (media && typeof media === 'object' && Object.keys(media).length > 0) {
			const msg = await generateWAMessageContent(media, { upload: naze.waUploadToServer });
			const anu = await naze.query({
				tag: 'message',
				attrs: { to: newsletter_id, type: 'text' in media ? 'text' : 'media' },
				content: [{
					tag: 'plaintext',
					attrs: /image|video|audio|sticker|poll/.test(Object.keys(media).join('|')) ? { mediatype: Object.keys(media).find(key => ['image', 'video', 'audio', 'sticker','poll'].includes(key)) || null } : {},
					content: proto.Message.encode(msg).finish()
				}]
			})
			return anu
		} else {
			if ((/(FOLLOW|UNFOLLOW|DELETE)/.test(type)) && !(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) return [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			const _query = await naze.query({
				tag: 'iq',
				attrs: {
					to: 's.whatsapp.net',
					type: 'get',
					xmlns: 'w:mex'
				},
				content: [{
					tag: 'query',
					attrs: {
						query_id: type == 'FOLLOW' ? '9926858900719341' : type == 'UNFOLLOW' ? '7238632346214362' : type == 'CREATE' ? '6234210096708695' : type == 'DELETE' ? '8316537688363079' : '6563316087068696'
					},
					content: new TextEncoder().encode(JSON.stringify({
						variables: /(FOLLOW|UNFOLLOW|DELETE)/.test(type) ? { newsletter_id } : type == 'CREATE' ? { newsletter_input: { name, description, picture }} : { fetch_creation_time: true, fetch_full_image: true, fetch_viewer_metadata: false, input: { key, type: (newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id)) ? 'JID' : 'INVITE' }}
					}))
				}]
			}, timeout);
			const res = JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_join_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_leave_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_create || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_delete_v2 || JSON.parse(_query.content[0].content)?.errors || JSON.parse(_query.content[0].content)
			res.thread_metadata ? (res.thread_metadata.host = 'https://mmg.whatsapp.net') : null
			return res
		}
	}
	
	naze.sendCarouselMsg = async (jid, body = '', footer = '', cards = [], options = {}) => {
		if (jid.endsWith('@g.us') && store) {
			try {
				await getOrFetchGroupMetadata(naze, jid, store);
			} catch (e) {
				// Biarkan lanjut jika gagal refresh grup metadata
			}
		}

		async function getCardMedia(a) {
			const urlsToTry = [
				a.url,
				a.asli,
				a.hd,
				a.image?.url || (typeof a.image === 'string' ? a.image : null),
				a.video?.url || (typeof a.video === 'string' ? a.video : null)
			].filter(Boolean)

			if (a.video && typeof a.video === 'object' && !a.video.url) {
				try {
					const msgContent = await generateWAMessageContent({ video: a.video }, { upload: naze.waUploadToServer })
					return {
						videoMessage: msgContent.videoMessage || null,
						imageMessage: null,
						hasMediaAttachment: Boolean(msgContent.videoMessage)
					}
				} catch (err) {
					console.error('[CAROUSEL] Gagal upload video buffer kartu:', err?.message || err)
				}
			}

			if (a.image && typeof a.image === 'object' && !a.image.url) {
				try {
					const msgContent = await generateWAMessageContent({ image: a.image }, { upload: naze.waUploadToServer })
					return {
						imageMessage: msgContent.imageMessage || null,
						videoMessage: null,
						hasMediaAttachment: Boolean(msgContent.imageMessage)
					}
				} catch (err) {
					console.error('[CAROUSEL] Gagal upload image buffer kartu:', err?.message || err)
				}
			}

			for (const u of urlsToTry) {
				try {
					const mediaType = a.type === 'video' || (typeof u === 'string' && /\.(mp4|mov|avi|mkv)(\?|#|$)/i.test(u)) ? 'video' : 'image'
					const msgContent = await generateWAMessageContent({ [mediaType]: { url: u } }, { upload: naze.waUploadToServer })
					return {
						imageMessage: msgContent.imageMessage || null,
						videoMessage: msgContent.videoMessage || null,
						hasMediaAttachment: Boolean(msgContent.imageMessage || msgContent.videoMessage)
					}
				} catch (err) {
					// Coba url alternatif berikutnya
				}
			}

			console.error('[CAROUSEL] Semua URL media kartu gagal di-upload:', urlsToTry)
			return null
		}

		const cardPromises = cards.map(async (a) => {
			const media = await getCardMedia(a)
			if (!media) return null

			const buttons = Array.isArray(a.buttons) ? convertLegacyButtons(a.buttons) : []

			return proto.Message.InteractiveMessage.create({
				header: proto.Message.InteractiveMessage.Header.create({
					title: a.title || '',
					subtitle: a.subtitle || '',
					hasMediaAttachment: media.hasMediaAttachment,
					imageMessage: media.imageMessage,
					videoMessage: media.videoMessage
				}),
				body: proto.Message.InteractiveMessage.Body.create({ text: a.body || '' }),
				footer: proto.Message.InteractiveMessage.Footer.create({ text: a.footer || '' }),
				nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
					buttons
				})
			})
		})

		const rawCardResults = await Promise.all(cardPromises)
		const cardResults = rawCardResults.filter(Boolean)

		if (cardResults.length === 0) {
			throw new Error('Semua media kartu carousel gagal di-generate.')
		}

		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2
					},
					interactiveMessage: proto.Message.InteractiveMessage.create({
						body: proto.Message.InteractiveMessage.Body.create({ text: body || '' }),
						footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || '' }),
						carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
							cards: cardResults,
							messageVersion: 1
						}),
						contextInfo: convertContext(options?.contextInfo || {}, options, options?.mentions || [])
					})
				}
			}
		}, { userJid: naze.user?.id, quoted: options?.quoted })

		const relayOpts = {
			messageId: msg.key.id,
			additionalNodes: [{
				tag: 'biz',
				attrs: {},
				content: [{
					tag: 'interactive',
					attrs: {
						type: 'native_flow',
						v: '1'
					},
					content: [{
						tag: 'native_flow',
						attrs: {
							v: '9',
							name: 'mixed'
						}
					}]
				}]
			}, ...(options?.ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
		}

		if (process.env.NAZE_RELAY_DEBUG === '1') {
			console.log(`[NAZE_RELAY_DEBUG] sendCarouselMsg -> jid=${jid} cardsCount=${cardResults.length} messageId=${msg.key.id}`)
		}

		const hasil = await naze.relayMessage(msg.key.remoteJid, msg.message, relayOpts)
		return hasil
	}
	
	if (naze.user && naze.user.id) {
		const botNumber = naze.decodeJid(naze.user.id);
		if (global.db?.set[botNumber]) {
			naze.public = global.db.set[botNumber].public
		} else naze.public = true
	} else naze.public = true

	return naze
}

/*
	* Create By Naze
	* Follow https://github.com/nazedev
	* Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
*/

async function Serialize(naze, msg, store) {
	const botLid = naze.decodeJid(naze.user.lid);
	const botNumber = naze.decodeJid(naze.user.id);
	const m = { ...msg };
	if (!m) return m
	if (m.key) {
		m.id = m.key.id
		m.chat = m.key.remoteJidAlt || m.key.remoteJid
		m.fromMe = m.key.fromMe
		m.isBot = Boolean(
			isBotSentMessage(m.id) ||
			m.id?.startsWith('BAE5') ||
			m.id?.startsWith('HSK') ||
			m.id?.startsWith('B1E') ||
			m.id?.startsWith('B24E')
		);
		m.isGroup = m.chat.endsWith('@g.us')
		if (!m.isGroup && m.chat.endsWith('@lid')) m.chat = naze.findJidByLid(m.chat, store, false) || m.chat;
		if (m.chat && !m.fromMe) global.lastActiveChat = m.chat;

		// Tentukan sender dengan memprioritaskan nomor telepon asli @s.whatsapp.net
		let rawSender = '';
		if (m.fromMe) {
			rawSender = naze.decodeJid(naze.user.id);
		} else {
			const candPhone = [m.key.participantAlt, m.key.participant, m.chat].find(p => p && typeof p === 'string' && p.endsWith('@s.whatsapp.net'));
			if (candPhone) {
				rawSender = candPhone;
			} else {
				rawSender = m.key.participantAlt || m.key.participant || m.chat || '';
			}
		}
		m.sender = naze.decodeJid(rawSender);

		// Catat mapping dua arah dari key jika ada
		if (m.key?.participant && m.key?.participantAlt) {
			const p1 = String(m.key.participant);
			const p2 = String(m.key.participantAlt);
			if (p1.endsWith('@lid') && p2.endsWith('@s.whatsapp.net')) global.recordLidMapping?.(p1, p2, m.pushName);
			else if (p2.endsWith('@lid') && p1.endsWith('@s.whatsapp.net')) global.recordLidMapping?.(p2, p1, m.pushName);
		}

		if (m.isGroup) {
			const metadata = await getOrFetchGroupMetadata(naze, m.chat, store);
			m.metadata = metadata || {};
			m.metadata.size = (m.metadata.participants || []).length;
			if (typeof global.recordGroupParticipants === 'function' && Array.isArray(m.metadata.participants)) {
				global.recordGroupParticipants(m.metadata.participants);
			}

			// Selesaikan m.sender ke nomor telepon asli @s.whatsapp.net
			const resolvedSender = naze.resolveRealJid(m.sender, m);
			if (resolvedSender && resolvedSender.endsWith('@s.whatsapp.net')) {
				m.sender = resolvedSender;
			}

			// Pastikan m.key.participant dan m.participant selalu nomor telepon canonical
			if (m.sender && m.sender.endsWith('@s.whatsapp.net')) {
				m.key.participant = m.sender;
				m.participant = m.sender;
			}

			m.metadata.owner = m.metadata?.participants?.find(p => p.id === m.metadata.owner)?.id || m.metadata.owner;
			m.metadata.subjectOwner = m.metadata?.participants?.find(p => p.id === m.metadata.subjectOwner)?.id || m.metadata.subjectOwner;

			if (!m.sender.endsWith('@g.us')) {
				const existingContact = store.contacts[m.sender] || {};
				store.contacts[m.sender] = {
					...existingContact,
					id: m.sender,
					phoneNumber: m.sender,
					name: m.pushName || existingContact.name || (m.fromMe ? naze.user.name : undefined)
				};
			}

			m.admins = m.metadata.participants ? m.metadata.participants.filter(p => p.admin).map(p => ({ 
				id: (p.phoneNumber ? (p.phoneNumber.includes('@') ? p.phoneNumber : p.phoneNumber + '@s.whatsapp.net') : p.id), 
				phoneNumber: p.phoneNumber, 
				admin: p.admin 
			})) : [];
			m.isAdmin = m.admins.some(a => a.id === m.sender || a.phoneNumber === m.sender || (m.sender && a.id?.includes(m.sender.split('@')[0])));
			m.isBotAdmin = m.admins.some(a => [botNumber, botLid].includes(a.id) || [botNumber, botLid].includes(a.phoneNumber) || (botNumber && a.id?.includes(botNumber.split('@')[0])));
		} else {
			// Private chat: selesaikan sender ke nomor telepon asli
			const resolvedSender = naze.resolveRealJid(m.sender, m);
			if (resolvedSender && resolvedSender.endsWith('@s.whatsapp.net')) {
				m.sender = resolvedSender;
				m.chat = resolvedSender;
				m.key.remoteJid = resolvedSender;
			}
			if (m.sender && m.sender.endsWith('@s.whatsapp.net')) {
				m.key.participant = m.sender;
				m.participant = m.sender;
			}
		}
	}
	if (m.message) {
		const normalizedContent = normalizeMessageContent(m.message) || m.message;
		m.type = getContentType(normalizedContent) || getContentType(m.message) || Object.keys(m.message)[0];
		m.msg = normalizedContent[m.type] || (/viewOnceMessage|viewOnceMessageV2|viewOnceMessageV2Extension|editedMessage|ephemeralMessage/i.test(m.type) ? m.message[m.type]?.message?.[getContentType(m.message[m.type]?.message)] : (extractMessageContent(m.message[m.type]) || m.message[m.type])) || m.message[m.type] || normalizedContent;
		if (m.msg && typeof m.msg === 'object') {
			const subKey = Object.keys(m.msg).find(k => k.endsWith('Message'));
			if (subKey && m.msg[subKey]?.mimetype) {
				m.type = subKey;
				m.msg = m.msg[subKey];
			}
		}
		let interactiveId = ''
		try {
			const nativeRes = m.msg?.interactiveResponseMessage?.nativeFlowResponseMessage
				|| m.msg?.nativeFlowResponseMessage
				|| m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
				|| m.message?.viewOnceMessage?.message?.interactiveResponseMessage?.nativeFlowResponseMessage
				|| m.message?.ephemeralMessage?.message?.interactiveResponseMessage?.nativeFlowResponseMessage;
			if (nativeRes?.paramsJson) {
				const parsed = typeof nativeRes.paramsJson === 'string' ? JSON.parse(nativeRes.paramsJson) : nativeRes.paramsJson;
				interactiveId = parsed?.id || parsed?.selectedId || parsed?.selectedRowId || '';
			}
			if (!interactiveId) {
				interactiveId = m.msg?.singleSelectReply?.selectedRowId
					|| m.message?.listResponseMessage?.singleSelectReply?.selectedRowId
					|| m.msg?.selectedButtonId
					|| m.message?.buttonsResponseMessage?.selectedButtonId
					|| m.msg?.selectedId
					|| m.message?.templateButtonReplyMessage?.selectedId
					|| '';
			}
		} catch {}
		m.interactiveId = interactiveId || '';
		m.body = m.message?.conversation || m.msg?.text || m.msg?.conversation || m.msg?.caption || m.interactiveId || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || m.msg?.name || ''
		m.mentionedJid = m.msg?.contextInfo?.mentionedJid?.map(a => naze.findJidByLid(a, store, true)) || []
		m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || m.interactiveId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || '';
		// Hapus regex surrogate pair emoji: emoji dekoratif (seperti 💰) tidak boleh dianggap sebagai command prefix!
		m.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.body) ? m.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : '';
		m.isCmd = Boolean(m.prefix && m.body?.startsWith(m.prefix));
		m.command = m.isCmd ? m.body.slice(m.prefix.length).trim().split(/ +/).shift() : '';
		m.args = m.isCmd ? m.body.trim().slice(m.prefix.length).replace(m.command, '').trim().split(/ +/).filter(Boolean) : [];
		m.device = getDevice(m.id)
		m.expiration = m.msg?.contextInfo?.expiration || m?.metadata?.ephemeralDuration || store?.messages?.[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0
		m.timestamp = (typeof m.messageTimestamp === "number" ? m.messageTimestamp : m.messageTimestamp.low ? m.messageTimestamp.low : m.messageTimestamp.high) || m.msg.timestampMs * 1000
		m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath
		if (m.isMedia) {
			m.mime = m.msg?.mimetype
			m.size = m.msg?.fileLength
			m.height = m.msg?.height || ''
			m.width = m.msg?.width || ''
			if (/webp/i.test(m.mime)) {
				m.isAnimated = m.msg?.isAnimated
			}
		}
		m.quoted = m.msg?.contextInfo?.quotedMessage || null
		if (m.quoted) {
			let qMsg = JSON.parse(JSON.stringify(m.msg?.contextInfo?.quotedMessage));
			let qParticipant = m.msg?.contextInfo?.participant;
			if (qParticipant) {
				const resolved = naze.resolveRealJid(qParticipant, m);
				if (resolved && resolved.endsWith('@s.whatsapp.net')) {
					qParticipant = resolved;
					if (m.msg?.contextInfo) m.msg.contextInfo.participant = qParticipant;
				}
			}
			const resolvedQuotedSender = naze.decodeJid(qParticipant || m.msg?.contextInfo?.participant);
			m.quoted = {
				...qMsg,
				message: extractMessageContent(qMsg) || qMsg,
				type: getContentType(qMsg) || Object.keys(qMsg)[0],
				id: m.msg?.contextInfo?.stanzaId,
				chat: m.msg?.contextInfo?.remoteJid || m.chat,
				sender: resolvedQuotedSender,
				fromMe: areJidsSameUser(resolvedQuotedSender, naze.decodeJid(naze.user.id)),
				text: qMsg?.conversation || qMsg?.caption || '',
			};
			m.quoted.msg = extractMessageContent(qMsg[m.quoted.type]) || qMsg[m.quoted.type];
			m.quoted.device = getDevice(m.quoted.id)
			m.quoted.isBot = m.quoted.id ? ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.quoted.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.quoted.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.quoted.id) : false
			m.quoted.fromMe = m.quoted.sender === naze.decodeJid(naze.user.id)
			m.quoted.mentionedJid = m.quoted?.msg?.contextInfo?.mentionedJid?.map(a => naze.findJidByLid(a, store, true)) || []
			m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ''
			m.getQuotedObj = async () => {
				if (!m.quoted.id) return null
				let q = await global.loadMessage(m.chat, m.quoted.id, naze)
				if (q) {
					return await Serialize(naze, q, store)
				} else {
					return null
				}
			}
			m.quoted.key = {
				remoteJid: m.msg?.contextInfo?.remoteJid || m.chat,
				participant: m.quoted.sender,
				fromMe: m.quoted.fromMe,
				id: m.msg?.contextInfo?.stanzaId
			}
			m.quoted.participant = m.quoted.sender;
			m.quoted.isGroup = m.quoted.chat.endsWith('@g.us')
			m.quoted.mentions = m.quoted.msg?.contextInfo?.mentionedJid || []
			m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ''
			m.quoted.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.quoted.body) ? m.quoted.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : '';
			m.quoted.isCmd = Boolean(m.quoted.prefix && m.quoted.body?.startsWith(m.quoted.prefix));
			m.quoted.command = m.quoted.isCmd ? m.quoted.body.slice(m.quoted.prefix.length).trim().split(/ +/).shift() : '';
			m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath
			if (m.quoted.isMedia) {
				m.quoted.fileSha256 = m.quoted[m.quoted.type]?.fileSha256 || ''
				m.quoted.mime = m.quoted.msg?.mimetype
				m.quoted.size = m.quoted.msg?.fileLength
				m.quoted.height = m.quoted.msg?.height || ''
				m.quoted.width = m.quoted.msg?.width || ''
				if (/webp/i.test(m.quoted.mime)) {
					m.quoted.isAnimated = m?.quoted?.msg?.isAnimated || false
				}
			}
			m.quoted.fakeObj = () => ({
				key: {
					remoteJid: m.quoted.chat,
					fromMe: m.quoted.fromMe,
					id: m.quoted.id
				},
				message: m.quoted,
				...(m.isGroup ? { participant: m.quoted.sender } : {})
			});
			m.quoted.download = () => naze.downloadMediaMessage(m.quoted)
			m.quoted.delete = () => {
				naze.sendMessage(m.quoted.chat, {
					delete: {
						remoteJid: m.quoted.chat,
						fromMe: m.isBotAdmin ? false : true,
						id: m.quoted.id,
						participant: m.quoted.sender
					}
				})
			}
		}
	}
	
	m.download = () => naze.downloadMediaMessage(m)
	
	m.copy = () => Serialize(naze, JSON.parse(JSON.stringify(m)), store)
	
	m.react = (u) => naze.sendMessage(m.chat, { react: { text: u, key: m.key }})
	
	m.reply = async (content, options = {}) => {
		const { quoted = m, chat = m.chat, caption = '', mentions = [], ephemeralExpiration = m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, ...validate } = options;
		// Non-blocking anti-ban presence & traffic heartbeat
		if (naze?.sendPresenceUpdate && chat) {
			naze.sendPresenceUpdate('composing', chat).catch(() => {});
		}
		global.__recordOguriTraffic?.();

		// 1. Sanitasi Quoted agar participant di contextInfo selalu nomor telepon asli (bukan format @lid yang menyebabkan nomor negara lain)
		let safeQuoted = quoted;
		if (safeQuoted && typeof safeQuoted === 'object') {
			safeQuoted = { ...safeQuoted };
			if (safeQuoted.key) {
				safeQuoted.key = { ...safeQuoted.key };
			}
			if (safeQuoted === m || (!safeQuoted.key?.fromMe && !safeQuoted.fromMe)) {
				const userTarget = (m.sender && m.sender.endsWith('@s.whatsapp.net')) ? m.sender : (naze.resolveRealJid(m.sender, m) || m.sender);
				if (userTarget && userTarget.endsWith('@s.whatsapp.net')) {
					if (safeQuoted.key) safeQuoted.key.participant = userTarget;
					safeQuoted.participant = userTarget;
				}
			} else if (safeQuoted.key?.fromMe || safeQuoted.fromMe) {
				const botTarget = naze.decodeJid(naze.user.id);
				if (safeQuoted.key) safeQuoted.key.participant = botTarget;
				safeQuoted.participant = botTarget;
			} else {
				let part = safeQuoted.key?.participant || safeQuoted.participant;
				if (part) {
					const real = naze.resolveRealJid(part, m);
					if (real && real.endsWith('@s.whatsapp.net')) {
						if (safeQuoted.key) safeQuoted.key.participant = real;
						safeQuoted.participant = real;
					}
				}
			}
		}

		// 2. Sanitasi teks & tag mentions agar tag selalu menggunakan nomor telepon asli
		let textBody = typeof content === 'string' ? content : (content.text || content.caption || '');
		const providedMentions = Array.isArray(mentions) ? mentions : [];
		const resolvedProvidedMentions = providedMentions.map(men => {
			const resolved = naze.resolveRealJid(men, m);
			return (resolved && resolved.endsWith('@s.whatsapp.net')) ? resolved : men;
		});

		// Ganti tag nomor LID di teks menjadi nomor telepon asli pengguna
		const tagMatches = [...textBody.matchAll(/@(\d{5,20})/g)];
		for (const match of tagMatches) {
			const tagNum = match[1];
			const phoneFromLid = naze.resolveRealJid(tagNum + '@lid', m);
			if (phoneFromLid && phoneFromLid.endsWith('@s.whatsapp.net')) {
				const realCleanPhone = phoneFromLid.split('@')[0];
				textBody = textBody.replaceAll(`@${tagNum}`, `@${realCleanPhone}`);
			} else if (global.lidPhoneRegistry?.lidToName?.has(tagNum)) {
				const userName = global.lidPhoneRegistry.lidToName.get(tagNum);
				textBody = textBody.replaceAll(`@${tagNum}`, `${userName}`);
			}
		}

		if (typeof content === 'string') {
			content = textBody;
		} else if (content && typeof content === 'object') {
			if (content.text) content.text = textBody;
			if (content.caption) content.caption = textBody;
		}

		const extractedMentions = [...textBody.matchAll(/@(\d{5,16})/g)].map(v => v[1] + '@s.whatsapp.net');
		const fixMentions = [...new Set([...resolvedProvidedMentions, ...extractedMentions])].map(j => {
			const resolved = naze.resolveRealJid(j, m);
			return (resolved && resolved.endsWith('@s.whatsapp.net')) ? resolved : j;
		});

		if (typeof content === 'object') {
			return naze.sendMessage(chat, content, { ...validate, quoted: safeQuoted, ephemeralExpiration })
		} else if (typeof content === 'string') {
			try {
				if (/^https?:\/\//.test(content)) {
					const res = await axios.head(content, { timeout: 3500 }).catch(() => null);
					const mime = res?.headers['content-type'] || '';
					if (/gif|image|video|audio|pdf|stream/i.test(mime)) {
						let type = /image/.test(mime) ? 'image' : /video/.test(mime) ? 'video' : /audio/.test(mime) ? 'audio' : 'document';
						return naze.sendMessage(chat, { [type]: { url: content }, caption, mimetype: mime, ...validate }, { quoted: safeQuoted, ephemeralExpiration })
					} else {
						return naze.sendMessage(chat, { text: content, mentions: fixMentions, ...validate }, { quoted: safeQuoted, ephemeralExpiration })
					}
				} else {
					return naze.sendMessage(chat, { text: content, mentions: fixMentions, ...validate }, { quoted: safeQuoted, ephemeralExpiration })
				}
			} catch (e) {
				return naze.sendMessage(chat, { text: content, mentions: fixMentions, ...validate }, { quoted: safeQuoted, ephemeralExpiration })
			}
		}
	}

	return m
}

export {
	GroupUpdate,
	GroupParticipantsUpdate,
	LoadDataBase,
	MessagesUpsert,
	Solving
};

// Reload Handler
const watcher = chokidar.watch(nazePath, {
	ignored: /^\./,
	persistent: true,
	ignoreInitial: true,
	usePolling: false,
	awaitWriteFinish: {
		stabilityThreshold: 300,
		pollInterval: 500
	}
});

watcher.on('change', async (filePath) => {
	console.log(chalk.yellowBright(`[UPDATE] ${filePath}`));
	await reloadHandler();
});