/**
 * ============================================================
 * 🛡️ OGURICAP BOT SAFETY GUARD & ANOMALY CIRCUIT BREAKER
 * ============================================================
 * 
 * Sistem pengamanan ketat untuk mencegah spam anomali, runaway loop,
 * dan potensi ban akun WhatsApp ketika bot ditinggal berjalan lama.
 * 
 * FITUR KEAMANAN:
 * 1. Global Outgoing Circuit Breaker (Rem Darurat):
 *    - Mendeteksi jika bot mencoba mengirim >20 pesan dalam 10 detik di semua chat.
 *    - Otomatis mengaktifkan rem darurat 15 detik untuk memutus infinite loop/bug.
 * 2. Per-Chat Outgoing Throttler:
 *    - Maksimal 4 pesan per 4 detik ke chat yang sama.
 * 3. Identical Outgoing Deduplication (Loop Breaker):
 *    - Memblokir pesan berulang dengan konten persis sama ke chat yang sama dalam 8 detik.
 * 4. Safe Outgoing Pacing (Anti-Burst Jitter):
 *    - Antrian outgoing dengan jeda aman 250-350ms antar pesan (menghindari burst packet).
 * 5. Smart Incoming Anti-Spam & Auto-Freeze:
 *    - Jeda 2.5 detik per command.
 *    - Peringatan 1x, setelah itu SILENT DROP (tidak merespons spam agar bot tidak membalas terus).
 *    - Jika spam masif (≥4x dlm 5s), akun spammer dibekukan selama 60 detik.
 * 6. Auto-Response & Moderation Throttler:
 *    - Salam dibatasi 1x per 30 detik per chat.
 *    - Alert moderasi (anti-link/toxic) dibatasi 1x per 4 detik per grup.
 * ============================================================
 */

import chalk from 'chalk';

// ============================================================
// 1. STATE & STORES
// ============================================================

// Outgoing Circuit Breaker State
let globalOutgoingTimestamps = [];
let emergencyPauseUntil = 0;
const chatOutgoingTimestamps = new Map(); // jid -> Array<number>
const recentMessageHashes = new Map();     // jid -> Array<{ hash: string, time: number }>

// Outgoing Queue State (Multi-Lane Isolated Queues)
export const TASK_LANE = {
	FAST: 'FAST_LANE',     // Teks, Reaksi, Polling, Native Flow / Buttons, Status
	MEDIA: 'MEDIA_LANE',   // Gambar, Video, Audio, Dokumen, Stiker, Album
	BULK: 'BULK_LANE'      // Broadcast, Hidetag, Notifikasi massal
};

// Konfigurasi performa & toleransi per-lane
const LANE_CONFIG = {
	[TASK_LANE.FAST]: {
		maxRetries: 3,
		timeoutMs: 15000,    // 15s (cepat & responsif)
		delayRange: [5, 18], // jitter 5-18ms
		backoffBase: 250     // exponential backoff 250ms -> 550ms -> 1200ms
	},
	[TASK_LANE.MEDIA]: {
		maxRetries: 2,
		timeoutMs: 60000,    // 60s (cukup untuk upload media besar / video)
		delayRange: [40, 80],
		backoffBase: 1000
	},
	[TASK_LANE.BULK]: {
		maxRetries: 2,
		timeoutMs: 25000,
		delayRange: [300, 450], // Anti-ban pacing
		backoffBase: 1500
	}
};

// Map antrian terpisah per-lane dan per-chat: key -> Promise<any>
const laneChatQueues = new Map();
let activeMediaUploads = 0;
const MAX_CONCURRENT_MEDIA = 3; // Menjaga heap memory & bandwidth tetap stabil

let pendingOutgoingCount = 0;
const MAX_PENDING_OUTGOING = 120;

// Statistik pemantauan outbound
export const outboundStats = {
	totalSent: 0,
	totalRetried: 0,
	totalFailed: 0,
	fastLaneCount: 0,
	mediaLaneCount: 0,
	bulkLaneCount: 0
};

// Sent Bot Message ID Tracker & Cache for Baileys getMessage Retry
// Menyimpan ID dan konten pesan yang dikirim oleh bot agar WhatsApp dapat langsung mendekripsi pesan tanpa delay
const sentBotMessageIds = new Set();
const sentBotMessageCache = new Map(); // id -> proto message content

/**
 * Merekam ID dan konten pesan yang dikirim oleh bot
 * @param {string} id 
 * @param {any} messageContent
 */
