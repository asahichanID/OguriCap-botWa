import {
  syncGroups,
  getLockedGroups,
  getAllGroups,
  unlockGroup,
  unlockAllGroups,
  cleanJid,
  botLock
} from "./kunci.js"
import { prosesTombolKunci } from "./kuncigrup.js"

const FOOTER = "🛡️ Oguri Cap Security System"
const cache = { lastSync: 0, ttl: 30000 }

async function ensureSync(conn) {
  const now = Date.now()
  if (!botLock.cache?.synced || now - cache.lastSync > cache.ttl) {
    try {
      syncGroups(conn).then(() => {
        botLock.cache = { ...(botLock.cache || {}), synced: true }
        cache.lastSync = Date.now()
      }).catch(e => {
        console.warn("🔓 [BUKA] Sync warning:", e.message)
      })
    } catch {}
  }
}

/**
 * Tampilkan antarmuka Buka Kunci Grup (100% Silent ke grup target)
 * Mode 1: args[0] === 'semua' / 'all' -> Buka kunci seluruh grup tanpa sisa
 * Mode 2: args[0] === 'ini' / 'here' -> Buka kunci grup saat ini
 * Mode 3: args[0] === <angka> -> Buka grup berdasarkan nomor urut di daftar terkunci
 * Mode 4: args[0] === <jid/nama> -> Buka grup berdasarkan JID atau nama
 * Mode 5: default -> Tampilkan daftar grup yang terkunci untuk dibuka
 */
