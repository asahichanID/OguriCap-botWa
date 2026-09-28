import {
  setGroupScheduleLock,
  cancelGroupScheduleLock,
  getGroupScheduleLock,
  cleanJid,
  initScheduleLockTimer
} from "./kunci.js"

/**
 * Format durasi sisa waktu menjadi teks human-readable
 * @param {number} ms 
 * @returns {string}
 */
function formatCountdown(ms) {
  if (ms <= 0) return "Sebentar lagi"
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))

  const parts = []
  if (days > 0) parts.push(`${days} hari`)
  if (hours > 0) parts.push(`${hours} jam`)
  if (minutes > 0) parts.push(`${minutes} menit`)
  if (parts.length === 0 || (days === 0 && hours === 0)) parts.push(`${seconds} detik`)
  return parts.join(" ")
}

/**
 * Parsing waktu dari input pengguna (format jam "22.00", "22:00", atau durasi "30m", "1h")
 * @param {string} timeStr 
 * @param {string} timezone 
 * @returns {{ targetMs: number, label: string } | null}
 */
function parseTargetTime(timeStr, timezone = "Asia/Jakarta") {
  if (!timeStr) return null
  const cleaned = timeStr.trim().toLowerCase()

  // 1. Format Durasi Relatif (misal: 30m, 1h, 2j, 45menit)
  const durMatch = cleaned.match(/^(\d+)\s*(s|detik|m|menit|h|jam|j|d|hari)$/i)
  if (durMatch) {
    const val = parseInt(durMatch[1], 10)
    const unit = durMatch[2].toLowerCase()
    let multiplier = 60 * 1000 // default menit
    if (unit === "s" || unit === "detik") multiplier = 1000
    else if (unit === "m" || unit === "menit") multiplier = 60 * 1000
    else if (unit === "h" || unit === "jam" || unit === "j") multiplier = 60 * 60 * 1000
    else if (unit === "d" || unit === "hari") multiplier = 24 * 60 * 60 * 1000

    const targetMs = Date.now() + (val * multiplier)
    const targetDate = new Date(targetMs)
    const hours = String(targetDate.getHours()).padStart(2, '0')
    const mins = String(targetDate.getMinutes()).padStart(2, '0')
    return {
      targetMs,
      label: `${hours}:${mins} WIB (dalam ${val} ${unit})`
    }
  }

  // 2. Format Jam Spesifik (misal: 22.00, 22:00, 07.30, 23)
  const timeMatch = cleaned.match(/^(\d{1,2})(?:[:.](\d{1,2}))?$/)
  if (timeMatch) {
    const targetHour = parseInt(timeMatch[1], 10)
    const targetMin = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0

    if (targetHour < 0 || targetHour > 23 || targetMin < 0 || targetMin > 59) {
      return null
    }

    const now = new Date()
    const target = new Date(now)
    target.setHours(targetHour, targetMin, 0, 0)

    // Jika waktu target hari ini sudah lewat, jadwalkan untuk besok
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1)
    }

    const labelHour = String(targetHour).padStart(2, '0')
    const labelMin = String(targetMin).padStart(2, '0')
    return {
      targetMs: target.getTime(),
      label: `${labelHour}:${labelMin} WIB`
    }
  }

  return null
}

/**
 * Handler Command .kuncibot <waktu> [pesan]
 * Khusus dijalankan di grup yang ingin dikunci.
 */