export function recordSentBotMessage(id, messageContent = null) {
	if (!id || typeof id !== 'string') return;
	sentBotMessageIds.add(id);
	if (messageContent) {
		sentBotMessageCache.set(id, messageContent);
	}
	if (sentBotMessageIds.size > 3000) {
		const oldest = sentBotMessageIds.values().next().value;
		sentBotMessageIds.delete(oldest);
		sentBotMessageCache.delete(oldest);
	}
}

/**
 * Mengambil cache konten pesan yang dikirim oleh bot untuk retry request WhatsApp
 * @param {string} id 
 * @returns {any}
 */
export function getSentBotMessage(id) {
	if (!id || typeof id !== 'string') return null;
	return sentBotMessageCache.get(id) || null;
}

/**
 * Memeriksa apakah suatu ID pesan dikirim oleh proses bot ini
 * @param {string} id 
 * @returns {boolean}
 */
export function isBotSentMessage(id) {
	if (!id || typeof id !== 'string') return false;
	return sentBotMessageIds.has(id);
}

// Incoming User Spam & Freeze State
// sender -> { lastTime: number, warnCount: number, freezeUntil: number }
const userSpamStore = new Map();

// Auto-Response & Moderation Throttling State
// key -> timestamp
const autoThrottleStore = new Map();

// Periodic cleanup every 3 minutes to prevent memory leak
const cleanGuardTimer = setInterval(() => {
	const now = Date.now();
	
	// Clean chat outgoing timestamps
	for (const [jid, times] of chatOutgoingTimestamps.entries()) {
		const valid = times.filter(t => now - t < 10000);
		if (valid.length === 0) chatOutgoingTimestamps.delete(jid);
		else chatOutgoingTimestamps.set(jid, valid);
	}

	// Clean recent message hashes
	for (const [jid, hashes] of recentMessageHashes.entries()) {
		const valid = hashes.filter(h => now - h.time < 12000);
		if (valid.length === 0) recentMessageHashes.delete(jid);
		else recentMessageHashes.set(jid, valid);
	}

	// Clean user spam records
	for (const [sender, data] of userSpamStore.entries()) {
		if (now > (data.freezeUntil || 0) && (now - data.lastTime > 60000)) {
			userSpamStore.delete(sender);
		}
	}

	// Clean completed chat queues
	for (const [key, q] of laneChatQueues.entries()) {
		const jid = key.split(':')[1];
		if (!jid || (chatOutgoingTimestamps.get(jid)?.length || 0) === 0) {
			laneChatQueues.delete(key);
		}
	}
}, 3 * 60 * 1000);
if (typeof cleanGuardTimer?.unref === 'function') cleanGuardTimer.unref();

// ============================================================
// 2. HELPER FUNCTIONS & LANE DETECTION
// ============================================================

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mendeteksi jalur tugas (Lane) pengiriman pesan berdasarkan konten dan opsi.
 * @param {any} content 
 * @param {object} options 
 * @returns {string} TASK_LANE.FAST | TASK_LANE.MEDIA | TASK_LANE.BULK
 */
export function detectTaskLane(content, options = {}) {
	if (options.isBulk || options.isBroadcast || options.priority === 'low') {
		return TASK_LANE.BULK;
	}
	if (!content) return TASK_LANE.FAST;
	if (typeof content === 'object') {
		if (
			content.image ||
			content.video ||
			content.audio ||
			content.document ||
			content.sticker ||
			content.album ||
			content.albumMessage
		) {
			return TASK_LANE.MEDIA;
		}
	}
	return TASK_LANE.FAST;
}

/**
 * Memastikan koneksi WebSocket WhatsApp siap sebelum mengirim pesan.
 * Jika socket sedang reconnecting atau handshaking, menunggu secara anggun (graceful wait)
 * sehingga pesan tidak langsung gagal atau memicu timeout error.
 * @param {object} naze - Baileys socket
 * @param {number} maxWaitMs - Waktu maksimal menunggu (ms)
 * @returns {Promise<boolean>}
 */
export async function waitForSocketReady(naze, maxWaitMs = 6000) {
	if (!naze) return false;
	// Status 1 = WebSocket.OPEN
	if (naze.ws?.readyState === 1 && naze.user?.id) {
		return true;
	}
	const startTime = Date.now();
	while (Date.now() - startTime < maxWaitMs) {
		if (naze.ws?.readyState === 1 && naze.user?.id) {
			return true;
		}
		await sleep(150);
	}
	return Boolean(naze.ws?.readyState === 1);
}

