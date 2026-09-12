import {
  syncGroups,
  getLockedGroups,
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
      await syncGroups(conn)
      botLock.cache = { ...(botLock.cache || {}), synced: true }
      cache.lastSync = now
      console.log("🔓 [BUKA] ✅ Sinkronisasi grup berhasil")
    } catch (e) {
      console.error("🔓 [BUKA] ❌ Gagal sinkron →", e.message)
    }
  }
}

/**
 * Tampilkan antarmuka Buka Kunci Grup
 * Mode 1: args[0] === 'semua' / 'all' -> Buka kunci seluruh grup
 * Mode 2: default -> Tampilkan daftar grup yang terkunci untuk dibuka
 */
export async function tampilkanBukaGrup(conn, m, args = []) {
  try {
    const mode = (args[0] || "").toLowerCase().trim()

    // Mode Buka Semua Grup
    if (mode === "semua" || mode === "all") {
      await ensureSync(conn)
      const listDibuka = unlockAllGroups()
      return conn.sendMessage(m.chat, {
        text: [
          "🔓 *BUKA SEMUA KUNCI GRUP BERHASIL*",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `📊 *Total Grup Dibuka:* ${listDibuka.length} Grup`,
          "✅ *Status:* SELURUH GRUP TELAH DIBUKA KEMBALI!",
          "💾 *Penyimpanan:* Tersimpan permanen di database.",
          "",
          "Bot sekarang sudah aktif kembali merespon seluruh perintah dan percakapan di semua grup."
        ].join("\n")
      }, { quoted: m })
    }

    // Mode Buka Grup Tertentu (.buka ini / .buka here / .buka <JID>)
    const targetJid = (mode === "ini" || mode === "here")
      ? (m.isGroup ? m.chat : null)
      : (mode.includes("@g.us") ? cleanJid(mode) : null)

    if (targetJid) {
      await ensureSync(conn)
      const cleanTarget = cleanJid(targetJid)
      const g = unlockGroup(cleanTarget)
      return m.reply(
`🔓 *SUKSES DIBUKA*
━━━━━━━━━━━━━━━━━━━━━━
📛 *Nama Grup* : ${g?.name || "Grup WhatsApp"}
🆔 *ID Grup*   : ${cleanTarget}
✅ Bot sudah aktif kembali merespon di grup ini.
💾 Status tersimpan permanen di database.`
      )
    }

    await ensureSync(conn)
    const daftar = getLockedGroups() || []

    const rows = daftar.length
      ? daftar.map(g => ({
          header: "🔓",
          title: `Buka: ${(g.name || "Grup").slice(0, 24)}`,
          description: `ID: ${g.id}`,
          id: `unlock_${g.id}`
        }))
      : [{
          header: "ℹ️",
          title: "Tidak ada grup terkunci",
          description: "Semua grup saat ini aktif",
          id: "none"
        }]

    return conn.sendListMsg(m.chat, {
      text: [
        "🔓 *BUKA KUNCI GRUP*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        `📊 Ditemukan: ${daftar.length} grup terkunci`,
        "",
        "Pilih grup yang ingin dibuka kuncinya dari daftar di bawah ini.",
        "Ketik *.buka semua* jika ingin membuka seluruh grup sekaligus."
      ].join('\n'),
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

  } catch (e) {
    console.error("🔓 [BUKA] Error tampilkanBukaGrup:", e.stack || e)
    m.reply("❌ Gagal memuat daftar grup terkunci.")
  }
}

export async function prosesTombolBuka(conn, m) {
  return prosesTombolKunci(conn, m)
}

console.log("✅ [MODUL] Pembuka Kunci Grup Siap")

