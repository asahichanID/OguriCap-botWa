import { pickRandom, getUmaQuote } from '../lib/helperquotes.js'
import { getYtmp4Thumb } from '../lib/mediahelper.js'
import { handleOguriError } from '../lib/oguri-error.js'
import { convertToMp3 } from './convertManager.js'
import axios from 'axios'

import {
  apiYoutubeDownload,
  apiYoutubeScrapDownload,
  apiTiktokDownload,
  apiTiktokScrapDownload,
  apiSpotifySearch,
  apiSpotifyDownload,
  apiSpotifyScrapSearch,
  apiSpotifyLyrics,
  apiSpotifyScrapTrack,
  apiSpotifyScrapAudio,
  apiInstagramDownload,
  apiInstagramScrapDownload
} from '../apiGlobal/index.js'
// ==============================================
// YTMP3 - Unduh Audio YouTube
// ==============================================
export const ytmp3 = async (naze, m, text) => {
  if (!text) {
    return m.reply(
`Contoh:
.ytmp3 https://youtu.be/xxxx`
    )
  }

  m.react('⏳')

  try {
    const { result } = await apiYoutubeScrapDownload(text, 'mp3')

    if (!result?.download) {
      await m.react('❌')
      return m.reply('❌ Audio tidak ditemukan')
    }

    const audio = await convertToMp3(result.download, `${result.title || 'audio'}.mp3`)

    if (audio?.buffer && audio.buffer.length > 30 * 1024 * 1024) {
      await m.react('⚠️')
      return m.reply(`❌ Ukuran audio (${(audio.buffer.length / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 30MB`)
    }

    await naze.sendMessage(m.chat, {
      audio: audio.buffer,
      mimetype: 'audio/mpeg',
      fileName: audio.filename || `${result.title || 'audio'}.mp3`,
      ptt: false
    }, { quoted: m })

    await m.react('🎧')
    console.log('🎧 YTMP3')
  } catch (err) {
    console.log('❌ YTMP3', err)
    if (err?.message?.includes('30MB')) {
      await m.react('⚠️')
      return m.reply('❌ Ukuran audio melebihi batas maksimal 30MB')
    }
    return handleOguriError({ err, m, naze, command: 'ytmp3', text })
  }
}

console.log('🎧 YTMP3 LOADED')


// ==============================================
// YTMP4 - Unduh Video YouTube
// ==============================================
const ytmp4Session = {}
export const ytmp4 = async (naze, m, text, isPremium = false) => {

  const qualityList = [
    '360',
    '480',
    '720',
    '1080',
    '1440',
    '2k',
    '4k',
    '8k'
  ]

  const premiumQuality = [
    '1440',
    '2k',
    '4k',
    '8k'
  ]

  // ====================
  // MODE BALAS KUALITAS
  // ====================
  if (!text && m.quoted) {
    const session = ytmp4Session[m.sender]
    if (session && m.quoted.text?.includes('𝐏𝐈𝐋𝐈𝐇 𝐐𝐔𝐀𝐋𝐈𝐓𝐘')) {
      text = `${session.url} ${m.text}`
    }
  }

  if (!text) {
    return m.reply(
`Contoh:
.ytmp4 https://youtu.be/xxxx
Atau
.ytmp4 link 720`
    )
  }

  const args = text.trim().split(/\s+/)
  let url = args[0]
  const quality = (args[1] || '').toLowerCase()

  // ====================
  // NORMALISASI TAUTAN
  // ====================
  if (url.includes('/shorts/')) {
    const id = url.match(/shorts\/([^?&]+)/i)
    if (id) url = `https://www.youtube.com/watch?v=${id[1]}`
  }

  if (url.includes('youtu.be/')) {
    const id = url.match(/youtu\.be\/([^?&]+)/i)
    if (id) url = `https://www.youtube.com/watch?v=${id[1]}`
  }

  // ====================
  // PENENTUAN KUALITAS
  // ====================
  if (!quality) {
    ytmp4Session[m.sender] = { url }

    const ytmp4Thumb = getYtmp4Thumb() ?? ''
    
return naze.sendListMsg(m.chat, {
  title: '',
  image: { url: ytmp4Thumb },
  text: `╭─❖「🎥 𝐓𝐑𝐀𝐂𝐄𝐍 𝐕𝐈𝐃𝐄𝐎 」
│
├ 🔗 Video
│ ❍ ${url}
│
├ 📺 Quality
│ ❍ 8 pilihan tersedia
│
├ 🚄 Status
│ ❍ Menunggu pilihan...
│
╰─────────────❖`,

  footer: 'Tracen Video Stage',
  buttons: [{
    name: 'single_select',
    buttonParamsJson: {
      title: '📺 Pilih Quality',
      sections: [{
        title: '🎥 Daftar Resolusi',
        rows: qualityList.map(q => ({
          header: '🎬',
          title: ['2k','4k','8k'].includes(q)
          ? q.toUpperCase()
          : `${q}p`,
            description: premiumQuality.includes(q)
              ? `💎 Premium • ${q.toUpperCase()}`
              : `Download ${q}p`,
          id: `.ytmp4 ${url} ${q}`
        }))
      }]
    }
  }]
}, { quoted: m })

  }

  if (!qualityList.includes(quality)) {
    return m.reply('❌ Quality hanya 360, 480, 720, 1080')
  }
  if (premiumQuality.includes(quality) && !isPremium) {
  return m.reply(
`💎 𝐓𝐑𝐀𝐂𝐄𝐍 𝐏𝐑𝐄𝐌𝐈𝐔𝐌

Resolusi *${quality.toUpperCase()}* hanya tersedia
untuk Trainer Premium.

📺 Free
• 360p
• 480p
• 720p
• 1080p

✨ Premium
• 1440p
• 2K
• 4K
• 8K`)
}

  m.react('⏳')

  try {
    const uma = getUmaQuote()

    let result
    try {
      const res = await apiYoutubeScrapDownload(url, quality)
      result = res.result
    } catch {
      return m.reply('❌ API gagal dihubungi')
    }

    if (!result?.download) {
      return m.reply('❌ Video tidak ditemukan')
    }

    const title = result.title || 'YouTube Video'
    const channel = result.author || '-'
    const views = result.views || 0
    const released = result.ago || '-'

    // ✅ CAPTION DIPERTAHANKAN PERSIS
    const caption =
`╭─❖「 🎥 𝐓𝐑𝐀𝐂𝐄𝐍 𝐕𝐈𝐃𝐄𝐎 𝐒𝐓𝐀𝐆𝐄 🌸 」
│
├ 🎬 Title
│ ❍ ${title}
│
├ 👒 Channel
│ ❍ ${channel}
│
├ 👀 Views
│ ❍ ${Number(views).toLocaleString('id-ID')}
│
├ 📺 Quality
│ ❍ ${['2k', '4k', '8k'].includes(quality) ? quality.toUpperCase() : `${quality}p`}
│
├ 📜 Released
│ ❍ ${released}
╰─────────────❖

💬 ${uma.name}
"${uma.quote}"`

    await naze.sendMessage(m.chat, {
      video: { url: result.download },
      fileName: `${title}.mp4`,
      caption
    }, { quoted: m })
    
    await m.react('✅')
    
    setTimeout(() => {
    delete ytmp4Session[m.sender]
    }, 300000)
    console.log('🎥 YTMP4')

  } catch (err) {
    console.log('❌ YTMP4', err)
    await m.react('❌')
    return handleOguriError({ err, m, naze, command: 'ytmp4', text })
  }
}

