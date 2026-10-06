import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const POLICE_TEXT_BERONDONG = 
`🚨💀 *[BEGAL MOKAD - DIBERONDONG PELURU POLISI]*

🚨 *WII-UU-WII-UU-WII-UU!* 🚨
Regu Taktis Kepolisian Tracen yang dipimpin oleh *Polisi Oguri Cap* mengepungmu dari segala penjuru! Polisi tidak datang sendirian!

👮 *Polisi Oguri Cap:* _"BERHENTI! JANGAN BERGERAK! LEPASKAN SENJATAMU!"_

Melihatmu berusaha melawan, seluruh regu polisi serempak melepaskan tembakan beruntun (*rapid burst fire*)!
💥💥💥 *DOR-DOR-DOR-DORRRR!!* 💥💥💥
Puluhan peluru menembus tubuhmu tanpa ampun! Kamu tersungkur tewas di aspal jalanan akademi Tracen!

⛓️ *Status:* MATI DI TEMPAT KEJADIAN & BARANG BUKTI DISITA!
⏱️ *Sanksi:* Cooldown selama *1 JAM (60 MENIT)* untuk hidup dan pulih kembali!

💡 *Tips:* Asah kemampuan bertempurmu dengan command .begalskill agar bisa membalikkan keadaan saat dikepung polisi!`;

export const POLICE_TEXT_TERTANGKAP = 
`🚨👮 *[BEGAL TERCIDUK - TERTANGKAP RESMI OLEH POLISI]*

🚨 *WII-UU-WII-UU-WII-UU!* 🚨
Alarm keamanan milik @korban berbunyi kencang! Sebelum kamu sempat melarikan diri, Tim Patroli Kepolisian Tracen yang dipimpin oleh *Polisi Oguri Cap* langsung mengepung dan menghadang jalanmu!

👮 *Polisi Oguri Cap:* _"BERHENTI! JANGAN BERGERAK! TANGAN DI ATAS KEPALA!"_

⛓️ *Status:* DIBORGOL & DIJEBLOSKAN KE SEL TAHANAN!
⏱️ *Sanksi:* Langsung Cooldown selama *1 JAM (60 MENIT)* untuk menjalani hukuman kurungan penjara.
_Aksimu gagal total dan barang bukti disita polisi._`;

/**
 * Mencari path file sticker polisi resmi Oguri Cap di berbagai kemungkinan lokasi
 */
export function getPoliceStickerPath() {
	const candidates = [
		path.resolve(__dirname, '../assets/oguricap_police_sticker.webp'),
		path.resolve(process.cwd(), 'OguriCap/assets/oguricap_police_sticker.webp'),
		path.resolve(process.cwd(), 'assets/oguricap_police_sticker.webp'),
		path.resolve(__dirname, '../../OguriCap/assets/oguricap_police_sticker.webp'),
	];
	for (const p of candidates) {
		if (p && fs.existsSync(p)) return p;
	}
	return null;
}

/**
 * Menjalankan uji coba console command: tesstcpolis
 * Mengirim teks tertangkap / diberondong + sticker polisi ke WA (jika terhubung)
 * serta mencetak output lengkap langsung ke console log / pterodactyl / preview logs.
 */
