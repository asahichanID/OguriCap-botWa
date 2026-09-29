import moment from "moment-timezone"
import {
  setGroupScheduleLock,
  cancelGroupScheduleLock,
  getGroupScheduleLock,
  cleanJid,
  initScheduleLockTimer,
  isLocked
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
 * @param {number|null} referenceMs 
 * @returns {{ targetMs: number, label: string } | null}
 */
function parseTargetTime(timeStr, timezone = "Asia/Jakarta", referenceMs = null) {
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

    const baseMs = referenceMs || Date.now()
    const targetMs = baseMs + (val * multiplier)
    const targetMoment = moment(targetMs).tz(timezone)
    return {
      targetMs,
      label: `${targetMoment.format('HH:mm')} WIB (dalam ${val} ${unit})`
    }
  }

  // 2. Format Jam Spesifik WIB (misal: 22.00, 22:00, 22.10, 07.30, 23, 04.00)
  const timeMatch = cleaned.match(/^(\d{1,2})(?:[:.](\d{1,2}))?$/)
  if (timeMatch) {
    const targetHour = parseInt(timeMatch[1], 10)
    const targetMin = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0

    if (targetHour < 0 || targetHour > 23 || targetMin < 0 || targetMin > 59) {
      return null
    }

    // Ambil waktu basis tepat di zona WIB (Asia/Jakarta / Jawa Barat)
    const baseMoment = referenceMs ? moment(referenceMs).tz(timezone) : moment().tz(timezone)

    // Buat target waktu di hari yang sama
    const targetMoment = baseMoment.clone().hour(targetHour).minute(targetMin).second(0).millisecond(0)

    // Jika waktu target <= baseMoment (misal lock jam 22.00, unlock jam 04.00 atau waktu sudah lewat hari ini), tambahkan 1 hari
    if (targetMoment.valueOf() <= baseMoment.valueOf()) {
      targetMoment.add(1, 'day')
    }

    const targetMs = targetMoment.valueOf()
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
 * Handler Command .kuncibot <waktu> [pesan] [ | <waktu buka> [pesan buka] ]
 * Khusus dijalankan di grup yang ingin dikunci / dijadwalkan.
 */
export async function handleKuncibot(conn, m, args = []) {
  try {
    if (!m.isGroup) {
      return m.reply("❌ Perintah *.kuncibot* hanya bisa digunakan di dalam grup yang ingin dikunci.")
    }

    // Pastikan background timer scheduler aktif dengan socket fresh
    initScheduleLockTimer(conn)

    const fullRawText = args.join(" ").trim()
    const rawFirst = (args[0] || "").toLowerCase().trim()
    const cleanChatId = cleanJid(m.chat)
    const groupName = m.metadata?.subject || "Grup Ini"

    // 1. OPSI BATALKAN JADWAL (.kuncibot batal / .kuncibot off / .kuncibot cancel)
    if (rawFirst === "batal" || rawFirst === "off" || rawFirst === "cancel" || rawFirst === "hapus") {
      const activeSchedule = getGroupScheduleLock(cleanChatId)
      if (!activeSchedule) {
        return m.reply("ℹ️ Tidak ada jadwal kunci / auto-buka otomatis yang sedang aktif di grup ini.")
      }

      cancelGroupScheduleLock(cleanChatId)
      const pesanBatal =
`╭─❖「 🔓 𝐉𝐀𝐃𝐖𝐀𝐋 𝐃𝐈𝐁𝐀𝐓𝐀𝐋𝐊𝐀𝐍 🌸 」
│
├ 👥 *Grup:* ${groupName}
├ ✅ Jadwal penguncian / pembukaan otomatis berhasil dibatalkan.
├ 🌐 Bot akan tetap beroperasi normal di grup ini.
╰─────────────❖`

      return conn.sendMessage(m.chat, { text: pesanBatal }, { quoted: m })
    }

    // 2. OPSI CEK STATUS JADWAL (.kuncibot status / tanpa argumen)
    if (!fullRawText || rawFirst === "status" || rawFirst === "info") {
      const activeSchedule = getGroupScheduleLock(cleanChatId)
      if (activeSchedule) {
        const remainingMs = Math.max(0, activeSchedule.targetTime - Date.now())
        const countdown = formatCountdown(remainingMs)
        const phase = activeSchedule.phase || activeSchedule.action || 'lock'

        if (phase === 'lock') {
          let pesanStatus =
`╭─❖「 ⏱️ 𝐉𝐀𝐃𝐖𝐀𝐋 𝐊𝐔𝐍𝐂𝐈 𝐀𝐊𝐓𝐈𝐅 🌸 」
│
├ 👥 *Grup:* ${activeSchedule.name || groupName}
├ 🔒 *Waktu Kunci:* *${activeSchedule.lockTargetTimeStr || activeSchedule.targetTimeStr}*
├ ⏳ *Sisa Waktu:* ${countdown}
├ 📝 *Pesan Kunci:* "${activeSchedule.lockReason || activeSchedule.reason || 'Waktu operasional bot telah berakhir.'}"`

          if (activeSchedule.hasAutoUnlock && activeSchedule.unlockTargetTimeStr) {
            pesanStatus += `\n│\n├ 🔓 *Jadwal Auto-Buka:* *${activeSchedule.unlockTargetTimeStr}*`
            pesanStatus += `\n├ 📝 *Pesan Buka:* "${activeSchedule.unlockReason || 'Waktu istirahat selesai, bot aktif kembali!'}"`
          }

          pesanStatus += `\n│\n├ 💡 *Perintah:*`
          pesanStatus += `\n│ • Ketik *.kuncibot batal* untuk membatalkan`
          pesanStatus += `\n│ • Ketik *.kuncibot <waktu baru>* untuk memperbarui`
          pesanStatus += `\n╰─────────────❖`
          return conn.sendMessage(m.chat, { text: pesanStatus }, { quoted: m })
        } else if (phase === 'unlock') {
          const pesanStatusUnlock =
`╭─❖「 🔓 𝐉𝐀𝐃𝐖𝐀𝐋 𝐀𝐔𝐓𝐎-𝐁𝐔𝐊𝐀 𝐀𝐊𝐓𝐈𝐅 🌸 」
│
├ 👥 *Grup:* ${activeSchedule.name || groupName}
├ 🔓 *Waktu Dibuka:* *${activeSchedule.unlockTargetTimeStr || activeSchedule.targetTimeStr}*
├ ⏳ *Sisa Waktu Terkunci:* ${countdown}
├ 📝 *Pesan Buka:* "${activeSchedule.unlockReason || activeSchedule.reason || 'Waktu istirahat selesai, bot aktif kembali!'}"
│
├ 💡 *Perintah:*
│ • Ketik *.kuncibot batal* untuk membatalkan jadwal buka
│ • Ketik *.buka ini* untuk langsung membuka grup sekarang
╰─────────────❖`
          return conn.sendMessage(m.chat, { text: pesanStatusUnlock }, { quoted: m })
        }
      }

      const nowWibStr = moment().tz(TIMEZONE).format('HH:mm')
      const panduanTeks =
`╭─❖「 ⏱️ 𝐊𝐔𝐍𝐂𝐈 𝐁𝐎𝐓 𝐎𝐓𝐎𝐌𝐀𝐓𝐈𝐒 (𝐅𝐋𝐄𝐊𝐒𝐈𝐁𝐄𝐋) 🌸 」
│
├ 🕒 *Jam Sekarang (WIB):* *${nowWibStr} WIB*
│
├ 💡 *Format Perintah:*
│ 1️⃣ *Kunci & Auto-Buka Otomatis (Gunakan |):*
│ • *.kuncibot <waktu kunci> [pesan] | <waktu buka> [pesan]*
│   Contoh: *.kuncibot 22.00 tidur | 04.00*
│   Contoh: *.kuncibot 22.00 tidur besok main lagi | 04.00 subuh bangun*
│   Contoh: *.kuncibot 1h ngopi | 2h gas lagi*
│
│ 2️⃣ *Kunci Saja (Tanpa Auto-Buka):*
│ • *.kuncibot 22.00 tidur*
│ • *.kuncibot 30m istirahat*
│
│ 3️⃣ *Jadwalkan Auto-Buka Saja:*
│ • *.kuncibot buka 04.00 subuh bangun*
│
│ 4️⃣ *Kontrol Jadwal:*
│ • *.kuncibot batal* (batalkan jadwal)
│ • *.kuncibot status* (cek sisa waktu)
│
├ 🛡️ *Keunggulan Sistem V5:*
│ • Presisi waktu WIB (Jawa Barat).
│ • Otomatis estafet: jam 22.00 tutup ➡️ jam 04.00 langsung buka otomatis.
│ • Dilengkapi pengaman watchdog jika bot macet / restart.
│ • Jalur antar grup terisolasi mandiri tanpa hambatan.
╰─────────────❖`
      return conn.sendMessage(m.chat, { text: panduanTeks }, { quoted: m })
    }

    // 3. OPSI JADWAL BUKA SAJA (.kuncibot buka <waktu> [pesan] / .kuncibot open <waktu>)
    if (rawFirst === "buka" || rawFirst === "open" || rawFirst === "unlock") {
      const unlockTimeArg = args[1]
      if (!unlockTimeArg) {
        return m.reply("❌ Masukkan waktu buka!\nContoh: *.kuncibot buka 04.00 subuh bangun* atau *.kuncibot buka 30m*")
      }
      const parsedUnlock = parseTargetTime(unlockTimeArg, TIMEZONE)
      if (!parsedUnlock) {
        return m.reply("❌ Format waktu buka tidak valid!\nContoh: *.kuncibot buka 04.00* atau *.kuncibot buka 1h*")
      }
      const unlockReason = args.slice(2).join(" ").trim() || "Waktu istirahat selesai, bot aktif kembali!"
      const countdown = formatCountdown(parsedUnlock.targetMs - Date.now())

      setGroupScheduleLock(
        cleanChatId,
        groupName,
        null,
        null,
        null,
        m.sender,
        {
          phase: 'unlock',
          hasAutoUnlock: true,
          unlockTargetTime: parsedUnlock.targetMs,
          unlockTargetTimeStr: parsedUnlock.label,
          unlockReason: unlockReason
        }
      )

      const pesanSetBuka =
`╭─❖「 🔓 𝐉𝐀𝐃𝐖𝐀𝐋 𝐀𝐔𝐓𝐎-𝐁𝐔𝐊𝐀 𝐁𝐎𝐓 🌸 」
│
├ 👥 *Grup:* ${groupName}
├ 🔓 *Waktu Dibuka:* *${parsedUnlock.label}*
├ ⏳ *Hitung Mundur:* ${countdown}
├ 📝 *Pesan Buka:* "${unlockReason}"
│
├ 🛡️ Saat jam tersebut tiba, bot akan otomatis terbuka dan aktif kembali untuk semua member.
├ 💡 Ketik *.kuncibot batal* untuk membatalkan sewaktu-waktu.
╰─────────────❖`
      return conn.sendMessage(m.chat, { text: pesanSetBuka }, { quoted: m })
    }

    // 4. PARSING FORMAT DUA SISI (KUNCI | AUTO-BUKA) ATAU SATU SISI (KUNCI SAJA)
    let leftSide = fullRawText
    let rightSide = null

    if (fullRawText.includes("|")) {
      const parts = fullRawText.split("|")
      leftSide = parts[0].trim()
      rightSide = parts.slice(1).join("|").trim()
    }

    // A. Parse Sisi Kiri (Waktu Kunci)
    const leftTokens = leftSide.split(/\s+/)
    const lockTimeStr = leftTokens[0]
    const parsedLock = parseTargetTime(lockTimeStr, TIMEZONE)

    if (!parsedLock) {
      return m.reply(
`❌ Format waktu kunci tidak valid!

💡 *Contoh yang benar:*
• *.kuncibot 22.00 tidur | 04.00*
• *.kuncibot 22.00 tidur besok main lagi | 04.00 subuh bangun*
• *.kuncibot 22.00 | 04.00*
• *.kuncibot 22.00 tidur*
• *.kuncibot 30m istirahat*`
      )
    }

    const lockReason = leftTokens.slice(1).join(" ").trim() || "Waktu operasional bot telah berakhir."

    // B. Parse Sisi Kanan (Waktu Auto-Buka) jika ada
    let parsedUnlock = null
    let unlockReason = "Waktu istirahat selesai, bot aktif kembali!"

    if (rightSide) {
      const rightTokens = rightSide.split(/\s+/)
      const unlockTimeStr = rightTokens[0]
      // Waktu buka dihitung relatif terhadap waktu penguncian
      parsedUnlock = parseTargetTime(unlockTimeStr, TIMEZONE, parsedLock.targetMs)

      if (!parsedUnlock) {
        return m.reply(
`❌ Format waktu buka setelah tanda '|' tidak valid!

💡 *Contoh:*
• *.kuncibot 22.00 tidur | 04.00*
• *.kuncibot 22.00 tidur | 04.00 subuh bangun*`
        )
      }

      if (rightTokens.length > 1) {
        unlockReason = rightTokens.slice(1).join(" ").trim() || unlockReason
      }
    }

    // Simpan ke database terpusat
    const countdownLock = formatCountdown(parsedLock.targetMs - Date.now())

    setGroupScheduleLock(
      cleanChatId,
      groupName,
      parsedLock.targetMs,
      parsedLock.label,
      lockReason,
      m.sender,
      {
        hasAutoUnlock: Boolean(parsedUnlock),
        unlockTargetTime: parsedUnlock?.targetMs || null,
        unlockTargetTimeStr: parsedUnlock?.label || null,
        unlockReason: unlockReason
      }
    )

    let pesanKonfirmasi = ""
    if (parsedUnlock) {
      const durasiKunciMs = parsedUnlock.targetMs - parsedLock.targetMs
      const durasiKunciTeks = formatCountdown(durasiKunciMs)

      pesanKonfirmasi =
`╭─❖「 ⏱️ 𝐉𝐀𝐃𝐖𝐀𝐋 𝐊𝐔𝐍𝐂𝐈 & 𝐀𝐔𝐓𝐎-𝐁𝐔𝐊𝐀 🌸 」
│
├ 👥 *Grup:* ${groupName}
├ 🔒 *Waktu Kunci:* *${parsedLock.label}*
├ ⏳ *Hitung Mundur Kunci:* ${countdownLock}
├ 📝 *Pesan Kunci:* "${lockReason}"
│
├ 🔓 *Jadwal Auto-Buka:* *${parsedUnlock.label}*
├ ⏱️ *Durasi Terkunci:* ${durasiKunciTeks}
├ 📝 *Pesan Buka:* "${unlockReason}"
│
├ 🛡️ *Estafet Otomatis:*
│ 1. Pada *${parsedLock.label}*, bot mengirim notifikasi dan terkunci otomatis.
│ 2. Pada *${parsedUnlock.label}*, bot langsung otomatis dibuka kembali!
│
├ 💡 Ketik *.kuncibot batal* untuk membatalkan sewaktu-waktu.
╰─────────────❖`
    } else {
      pesanKonfirmasi =
`╭─❖「 ⏱️ 𝐉𝐀𝐃𝐖𝐀𝐋 𝐊𝐔𝐍𝐂𝐈 𝐁𝐎𝐓 🌸 」
│
├ 👥 *Grup:* ${groupName}
├ 🔒 *Waktu Kunci:* *${parsedLock.label}*
├ ⏳ *Hitung Mundur:* ${countdownLock}
├ 📝 *Pesan Otomatis:* "${lockReason}"
│
├ 🛡️ Saat jam tersebut tiba, bot akan mengirimkan pemberitahuan resmi dan langsung mengunci dirinya di grup ini.
├ 💡 Ketik *.kuncibot batal* untuk membatalkan jadwal sewaktu-waktu.
╰─────────────❖`
    }

    return conn.sendMessage(m.chat, { text: pesanKonfirmasi }, { quoted: m })

  } catch (e) {
    console.error("🔐 [KUNCIBOT] Error handleKuncibot:", e.stack || e)
    m.reply("❌ Terjadi kesalahan saat mengatur jadwal kunci bot.")
  }
}

export default handleKuncibot
