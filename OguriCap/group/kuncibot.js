import moment from "moment-timezone"
import {
  setGroupScheduleLock,
  cancelGroupScheduleLock,
  getGroupScheduleLock,
  cleanJid,
  initScheduleLockTimer
} from "./kunci.js"

const TIMEZONE = "Asia/Jakarta" // Zona Waktu Jawa Barat / WIB (UTC+7)

/**
 * Format durasi sisa waktu menjadi teks human-readable presisi
 * @param {number} ms 
 * @returns {string}
 */
function formatCountdown(ms) {
  if (ms <= 0) return "Sebentar lagi"
  const totalSeconds = Math.floor(ms / 1000)
  const seconds = totalSeconds % 60
  const minutes = Math.floor((totalSeconds / 60) % 60)
  const hours = Math.floor((totalSeconds / 3600) % 24)
  const days = Math.floor(totalSeconds / 86400)

  const parts = []
  if (days > 0) parts.push(`${days} hari`)
  if (hours > 0) parts.push(`${hours} jam`)
  if (minutes > 0) parts.push(`${minutes} menit`)
  if (parts.length === 0 || (days === 0 && hours === 0)) parts.push(`${seconds} detik`)
  return parts.join(" ")
}

/**
 * Parsing waktu dari input pengguna persis zona waktu Jawa Barat / WIB (Asia/Jakarta)
 * @param {string} timeStr 
 * @param {string} timezone 
 * @returns {{ targetMs: number, label: string } | null}
 */
function parseTargetTime(timeStr, timezone = "Asia/Jakarta") {
  if (!timeStr) return null
  const cleaned = timeStr.trim().toLowerCase()

  // 1. Format Durasi Relatif (misal: 10s, 30m, 1h, 2j, 45menit)
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
    const targetMoment = moment(targetMs).tz(timezone)
    return {
      targetMs,
      label: `${targetMoment.format('HH:mm')} WIB (dalam ${val} ${unit})`
    }
  }

  // 2. Format Jam Spesifik WIB (misal: 22.00, 22:00, 22.10, 07.30, 23)
  const timeMatch = cleaned.match(/^(\d{1,2})(?:[:.](\d{1,2}))?$/)
  if (timeMatch) {
    const targetHour = parseInt(timeMatch[1], 10)
    const targetMin = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0

    if (targetHour < 0 || targetHour > 23 || targetMin < 0 || targetMin > 59) {
      return null
    }

    // Ambil waktu saat ini tepat di zona WIB (Asia/Jakarta / Jawa Barat)
    const nowWib = moment().tz(timezone)

    // Buat target hari ini di zona WIB
    const targetWib = nowWib.clone().hour(targetHour).minute(targetMin).second(0).millisecond(0)

    // Jika waktu target hari ini sudah lewat (misal sekarang 22:20 dan user set 22:10), jadwalkan untuk besok
    if (targetWib.valueOf() <= nowWib.valueOf()) {
      targetWib.add(1, 'day')
    }

    const targetMs = targetWib.valueOf()
    const labelHour = String(targetHour).padStart(2, '0')
    const labelMin = String(targetMin).padStart(2, '0')

    return {
      targetMs,
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

    // Pastikan background timer scheduler aktif dengan socket fresh
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

      const nowWibStr = moment().tz(TIMEZONE).format('HH:mm')
      const panduanTeks =
`╭─❖「 ⏱️ 𝐊𝐔𝐍𝐂𝐈 𝐁𝐎𝐓 𝐎𝐓𝐎𝐌𝐀𝐓𝐈𝐒 🌸 」
│
├ 🕒 *Jam Sekarang (WIB):* *${nowWibStr} WIB*
├ 💡 *Format Perintah:*
│ • *.kuncibot <waktu> [pesan]*
│
├ 📌 *Contoh Penggunaan:*
│ • *.kuncibot 22.00*
│ • *.kuncibot 22.00 tidur besok main lagi*
│ • *.kuncibot 23:30 istirahat malam*
│ • *.kuncibot 10m* (10 menit lagi)
│ • *.kuncibot 1h* (1 jam dari sekarang)
│ • *.kuncibot batal* (batalkan jadwal)
│
├ 🛡️ *Fitur Presisi:*
│ Saat jam yang ditentukan tiba, bot otomatis mengirim pesan
│ pemberitahuan ke grup ini dan langsung terkunci.
╰─────────────❖`
      return conn.sendMessage(m.chat, { text: panduanTeks }, { quoted: m })
    }

    // 3. PARSING WAKTU & PESAN
    const parsed = parseTargetTime(rawFirst, TIMEZONE)
    if (!parsed) {
      return m.reply(
`❌ Format waktu tidak valid!

Contoh yang benar:
• *.kuncibot 22.00*
• *.kuncibot 22:00 tidur besok main lagi*
• *.kuncibot 10m* (10 menit lagi)
• *.kuncibot 1h* (1 jam dari sekarang)`
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