console.log('🎥 YTMP4 V1.5 LOADED')

/**
 * Unduh dan validasi buffer video TikTok asli.
 * Mencegah pengiriman file HTML 503/403 atau buffer korup ke WhatsApp.
 * Menjamin file memiliki container MP4 valid (ftyp/moov/mdat) tanpa merusak atau mengompresi kualitas aslinya.
 */
async function downloadValidTikTokVideo(candidates = []) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.tiktok.com/',
    'Accept': '*/*'
  };

  const urls = candidates.filter(u => typeof u === 'string' && u.trim().startsWith('http'));

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers,
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 100 * 1024 * 1024
      });

      if (!res.data) continue;
      const buf = Buffer.from(res.data);

      if (buf.length < 20480) continue;

      const headSample = buf.slice(0, 120).toString().toLowerCase();
      if (
        headSample.includes('<html') ||
        headSample.includes('<!doctype') ||
        headSample.includes('503 service') ||
        headSample.includes('403 forbidden') ||
        headSample.includes('accessdenied')
      ) {
        continue;
      }

      const hasFtyp = buf.slice(4, 8).toString() === 'ftyp' || buf.includes(Buffer.from('ftyp'));
      const hasMoov = buf.includes(Buffer.from('moov'));
      const hasMdat = buf.includes(Buffer.from('mdat'));

      if (hasFtyp || (hasMoov && hasMdat)) {
        return {
          buffer: buf,
          url,
          size: buf.length
        };
      }
    } catch (e) {
      // Coba kandidat berikutnya
    }
  }

  return null;
}

/**
 * Unduh dan validasi buffer audio TikTok MP3/M4A secepat kilat.
 * Mencegah file HTML 503/403 dan memastikan file audio utuh & normal.
 */
async function downloadValidTikTokAudio(candidates = []) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.tiktok.com/',
    'Accept': '*/*'
  };

  const urls = candidates.filter(u => typeof u === 'string' && u.trim().startsWith('http'));

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers,
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 30 * 1024 * 1024
      });

      if (!res.data) continue;
      const buf = Buffer.from(res.data);
      if (buf.length < 2048) continue;

      const headSample = buf.slice(0, 120).toString().toLowerCase();
      if (
        headSample.includes('<html') ||
        headSample.includes('<!doctype') ||
        headSample.includes('503 service') ||
        headSample.includes('403 forbidden') ||
        headSample.includes('accessdenied')
      ) {
        continue;
      }

      return {
        buffer: buf,
        url,
        size: buf.length
      };
    } catch (e) {
      // Coba kandidat berikutnya
    }
  }

  return null;
}

