import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { generateBaseXP } from '../lib/xpGlobal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = path.join(__dirname, '../database/dino.json')
const SECRET_KEY = 'OGURI_CHROME_DINO_SECRET_SALT_2026'

let data = {
	claimedCodes: {}, // { [code]: { jid, score, coins, xp, ending, claimedAt } }
	autoUnlockedUsers: {}, // { [jid]: { unlockedAt, token } }
	activeSessions: {} // { [token]: { jid, createdAt } }
}

function loadDB() {
	try {
		if (fs.existsSync(DB_FILE)) {
			const raw = fs.readFileSync(DB_FILE, 'utf8')
			const parsed = JSON.parse(raw)
			data = {
				claimedCodes: parsed.claimedCodes || {},
				autoUnlockedUsers: parsed.autoUnlockedUsers || {},
				activeSessions: parsed.activeSessions || {}
			}
		} else {
			saveDB()
		}
	} catch (e) {
		console.error('[DINO] Error loading database:', e.message)
	}
}

function saveDB() {
	try {
		const dir = path.dirname(DB_FILE)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}
		fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
	} catch (e) {
		console.error('[DINO] Error saving database:', e.message)
	}
}

loadDB()

/**
 * Menghasilkan signature anti-cheat untuk kode klaim Dino
 */
function createSignature(score, coins, xp, timestamp, ending) {
	const payload = `${score}:${coins}:${xp}:${timestamp}:${ending}:${SECRET_KEY}`
	return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 8).toUpperCase()
}

/**
 * Menghasilkan kode klaim resmi permainan Dino
 */
export function generateDinoClaimCode(score, coins, xp, ending = 'normal') {
	const ts = Date.now()
	const sig = createSignature(score, coins, xp, ts, ending)
	const endCode = ending === 'happy' ? 'H' : ending === 'bad' ? 'B' : 'N'
	return `DN-${score}-${coins}-${xp}-${endCode}-${ts.toString(36).toUpperCase()}-${sig}`
}

/**
 * Verifikasi dan klaim kode Dino untuk WhatsApp Bot
 */
export function verifyAndClaimDinoCode(code, userJid, userName = 'Trainer', userLevel = 1) {
	loadDB()
	const cleanCode = (code || '').trim().toUpperCase()

	if (!cleanCode.startsWith('DN-')) {
		return { success: false, message: 'Format kode klaim Dino tidak valid!' }
	}

	if (data.claimedCodes[cleanCode]) {
		const prev = data.claimedCodes[cleanCode]
		const dateStr = new Date(prev.claimedAt).toLocaleString('id-ID')
		return {
			success: false,
			message: `Kode ini sudah pernah diklaim sebelumnya pada ${dateStr}!`
		}
	}

	const parts = cleanCode.split('-')
	if (parts.length < 7) {
		return { success: false, message: 'Kode klaim rusak atau tidak lengkap!' }
	}

	const score = parseInt(parts[1], 10)
	const coins = parseInt(parts[2], 10)
	const xp = parseInt(parts[3], 10)
	const endCode = parts[4]
	const tsHex = parts[5]
	const sig = parts[6]

	if (isNaN(score) || score < 0 || score > 9999) {
		return { success: false, message: 'Skor tidak valid!' }
	}

	let timestamp = 0
	try {
		timestamp = parseInt(tsHex, 36)
	} catch {
		return { success: false, message: 'Format timestamp kode tidak valid!' }
	}

	// Kedaluwarsa 4 jam
	const now = Date.now()
	if (now - timestamp > 4 * 60 * 60 * 1000) {
		return { success: false, message: 'Kode klaim sudah kedaluwarsa (maksimal 4 jam)!' }
	}

	const ending = endCode === 'H' ? 'happy' : endCode === 'B' ? 'bad' : 'normal'
	const expectedSig = createSignature(score, coins, xp, timestamp, ending)

	if (sig !== expectedSig) {
		return { success: false, message: 'Verifikasi tanda tangan kode gagal (Kode palsu atau hasil manipulasi)!' }
	}

	// Hitung reward wajar
	const cleanCoins = Math.min(Math.max(coins, 0), 10000)
	const baseXp = generateBaseXP(userLevel)
	const calculatedXp = Math.min(Math.max(xp, 0), 5000) + Math.round(baseXp * (score / 2000))

	// Simpan ke riwayat klaim
	data.claimedCodes[cleanCode] = {
		jid: userJid,
		name: userName,
		score,
		coins: cleanCoins,
		xp: calculatedXp,
		ending,
		claimedAt: now
	}
	saveDB()

	return {
		success: true,
		score,
		coins: cleanCoins,
		xp: calculatedXp,
		ending,
		code: cleanCode
	}
}

/**
 * Aktivasi Mode Automatic Dino setelah pembayaran 150.000 Carats
 */
export function unlockDinoAuto(userJid) {
	loadDB()
	const cleanJid = String(userJid).trim()
	const phone = cleanJid.replace(/[^0-9]/g, '')
	const token = `DINO-AUTO-${phone.slice(-6)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

	data.autoUnlockedUsers[cleanJid] = {
		unlockedAt: Date.now(),
		token,
		phone
	}
	if (phone) {
		data.autoUnlockedUsers[phone] = data.autoUnlockedUsers[cleanJid]
	}
	saveDB()

	return { token, phone }
}

/**
 * Cek apakah user telah membeli Mode Automatic
 */
export function isDinoAutoUnlocked(userJid) {
	loadDB()
	if (!userJid) return false
	const cleanJid = String(userJid).trim()
	const phone = cleanJid.replace(/[^0-9]/g, '')
	return Boolean(data.autoUnlockedUsers[cleanJid] || (phone && data.autoUnlockedUsers[phone]))
}

/**
 * Verifikasi kode aktivasi mode automatic dari web game
 */
export function verifyDinoAutoToken(inputStr) {
	loadDB()
	if (!inputStr) return false
	const clean = String(inputStr).trim().toUpperCase()

	// Cek berdasarkan token
	for (const [key, val] of Object.entries(data.autoUnlockedUsers)) {
		if (val?.token && val.token.toUpperCase() === clean) {
			return true
		}
	}

	// Cek jika input adalah nomor WA yang sudah beli
	const num = clean.replace(/[^0-9]/g, '')
	if (num && data.autoUnlockedUsers[num]) {
		return true
	}

	return false
}