/**
 * Memeriksa apakah error pengiriman adalah error sementara yang layak di-retry.
 * @param {Error|any} err 
 * @returns {boolean}
 */
export function isRetryableError(err) {
	if (!err) return false;
	const msg = String(err.message || err.output?.payload?.message || err).toLowerCase();
	return (
		msg.includes('timed out') ||
		msg.includes('timeout') ||
		msg.includes('connection closed') ||
		msg.includes('connection lost') ||
		msg.includes('websocket') ||
		msg.includes('stream') ||
		msg.includes('rate-overlimit') ||
		msg.includes('socket') ||
		msg.includes('epipe') ||
		msg.includes('econnreset') ||
		msg.includes('etimedout') ||
		msg.includes('503') ||
		msg.includes('500') ||
		msg.includes('408') ||
		msg.includes('service unavailable') ||
		msg.includes('failed to upload') ||
		msg.includes('temporary')
	);
}

function extractMessageSignature(content) {
	if (!content) return '';
	if (typeof content === 'string') return content.trim().toLowerCase().slice(0, 100);
	if (typeof content === 'object') {
		const text = content.text || content.caption || content.extendedTextMessage?.text || content.conversation || '';
		if (text) return text.trim().toLowerCase().slice(0, 100);
		if (content.image) return 'MEDIA:IMAGE:' + (typeof content.image === 'object' ? (content.image.url || '') : '');
		if (content.video) return 'MEDIA:VIDEO:' + (typeof content.video === 'object' ? (content.video.url || '') : '');
		if (content.audio) return 'MEDIA:AUDIO:' + (content.fileName || (typeof content.audio === 'object' ? (content.audio.url || '') : ''));
		if (content.sticker) return 'MEDIA:STICKER';
		if (content.delete) return 'ACTION:DELETE:' + (content.delete.id || '');
	}
	return '';
}

// ============================================================
// 3. OUTGOING GATEKEEPER & MULTI-LANE DISPATCHER
// ============================================================

/**
 * Memeriksa apakah pesan outgoing diizinkan dikirim atau harus diblokir demi keamanan.
 * @param {string} jid 
 * @param {any} content 
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkOutgoingSafety(jid, content) {
	const now = Date.now();

	// 1. Cek Global Emergency Pause
	if (now < emergencyPauseUntil) {
		const sisaDetik = Math.ceil((emergencyPauseUntil - now) / 1000);
		console.warn(chalk.yellowBright(`[BOT-GUARD] ⚠️ Outgoing diblokir: Emergency Brake aktif (tersisa ${sisaDetik}s). JID: ${jid}`));
		return { allowed: false, reason: 'GLOBAL_EMERGENCY_PAUSE' };
	}

	// 2. Cek Global Circuit Breaker (>60 pesan dlm 10 detik di seluruh chat)
	globalOutgoingTimestamps = globalOutgoingTimestamps.filter(t => now - t < 10000);
	if (globalOutgoingTimestamps.length >= 60) {
		emergencyPauseUntil = now + 8000; // Aktifkan rem darurat 8 detik
		console.error(chalk.bgRed.white.bold('\n[🚨 BOT-GUARD CRITICAL] Global Outgoing Circuit Breaker TRIPPED!'));
		console.error(chalk.redBright(`Terdeteksi anomali runaway loop (>60 msg dlm 10s). Outgoing dijeda sejenak selama 8 detik untuk melindungi akun bot.\n`));
		return { allowed: false, reason: 'GLOBAL_CIRCUIT_BREAKER_TRIPPED' };
	}

	// 3. Cek Per-Chat Rate Limit (>8 pesan dlm 4 detik ke tujuan yang sama)
	let chatTimes = chatOutgoingTimestamps.get(jid) || [];
	chatTimes = chatTimes.filter(t => now - t < 4000);
	if (chatTimes.length >= 8) {
		chatOutgoingTimestamps.set(jid, chatTimes);
		console.warn(chalk.yellowBright(`[BOT-GUARD] ⚠️ Outgoing diblokir: Melebihi batas per-chat (maks 8 msg/4s) ke ${jid}`));
		return { allowed: false, reason: 'CHAT_BURST_EXCEEDED' };
	}

	// 4. Cek Identical Message Loop (mencegah loop kirim teks persis sama berulang kali)
	// Ditingkatkan ambang batasnya (>= 4x dlm 6s) agar command sah pengguna tidak terblokir
	const sig = extractMessageSignature(content);
	if (sig && sig.length > 3 && !sig.startsWith('ACTION:DELETE')) {
		let hashes = recentMessageHashes.get(jid) || [];
		hashes = hashes.filter(h => now - h.time < 6000);
		const duplicateCount = hashes.filter(h => h.hash === sig).length;
		if (duplicateCount >= 4) {
			recentMessageHashes.set(jid, hashes);
			console.warn(chalk.yellowBright(`[BOT-GUARD] 🔁 Loop pesan identik diblokir ke ${jid} (isi: "${sig.slice(0, 30)}...")`));
			return { allowed: false, reason: 'IDENTICAL_LOOP_DETECTED' };
		}
		hashes.push({ hash: sig, time: now });
		recentMessageHashes.set(jid, hashes);
	}

	// Catat pengiriman yang lolos verifikasi
	globalOutgoingTimestamps.push(now);
	chatTimes.push(now);
	chatOutgoingTimestamps.set(jid, chatTimes);

	return { allowed: true };
}

/**
 * Memasang Outgoing Multi-Lane Guard & Resilient Dispatcher pada instance Baileys socket.
 * Memisahkan tugas Fast Lane (Teks/Interaktif), Media Lane, dan Bulk Lane agar anti-timeout,
 * anti-crash, dan responsif 24/7.
 * @param {object} naze 
 */
