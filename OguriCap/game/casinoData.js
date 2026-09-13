import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = path.join(__dirname, '../database/casino_data.json')
const SECRET_KEY = 'OGURI_CASINO_SECRET_SALT_2026_ROYAL'

// In-memory & persisted state
let data = {
	rooms: {}, // { [code]: { code: string, name: string, hostJid: string, hostName: string, gameType: string, minBet: number, pot: number, state: 'WAITING'|'BETTING'|'PLAYING'|'FINISHED', players: [], createdAt: number, expiresAt: number, history: [] } }
	claimedCodes: {}, // { [code]: { jid: string, score: number, claimedAt: number } }
	activeCodes: {}, // { [code]: { score: number, createdAt: number, expiresAt: number, used: boolean, jid: string } }
	stats: {
		totalSpins: 0,
		totalWon: 0,
		totalRoomsCreated: 0
	}
}

function loadDB() {
	try {
		if (fs.existsSync(DB_FILE)) {
			const raw = fs.readFileSync(DB_FILE, 'utf8')
			const parsed = JSON.parse(raw)
			data = {
				rooms: parsed.rooms || {},
				claimedCodes: parsed.claimedCodes || {},
				activeCodes: parsed.activeCodes || {},
				stats: parsed.stats || { totalSpins: 0, totalWon: 0, totalRoomsCreated: 0 }
			}
		} else {
			saveDB()
		}
	} catch (e) {
		console.error('[CASINO DATA] Error load DB:', e.message)
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
		console.error('[CASINO DATA] Error save DB:', e.message)
	}
}

loadDB()

// Bersihkan room yang kadaluarsa tiap 5 menit
setInterval(() => {
	const now = Date.now()
	let changed = false
	for (const code of Object.keys(data.rooms)) {
		if (data.rooms[code].expiresAt && now > data.rooms[code].expiresAt) {
			delete data.rooms[code]
			changed = true
		}
	}
	if (changed) saveDB()
}, 5 * 60 * 1000).unref()

/**
 * Generate 4-digit room code yang unik (1000-9999)
 */
export function generate4DigitCode() {
	let code = ''
	let tries = 0
	do {
		code = Math.floor(1000 + Math.random() * 9000).toString()
		tries++
	} while (data.rooms[code] && tries < 100)
	return code
}

/**
 * Buat Multiplayer Casino Room baru
 */
export function createCasinoRoom({ roomName, hostName, hostJid, minBet = 100, gameType = 'dice_duel' }) {
	const code = generate4DigitCode()
	const now = Date.now()
	const room = {
		code,
		name: (roomName || `Room ${code}`).slice(0, 24),
		hostJid: hostJid || 'player@s.whatsapp.net',
		hostName: (hostName || 'Host').slice(0, 18),
		gameType: gameType || 'dice_duel',
		minBet: Math.max(10, Math.floor(minBet)),
		pot: 0,
		state: 'WAITING',
		players: [
			{
				jid: hostJid || 'player@s.whatsapp.net',
				name: (hostName || 'Host').slice(0, 18),
				chips: 1000,
				bet: 0,
				isHost: true,
				choice: null,
				score: 0,
				ready: true,
				joinedAt: now
			}
		],
		createdAt: now,
		expiresAt: now + 30 * 60 * 1000, // 30 menit
		history: []
	}
	data.rooms[code] = room
	data.stats.totalRoomsCreated++
	saveDB()
	return room
}

/**
 * Gabung ke Room Casino dengan 4-digit code
 */
