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
        botLock.aktif = botLock.allLocked || Object.values(botLock.groups).some(g => g.locked === true)
        console.log(`🔒 [KUNCI] Berhasil memuat ${Object.keys(botLock.groups).length} grup dari database. AllLocked: ${botLock.allLocked}`)
        return
      }
    }
  } catch (e) {
    console.error("🔒 [KUNCI] Gagal membaca locked_groups.json:", e.message)
  }

  botLock.allLocked = false
  botLock.lockedAt = null
  botLock.groups = {}
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
      groups: botLock.groups || {}
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

