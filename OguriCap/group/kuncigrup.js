import {
  syncGroups,
  getUnlockedGroups,
  getLockedGroups,
  getAllGroups,
  lockGroup,
  unlockGroup,
  lockAllGroups,
  cleanJid,
  botLock
} from "./kunci.js"

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
        console.warn("🔐 [KUNCI] Sync warning:", e.message)
      })
    } catch {}
  }
}

/**
 * Tampilkan antarmuka Kunci Grup (100% Silent ke grup target)
 * Mode 1: args[0] === 'semua' / 'all' -> Kunci seluruh grup tanpa sisa
 * Mode 2: args[0] === 'ini' / 'here' -> Kunci grup saat ini
 * Mode 3: args[0] === <angka> -> Kunci grup berdasarkan nomor urut di daftar grup dibuka
 * Mode 4: args[0] === <jid/nama> -> Kunci grup berdasarkan JID atau nama
 * Mode 5: default -> Panel kelola grup dengan pemisahan ATAS (grup dibuka) dan BAWAH (grup dikunci)
 */
export async function tampilkanKunciGrup(conn, m, args = []) {
  try {
    const rawMode = (args[0] || "").toLowerCase().trim()
    const fullQuery = args.join(" ").toLowerCase().trim()

    // Trigger sync di latar belakang
    ensureSync(conn)

    // =================================================================
    // MODE 1: KUNCI SEMUA GRUP TANPA SISA (.kunci semua / .lock all)
    // =================================================================
    if (rawMode === "semua" || rawMode === "all") {
      const listSemua = lockAllGroups()
      const total = listSemua.length

      const pesanKunciSemua =
`╭─❖「 🔒 𝐊𝐔𝐍𝐂𝐈 𝐒𝐄𝐌𝐔𝐀 𝐆𝐑𝐔𝐏 🌸 」
│
├ 📊 *Total Terkunci:* ${total} Grup
├ 🛡️ *Status:* SELURUH GRUP TELAH DIKUNCI
├ 🤫 *Mode:* 100% Silent (Tanpa Notifikasi Grup)
├ 💾 *Penyimpanan:* Terpusat & Permanen
│
├ 🛑 *Pengaruh:*
│ • Bot mengabaikan seluruh pesan member di semua grup
│ • Khusus Owner tetap bebas menggunakan bot di mana saja
│
├ 💡 *Perintah Buka:*
│ • Ketik *.buka semua* untuk membuka kembali
╰─────────────❖`;

      return conn.sendMessage(m.chat, { text: pesanKunciSemua }, { quoted: m })
    }

    // =================================================================
    // MODE 2: KUNCI GRUP TERTENTU / SAAT INI / VIA NOMOR / JID
    // =================================================================
    let targetJid = null
    let targetName = "Grup WhatsApp"

    if (rawMode === "ini" || rawMode === "here") {
      if (m.isGroup) {
        targetJid = m.chat
        targetName = m.metadata?.subject || "Grup Ini"
      } else {
        return m.reply("❌ Perintah *.kunci ini* hanya bisa digunakan di dalam grup.")
      }
    } else if (rawMode.includes("@g.us") || /^\d{10,25}/.test(rawMode)) {
      targetJid = cleanJid(rawMode)
    } else if (args.length > 0) {
      const grupDibuka = getUnlockedGroups() || []
      const num = parseInt(rawMode, 10)
      if (!isNaN(num) && num > 0 && num <= grupDibuka.length) {
        targetJid = grupDibuka[num - 1]?.id
        targetName = grupDibuka[num - 1]?.name || targetName
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
      const g = lockGroup(cleanTarget, targetName)
      const finalName = g?.name || targetName || "Grup WhatsApp"

      const pesan =
`╭─❖「 🔒 𝐆𝐑𝐔𝐏 𝐁𝐄𝐑𝐇𝐀𝐒𝐈𝐋 𝐃𝐈𝐊𝐔𝐍𝐂𝐈 🌸 」
│
├ 📛 *Nama Grup:* ${finalName}
├ 🆔 *ID Grup:* ${cleanTarget}
├ 🤫 *Mode:* Silent (Tanpa Pesan ke Grup)
├ 🛡️ *Status:* Bot Membisu di Grup Tersebut
├ 💾 *Penyimpanan:* Permanen di Database
╰─────────────❖`;

      try {
        await m.reply(pesan)
      } catch {
        await conn.sendMessage(m.chat, { text: pesan }).catch(() => {})
      }
      return
    }

    // =================================================================
    // MODE 3: PANEL KELOLA KUNCI GRUP (.kunci)
    // =================================================================
    const grupDibuka = getUnlockedGroups() || []
    const grupDikunci = getLockedGroups() || []
    const totalGrup = (getAllGroups() || []).length

    // 1. Baris untuk Section ATAS (Grup Dibuka / Aktif)
    const rowsDibuka = grupDibuka.length
      ? grupDibuka.map(g => ({
          header: "🔒 KUNCI",
          title: (g.name || "Grup").slice(0, 24),
          description: `ID: ${g.id}`,
          id: `lock_${g.id}`
        }))
      : [{
          header: "ℹ️ INFO",
          title: "Tidak ada grup dibuka",
          description: "Semua grup saat ini dalam status terkunci",
          id: "none"
        }]

    // 2. Baris untuk Section BAWAH (Grup Dikunci)
    const rowsDikunci = grupDikunci.length
      ? grupDikunci.map(g => ({
          header: "🔓 BUKA",
          title: (g.name || "Grup").slice(0, 24),
          description: `ID: ${g.id}`,
          id: `unlock_${g.id}`
        }))
      : [{
          header: "ℹ️ INFO",
          title: "Belum ada grup dikunci",
          description: "Seluruh grup saat ini aktif merespon",
          id: "none"
        }]

    // 3. Teks Ringkasan Pesan
    const listTextDibuka = grupDibuka.length
      ? grupDibuka.map((g, i) => `├  ${i + 1}. 🟢 ${g.name || "Grup"} (\`${g.id.slice(0, 22)}\`)`).join("\n")
      : "├ _Tidak ada (semua grup terkunci)_"

    const listTextDikunci = grupDikunci.length
      ? grupDikunci.map((g, i) => `├  ${i + 1}. 🔴 ${g.name || "Grup"} (\`${g.id.slice(0, 22)}\`)`).join("\n")
      : "├ _Belum ada (semua grup aktif)_"

    const textMsg =
`╭─❖「 🔒 𝐏𝐀𝐍𝐄𝐋 𝐊𝐔𝐍𝐂𝐈 𝐆𝐑𝐔𝐏 🌸 」
│
├ 📊 *Total Grup:* ${totalGrup}
├ 🟢 *Dibuka:* ${grupDibuka.length} Grup
├ 🔴 *Dikunci:* ${grupDikunci.length} Grup
${botLock.allLocked ? "├ ⚠️ *Status Global:* ALL LOCKED\n" : ""}│
├ 🟢 *DAFTAR GRUP DIBUKA (AKTIF):*
${listTextDibuka}
│
├ 🔴 *DAFTAR GRUP DIKUNCI:*
${listTextDikunci}
│
├ 💡 *Panduan Cepat (100% Silent):*
│ • Klik tombol *📋 KELOLA KUNCI GRUP* di bawah
│ • Ketik *.kunci semua* untuk mengunci semua grup
│ • Ketik *.buka semua* untuk membuka semua grup
│ • Ketik *.kunci <nomor>* untuk mengunci grup tertentu
│ • Ketik *.buka <nomor>* untuk membuka grup tertentu
╰─────────────❖`;

    // 4. Kirim Pesan Interaktif dengan fallback teks yang aman
    try {
      if (typeof conn.sendListMsg === "function") {
        return await conn.sendListMsg(m.chat, {
          text: textMsg,
          footer: FOOTER,
          buttons: [{
            name: "single_select",
            buttonParamsJson: {
              title: "📋 KELOLA KUNCI GRUP",
              sections: [
                {
                  title: `🟢 GRUP DIBUKA (${grupDibuka.length}) - KLIK UTK KUNCI`,
                  highlight_label: "DIBUKA",
                  rows: rowsDibuka
                },
                {
                  title: `🔴 GRUP DIKUNCI (${grupDikunci.length}) - KLIK UTK BUKA`,
                  highlight_label: "DIKUNCI",
                  rows: rowsDikunci
                }
              ]
            }
          }]
        }, { quoted: m })
      }
    } catch {}

    return conn.sendMessage(m.chat, { text: textMsg }, { quoted: m })

  } catch (e) {
    console.error("🔐 [KUNCI] Error tampilkanKunciGrup:", e.stack || e)
    m.reply("❌ Gagal memuat panel kunci grup.")
  }
}

/**
 * Memproses klik tombol interaktif kunci atau buka secara mandiri & 100% Silent
 */
export async function prosesTombolKunci(conn, m) {
  try {
    let id = null

    // 1. Ekstrak dari property m.interactiveId (dari Serialize)
    if (m?.interactiveId) {
      id = m.interactiveId
    }

    // 2. Ekstrak dari interactiveResponseMessage native flow di berbagai layer
    if (!id) {
      const native = m?.message?.interactiveResponseMessage?.nativeFlowResponseMessage
        || m?.msg?.nativeFlowResponseMessage
        || m?.msg?.interactiveResponseMessage?.nativeFlowResponseMessage
        || m?.message?.viewOnceMessage?.message?.interactiveResponseMessage?.nativeFlowResponseMessage
        || m?.message?.ephemeralMessage?.message?.interactiveResponseMessage?.nativeFlowResponseMessage
      if (native?.paramsJson) {
        try {
          const parsed = typeof native.paramsJson === 'string' ? JSON.parse(native.paramsJson) : native.paramsJson
          id = parsed?.id || parsed?.selectedId || parsed?.selectedRowId
        } catch {}
      }
    }

    // 3. Ekstrak dari singleSelect / button response
    if (!id) {
      id = m?.message?.listResponseMessage?.singleSelectReply?.selectedRowId
        || m?.msg?.singleSelectReply?.selectedRowId
        || m?.message?.buttonsResponseMessage?.selectedButtonId
        || m?.msg?.selectedButtonId
        || m?.message?.templateButtonReplyMessage?.selectedId
        || m?.msg?.selectedId
    }

    // 4. Ekstrak fallback dari m.body atau m.text
    if (!id) {
      const rawText = (m.body || m.text || "").trim()
      if (rawText.startsWith("lock_") || rawText.startsWith("unlock_")) {
        id = rawText
      }
    }

    if (!id || id === "none") return false

    // Aksi Mengunci Grup (lock_JID) - 100% SILENT ke grup target
    if (id.startsWith("lock_")) {
      const rawJid = id.slice(5)
      const jid = cleanJid(rawJid)
      const g = lockGroup(jid)
      const namaGrup = g?.name || botLock.groups?.[jid]?.name || "Grup WhatsApp"

      const pesan =
`╭─❖「 🔒 𝐆𝐑𝐔𝐏 𝐁𝐄𝐑𝐇𝐀𝐒𝐈𝐋 𝐃𝐈𝐊𝐔𝐍𝐂𝐈 🌸 」
│
├ 📛 *Nama Grup:* ${namaGrup}
├ 🆔 *ID Grup:* ${jid}
├ 🤫 *Mode:* Silent (Tanpa Pemberitahuan ke Grup)
├ 🛡️ *Status:* Bot Dinonaktifkan di Grup Ini
├ 💾 *Penyimpanan:* Database Terpusat
╰─────────────❖`;

      try {
        await m.reply(pesan)
      } catch {
        await conn.sendMessage(m.chat, { text: pesan }).catch(() => {})
      }
      console.log(`🔒 [KUNCI SILENT] Grup dikunci → ${namaGrup} (${jid})`)
      return true
    }

    // Aksi Membuka Kunci Grup (unlock_JID) - 100% SILENT ke grup target
    if (id.startsWith("unlock_")) {
      const rawJid = id.slice(7)
      if (rawJid === "all") {
        unlockAllGroups()
        const pesan =
`╭─❖「 🔓 𝐒𝐄𝐌𝐔𝐀 𝐆𝐑𝐔𝐏 𝐃𝐈𝐁𝐔𝐊𝐀 🌸 」
│
├ ✅ Seluruh kunci grup telah dibuka kembali
├ 🤫 *Mode:* Silent (Tanpa Notifikasi Grup)
╰─────────────❖`;
        try {
          await m.reply(pesan)
        } catch {
          await conn.sendMessage(m.chat, { text: pesan }).catch(() => {})
        }
        return true
      }

      const jid = cleanJid(rawJid)
      const g = unlockGroup(jid)
      const namaGrup = g?.name || botLock.groups?.[jid]?.name || "Grup WhatsApp"

      const pesan =
`╭─❖「 🔓 𝐆𝐑𝐔𝐏 𝐁𝐄𝐑𝐇𝐀𝐒𝐈𝐋 𝐃𝐈𝐁𝐔𝐊𝐀 🌸 」
│
├ 📛 *Nama Grup:* ${namaGrup}
├ 🆔 *ID Grup:* ${jid}
├ 🤫 *Mode:* Silent (Tanpa Pemberitahuan ke Grup)
├ 🛡️ *Status:* Bot Aktif Kembali di Grup Ini
├ 💾 *Penyimpanan:* Database Terpusat
╰─────────────❖`;

      try {
        await m.reply(pesan)
      } catch {
        await conn.sendMessage(m.chat, { text: pesan }).catch(() => {})
      }
      console.log(`🔓 [BUKA SILENT] Grup dibuka → ${namaGrup} (${jid})`)
      return true
    }

    return false
  } catch (e) {
    console.error("🔐 [PROSES] Error prosesTombolKunci:", e.stack || e)
    return false
  }
}

console.log("✅ [MODUL] Pengunci Grup Siap & Terpusat (100% Silent)")