export function joinCasinoRoom(code, { playerName, playerJid, chips = 1000 }) {
	const cleanCode = String(code).trim()
	const room = data.rooms[cleanCode]
	if (!room) {
		return { success: false, message: `Room dengan kode [${cleanCode}] tidak ditemukan!` }
	}
	if (room.players.length >= 8) {
		return { success: false, message: 'Room sudah penuh (maksimal 8 pemain)!' }
	}
	const existing = room.players.find(p => p.jid === playerJid)
	if (existing) {
		existing.name = playerName || existing.name
		return { success: true, room, player: existing, isRejoin: true }
	}
	const newPlayer = {
		jid: playerJid || `guest_${Date.now()}@s.whatsapp.net`,
		name: (playerName || `Player ${room.players.length + 1}`).slice(0, 18),
		chips: Math.max(100, chips),
		bet: 0,
		isHost: false,
		choice: null,
		score: 0,
		ready: true,
		joinedAt: Date.now()
	}
	room.players.push(newPlayer)
	room.expiresAt = Date.now() + 30 * 60 * 1000
	saveDB()
	return { success: true, room, player: newPlayer, isRejoin: false }
}

export function getCasinoRoom(code) {
	return data.rooms[String(code).trim()] || null
}

export function listCasinoRooms() {
	return Object.values(data.rooms).map(r => ({
		code: r.code,
		name: r.name,
		hostName: r.hostName,
		playersCount: r.players.length,
		gameType: r.gameType,
		minBet: r.minBet,
		state: r.state
	}))
}

/**
 * Generate cryptographic claim reward code
 */
export function generateCasinoRewardCode(score, jid = '', roomCode = '') {
	const sanitizedScore = Math.max(10, Math.floor(Number(score) || 0))
	const randomNonce = crypto.randomBytes(3).toString('hex').toUpperCase()
	const timestamp = Math.floor(Date.now() / 1000)
	
	const payload = `${sanitizedScore}-${randomNonce}-${timestamp}`
	const hash = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex').slice(0, 4).toUpperCase()
	const code = `CASINO-${sanitizedScore}-${randomNonce}-${hash}`
	
	data.activeCodes[code] = {
		score: sanitizedScore,
		jid,
		roomCode,
		createdAt: Date.now(),
		expiresAt: Date.now() + 24 * 60 * 60 * 1000,
		used: false
	}
	
	data.stats.totalWon += sanitizedScore
	saveDB()
	return code
}

/**
 * Verifikasi & Klaim Reward Casino di WhatsApp
 */
export function verifyAndClaimCasinoCode(code, claimerJid, claimerName = 'Player') {
	const cleanCode = String(code || '').trim().toUpperCase()
	
	if (data.claimedCodes[cleanCode]) {
		const info = data.claimedCodes[cleanCode]
		const dateStr = new Date(info.claimedAt).toLocaleString('id-ID')
		return {
			success: false,
			message: `Kode ${cleanCode} sudah pernah diklaim sebelumnya pada ${dateStr}!`
		}
	}
	
	const parts = cleanCode.split('-')
	if (parts[0] !== 'CASINO' || parts.length < 3) {
		return {
			success: false,
			message: 'Format kode Casino tidak valid! Contoh: CASINO-10000-A1B2-C3D4'
		}
	}
	
	let score = 0
	const stored = data.activeCodes[cleanCode]
	
	if (stored) {
		if (stored.used) {
			return { success: false, message: 'Kode hadiah ini sudah digunakan!' }
		}
		if (Date.now() > stored.expiresAt) {
			return { success: false, message: 'Kode hadiah sudah kadaluarsa (lebih dari 24 jam)!' }
		}
		score = stored.score
		stored.used = true
	} else {
		// Parse score dari bagian kedua: CASINO-<SCORE>-<NONCE>-<HASH> atau CASINO-<A>-<B>
		const parsedScore = parseInt(parts[1], 10)
		if (isNaN(parsedScore) || parsedScore <= 0) {
			return { success: false, message: 'Nilai Carats pada kode tidak valid!' }
		}
		score = parsedScore
	}
	
	if (score <= 0) {
		score = 1000 // Minimum fallback
	}
	
	data.claimedCodes[cleanCode] = {
		jid: claimerJid,
		name: claimerName,
		score,
		claimedAt: Date.now()
	}
	
	saveDB()
	
	return {
		success: true,
		score,
		code: cleanCode,
		message: `Berhasil mengklaim +${score.toLocaleString('id-ID')} Carats dari Casino!`
	}
}