export function installOutgoingGuard(naze) {
	if (!naze || naze._outgoingGuardInstalled) return;
	naze._outgoingGuardInstalled = true;

	const rawSendMessage = naze.sendMessage.bind(naze);
	const rawRelayMessage = naze.relayMessage.bind(naze);

	/**
	 * Safe Multi-Lane Task Dispatcher dengan Auto-Retry & Crash-Proof Error Boundary.
	 * @param {Function} task - Fungsi pengiriman pesan aktual
	 * @param {string} jid - JID penerima
	 * @param {any} content - Konten pesan
	 * @param {object} options - Opsi pengiriman
	 * @returns {Promise<any>}
	 */
	function queueSendTask(task, jid, content, options = {}) {
		const lane = detectTaskLane(content, options);

		// Update statistik lane
		if (lane === TASK_LANE.FAST) outboundStats.fastLaneCount++;
		else if (lane === TASK_LANE.MEDIA) outboundStats.mediaLaneCount++;
		else outboundStats.bulkLaneCount++;

		const safety = checkOutgoingSafety(jid, content);
		if (!safety.allowed) {
			return Promise.resolve({
				key: { remoteJid: jid, id: 'SAFETY_GUARD_BLOCKED' },
				status: 'BLOCKED',
				reason: safety.reason
			});
		}

		if (pendingOutgoingCount >= MAX_PENDING_OUTGOING) {
			console.warn(chalk.yellowBright(`[OUTBOUND] ⚠️ Outgoing queue penuh (${pendingOutgoingCount} antrian). Menolak pesan burst baru.`));
			return Promise.resolve({
				key: { remoteJid: jid, id: 'SAFETY_GUARD_QUEUE_FULL' },
				status: 'BLOCKED',
				reason: 'QUEUE_OVERFLOW'
			});
		}

		pendingOutgoingCount++;

		// Isolasi antrian per-lane dan per-chat
		// FAST LANE tidak akan pernah macet / menunggu MEDIA LANE yang sedang upload besar!
		const chatKey = jid || 'global';
		const queueKey = `${lane}:${chatKey}`;
		const prevPromise = laneChatQueues.get(queueKey) || Promise.resolve();
		const config = LANE_CONFIG[lane] || LANE_CONFIG[TASK_LANE.FAST];

		const execPromise = prevPromise.then(async () => {
			let isMediaActive = false;
			try {
				// Khusus Media Lane: Kendalikan batas concurrency upload global agar hemat RAM & bandwidth
				if (lane === TASK_LANE.MEDIA) {
					while (activeMediaUploads >= MAX_CONCURRENT_MEDIA) {
						await sleep(100);
					}
					activeMediaUploads++;
					isMediaActive = true;
				}

				// Jeda mikro / pacing alami sesuai lane
				const [minD, maxD] = config.delayRange;
				const jitter = minD + Math.floor(Math.random() * (maxD - minD + 1));
				if (jitter > 0) await sleep(jitter);

				// Eksekusi dengan Resilient Retry & Socket Readiness Guard
				let attempt = 0;
				let lastError = null;

				while (attempt <= config.maxRetries) {
					attempt++;

					// 1. Pastikan socket aktif sebelum menembak pesan
					const isSocketReady = await waitForSocketReady(naze, attempt === 1 ? 3500 : 6000);
					if (!isSocketReady && attempt > 1) {
						console.warn(chalk.yellow(`[OUTBOUND] ⚠️ Menunggu socket WA stabil (percobaan ${attempt}/${config.maxRetries + 1}) ke ${jid}`));
					}

					try {
						let timer = null;
						const timeoutPromise = new Promise((_, reject) => {
							timer = setTimeout(() => {
								reject(new Error(`Send task timeout (${config.timeoutMs}ms) di ${lane}`));
							}, config.timeoutMs);
						});

						const result = await Promise.race([task(), timeoutPromise]);
						if (timer) clearTimeout(timer);

						if (attempt > 1) {
							outboundStats.totalRetried++;
							console.log(chalk.greenBright(`[OUTBOUND-RETRY] ✅ Pesan (${lane}) ke ${jid} berhasil terkirim pada percobaan ke-${attempt}!`));
						}

						outboundStats.totalSent++;
						return result;
					} catch (err) {
						lastError = err;
						const retryable = isRetryableError(err);

						if (attempt <= config.maxRetries && retryable) {
							const backoff = (config.backoffBase * Math.pow(1.8, attempt - 1)) + Math.floor(Math.random() * 150);
							console.warn(chalk.yellowBright(`[OUTBOUND-RETRY] ⚠️ Pengiriman (${lane}) ke ${jid} kendala: ${err.message}. Mencoba ulang dalam ${backoff}ms (Percobaan ${attempt}/${config.maxRetries})...`));
							await sleep(backoff);
						} else {
							break;
						}
					}
				}

				// Jika seluruh retry habis: JANGAN BIARKAN NODE.JS CRASH!
				// Kembalikan safe response object dan log error
				outboundStats.totalFailed++;
				console.error(chalk.redBright(`[OUTBOUND] ❌ Gagal mengirim pesan (${lane}) ke ${jid} setelah ${attempt}x percobaan: ${lastError?.message || 'Unknown'}`));
				return {
					key: { remoteJid: jid, id: options?.messageId || `FAIL_${Date.now()}` },
					status: 'FAILED',
					error: lastError?.message || 'Send failed after retries',
					lane
				};

			} catch (fatalErr) {
				outboundStats.totalFailed++;
				console.error(chalk.redBright(`[OUTBOUND-FATAL] Safe boundary caught: ${fatalErr?.message || fatalErr}`));
				return {
					key: { remoteJid: jid, id: options?.messageId || `FAIL_${Date.now()}` },
					status: 'FATAL_ERROR',
					error: fatalErr?.message || 'Fatal send error',
					lane
				};
			} finally {
				pendingOutgoingCount = Math.max(0, pendingOutgoingCount - 1);
				if (isMediaActive) {
					activeMediaUploads = Math.max(0, activeMediaUploads - 1);
				}
				// Draining bersih: jika antrian selesai, hapus key dari map untuk menghemat memory
				if (laneChatQueues.get(queueKey) === execPromise) {
					laneChatQueues.delete(queueKey);
				}
			}
		});

		laneChatQueues.set(queueKey, execPromise.catch(() => {}));
		return execPromise;
	}

	// Override sendMessage dengan Multi-Lane Dispatcher
	naze.sendMessage = async (jid, content, options = {}) => {
		if (options?.messageId) recordSentBotMessage(options.messageId, content);
		return queueSendTask(async () => {
			const res = await rawSendMessage(jid, content, options);
			if (res?.key?.id) {
				recordSentBotMessage(res.key.id, res.message || content);
			}
			return res;
		}, jid, content, options);
	};

	// Override relayMessage dengan Multi-Lane Dispatcher
	naze.relayMessage = async (jid, message, options = {}) => {
		if (options?.messageId) recordSentBotMessage(options.messageId, message);
		return queueSendTask(async () => {
			const res = await rawRelayMessage(jid, message, options);
			if (res?.key?.id) {
				recordSentBotMessage(res.key.id, message);
			}
			return res;
		}, jid, message, options);
	};

	console.log(chalk.greenBright('[BOT-GUARD] ✅ Multi-Lane Outgoing Engine & Resilient Dispatcher berhasil terpasang pada Baileys socket.'));
}