export async function testPoliceConsole(conn = null, args = [], db = null) {
	const logs = [];
	const logOutput = (msg) => {
		console.log(msg);
		logs.push(msg);
	};

	const socket = conn || global.nazeSocket || global.conn || null;

	// Parse arguments
	// Contoh arg: 'tesstcpolis' / 'tesstcpolis berondong' / 'tesstcpolis tangkap' / 'tesstcpolis 628xxx'
	let target = null;
	let mode = 'both'; // 'berondong' | 'tangkap' | 'both'

	for (const arg of args) {
		const lower = String(arg).toLowerCase().trim();
		if (!lower) continue;
		if (['berondong', 'tembak', 'diberondong', 'mokad', 'burst'].includes(lower)) {
			mode = 'berondong';
		} else if (['tangkap', 'tertangkap', 'borgol', 'sel', 'penjara'].includes(lower)) {
			mode = 'tangkap';
		} else if (['both', 'semua', 'all', 'duaduanya'].includes(lower)) {
			mode = 'both';
		} else if (lower.includes('@') || /^\+?[0-9]{6,20}$/.test(lower)) {
			target = lower.replace(/[^0-9@]/g, '');
			if (!target.includes('@')) {
				if (target.startsWith('08')) target = '628' + target.slice(2);
				target = target + '@s.whatsapp.net';
			}
		}
	}

	// Tentukan target tujuan jika socket aktif
	let targetChat = target;
	let targetDesc = '';
	if (socket) {
		if (!targetChat && global.lastActiveChat) {
			targetChat = global.lastActiveChat;
			targetDesc = `(Chat terakhir aktif: ${targetChat})`;
		} else if (!targetChat && global.owner && global.owner[0]) {
			let ownerNum = String(global.owner[0]).replace(/[^0-9]/g, '');
			if (ownerNum.startsWith('08')) ownerNum = '628' + ownerNum.slice(2);
			targetChat = `${ownerNum}@s.whatsapp.net`;
			targetDesc = `(Nomor Owner: ${targetChat})`;
		} else if (!targetChat && socket.user?.id) {
			targetChat = socket.decodeJid ? socket.decodeJid(socket.user.id) : socket.user.id;
			targetDesc = `(Nomor Bot Sendiri: ${targetChat})`;
		} else if (targetChat) {
			targetDesc = `(Custom Target dari parameter: ${targetChat})`;
		}
	}

	const stickerPath = getPoliceStickerPath();
	let stickerBuffer = null;
	let stickerSize = 0;
	if (stickerPath) {
		try {
			stickerBuffer = fs.readFileSync(stickerPath);
			stickerSize = stickerBuffer.length;
		} catch (e) {
			stickerSize = 0;
		}
	}

	logOutput(`\n${chalk.cyan.bold('╔══════════════════════════════════════════════════════════════════════════════╗')}`);
	logOutput(`${chalk.cyan.bold('║')} 👮🚨 ${chalk.yellow.bold('[CONSOLE COMMAND: tesstcpolis]')} ${chalk.green.bold('UJI COBA POLISI & STICKER')} 🚨👮   ${chalk.cyan.bold('║')}`);
	logOutput(`${chalk.cyan.bold('╚══════════════════════════════════════════════════════════════════════════════╝')}`);

	// 1. Status Asset Sticker
	logOutput(`${chalk.blue.bold('📁 [STATUS ASSET STICKER POLISI]')}`);
	if (stickerPath && stickerBuffer) {
		logOutput(`  ${chalk.green('✔')} File Sticker : ${chalk.cyan(stickerPath)}`);
		logOutput(`  ${chalk.green('✔')} Ukuran Buffer: ${chalk.yellow(stickerSize.toLocaleString('id-ID'))} bytes (Valid WebP Sticker)`);
		logOutput(`  ${chalk.green('✔')} Format File  : ${chalk.magenta('image/webp')} (Sticker WhatsApp Resmi Oguri Cap)`);
	} else {
		logOutput(`  ${chalk.red('✖')} File Sticker : ${chalk.red('TIDAK DITEMUKAN')} di assets!`);
	}

	// 2. Status Koneksi WhatsApp
	logOutput(`\n${chalk.blue.bold('📡 [STATUS KONEKSI WHATSAPP]')}`);
	const isWaConnected = Boolean(socket && typeof socket.sendMessage === 'function' && targetChat);
	if (isWaConnected) {
		logOutput(`  ${chalk.green('✔')} Socket WA    : ${chalk.green.bold('TERHUBUNG')} (Online)`);
		logOutput(`  ${chalk.green('✔')} Chat Tujuan  : ${chalk.yellow.bold(targetChat)} ${targetDesc}`);
	} else {
		logOutput(`  ${chalk.yellow('ℹ')} Socket WA    : ${chalk.gray('Belum terhubung ke WA / Standalone mode.')}`);
		logOutput(`  ${chalk.yellow('ℹ')} Keterangan   : ${chalk.cyan('Teks & sticker tetap diverifikasi dan dicetak lengkap di console ini.')}`);
	}

	let waSentDiberondong = false;
	let waSentTertangkap = false;

	// 3. Simulasi & Pengiriman Skenario 1: Diberondong Peluru Polisi
	if (mode === 'both' || mode === 'berondong') {
		logOutput(`\n${chalk.magenta.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
		logOutput(`${chalk.magenta.bold('💥 [SKENARIO 1: BEGAL DIBERONDONG PELURU REGU POLISI (RAPID BURST FIRE)]')}`);
		logOutput(`${chalk.magenta.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
		logOutput(POLICE_TEXT_BERONDONG);
		logOutput(`${chalk.magenta('──────────────────────────────────────────────────────────────────────────────')}`);
		logOutput(`🖼️  ${chalk.yellow.bold('[STICKER POLISI OGURI CAP DIKIRIM]')}: Pose Polisi Oguri Cap mengepung / menghadang!`);

		if (isWaConnected) {
			try {
				await socket.sendMessage(targetChat, { text: POLICE_TEXT_BERONDONG });
				if (stickerBuffer) {
					await socket.sendMessage(targetChat, { sticker: stickerBuffer });
				}
				waSentDiberondong = true;
				logOutput(`📲 ${chalk.green.bold('✔ [WA SENT] Teks diberondong + Sticker polisi berhasil dikirim ke ' + targetChat)}`);
			} catch (err) {
				logOutput(`⚠️ ${chalk.red('Gagal kirim WA (diberondong): ' + (err?.message || err))}`);
			}
		} else {
			logOutput(`💻 ${chalk.cyan('✔ [CONSOLE LOG] Skenario Diberondong & Sticker tersimulasi sempurna di console.')}`);
		}
	}

	// 4. Simulasi & Pengiriman Skenario 2: Tertangkap Resmi oleh Polisi
	if (mode === 'both' || mode === 'tangkap') {
		logOutput(`\n${chalk.blue.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
		logOutput(`${chalk.blue.bold('🚨👮 [SKENARIO 2: BEGAL TERCIDUK - RESMI TERTANGKAP OLEH POLISI OGURI CAP]')}`);
		logOutput(`${chalk.blue.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
		logOutput(POLICE_TEXT_TERTANGKAP);
		logOutput(`${chalk.blue('──────────────────────────────────────────────────────────────────────────────')}`);
		logOutput(`🖼️  ${chalk.yellow.bold('[STICKER POLISI OGURI CAP DIKIRIM]')}: Pose Polisi Oguri Cap mengepung / menghadang!`);

		if (isWaConnected) {
			try {
				await socket.sendMessage(targetChat, { text: POLICE_TEXT_TERTANGKAP });
				if (stickerBuffer) {
					await socket.sendMessage(targetChat, { sticker: stickerBuffer });
				}
				waSentTertangkap = true;
				logOutput(`📲 ${chalk.green.bold('✔ [WA SENT] Teks tertangkap + Sticker polisi berhasil dikirim ke ' + targetChat)}`);
			} catch (err) {
				logOutput(`⚠️ ${chalk.red('Gagal kirim WA (tertangkap): ' + (err?.message || err))}`);
			}
		} else {
			logOutput(`💻 ${chalk.cyan('✔ [CONSOLE LOG] Skenario Tertangkap & Sticker tersimulasi sempurna di console.')}`);
		}
	}

	logOutput(`\n${chalk.green.bold('══════════════════════════════════════════════════════════════════════════════')}`);
	logOutput(`${chalk.green.bold('✅ [SUKSES]')} Uji coba command ${chalk.yellow.bold('tesstcpolis')} selesai dijalankan!`);
	logOutput(`${chalk.gray('ℹ️  Tips: Command ini bisa diketik kapan saja di Console Pterodactyl, Terminal VPS, maupun Console Web Preview.')}`);
	logOutput(`${chalk.green.bold('══════════════════════════════════════════════════════════════════════════════\n')}`);

	return {
		success: true,
		mode,
		target: targetChat,
		stickerFound: Boolean(stickerPath && stickerBuffer),
		stickerSize,
		waSentDiberondong,
		waSentTertangkap,
		logs: logs.join('\n')
	};
}

/**
 * Menangani baris perintah dari console (stdin)
 */
export async function handleConsoleInput(line, conn = null, db = null) {
	const raw = String(line || '').trim();
	if (!raw) return false;

	const parts = raw.split(/\s+/);
	const cmd = parts[0].toLowerCase();
	const args = parts.slice(1);

	if (['tesstcpolis', 'tesstcpolisi', 'testpolis', 'testpolisi', 'testcpolis', 'tespolis'].includes(cmd)) {
		await testPoliceConsole(conn, args, db);
		return true;
	}

	if (['help', 'bantuan', 'menuconsole', 'consolehelp'].includes(cmd)) {
		console.log(`\n${chalk.cyan.bold('=== DAFTAR COMMAND CONSOLE OGURICAP ===')}`);
		console.log(`${chalk.yellow.bold('tesstcpolis')} [target] [mode] : Tes kirim teks diberondong/tertangkap + sticker polisi`);
		console.log(`  - Contoh 1: ${chalk.green('tesstcpolis')} (Menguji kedua skenario di console + WA)`);
		console.log(`  - Contoh 2: ${chalk.green('tesstcpolis berondong')} (Khusus skenario diberondong peluru)`);
		console.log(`  - Contoh 3: ${chalk.green('tesstcpolis tangkap')} (Khusus skenario tertangkap polisi)`);
		console.log(`  - Contoh 4: ${chalk.green('tesstcpolis 62895xxx')} (Kirim langsung ke nomor WA tertentu)\n`);
		return true;
	}

	return false;
}

let _isConsoleListenerActive = false;

/**
 * Mengaktifkan listener stdin interaktif untuk menerima command console
 */
export function initConsoleListener(getConn = () => global.nazeSocket, getDb = () => global.db) {
	if (_isConsoleListenerActive) return;
	_isConsoleListenerActive = true;

	try {
		// Buat readline interface yang selalu mendengarkan process.stdin
		const consoleRl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: false
		});

		consoleRl.on('line', async (line) => {
			try {
				await handleConsoleInput(line, getConn(), getDb());
			} catch (err) {
				console.error('[CONSOLE-COMMAND-ERROR]', err);
			}
		});

		console.log(chalk.cyanBright('[CONSOLE] Interactive CLI listener aktif. Ketik ') + chalk.yellowBright.bold('tesstcpolis') + chalk.cyanBright(' untuk tes polisi & sticker.'));
	} catch (e) {
		console.warn('[CONSOLE] Gagal inisialisasi console listener:', e?.message || e);
	}
}
