// ======================================================
// GROUP LOCK MANAGER V3 (Permanent Persistent Storage)
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
 * Muat data penguncian dari disk secara permanen
 * Menjamin status terkunci tidak pernah hilang meski bot mati / sesi login reset
 */
export function loadLockStorage() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8")
      const data = JSON.parse(raw)
      botLock.allLocked = Boolean(data.allLocked)
      botLock.lockedAt = data.lockedAt || null
      botLock.groups = (data.groups && typeof data.groups === "object") ? data.groups : {}
      botLock.aktif = botLock.allLocked || Object.values(botLock.groups).some(g => g.locked)
      console.log(`🔒 [KUNCI] Berhasil memuat ${Object.keys(botLock.groups).length} grup dari penyimpanan permanen. Status AllLocked: ${botLock.allLocked}`)
      return
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

    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), "utf-8")
  } catch (e) {
    console.error("🔒 [KUNCI] Gagal menulis locked_groups.json:", e.message)
  }
}

// Inisialisasi awal saat modul dimuat
loadLockStorage()

export const cleanJid = (jid) => {
  if (!jid || typeof jid !== "string") return ""
  let clean = jid.trim().toLowerCase()
  if (clean.includes("@")) {
    const [user, domain] = clean.split("@")
    const cleanUser = user.split(":")[0]
    return `${cleanUser}@${domain}`
  }
  return clean
}

export const cekKunci = () => botLock.aktif || botLock.allLocked

export const setKunci = (status = false) => {
  botLock.aktif = Boolean(status)
  return botLock.aktif
}

const ensureGroup = (id, name = "Unknown Group") => {
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
 * 1. Jika mode allLocked aktif: SEMUA grup terkunci (100% kedap), kecuali yang secara eksplisit dibuka via .buka <id>
 * 2. Jika mode allLocked tidak aktif: hanya grup yang status locked === true yang terkunci
 */
export const isLocked = (chat) => {
  if (!chat) return false
  const cleanId = cleanJid(chat)
  if (!cleanId.endsWith('@g.us')) return false // Kunci hanya berlaku untuk grup

  // 1. Jika mode allLocked aktif
  if (botLock.allLocked) {
    if (botLock.groups[cleanId]?.explicitlyUnlocked === true || botLock.groups[chat]?.explicitlyUnlocked === true) {
      return false
    }
    return true
  }

  // 2. Jika mode per-grup biasa
  if (botLock.groups[cleanId]) {
    return Boolean(botLock.groups[cleanId].locked)
  }
  if (botLock.groups[chat]) {
    return Boolean(botLock.groups[chat].locked)
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
  }
  botLock.aktif = true
  saveLockStorage()
  return group
}

/**
 * Buka kunci satu grup tertentu
 * Jika allLocked aktif, grup ini ditandai explicitlyUnlocked = true
 */
export const unlockGroup = (chat) => {
  const cleanId = cleanJid(chat)
  if (!cleanId) return null
  const group = ensureGroup(cleanId)
  group.locked = false
  if (botLock.allLocked) {
    group.explicitlyUnlocked = true
  } else {
    delete group.explicitlyUnlocked
  }
  group.updatedAt = Date.now()
  if (botLock.groups[chat] && chat !== cleanId) {
    botLock.groups[chat].locked = false
    if (botLock.allLocked) {
      botLock.groups[chat].explicitlyUnlocked = true
    } else {
      delete botLock.groups[chat].explicitlyUnlocked
    }
  }
  botLock.aktif = botLock.allLocked || Object.values(botLock.groups).some(g => g.locked)
  saveLockStorage()
  return group
}

/**
 * MODE 1: Kunci SEMUA grup tanpa sisa!
 * Menandai botLock.allLocked = true dan seluruh grup yang tercatat menjadi locked = true
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
    delete botLock.groups[id].explicitlyUnlocked
    botLock.groups[id].updatedAt = Date.now()
  }

  saveLockStorage()
  return Object.values(botLock.groups)
}

export const getAllGroups = () => Object.values(botLock.groups)

export const getLockedGroups = () => {
  const all = Object.values(botLock.groups)
  if (botLock.allLocked) {
    return all.filter(v => !v.explicitlyUnlocked)
  }
  return all.filter(v => v.locked === true)
}

export const getUnlockedGroups = () => {
  const all = Object.values(botLock.groups)
  if (botLock.allLocked) {
    return all.filter(v => v.explicitlyUnlocked === true)
  }
  return all.filter(v => !v.locked)
}

/**
 * Sinkronisasi grup dari koneksi Baileys
 * CATATAN PENTING: Grup yang sudah dikunci TIDAK AKAN PERNAH DIHAPUS
 */
export const syncGroups = async (conn) => {
  try {
    if (!conn?.groupFetchAllParticipating) return getAllGroups()
    const groups = await conn.groupFetchAllParticipating()
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
        if (botLock.allLocked && !botLock.groups[id].explicitlyUnlocked && !botLock.groups[id].locked) {
          botLock.groups[id].locked = true
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