// ============================================================
// 4. SMART INCOMING ANTI-SPAM & AUTO-FREEZE
// ============================================================

/**
 * Validasi ketat pesan masuk dari user untuk mendeteksi spam/anomali.
 * Pesan dari bot lain TIDAK PERNAH memicu respon/peringatan anti-spam.
 * @param {string} sender 
 * @param {boolean} isCreator 
 * @param {boolean} isBot
 * @returns {{ allowed: boolean, shouldWarn: boolean, warnMsg?: string, isFrozen?: boolean }}
 */
export function checkIncomingSpam(sender, isCreator = false, isBot = false) {
	if (isCreator) return { allowed: true, shouldWarn: false };
	// Pesan bot lain di-drop tanpa respon teks apapun agar tidak terjadi loop respon antar bot
	if (isBot) return { allowed: false, shouldWarn: false, isFrozen: false };

	const now = Date.now();
	let user = userSpamStore.get(sender) || { lastTime: 0, warnCount: 0, freezeUntil: 0 };

	// 1. Jika user sedang dibekukan karena spam masif
	if (now < user.freezeUntil) {
		const sisa = Math.ceil((user.freezeUntil - now) / 1000);
		// Diam total, tidak merespons sama sekali (silent drop)
		return { allowed: false, shouldWarn: false, isFrozen: true, remaining: sisa };
	}

	const elapsed = now - user.lastTime;
	user.lastTime = now;

	// Cooldown batas aman antar command: 2.5 detik (sesuai peringatan "jeda minimal 3 detik")
	if (elapsed < 2500) {
		user.warnCount = (user.warnCount || 0) + 1;

		// 4x pelanggaran berturut-turut -> FREEZE 60 detik!
		if (user.warnCount >= 4) {
			user.freezeUntil = now + 60000;
			userSpamStore.set(sender, user);
			console.warn(chalk.bgRed(`[SPAM FREEZE] User ${sender} dibekukan selama 60s karena spam masif.`));
			return {
				allowed: false,
				shouldWarn: true,
				warnMsg: '「 ⛔ ANTISPAM ALERT 」\nTerdeteksi spam/anomali beruntun! Akun Anda dibekukan sementara selama *60 detik* demi keamanan server.',
				isFrozen: true
			};
		}

		// Pelanggaran pertama: Peringatkan 1x
		if (user.warnCount === 1) {
			userSpamStore.set(sender, user);
			return {
				allowed: false,
				shouldWarn: true,
				warnMsg: '「 ⚠️ 」Harap bersabar! Beri jeda minimal *3 detik* antar command ya.',
				isFrozen: false
			};
		}

		// Pelanggaran ke-2 dan ke-3: SILENT DROP (tidak merespons, abaikan pesan agar tidak spam grup)
		userSpamStore.set(sender, user);
		return { allowed: false, shouldWarn: false, isFrozen: false };
	}

	// Jika user tertib (>= 2.5 detik), reset counter peringatan
	user.warnCount = 0;
	userSpamStore.set(sender, user);
	return { allowed: true, shouldWarn: false };
}