// ==============================================
// TIKTOK - Unduh Video TikTok
// ==============================================
export const tiktok = async (naze, m, text) => {
  if (!text)
    return m.reply(`Contoh:\n.tt https://vt.tiktok.com/xxxx`)

  try {
    m.react('⏳')

    const uma = getUmaQuote()
    const { result } = await apiTiktokScrapDownload(text, { withMetadata: true })
    
    if (!result)
      return m.reply('❌ Video tidak ditemukan')
   
    const images =
  result.images ||
  result.image ||
  result.photos ||
  result.photo ||
  result.download?.images ||
  result.download?.image ||
  []

const photoList = Array.isArray(images)
  ? images
      .map(v =>
        typeof v === 'string'
          ? v
          : v?.url ||
            v?.image ||
            v?.src
      )
      .filter(Boolean)
  : []

    const title =
      result.desc ||
      result.title ||
      result.caption ||
      'Tanpa Judul'

    const authorNickname = (result.author?.nickname || result.author?.name || '').trim()
    const authorUniqueId = (result.author?.uniqueId || result.author?.unique_id || '').replace(/^@/, '').trim()
    let authorName = '-'
    if (authorNickname && authorUniqueId) {
      if (authorNickname.toLowerCase() === authorUniqueId.toLowerCase()) {
        authorName = `@${authorUniqueId}`
      } else {
        authorName = `${authorNickname} (@${authorUniqueId})`
      }
    } else if (authorNickname) {
      authorName = authorNickname
    } else if (authorUniqueId) {
      authorName = `@${authorUniqueId}`
    }

    const parseStat = (val) => {
      if (val === undefined || val === null || val === '') return 0
      if (typeof val === 'number') return isNaN(val) ? 0 : val
      const str = String(val).trim()
      if (/^\d+$/.test(str)) return parseInt(str, 10)
      const match = str.match(/^([\d.,]+)\s*([kKmMbB])?$/)
      if (match) {
        let num = parseFloat(match[1].replace(/,/g, '.'))
        const unit = (match[2] || '').toUpperCase()
        if (unit === 'K') num *= 1000
        else if (unit === 'M') num *= 1000000
        else if (unit === 'B') num *= 1000000000
        return Math.round(num)
      }
      const parsed = parseFloat(str)
      return isNaN(parsed) ? 0 : parsed
    }

    const stats =
      result.stats ??
      result.statistics ??
      result.statistic ??
      result.statsV2 ??
      result.authorStats ??
      result ??
      {}

    const views = parseStat(
      stats.playCount ??
      stats.play_count ??
      stats.views ??
      stats.plays ??
      stats.play ??
      result.playCount ??
      result.views ??
      0
    )

    const likes = parseStat(
      stats.diggCount ??
      stats.digg_count ??
      stats.likes ??
      stats.like ??
      stats.heart ??
      stats.hearts ??
      result.diggCount ??
      result.likes ??
      0
    )

    const comments = parseStat(
      stats.commentCount ??
      stats.comment_count ??
      stats.comments ??
      stats.comment ??
      result.commentCount ??
      result.comments ??
      0
    )

    const shares = parseStat(
      stats.shareCount ??
      stats.share_count ??
      stats.shares ??
      stats.share ??
      result.shareCount ??
      result.shares ??
      0
    )

    const saved = parseStat(
      stats.collectCount ??
      stats.collect_count ??
      stats.saved ??
      stats.save ??
      stats.favorites ??
      stats.favorite ??
      stats.downloads ??
      stats.downloadCount ??
      result.collectCount ??
      result.saved ??
      0
    )

    const formatNumber = value => {
      const num = typeof value === 'number' ? value : parseStat(value)
      if (num <= 0) return '0'
      if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B'
      }
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
      }
      if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
      }
      return Number(num).toLocaleString('id-ID')
    }

    const candidateUrls = [
      result.download?.video?.nowm_hd,
      result.download?.video?.nowm,
      result.download?.video?.wm,
      result.video?.playUrl,
      result.video?.url,
      ...(Array.isArray(result.download?.video?.candidates) ? result.download.video.candidates : [])
    ].filter(Boolean)

    const isPhoto =
      photoList.length > 0

    if (!isPhoto && candidateUrls.length === 0)
      return m.reply(
        '❌ Video tidak ditemukan'
      )

    const caption =
