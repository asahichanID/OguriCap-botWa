// ======================================================
// GROUP LOCK MANAGER V4 (Independent & Resilient Storage)
// ======================================================
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_DIR = path.resolve(__dirname, "database")
const DB_FILE = path.join(DB_DIR, "locked_groups.json")

export const botLock = {
  aktif: false,
  allLocked: false,
  lockedAt: null,
  groups: {},
  schedules: {},
  cache: {
    synced: false,
    lastSync: 0
  }
}

/**
 * Muat data penguncian dari disk secara permanen & mandiri
 */
export function loadLockStorage() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8")
      if (raw && raw.trim().length > 0) {
        const data = JSON.parse(raw)
        botLock.allLocked = Boolean(data.allLocked)
        botLock.lockedAt = data.lockedAt || null
        botLock.groups = (data.groups && typeof data.groups === "object") ? data.groups : {}
        botLock.schedules = (data.schedules && typeof data.schedules === "object") ? data.schedules : {}
        botLock.aktif = botLock.allLocked || Object.values(botLock.groups).some(g => g.locked === true)
        console.log(`🔒 [KUNCI] Berhasil memuat ${Object.keys(botLock.groups).length} grup & ${Object.keys(botLock.schedules).length} jadwal dari database. AllLocked: ${botLock.allLocked}`)
        return
      }
    }
  } catch (e) {
    console.error("🔒 [KUNCI] Gagal membaca locked_groups.json:", e.message)
  }

  botLock.allLocked = false
  botLock.lockedAt = null
  botLock.groups = {}
  botLock.schedules = {}
  botLock.aktif = false
  saveLockStorage()
}

/**
 * Simpan data penguncian ke disk secara atomik & instan
 */
export function saveLockStorage() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    const payload = {
      allLocked: Boolean(botLock.allLocked),
      lockedAt: botLock.lockedAt || null,
      updatedAt: Date.now(),
      groups: botLock.groups || {},
      schedules: botLock.schedules || {}
    }

    const tmpFile = `${DB_FILE}.tmp`
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), "utf-8")
    fs.renameSync(tmpFile, DB_FILE)
  } catch (e) {
    console.error("🔒 [KUNCI] Gagal menulis locked_groups.json:", e.message)
  }
}

// Inisialisasi awal saat modul dimuat
loadLockStorage()

/**
 * Normalisasi JID WhatsApp agar seragam di semua event
 */
export const cleanJid = (jid) => {
  if (!jid || typeof jid !== "string") return ""
  let clean = jid.trim().toLowerCase()
  if (clean.includes("@")) {
    const [user, domain] = clean.split("@")
    const cleanUser = user.split(":")[0]
    return `${cleanUser}@${domain}`
  }
  if (/^\d{10,25}(?:-\d+)?$/.test(clean)) {
    return `${clean}@g.us`
  }
  return clean
}

export const cekKunci = () => botLock.aktif || botLock.allLocked

export const setKunci = (status = false) => {
  botLock.aktif = Boolean(status)
  return botLock.aktif
}