export async function tampilkanBukaGrup(conn, m, args = []) {
  try {
    const rawMode = (args[0] || "").toLowerCase().trim()
    const fullQuery = args.join(" ").toLowerCase().trim()

    // Trigger sync di latar belakang
    ensureSync(conn)

    // =================================================================
    // MODE 1: BUKA SEMUA GRUP SEKALIGUS (.buka semua / .unlock all)
    // =================================================================
    if (rawMode === "semua" || rawMode === "all") {
      const listDibuka = unlockAllGroups()

      const pesanBukaSemua =
`╭─❖「 🔓 𝐒𝐄𝐌𝐔𝐀 𝐆𝐑𝐔𝐏 𝐃𝐈𝐁𝐔𝐊𝐀 🌸 」
│
├ 📊 *Total Dibuka:* ${listDibuka.length} Grup
├ ✅ *Status:* SELURUH GRUP TELAH DIBUKA KEMBALI
├ 🤫 *Mode:* 100% Silent (Tanpa Notifikasi Grup)
├ 💾 *Penyimpanan:* Database Terpusat & Permanen
│
├ 🤖 Bot sekarang aktif kembali merespon seluruh perintah di semua grup.
╰─────────────❖`;

      return conn.sendMessage(m.chat, { text: pesanBukaSemua }, { quoted: m })
    }

    // =================================================================
    // MODE 2: BUKA GRUP TERTENTU / SAAT INI / VIA NOMOR / JID
    // =================================================================
    let targetJid = null
    let targetName = "Grup WhatsApp"

    if (rawMode === "ini" || rawMode === "here") {
      if (m.isGroup) {
        targetJid = m.chat
        targetName = m.metadata?.subject || "Grup Ini"
      } else {
        return m.reply("❌ Perintah *.buka ini* hanya bisa digunakan di dalam grup.")
      }
    } else if (rawMode.includes("@g.us") || /^\d{10,25}/.test(rawMode)) {
      targetJid = cleanJid(rawMode)
    } else if (args.length > 0) {
      const daftar = getLockedGroups() || []
      const num = parseInt(rawMode, 10)
      if (!isNaN(num) && num > 0 && num <= daftar.length) {
        targetJid = daftar[num - 1]?.id
        targetName = daftar[num - 1]?.name || targetName
      } else if (fullQuery) {
        const match = (getAllGroups() || []).find(g => (g.name || "").toLowerCase().includes(fullQuery))
        if (match) {
          targetJid = match.id
          targetName = match.name || targetName
        }
      }
    }

    if (targetJid) {
      const cleanTarget = cleanJid(targetJid)
      const g = unlockGroup(cleanTarget)
      const namaGrup = g?.name || botLock.groups?.[cleanTarget]?.name || targetName || "Grup WhatsApp"

      const pesan =
`╭─❖「 🔓 𝐆𝐑𝐔𝐏 𝐁𝐄𝐑𝐇𝐀𝐒𝐈𝐋 𝐃𝐈𝐁𝐔𝐊𝐀 🌸 」
│
├ 📛 *Nama Grup:* ${namaGrup}
├ 🆔 *ID Grup:* ${cleanTarget}
├ 🤫 *Mode:* Silent (Tanpa Pesan ke Grup)
├ 🛡️ *Status:* Bot Aktif Kembali di Grup Ini
├ 💾 *Penyimpanan:* Database Terpusat & Permanen
╰─────────────❖`;

      try {
        await m.reply(pesan)
      } catch {
        await conn.sendMessage(m.chat, { text: pesan }).catch(() => {})
      }
      return
    }

    // =================================================================
    // MODE 3: DAFTAR GRUP TERKUNCI UNTUK DIBUKA (.buka)
    // =================================================================
    const daftar = getLockedGroups() || []

    if (daftar.length === 0 && !botLock.allLocked) {
      return conn.sendMessage(m.chat, {
        text:
`╭─❖「 🔓 𝐒𝐓𝐀𝐓𝐔𝐒 𝐊𝐔𝐍𝐂𝐈 𝐆𝐑𝐔𝐏 🌸 」
│
├ ✅ *Tidak ada grup yang terkunci saat ini.*
├ 🌐 Seluruh grup aktif merespon normal.
│
├ 💡 Ketik *.kunci* untuk mengelola atau mengunci grup.
╰─────────────❖`
      }, { quoted: m })
    }

    const listTextTerkunci = daftar.length
      ? daftar.map((g, i) => `├  ${i + 1}. 🔴 ${g.name || "Grup"} (\`${g.id.slice(0, 22)}\`)`).join("\n")
      : "├ _Status Global ALL LOCKED aktif._"

    const rows = daftar.length
      ? daftar.map(g => ({
          header: "🔓 BUKA",
          title: (g.name || "Grup").slice(0, 24),
          description: `ID: ${g.id}`,
          id: `unlock_${g.id}`
        }))
      : [{
          header: "ℹ️ BUKA",
          title: "Buka Semua Kunci",
          description: "Buka seluruh proteksi grup sekaligus",
          id: "unlock_all"
        }]

    const textMsg =
`╭─❖「 🔓 𝐁𝐔𝐊𝐀 𝐊𝐔𝐍𝐂𝐈 𝐆𝐑𝐔𝐏 🌸 」
│
├ 📊 *Ditemukan:* ${daftar.length} Grup Terkunci
${botLock.allLocked ? "├ ⚠️ *Status Global:* ALL LOCKED\n" : ""}│
├ 🔴 *DAFTAR GRUP TERKUNCI:*
${listTextTerkunci}
│
├ 💡 *Cara Membuka (100% Silent):*
│ • Klik tombol *📋 PILIH GRUP DIBUKA* di bawah
│ • Ketik *.buka semua* untuk membuka semua grup
│ • Ketik *.buka <nomor>* untuk membuka grup tertentu
│ • Ketik *.buka ini* saat berada di dalam grup
╰─────────────❖`;

    try {
      if (typeof conn.sendListMsg === "function") {
        return await conn.sendListMsg(m.chat, {
          text: textMsg,
          footer: FOOTER,
          buttons: [{
            name: "single_select",
            buttonParamsJson: {
              title: "📋 PILIH GRUP DIBUKA",
              sections: [{
                title: "Daftar Grup Terkunci",
                highlight_label: "TERKUNCI",
                rows: rows
              }]
            }
          }]
        }, { quoted: m })
      }
    } catch {}

    return conn.sendMessage(m.chat, { text: textMsg }, { quoted: m })

  } catch (e) {
    console.error("🔓 [BUKA] Error tampilkanBukaGrup:", e.stack || e)
    m.reply("❌ Gagal memuat daftar grup terkunci.")
  }
}

export async function prosesTombolBuka(conn, m) {
  return prosesTombolKunci(conn, m)
}

console.log("✅ [MODUL] Pembuka Kunci Grup Siap (100% Silent)")