export async function handleKuncibot(conn, m, args = []) {
  try {
    if (!m.isGroup) {
      return m.reply("❌ Perintah *.kuncibot* hanya bisa digunakan di dalam grup yang ingin dikunci.")
    }

    // Pastikan background timer scheduler aktif
    initScheduleLockTimer(conn)

    const rawFirst = (args[0] || "").toLowerCase().trim()
    const cleanChatId = cleanJid(m.chat)
    const groupName = m.metadata?.subject || "Grup Ini"

    // 1. OPSI BATALKAN JADWAL (.kuncibot batal / .kuncibot off)
    if (rawFirst === "batal" || rawFirst === "off" || rawFirst === "cancel" || rawFirst === "hapus") {
      const activeSchedule = getGroupScheduleLock(cleanChatId)
      if (!activeSchedule) {
        return m.reply("ℹ️ Tidak ada jadwal kunci otomatis yang sedang aktif di grup ini.")
      }

      cancelGroupScheduleLock(cleanChatId)
      const pesanBatal =
`╭─❖「 🔓 𝐉𝐀𝐃𝐖𝐀𝐋 𝐃𝐈𝐁𝐀𝐓𝐀𝐋𝐊𝐀𝐍 🌸 」
│
├ 👥 *Grup:* ${groupName}
├ ✅ Jadwal penguncian otomatis berhasil dibatalkan.
├ 🌐 Bot akan tetap aktif normal di grup ini.
╰─────────────❖`

      return conn.sendMessage(m.chat, { text: pesanBatal }, { quoted: m })
    }

    // 2. OPSI CEK STATUS JADWAL (.kuncibot status / tanpa argumen)
    if (!rawFirst || rawFirst === "status" || rawFirst === "info") {
      const activeSchedule = getGroupScheduleLock(cleanChatId)
      if (activeSchedule) {
        const remainingMs = activeSchedule.targetTime - Date.now()
        const countdown = formatCountdown(remainingMs)

        const pesanStatus =
`╭─❖「 ⏱️ 𝐉𝐀𝐃𝐖𝐀𝐋 𝐊𝐔𝐍𝐂𝐈 𝐀𝐊𝐓𝐈𝐅 🌸 」
│
├ 👥 *Grup:* ${activeSchedule.name || groupName}
├ ⏰ *Waktu Kunci:* *${activeSchedule.targetTimeStr}*
├ ⏳ *Sisa Waktu:* ${countdown}
├ 📝 *Pesan Otomatis:* "${activeSchedule.reason || 'Waktu operasional bot telah berakhir.'}"
│
├ 💡 *Perintah:*
│ • Ketik *.kuncibot batal* untuk membatalkan
│ • Ketik *.kuncibot <waktu baru> [pesan]* untuk mengubah jadwal
╰─────────────❖`
        return conn.sendMessage(m.chat, { text: pesanStatus }, { quoted: m })
      }

      const panduanTeks =
`╭─❖「 ⏱️ 𝐊𝐔𝐍𝐂𝐈 𝐁𝐎𝐓 𝐎𝐓𝐎𝐌𝐀𝐓𝐈𝐒 🌸 」
│
├ 💡 *Format Perintah:*
│ • *.kuncibot <waktu> [pesan]*
│
├ 📌 *Contoh Penggunaan:*
│ • *.kuncibot 22.00*
│ • *.kuncibot 22.00 tidur besok main lagi*
│ • *.kuncibot 23:30 istirahat malam*
│ • *.kuncibot 1h* (1 jam dari sekarang)
│ • *.kuncibot 30m istirahat dulu*
│ • *.kuncibot batal* (batalkan jadwal)
│
├ 🛡️ *Fitur:*
│ Saat jam yang ditentukan tiba, bot otomatis mengirim pesan
│ pemberitahuan ke grup ini dan langsung terkunci.
╰─────────────❖`
      return conn.sendMessage(m.chat, { text: panduanTeks }, { quoted: m })
    }

    // 3. PARSING WAKTU & PESAN
    const parsed = parseTargetTime(rawFirst, global.timezone || "Asia/Jakarta")
    if (!parsed) {
      return m.reply(
`❌ Format waktu tidak valid!

Contoh yang benar:
• *.kuncibot 22.00*
• *.kuncibot 22:00 tidur besok main lagi*
• *.kuncibot 1h* (1 jam dari sekarang)
• *.kuncibot 30m istirahat dulu*`
      )
    }

    // Ambil pesan / alasan jika disertakan
    const reasonText = args.slice(1).join(" ").trim() || "Waktu operasional bot telah berakhir."
    const countdown = formatCountdown(parsed.targetMs - Date.now())

    // Simpan jadwal ke database terpusat
    setGroupScheduleLock(
      cleanChatId,
      groupName,
      parsed.targetMs,
      parsed.label,
      reasonText,
      m.sender
    )

    const pesanKonfirmasi =
`╭─❖「 ⏱️ 𝐉𝐀𝐃𝐖𝐀𝐋 𝐊𝐔𝐍𝐂𝐈 𝐁𝐎𝐓 🌸 」
│
├ 👥 *Grup:* ${groupName}
├ ⏰ *Waktu Kunci:* *${parsed.label}*
├ ⏳ *Hitung Mundur:* ${countdown}
├ 📝 *Pesan Otomatis:* "${reasonText}"
│
├ 🛡️ Saat jam tersebut tiba, bot akan mengirimkan pemberitahuan resmi dan langsung mengunci dirinya di grup ini.
├ 💡 Ketik *.kuncibot batal* untuk membatalkan jadwal sewaktu-waktu.
╰─────────────❖`

    return conn.sendMessage(m.chat, { text: pesanKonfirmasi }, { quoted: m })

  } catch (e) {
    console.error("🔐 [KUNCIBOT] Error handleKuncibot:", e.stack || e)
    m.reply("❌ Terjadi kesalahan saat mengatur jadwal kunci bot.")
  }
}

export default handleKuncibot