`🎬 *${title}*
👤 *Author:* ${authorName}

📊 *Statistik:*
• 👁️ Views: ${formatNumber(views)}
• ❤️ Likes: ${formatNumber(likes)}
• 💬 Comments: ${formatNumber(comments)}
• 🔄 Shares: ${formatNumber(shares)}
• ⭐ Saved: ${formatNumber(saved)}

🎵 *Audio:* Otomatis dikirim bersamaan ✨`

    // ==============================================
    // 1. TASK PENGIRIMAN MEDIA (VIDEO / FOTO SLIDE)
    // ==============================================
    const sendMediaTask = async () => {
      try {
        if (isPhoto) {
          if (photoList.length === 1) {
            try {
              await naze.sendListMsg(
                m.chat,
                {
                  text: caption,
                  footer: `🛡️ Tiktok • ${global.botname}`,
                  image: {
                    url: photoList[0]
                  },
                  buttons: [
                    {
                      name: 'quick_reply',
                      buttonParamsJson: JSON.stringify({
                        display_text: '🎵 Audio Terkirim Otomatis',
                        id: `.ttmp3 ${text}`
                      })
                    }
                  ]
                },
                {
                  quoted: m
                }
              )
            } catch (e) {
              await naze.sendMessage(
                m.chat,
                {
                  image: { url: photoList[0] },
                  caption
                },
                { quoted: m }
              )
            }
          } else {
            await naze.sendCarouselMsg(
              m.chat,
              caption,
              `🛡️ Oguri Cap • ${global.botname}`,
              photoList.map((url, i) => ({
                url,
                body: `📸 Foto ${i + 1} / ${photoList.length}\n\n🎬 ${title}`,
                footer: global.botname,
                buttons: [
                  {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                      display_text: '🎵 Audio Terkirim Otomatis',
                      id: `.ttmp3 ${text}`
                    })
                  }
                ]
              })),
              {
                quoted: m
              }
            )
          }
        } else {
          // Unduh dan validasi buffer video MP4 asli tanpa re-encoding (kualitas tetap original HD)
          let validVideo = await downloadValidTikTokVideo(candidateUrls)

          // Jika seluruh kandidat scraper utama gagal, coba dari provider backup
          if (!validVideo) {
            try {
              const backup = await apiTiktokDownload(text, { withMetadata: true })
              const backupCandidates = [
                backup.result?.download?.video?.nowm_hd,
                backup.result?.download?.video?.nowm,
                backup.result?.download?.video?.wm
              ].filter(Boolean)
              validVideo = await downloadValidTikTokVideo(backupCandidates)
            } catch (errBackup) {}
          }

          const cleanFileName = (result.author?.nickname || result.author?.name || 'tiktok').replace(/[^\w\s-]/gi, '').trim() || 'tiktok'

          if (validVideo?.buffer) {
            // Kirimkan buffer MP4 asli yang telah tervalidasi via native WhatsApp Video Message
            await naze.sendMessage(
              m.chat,
              {
                video: validVideo.buffer,
                caption,
                mimetype: 'video/mp4',
                fileName: `${cleanFileName}.mp4`
              },
              { quoted: m }
            )
          } else if (candidateUrls[0]) {
            // Fallback ke direct URL jika buffer gagal
            await naze.sendMessage(
              m.chat,
              {
                video: { url: candidateUrls[0] },
                caption,
                mimetype: 'video/mp4',
                fileName: `${cleanFileName}.mp4`
              },
              { quoted: m }
            )
          } else {
            m.reply('❌ Gagal memproses video TikTok. File video tidak dapat diakses atau dibatasi.')
          }
        }
      } catch (errMedia) {
        console.error('❌ Error kirim media TikTok:', errMedia.message)
      }
    }

    // ==============================================
    // 2. TASK PENGIRIMAN AUDIO OTOMATIS (SECEPAT KILAT & NON-BLOCKING)
    // ==============================================
    const sendAudioTask = async () => {
      try {
        const audioCandidates = [
          result.download?.music,
          result.download?.audio,
          result.music?.playUrl,
          result.music?.play_url,
          result.music?.url,
          result.audio
        ].filter(Boolean)

        // Jika belum ada audio URL, coba ambil dari API backup
        if (audioCandidates.length === 0) {
          try {
            const backup = await apiTiktokDownload(text, { withMetadata: false })
            if (backup?.result?.download?.music) audioCandidates.push(backup.result.download.music)
            if (backup?.result?.download?.audio) audioCandidates.push(backup.result.download.audio)
          } catch {}
        }

        if (audioCandidates.length === 0) return

        const audioTitle = (
          result.download?.music_info?.title ||
          result.music?.title ||
          result.music?.name ||
          title ||
          'TikTok Audio'
        ).replace(/[^\w\s-]/gi, '').trim() || 'TikTok Audio'

        // Unduh dan validasi buffer audio secepat kilat
        const validAudio = await downloadValidTikTokAudio(audioCandidates)

        if (validAudio?.buffer) {
          await naze.sendMessage(
            m.chat,
            {
              audio: validAudio.buffer,
              mimetype: 'audio/mpeg',
              fileName: `${audioTitle}.mp3`
            },
            { quoted: m }
          )
        } else if (audioCandidates[0]) {
          // Fallback via URL audio langsung
          await naze.sendMessage(
            m.chat,
            {
              audio: { url: audioCandidates[0] },
              mimetype: 'audio/mpeg',
              fileName: `${audioTitle}.mp3`
            },
            { quoted: m }
          )
        }
      } catch (errAudio) {
        console.warn('⚠️ Gagal mengirim audio TikTok otomatis:', errAudio.message)
      }
    }

    // Jalankan media (video/foto) dan audio secara paralel (bersamaan) tanpa saling membatasi!
    await Promise.allSettled([sendMediaTask(), sendAudioTask()])

    await m.react('✅')

    console.log({
      provider: 'TikTok',
      creator: authorName,
      photo: photoList.length,
      video: !isPhoto && candidateUrls.length > 0,
      likes,
      comments,
      shares,
      views,
      saved
    })

    console.log('🎭 TikTok Success')

  } catch (err) {
    console.error('❌ TT →', err)
    await m.react('❌')
    return handleOguriError({ err, m, naze, command: 'tiktok', text })
  }
}

