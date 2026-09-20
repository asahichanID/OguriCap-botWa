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
      // Jalankan sync dengan safety catch agar tidak memblokir
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
 * Tampilkan antarmuka Kunci Grup
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

      const pesanKunciSemua = [
        "🔒 *KUNCI SEMUA GRUP BERHASIL*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        `📊 *Total Grup Terkunci:* ${total} Grup`,
        "🛡️ *Status:* SELURUH GRUP TELAH DIKUNCI TANPA SISA!",
        "💾 *Penyimpanan:* PERMANEN (database/locked_groups.json)",
        "",
        "🛑 *Pengaruh Penguncian:*",
        "• Bot mengabaikan seluruh pesan dan perintah member di SEMUA grup.",
        "• Bot tidak akan merespon siapapun di grup sampai dibuka kembali oleh Owner.",
        "• Penguncian bersifat *MANDIRI & PERMANEN* (tetap aman meski server/file berubah).",
        "• Khusus Owner tetap bebas menggunakan perintah di manapun.",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "💡 *Perintah Terkait:*",
        "• Ketik *.buka semua* untuk membuka kembali seluruh grup sekaligus.",
        "• Ketik *.buka ini* atau *.buka <nomor>* untuk membuka grup tertentu."
      ].join("\n")

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

      const pesan = [
        "🔒 *SUKSES DIKUNCI*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        `📛 *Nama Grup* : ${finalName}`,
        `🆔 *ID Grup*   : ${cleanTarget}`,
        "✅ Bot sekarang membisukan diri di grup ini sampai dibuka kembali oleh Owner.",
        "💾 Status tersimpan mandiri & permanen di database."
      ].join("\n")

      try {
        await m.reply(pesan)
      } catch {
        await conn.sendMessage(m.chat, { text: pesan }).catch(() => {})
      }

      if (m.chat !== cleanTarget && cleanTarget.endsWith('@g.us')) {
        await conn.sendMessage(cleanTarget, {
          text: "🔒 *PEMBERITAHUAN*\n━━━━━━━━━━━━━━━━━━━━━━\n🛑 Bot telah dikunci oleh Owner dan dinonaktifkan sementara di grup ini."
        }).catch(() => {})
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

    // 3. Teks Ringkasan Pesan (Dipisah Atas & Bawah)
    const listTextDibuka = grupDibuka.length
      ? grupDibuka.map((g, i) => `${i + 1}. 🟢 ${g.name || "Grup"} (\`${g.id.slice(0, 22)}\`)`).join("\n")
      : "_Tidak ada grup yang dibuka (semua dalam status terkunci)._"

    const listTextDikunci = grupDikunci.length
      ? grupDikunci.map((g, i) => `${i + 1}. 🔴 ${g.name || "Grup"} (\`${g.id.slice(0, 22)}\`)`).join("\n")
      : "_Belum ada grup yang dikunci (semua aktif)._"

    const textMsg = [
      "🔒 *PANEL KELOLA KUNCI GRUP*",
      "━━━━━━━━━━━━━━━━━━━━━━",
      `📊 *Ringkasan Status Grup:*`,
      `• Total Grup   : ${totalGrup}`,
      `• Grup Dibuka  : ${grupDibuka.length} 🟢`,
      `• Grup Dikunci : ${grupDikunci.length} 🔴`,
      botLock.allLocked ? "⚠️ *Status Global:* SEMUA GRUP DIKUNCI (ALL LOCKED)\n" : "",
      "━━━━━━━━━━━━━━━━━━━━━━",
      "🟢 *DAFTAR GRUP DIBUKA (AKTIF):*",
      listTextDibuka,
      "",
      "🔴 *DAFTAR GRUP DIKUNCI:*",
      listTextDikunci,
      "━━━━━━━━━━━━━━━━━━━━━━",
      "💡 *Opsi Penggunaan Cepat:*",
      "• Klik tombol *📋 KELOLA KUNCI GRUP* di bawah:",
      "  ↳ *Atas*: Grup dibuka (klik utk mengunci).",
      "  ↳ *Bawah*: Grup dikunci (klik utk membuka).",
      "• Ketik *.kunci semua* untuk mengunci seluruh grup.",
      "• Ketik *.buka semua* untuk membuka seluruh grup.",
      "• Ketik *.kunci <nomor>* untuk mengunci grup tertentu (misal: *.kunci 1*).",
      "• Ketik *.buka <nomor>* untuk membuka grup tertentu (misal: *.buka 1*)."
    ].join("\n")

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
 * Memproses klik tombol interaktif kunci atau buka secara mandiri & instan
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

    // Aksi Mengunci Grup (lock_JID)
    if (id.startsWith("lock_")) {
      const rawJid = id.slice(5)
      const jid = cleanJid(rawJid)
      const g = lockGroup(jid)
      const namaGrup = g?.name || botLock.groups?.[jid]?.name || "Grup WhatsApp"
      const pesan = [
        "🔒 *SUKSES DIKUNCI*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        `📛 *Nama Grup* : ${namaGrup}`,
        `🆔 *ID Grup*   : ${jid}`,
        "✅ Bot sekarang membisukan diri di grup ini sampai dibuka kembali oleh Owner.",
        "💾 Status tersimpan permanen di database."
      ].join("\n")

      try {
        await m.reply(pesan)
      } catch {
        await conn.sendMessage(m.chat, { text: pesan }).catch(() => {})
      }
      console.log(`🔒 [KUNCI] Grup dikunci → ${namaGrup} (${jid})`)

      if (m.chat !== jid && jid.endsWith('@g.us')) {
        await conn.sendMessage(jid, {
          text: `🔒 *PEMBERITAHUAN*\n━━━━━━━━━━━━━━━━━━━━━━\n🛑 Bot telah dikunci oleh Owner dan dinonaktifkan sementara di grup ini.`
        }).catch(() => {})
      }
      return true
    }

    // Aksi Membuka Kunci Grup (unlock_JID)
    if (id.startsWith("unlock_")) {
      const rawJid = id.slice(7)
      const jid = cleanJid(rawJid)
      const g = unlockGroup(jid)
      const namaGrup = g?.name || botLock.groups?.[jid]?.name || "Grup WhatsApp"
      const pesan = [
        "🔓 *SUKSES DIBUKA*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        `📛 *Nama Grup* : ${namaGrup}`,
        `🆔 *ID Grup*   : ${jid}`,
        "✅ Bot sudah aktif kembali merespon di grup ini.",
        "💾 Status tersimpan permanen di database."
      ].join("\n")

      try {
        await m.reply(pesan)
      } catch {
        await conn.sendMessage(m.chat, { text: pesan }).catch(() => {})
      }
      console.log(`🔓 [KUNCI] Grup dibuka → ${namaGrup} (${jid})`)

      if (m.chat !== jid && jid.endsWith('@g.us')) {
        await conn.sendMessage(jid, {
          text: `🔓 *PEMBERITAHUAN*\n━━━━━━━━━━━━━━━━━━━━━━\n✅ Bot telah dibuka kuncinya oleh Owner dan kini aktif kembali merespon seluruh perintah di grup ini.`
        }).catch(() => {})
      }
      return true
    }

    return false
  } catch (e) {
    console.error("🔐 [PROSES] Error prosesTombolKunci:", e.stack || e)
    return false
  }
}

console.log("✅ [MODUL] Pengunci Grup Siap")