export const ensureGroup = (id, name = "Unknown Group") => {
  const cleanId = cleanJid(id)
  if (!cleanId) return null

  if (!botLock.groups[cleanId]) {
    botLock.groups[cleanId] = {
      id: cleanId,
      name: name || "Unknown Group",
      locked: Boolean(botLock.allLocked),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }
  if (name && name !== "Unknown Group") {
    botLock.groups[cleanId].name = name
  }
  return botLock.groups[cleanId]
}

export const registerGroup = (id, name = "Unknown Group") => {
  const cleanId = cleanJid(id)
  const group = ensureGroup(cleanId, name)
  if (name && name !== "Unknown Group") {
    group.name = name
  }
  group.updatedAt = Date.now()
  return group
}

export const removeGroup = (id) => {
  const cleanId = cleanJid(id)
  delete botLock.groups[cleanId]
  delete botLock.groups[id]
  saveLockStorage()
}

/**
 * Memeriksa apakah suatu grup sedang dikunci
 * 1. Hanya grup (@g.us) yang bisa dikunci (Private chat tidak pernah dikunci).
 * 2. Jika grup tercatat di database:
 *    - Jika locked === false atau explicitlyUnlocked === true -> PASTI DIBUKA (return false)
 *    - Jika locked === true -> PASTI DIKUNCI (return true)
 * 3. Jika grup belum terdaftar di database:
 *    - Ikuti botLock.allLocked
 */
export const isLocked = (chat) => {
  if (!chat) return false
  const cleanId = cleanJid(chat)
  if (!cleanId || !cleanId.endsWith('@g.us')) return false // Kunci hanya berlaku untuk grup

  const g = botLock.groups[cleanId] || botLock.groups[chat]
  if (g) {
    if (g.locked === false || g.explicitlyUnlocked === true) {
      return false
    }
    if (g.locked === true) {
      return true
    }
  }

  // Jika belum ada di catatan, ikuti mode allLocked
  if (botLock.allLocked) {
    return true
  }

  return false
}

/**
 * Kunci satu grup tertentu
 */
export const lockGroup = (chat, name) => {
  const cleanId = cleanJid(chat)
  if (!cleanId) return null
  const group = ensureGroup(cleanId, name)
  group.locked = true
  delete group.explicitlyUnlocked
  group.lockedAt = Date.now()
  group.updatedAt = Date.now()
  
  if (botLock.groups[chat] && chat !== cleanId) {
    botLock.groups[chat].locked = true
    delete botLock.groups[chat].explicitlyUnlocked
    botLock.groups[chat].lockedAt = Date.now()
    botLock.groups[chat].updatedAt = Date.now()
  }

  botLock.aktif = true
  saveLockStorage()
  return group
}

/**
 * Buka kunci satu grup tertentu
 * Ketika satu grup dibuka:
 * - Grup yang dipilih menjadi locked = false & explicitlyUnlocked = true
 * - Status disimpan seketika ke file penyimpanan permanen
 */
export const unlockGroup = (chat) => {
  const cleanId = cleanJid(chat)
  if (!cleanId) return null
  const group = ensureGroup(cleanId)
  group.locked = false
  group.explicitlyUnlocked = true
  group.updatedAt = Date.now()

  if (botLock.groups[chat] && chat !== cleanId) {
    botLock.groups[chat].locked = false
    botLock.groups[chat].explicitlyUnlocked = true
    botLock.groups[chat].updatedAt = Date.now()
  }

  botLock.aktif = Object.values(botLock.groups).some(g => g.locked === true)
  saveLockStorage()
  return group
}

/**
 * Kunci SEMUA grup tanpa sisa
 */
export const lockAllGroups = () => {
  botLock.allLocked = true
  botLock.lockedAt = Date.now()
  botLock.aktif = true

  for (const id in botLock.groups) {
    botLock.groups[id].locked = true
    delete botLock.groups[id].explicitlyUnlocked
    botLock.groups[id].lockedAt = Date.now()
    botLock.groups[id].updatedAt = Date.now()
  }

  saveLockStorage()
  return Object.values(botLock.groups)
}

/**
 * Buka seluruh grup yang terkunci
 */
export const unlockAllGroups = () => {
  botLock.allLocked = false
  botLock.lockedAt = null
  botLock.aktif = false

  for (const id in botLock.groups) {
    botLock.groups[id].locked = false
    botLock.groups[id].explicitlyUnlocked = true
    botLock.groups[id].updatedAt = Date.now()
  }

  saveLockStorage()
  return Object.values(botLock.groups)
}

export const getAllGroups = () => Object.values(botLock.groups)

export const getLockedGroups = () => {
  const all = Object.values(botLock.groups)
  return all.filter(v => v.locked === true && !v.explicitlyUnlocked)
}

export const getUnlockedGroups = () => {
  const all = Object.values(botLock.groups)
  return all.filter(v => v.locked === false || v.explicitlyUnlocked === true)
}

/**
 * Sinkronisasi grup dari koneksi Baileys secara non-blocking & aman
 */
export const syncGroups = async (conn) => {
  try {
    if (!conn?.groupFetchAllParticipating) return getAllGroups()
    
    // Timeout safeguard 3 detik agar tidak menghalangi respons bot
    const fetchPromise = conn.groupFetchAllParticipating()
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout sync Baileys")), 3000))
    const groups = await Promise.race([fetchPromise, timeoutPromise]).catch(err => {
      console.warn("⚠️ [GroupLock Sync Warning]:", err.message || err)
      return null
    })

    if (!groups || typeof groups !== 'object') return getAllGroups()
    let hasChanges = false

    for (const rawId in groups) {
      const id = cleanJid(rawId)
      if (!id || !id.endsWith('@g.us')) continue
      const subject = groups[rawId]?.subject || "Unknown Group"
      if (!botLock.groups[id]) {
        botLock.groups[id] = {
          id,
          name: subject,
          locked: Boolean(botLock.allLocked),
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        hasChanges = true
      } else {
        if (botLock.groups[id].name !== subject) {
          botLock.groups[id].name = subject
          hasChanges = true
        }
      }
    }

    botLock.cache.synced = true
    botLock.cache.lastSync = Date.now()

    if (hasChanges) {
      saveLockStorage()
    }

    return getAllGroups()
  } catch (e) {
    console.error("[GroupLock Sync Error]", e.message || e)
    return getAllGroups()
  }
}

// ======================================================
// JADWAL KUNCI BOT OTOMATIS (SCHEDULED LOCK & AUTO-UNLOCK MANAGER V5)
// ======================================================

const _executingScheduleMap = new Set()

/**
 * Pasang jadwal kunci otomatis pada grup tertentu (bisa single lock atau range lock | unlock)
 */
export const setGroupScheduleLock = (
  chat,
  name,
  lockTargetTime,
  lockTargetTimeStr,
  lockReason,
  setBy,
  options = {}
) => {
  const cleanId = cleanJid(chat)
  if (!cleanId) return null

  botLock.schedules = botLock.schedules || {}

  const hasAutoUnlock = Boolean(options.hasAutoUnlock && options.unlockTargetTime)
  const isDirectUnlock = options.phase === 'unlock'

  const scheduleData = {
    id: cleanId,
    name: name || botLock.groups?.[cleanId]?.name || "Grup WhatsApp",
    setBy: setBy || "Owner",
    createdAt: Date.now(),
    updatedAt: Date.now(),

    // Current phase: 'lock' | 'unlock'
    phase: isDirectUnlock ? 'unlock' : 'lock',
    action: isDirectUnlock ? 'unlock' : 'lock',

    // Data Penguncian
    targetTime: Number(isDirectUnlock ? options.unlockTargetTime : lockTargetTime),
    targetTimeStr: String(isDirectUnlock ? options.unlockTargetTimeStr : lockTargetTimeStr),
    reason: String((isDirectUnlock ? options.unlockReason : lockReason) || "").trim(),

    lockTargetTime: isDirectUnlock ? null : Number(lockTargetTime),
    lockTargetTimeStr: isDirectUnlock ? null : String(lockTargetTimeStr),
    lockReason: isDirectUnlock ? "" : String(lockReason || "").trim(),

    // Data Auto-Unlock (jika ada pembatas |)
    hasAutoUnlock: hasAutoUnlock,
    unlockTargetTime: hasAutoUnlock ? Number(options.unlockTargetTime) : null,
    unlockTargetTimeStr: hasAutoUnlock ? String(options.unlockTargetTimeStr) : null,
    unlockReason: hasAutoUnlock ? String(options.unlockReason || "").trim() : ""
  }

  botLock.schedules[cleanId] = scheduleData
  saveLockStorage()
  return scheduleData
}

/**
 * Batalkan jadwal kunci / buka otomatis pada grup tertentu
 */
export const cancelGroupScheduleLock = (chat) => {
  const cleanId = cleanJid(chat)
  if (!cleanId || !botLock.schedules?.[cleanId]) return false

  delete botLock.schedules[cleanId]
  _executingScheduleMap.delete(cleanId)
  saveLockStorage()
  return true
}

/**
 * Dapatkan data jadwal kunci / buka grup
 */
export const getGroupScheduleLock = (chat) => {
  const cleanId = cleanJid(chat)
  return botLock.schedules?.[cleanId] || null
}

/**
 * Eksekusi satu jadwal grup secara terisolasi (Independent Lane)
 */
async function processSingleGroupSchedule(conn, cleanId, item, now) {
  if (!item || !item.targetTime) return
  if (_executingScheduleMap.has(cleanId)) return

  // 1. CEK APAKAH SUDAH TIBA WAKTUNYA
  if (now < item.targetTime) return

  _executingScheduleMap.add(cleanId)

  try {
    const groupName = item.name || botLock.groups?.[cleanId]?.name || "Grup Ini"
    const currentPhase = item.phase || item.action || 'lock'

    if (currentPhase === 'lock') {
      // === FASE 1: KUNCI GRUP ===
      const lockedGroup = lockGroup(cleanId, groupName)
      const timeStr = item.lockTargetTimeStr || item.targetTimeStr || "Waktu Terjadwal"
      const pesanAlasan = item.lockReason || item.reason || "Waktu operasional bot telah berakhir."

      let notifPesan =
`╭─❖「 🔒 𝐁𝐎𝐓 𝐃𝐈𝐊𝐔𝐍𝐂𝐈 🌸 」
│
├ ⏰ *Waktu Kunci:* ${timeStr}
├ 📝 *Pesan:* ${pesanAlasan}`;

      if (item.hasAutoUnlock && item.unlockTargetTimeStr) {
        notifPesan += `\n├ 🔓 *Jadwal Auto-Buka:* ${item.unlockTargetTimeStr}`;
      }

      notifPesan += `
├ 🛡️ *Status:* Bot sekarang terkunci di grup ini.
│
├ 💡 *Catatan:*
│ • Bot tidak akan merespon perintah member grup.`;

      if (item.hasAutoUnlock && item.unlockTargetTimeStr) {
        notifPesan += `\n│ • Bot akan otomatis dibuka kembali pada pukul *${item.unlockTargetTimeStr}*.`;
      } else {
        notifPesan += `\n│ • Owner dapat membuka kembali dengan *.buka ini*.`;
      }

      notifPesan += `\n╰─────────────❖`;

      // Kirim notifikasi aman tanpa menahan jalur lain
      if (conn?.sendMessage) {
        await conn.sendMessage(cleanId, { text: notifPesan }).catch(err => {
          console.warn(`[SCHEDULE LOCK] Notice gagal kirim ke ${cleanId}:`, err.message || err)
        })
      }

      // Jika ada jadwal auto-unlock kelanjutan, alihkan fase ke 'unlock'
      if (item.hasAutoUnlock && item.unlockTargetTime) {
        item.phase = 'unlock'
        item.action = 'unlock'
        item.targetTime = item.unlockTargetTime
        item.targetTimeStr = item.unlockTargetTimeStr
        item.reason = item.unlockReason || "Waktu istirahat selesai, bot aktif kembali!"
        item.updatedAt = Date.now()
        saveLockStorage()
        console.log(`🔒 [SCHEDULE LOCK EXECUTED] ${groupName} terkunci. Fase beralih menunggu auto-buka pada ${item.unlockTargetTimeStr}`)
      } else {
        // Hapus jika tidak ada auto-unlock
        delete botLock.schedules[cleanId]
        saveLockStorage()
        console.log(`🔒 [SCHEDULE LOCK EXECUTED] ${groupName} berhasil dikunci otomatis pada ${timeStr}`)
      }

    } else if (currentPhase === 'unlock') {
      // === FASE 2: BUKA GRUP KEMBALI ===
      unlockGroup(cleanId)
      const timeStr = item.unlockTargetTimeStr || item.targetTimeStr || "Waktu Terjadwal"
      const pesanAlasan = item.unlockReason || item.reason || "Waktu istirahat selesai, bot aktif kembali!"

      const notifBuka =
`╭─❖「 🔓 𝐁𝐎𝐓 𝐃𝐈𝐁𝐔𝐊𝐀 𝐊𝐄𝐌𝐁𝐀𝐋𝐈 🌸 」
│
├ ⏰ *Waktu Buka:* ${timeStr}
├ 📝 *Pesan:* ${pesanAlasan}
├ 🌐 *Status:* Bot telah aktif dan siap digunakan kembali oleh semua member!
│
├ 💡 *Selamat Beraktivitas!*
╰─────────────❖`;

      if (conn?.sendMessage) {
        await conn.sendMessage(cleanId, { text: notifBuka }).catch(err => {
          console.warn(`[SCHEDULE UNLOCK] Notice gagal kirim ke ${cleanId}:`, err.message || err)
        })
      }

      // Hapus jadwal selesai
      delete botLock.schedules[cleanId]
      saveLockStorage()
      console.log(`🔓 [SCHEDULE UNLOCK EXECUTED] ${groupName} berhasil dibuka otomatis pada ${timeStr}`)
    }

  } catch (err) {
    console.error(`[SCHEDULE LANE ERROR] ${cleanId}:`, err?.message || err)
  } finally {
    _executingScheduleMap.delete(cleanId)
  }
}

/**
 * Periksa dan eksekusi jadwal kunci & auto-unlock otomatis
 * Dilengkapi pengaman recovery bot crash / macet dan isolasi non-blocking antar grup.
 */
export const checkAndExecuteScheduleLocks = async (conn) => {
  if (!botLock.schedules || typeof botLock.schedules !== "object") return

  const now = Date.now()
  const scheduleEntries = Object.entries(botLock.schedules)
  if (scheduleEntries.length === 0) return

  // Jalankan semua grup secara paralel non-blocking (Independent Lanes)
  await Promise.allSettled(
    scheduleEntries.map(([cleanId, item]) => processSingleGroupSchedule(conn, cleanId, item, now))
  )
}

// Background scheduler interval runner
let _scheduleTimer = null
let _activeConn = null

export const initScheduleLockTimer = (conn) => {
  if (conn) _activeConn = conn
  if (_scheduleTimer) return

  // Watchdog & Scheduler Interval (1.5 detik per-tick, ringan & instan)
  _scheduleTimer = setInterval(() => {
    if (_activeConn) {
      checkAndExecuteScheduleLocks(_activeConn).catch(e => {
        console.error("[SCHEDULE LOCK CHECK ERROR]:", e.message || e)
      })
    }
  }, 1500)

  // Recovery run langsung saat inisialisasi
  if (_activeConn) {
    checkAndExecuteScheduleLocks(_activeConn).catch(() => {})
  }
}