// ==============================================
// TTMP3 - Unduh Audio TikTok
// ==============================================
export const ttmp3 = async (naze, m, text) => {
  if (!text) {
    return m.reply(
`Contoh:
.ttmp3 https://vt.tiktok.com/xxxx`
    )
  }

  m.react('⏳')

  try {
    const { result } = await apiTiktokScrapDownload(text, { withMetadata: false })
    const audioUrl = result?.download?.music || result?.download?.audio || result?.music?.playUrl || result?.audio

    if (!audioUrl) {
      return m.reply('❌ Audio tidak ditemukan')
    }

    await naze.sendMessage(m.chat, {
      audio: { url: audioUrl },
      mimetype: 'audio/mpeg',
      fileName: `${result?.download?.music_info?.title || result?.music?.title || 'TikTok Audio'}.mp3`
    }, { quoted: m })

    console.log('🎵 TTMP3')
  } catch (err) {
    console.log('❌ TTMP3', err)
    return handleOguriError({ err, m, naze, command: 'ttmp3', text })
  }
}

console.log('🎵 TTMP3 LOADED')

// ==============================================
// IG - Instagram Downloader (Scraper Utama + API Backup)
// ==============================================
const MAX_LIST_MEDIA = 12

export const instagram = async (naze, m, text) => {
    if (!text) return m.reply('Contoh:\n.ig https://www.instagram.com/p/xxxx\n.ig https://www.instagram.com/reel/xxxx')
    if (!/instagram\.com|instagr\.am/i.test(text)) return m.reply('❌ URL Instagram tidak valid.')
        
    try {
        await m.react('⏳')
        const mulai = Date.now()
        const uma = getUmaQuote()
        const { result, provider } = await apiInstagramScrapDownload(text)
        const medias = result?.urls || []

        if (!medias.length) return m.reply('❌ Postingan tidak tersedia, dihapus, atau akun privat!')
        const igCaption = (result.caption || result.title || '').trim()
        const shortTitle = igCaption ? igCaption.slice(0, 100) : 'Instagram Post'
        const speed = Date.now() - mulai

        const caption =
`╭─❖「 📸 𝐈𝐍𝐒𝐓𝐀𝐆𝐑𝐀𝐌 🌸 」
│
├ ✅ Download berhasil
├ 📦 ${medias.length} media
├ ⚡ ${provider || '-'} • ${speed}ms
╰─────────────❖

💬 ${uma.name}
"${uma.quote}"${igCaption ? `\n\n📝 *Caption:*\n${igCaption}` : ''}`

        const videos = medias.filter(v => v.is_video)
        const images = medias.filter(v => !v.is_video)

        // === KONDISI 1: 1 MEDIA SAJA (Single Image / Single Video) ===
        if (medias.length === 1) {
            const media = medias[0]
            if (media.is_video) {
                await naze.sendMessage(
                    m.chat,
                    {
                        video: { url: media.url },
                        mimetype: 'video/mp4',
                        caption
                    },
                    { quoted: m }
                )
            } else {
                await naze.sendMessage(
                    m.chat,
                    {
                        image: { url: media.url },
                        caption
                    },
                    { quoted: m }
                )
            }
        }

        // === KONDISI 2: SEMUA GAMBAR (Carousel Swipable Seperti Pinterest) ===
        else if (!videos.length && images.length > 0) {
            await naze.sendCarouselMsg(
                m.chat,
                caption,
                `🛡️ ${global.botname} • Instagram`,
                images
                    .slice(0, MAX_LIST_MEDIA)
                    .map((img, i) => ({
                        type: 'image',
                        url: img.url,
                        body: `📸 Foto ${i + 1} / ${images.length}\n\n🎬 ${shortTitle}`,
                        footer: `Provider : ${provider || '-'}`,
                        buttons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🎵 Download Audio',
                                    id: `.igaudio ${text}`
                                })
                            }
                        ]
                    })),
                { quoted: m }
            )
        }
        
        // === KONDISI 3: SEMUA VIDEO (Carousel Video) ===
        else if (!images.length && videos.length > 0) {
            await naze.sendCarouselMsg(
                m.chat,
                caption,
                `🛡️ ${global.botname} • Instagram`,
                videos
                    .slice(0, MAX_LIST_MEDIA)
                    .map((vid, i) => ({
                        type: 'video',
                        url: vid.url,
                        body: `🎥 Video ${i + 1} / ${videos.length}\n\n🎬 ${shortTitle}`,
                        footer: `Provider : ${provider || '-'}`,
                        buttons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🎵 Download Audio',
                                    id: `.igaudio ${text}`
                                })
                            }
                        ]
                    })),
                { quoted: m }
            )
        }

        // === KONDISI 4: CAMPURAN VIDEO & FOTO (Video Pertama + Teks Lengkap, Foto Carousel Tanpa Duplikat Teks) ===
        else {
            // 1. Kirim Video Terlebih Dahulu (Video Pertama memuat teks lengkap)
            for (let i = 0; i < videos.length; i++) {
                const vid = videos[i]
                await naze.sendMessage(
                    m.chat,
                    {
                        video: { url: vid.url },
                        mimetype: 'video/mp4',
                        caption: i === 0 ? caption : `🎥 Video ${i + 1} / ${videos.length}`
                    },
                    { quoted: m }
                )
            }

            // 2. Kirim Carousel Foto di Bawahnya (Tanpa teks duplikat pada header carousel)
            if (images.length > 0) {
                await naze.sendCarouselMsg(
                    m.chat,
                    '', // Tanpa duplikasi teks header
                    `🛡️ ${global.botname} • Instagram`,
                    images
                        .slice(0, MAX_LIST_MEDIA)
                        .map((img, i) => ({
                            type: 'image',
                            url: img.url,
                            body: `📸 Foto ${i + 1} / ${images.length}\n\n🎬 ${shortTitle}`,
                            footer: `Provider : ${provider || '-'}`,
                            buttons: [
                                {
                                    name: 'quick_reply',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: '🎵 Download Audio',
                                        id: `.igaudio ${text}`
                                    })
                                }
                            ]
                        })),
                    { quoted: m }
                )
            }
        }

        await m.react('✅')
        console.log(`📸 IG OK (${provider})`)
    } catch (error) {
        console.error('❌ IG →', error)
        await m.react('❌')
        return handleOguriError({ err: error, m, naze, command: 'instagram', text })
    }
}