// ============================================================
// 5. AUTO-RESPONSE & MODERATION THROTTLING
// ============================================================

/**
 * Throttle pesan otomatis non-command (misal auto-salam) agar tidak looping.
 * @param {string} key ID unik grup/chat + event
 * @param {number} cooldownMs Jeda minimal (ms)
 * @returns {boolean} true jika diizinkan kirim
 */
export function allowAutoResponse(key, cooldownMs = 30000) {
	const now = Date.now();
	const lastTime = autoThrottleStore.get(key) || 0;
	if (now - lastTime < cooldownMs) {
		return false;
	}
	autoThrottleStore.set(key, now);
	return true;
}

/**
 * Throttle pesan notifikasi moderasi grup (anti-link, anti-toxic, anti-tagsw)
 * agar saat terjadi serbuan bot/raid, bot tidak ikut spam ribuan pesan.
 * @param {string} chat JID grup
 * @param {string} modType Tipe moderasi ('antilink', 'antitoxic', 'antitagsw', 'antihidetag')
 * @returns {boolean} true jika boleh mengirim notifikasi teks
 */
export function allowModAlert(chat, modType) {
	const key = `mod:${modType}:${chat}`;
	return allowAutoResponse(key, 4000); // maksimal 1 notifikasi teks per 4 detik per kategori
}