// ==============================================
// IGAUDIO - Unduh Audio Instagram
// ==============================================
export const igaudio = async (naze, m, text) => {
    if (!text) return m.reply('Contoh:\n.igaudio https://www.instagram.com/reel/xxxx')
    if (!/instagram\.com|instagr\.am/i.test(text)) return m.reply('❌ URL Instagram tidak valid.')

    await m.react('⏳')
    try {
        const { result } = await apiInstagramScrapDownload(text)
        const audioUrl = result?.audio || result?.music

        if (audioUrl) {
            await naze.sendMessage(m.chat, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: `${result?.title || 'Instagram Audio'}.mp3`
            }, { quoted: m })
            await m.react('✅')
            return
        }

        // Jika tidak ada direct audio, ambil video pertama dan convert ke mp3
        const videos = (result?.urls || []).filter(v => v.is_video)
        if (videos.length > 0) {
            const audio = await convertToMp3(videos[0].url, `${result?.title || 'Instagram Audio'}.mp3`)
            if (audio?.buffer) {
                await naze.sendMessage(m.chat, {
                    audio: audio.buffer,
                    mimetype: 'audio/mpeg',
                    fileName: `${result?.title || 'Instagram Audio'}.mp3`
                }, { quoted: m })
                await m.react('✅')
                return
            }
        }

        await m.react('❌')
        return m.reply('❌ Audio tidak ditemukan atau gagal diekstrak dari postingan ini.')
    } catch (err) {
        console.error('❌ IGAUDIO →', err)
        await m.react('❌')
        return handleOguriError({ err, m, naze, command: 'igaudio', text })
    }
}

// ============================================================
// ✅ FUNGSI UTAMA PENCARIAN SPOTIFY — DIPANGGIL OLEH NAZE
// ============================================================
export const cariSpotify = async (conn, m, text) => {
  if (!text) return m.reply(`🎵 Contoh: .spotify yoasobi idol`)

  try {
    m.react('🔍')
    let hasilAkhir = []
    let sumberDipakai = ''

    try {
      const res = await apiSpotifyScrapSearch(text)
      hasilAkhir = res.result || []
      sumberDipakai = res.provider || 'Scraper'
      console.log(`🎵 SPOTIFY SEARCH: Berhasil lewat ${sumberDipakai} (${hasilAkhir.length} lagu)`)
    } catch (errScrap) {
      console.log(`⚠️ SPOTIFY SCRAP SEARCH fallback ke apiSpotifySearch:`, errScrap.message)
      const res = await apiSpotifySearch(text)
      hasilAkhir = res.result || []
      sumberDipakai = res.provider || 'Backup API'
    }

    if (!hasilAkhir.length) {
      return m.reply('❌ Oguri tidak menemukan lagu tersebut! Coba ganti kata kunci ya~')
    }

    // Susun Tombol List yang Estetik dan Informatif
    const rows = hasilAkhir.slice(0, 10).map((lagu, urut) => {
      const title = String(lagu.title || lagu.name || 'Tanpa Judul').trim()
      const artist = String(lagu.artist || lagu.author || 'Spotify Artist').trim()
      const duration = String(lagu.duration || '--:--').trim()
      const url = lagu.url || (lagu.id ? `https://open.spotify.com/track/${lagu.id}` : '')

      return {
        header: `🎵 Track #${urut + 1}`,
        title: title.length > 40 ? `${title.slice(0, 37)}...` : title,
        description: `🎤 ${artist.length > 25 ? artist.slice(0, 22) + '...' : artist} • ⏱️ ${duration}`,
        id: `.spotify_pilih ${url}`
      }
    })

    const teks = [
      `╭───「 🎵 ＳＰＯＴＩＦＹ ＳＥＡＲＣＨ 」`,
      `│ 🔎 *Kata Kunci* : ${text}`,
      `│ 📊 *Ditemukan*  : ${hasilAkhir.length} Lagu`,
      `│ 📡 *Engine*     : ${sumberDipakai.toUpperCase()}`,
      `│ 🐎 *Station*    : Oguri Cap Music Station`,
      `╰──────────────────────────────`,
      ``,
      `💡 *Silakan ketuk tombol di bawah untuk memilih lagu favoritmu!*`
    ].join('\n')

    const thumb = hasilAkhir[0]?.thumbnail || hasilAkhir[0]?.image || 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0'

    try {
      await conn.sendListMsg(m.chat, {
        text: teks,
        image: { url: thumb },
        footer: `🛡️ Oguri Cap Music System • ${global.botname || 'Oguri Cap'}`,
        buttons: [{
          name: 'single_select',
          buttonParamsJson: {
            title: '🎵 PILIH LAGU DISINI',
            sections: [{
              title: '📋 Rekomendasi Lagu Spotify',
              highlight_label: 'PILIHAN UTAMA',
              rows: rows
            }]
          }
        }]
      }, { quoted: m })
    } catch (errList) {
      console.warn('⚠️ sendListMsg gagal, langsung kirim teks ke WA:', errList?.message || errList)
      const listFallback = [
        teks,
        '',
        '📋 *DAFTAR LAGU:*',
        ...rows.map((r, i) => `${i + 1}. *${r.title}*\n   ${r.description}\n   👉 \`${r.id}\``)
      ].join('\n')
      await conn.sendMessage(m.chat, { text: listFallback }, { quoted: m })
    }

  } catch (e) {
    console.error('💥 ERROR CARI SPOTIFY →', e)
    return handleOguriError({ err: e, m, naze: conn, command: 'spotify', text })
  }
}

// ============================================================
// ✅ FUNGSI PENGUNDUH SPOTIFY DENGAN LIRIK, FOTO, STATS & AUDIO
// ============================================================
export const unduhSpotify = async (conn, m, urlLagu) => {
  try {
    m.react('⏳')
    const mulai = Date.now()

    // 1. Eksekusi paralel: Track Metadata + Lirik + Cover Buffer sekaligus Audio Scraper
    const metaLyricsPromise = (async () => {
      let meta = await apiSpotifyScrapTrack(urlLagu)
      // Jika oEmbed / embed belum dapat detail artist, coba fallback ke download API untuk metadata cadangan
      if (!meta.artist || meta.artist === 'Spotify Artist' || !meta.title || meta.title === 'Spotify Track') {
        try {
          const directMeta = await apiSpotifyDownload(urlLagu)
          if (directMeta?.result) {
            meta = {
              ...meta,
              title: directMeta.result.title || meta.title,
              artist: directMeta.result.artist || meta.artist,
              thumbnail: directMeta.result.thumbnail || meta.thumbnail,
              duration: directMeta.result.duration || meta.duration
            }
          }
        } catch (_) {}
      }

      let coverUrl = meta.thumbnail || 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02baf89eb11ec7c657805d2da0'
      if (typeof coverUrl === 'string' && coverUrl.includes('ab67616d0000b273')) {
        // Ganti cover 640x640 (~2MB) ke versi 300x300 (~25KB) agar upload ke WhatsApp secepat kilat
        coverUrl = coverUrl.replace('ab67616d0000b273', 'ab67616d00001e02')
      }

      // Ambil lirik (max 2000ms non-blocking) & unduh cover image buffer secara paralel
      const fetchLyricsFast = Promise.race([
        apiSpotifyLyrics(meta.title, meta.artist, `${meta.title} ${meta.artist}`),
        new Promise(resolve => setTimeout(() => resolve({ hasLyrics: false, lyrics: null }), 2000))
      ]).catch(() => ({ hasLyrics: false, lyrics: null }))

      const [lyricsData, coverBuffer] = await Promise.all([
        fetchLyricsFast,
        (async () => {
          try {
            if (coverUrl && coverUrl.startsWith('http')) {
              const imgRes = await axios.get(coverUrl, {
                responseType: 'arraybuffer',
                timeout: 2000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
              })
              if (imgRes.data && imgRes.data.length > 0) {
                return Buffer.from(imgRes.data)
              }
            }
          } catch (eThumb) {
            console.log('⚠️ Gagal unduh cover Spotify buffer:', eThumb.message)
          }
          return (global.fake?.thumbnail && Buffer.isBuffer(global.fake.thumbnail) && global.fake.thumbnail.length > 0)
            ? global.fake.thumbnail
            : null
        })()
      ])

      return { meta, lyricsData, coverUrl, coverBuffer }
    })()

    const audioPromise = (async () => {
      const stream = await apiSpotifyScrapAudio(urlLagu)
      const filename = stream.filename || `${stream.title || 'track'} - ${stream.artist || 'audio'}.mp3`
      let audioData = null
      try {
        const directAudioUrl = stream.download || stream.url
        if (directAudioUrl) {
          audioData = await convertToMp3(directAudioUrl, filename).catch(err => {
            console.warn('⚠️ Fast convertToMp3 fallback to direct url stream:', err?.message || err)
            return null
          })
        }
      } catch (eConv) {
        console.warn('⚠️ Audio processing fallback:', eConv?.message || eConv)
      }
      return { stream, audioData }
    })()

    // 2. Tunggu metadata, lirik & cover buffer selesai terlebih dahulu (muncul duluan teks + foto)
    const { meta, lyricsData, coverUrl, coverBuffer } = await metaLyricsPromise
    const speed = `${Date.now() - mulai}ms`

    let lyricsDisplay = '_(Lirik tidak tersedia atau lagu berupa instrumen)_'
    if (lyricsData?.hasLyrics && lyricsData.lyrics) {
      // Rapikan lirik menjadi bait-bait yang nyaman dibaca dengan jeda dan penanda bagian
      const rawLines = lyricsData.lyrics
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(l => l.trim())

      const stanzas = []
      let currentStanza = []
      const hasExistingBlankLines = rawLines.some(l => l === '')

      for (const line of rawLines) {
        if (line === '') {
          if (currentStanza.length > 0) {
            stanzas.push(currentStanza)
            currentStanza = []
          }
        } else {
          currentStanza.push(line)
          // Jika dari sumber asli lirik tidak memiliki jeda baris kosong sama sekali (numpuk),
          // pisahkan secara proporsional tiap 4 baris agar tidak menumpuk dan mata tidak lelah
          if (!hasExistingBlankLines && currentStanza.length >= 4) {
            stanzas.push(currentStanza)
            currentStanza = []
          }
        }
      }
      if (currentStanza.length > 0) stanzas.push(currentStanza)

      if (stanzas.length > 0) {
        lyricsDisplay = stanzas.map((stanza, idx) => {
          const lines = stanza.map(l => `> ${l}`).join('\n')
          return `🎶 *[ Bait ${idx + 1} ]*\n${lines}`
        }).join('\n\n')
      } else {
        lyricsDisplay = lyricsData.lyrics.trim()
      }
    }

    const caption = [
      `╭───「 🎧 ＳＰＯＴＩＦＹ ＰＬＡＹＥＲ 」`,
      `│ 🎶 *Judul*       : ${meta.title}`,
      `│ 🎤 *Penyanyi*    : ${meta.artist}`,
      `│ 💿 *Album*       : ${meta.album || meta.title}`,
      `│ ⏱️ *Durasi*      : ${meta.duration || '--:--'}`,
      `│ 📅 *Rilis*       : ${meta.releaseDate || 'Official Track'}`,
      `│ 📊 *Statistik*   : HQ 192kbps • ${speed}`,
      `│ 📡 *Lirik*       : ${lyricsData.source || 'Auto'}`,
      `╰──────────────────────────────`,
      ``,
      `╭───「 📜 ＬＩＲＩＫ  ＬＡＧＵ 」`,
      lyricsDisplay,
      `╰──────────────────────────────`,
      ``,
      `🔗 *Source* : ${urlLagu}`,
      `🐎 *Oguri Cap Track Player* • Mengirim audio...`
    ].join('\n')

    // Kirim Tampilan Foto Cover + Statistik + Lirik Full (Tanpa tombol agar kompatibel di semua client WhatsApp)
    try {
      await conn.sendMessage(
        m.chat,
        {
          image: coverBuffer || { url: coverUrl },
          caption: caption
        },
        { quoted: m }
      )
    } catch (eMsg) {
      console.log('Fallback kirim pesan info Spotify ke text:', eMsg.message)
      await conn.sendMessage(
        m.chat,
        { text: caption },
        { quoted: m }
      )
    }

    // 3. Audio selesai diproses (audio dikirim setelah teks & foto)
    const { stream, audioData } = await audioPromise

    if (!audioData?.buffer && !stream?.download && !stream?.url) {
      throw new Error('Gagal mengekstrak berkas audio Spotify.')
    }

    // Enforce 30MB file size limit
    if (audioData?.buffer && audioData.buffer.length > 30 * 1024 * 1024) {
      await m.react('⚠️')
      return m.reply(`❌ Ukuran audio (${(audioData.buffer.length / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 30MB`)
    }

    // Kirim Audio Spotify (Audio Only agar kompatibel & bisa dilihat oleh semua client)
    await conn.sendMessage(
      m.chat,
      {
        audio: audioData?.buffer ? audioData.buffer : { url: stream.download || stream.url },
        mimetype: 'audio/mpeg',
        fileName: `${meta.title} - ${meta.artist}.mp3`,
        ptt: false
      },
      { quoted: m }
    )

    await m.react('🎧')
    console.log(`✅ Spotify track '${meta.title}' berhasil dikirim (${Date.now() - mulai}ms total)`)

  } catch (e) {
    console.error('💥 ERROR UNDUH SPOTIFY →', e)
    return handleOguriError({ err: e, m, naze: conn, command: 'spotify', text: urlLagu })
  }
}
