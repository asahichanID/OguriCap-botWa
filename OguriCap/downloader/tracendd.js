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
  apiInstagramDownload
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

    const videoUrl =
      result.download?.video?.nowm_hd ||
      result.download?.video?.nowm ||
      result.download?.video?.wm

    const isPhoto =
      photoList.length > 0

    if (!isPhoto && !videoUrl)
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
• ⭐ Saved: ${formatNumber(saved)}`

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
                    display_text: '🎵 Download Audio',
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
              caption: `${caption}\n\n_Ketik *.ttmp3 ${text}* untuk unduh audio._`
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
                  display_text: '🎵 Download Audio',
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
      try {
        await naze.sendListMsg(
          m.chat,
          {
            text: caption,
            footer: `🛡️ Oguri Cap • ${global.botname}`,
            video: {
              url: videoUrl
            },
            fileName: `${result.author?.nickname || 'tiktok'}.mp4`,
            mimetype: 'video/mp4',
            buttons: [
              {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                  display_text: '🎵 Download Audio',
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
            video: { url: videoUrl },
            caption: `${caption}\n\n_Ketik *.ttmp3 ${text}* untuk unduh audio._`,
            mimetype: 'video/mp4'
          },
          { quoted: m }
        )
      }
    }

    await m.react('✅')

    console.log({
      provider: 'TikTok',
      creator: authorName,
      photo: photoList.length,
      video: !!videoUrl,
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
// IG- Instagram Downloader 
// ==============================================
const MAX_LIST_MEDIA = 12
export const instagram = async (naze, m, text) => {
    if (!text) return m.reply('Contoh:\n.ig https://www.instagram.com/...')
    if (!/instagram\.com/i.test(text)) return m.reply('❌ URL Instagram tidak valid.')
        
    try {
        await m.react('⏳')
        const mulai = Date.now()
        const uma = getUmaQuote()
        const { result, provider } = await apiInstagramDownload(text)
        const medias = result?.urls || []

        if (!medias.length) return m.reply('❌ Postingan tidak tersedia atau privat!')
        const igCaption = result.caption || '-'
        const speed = Date.now() - mulai

        const caption =
`╭─❖「 📸 𝐈𝐍𝐒𝐓𝐀𝐆𝐑𝐀𝐌 🌸 」
│
├ ✅ Download berhasil
├ 📦 ${medias.length} media
├ ⚡ ${provider || '-'} • ${speed}ms
╰─────────────❖

💬 ${uma.name}
"${uma.quote}"`

        const videos = medias.filter(v => v.is_video)
        const images = medias.filter(v => !v.is_video)

        // === 1 MEDIA SAJA ===
        if (medias.length === 1) {
            const media = medias[0]
            await naze.sendMessage(
                m.chat,
                media.is_video
                    ? { video: { url: media.url }, mimetype: 'video/mp4', caption }
                    : { image: { url: media.url }, caption },
                { quoted: m }
            )
        }

      // === SEMUA GAMBAR ===
        else if (!videos.length) {
            await naze.sendCarouselMsg(
                m.chat,
                caption,
                '🛡️ Oguri Cap Instagram',
                images
                    .slice(0, MAX_LIST_MEDIA)
                    .map((img, i) => ({
                        type: 'image',
                        url: img.url,
                        body: `📸 Foto ${i + 1}/${images.length}`,
                        footer: `Provider : ${provider || '-'}`,
                        buttons: []
                    })),
                { quoted: m }
            )
        }
        
        // === SEMUA VIDEO ===
        else if (!images.length) {
            await naze.sendCarouselMsg(
                m.chat,
                caption,
                '🛡️ Oguri Cap Instagram',
                videos
                    .slice(0, MAX_LIST_MEDIA)
                    .map((vid, i) => ({
                        type: 'video',
                        url: vid.url,
                        body: `🎥 Video ${i + 1}/${videos.length}`,
                        footer: `Provider : ${provider || '-'}`,
                        buttons: []
                    })),
                { quoted: m }
            )
        }

        // === CAMPURAN VIDEO + GAMBAR ===
        else {
            const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 15)
            global.instagramSession ??= new Map()
            global.instagramSession.set(sessionId, {
                provider,
                caption,
                videos,
                images,
                created: Date.now()
            })

            const rowsVideo = [
            {
                title: '🎥 Ambil Semua Video',
                description: `${videos.length} Video`,
                id: `.igvideoall ${sessionId}`
            },
            ...videos.slice(0, MAX_LIST_MEDIA).map((v, i) => ({
                title: `🎥 Video ${i + 1}`,
                description: 'Kirim video ini',
                id: `.igvideo ${sessionId} ${i}`
            }))
        ]
        
        if (videos.length > MAX_LIST_MEDIA) {
            rowsVideo.push({
                title: '➡️ Lihat Selengkapnya',
                description: `${videos.length - MAX_LIST_MEDIA} video lainnya`,
                id: `.igvideolist ${sessionId} ${MAX_LIST_MEDIA}`
            })
        }
        
        const rowsImage = [
            {
                title: '🖼️ Ambil Semua Gambar',
                description: `${images.length} Gambar`,
                id: `.igimageall ${sessionId}`
            },
            ...images.slice(0, MAX_LIST_MEDIA).map((v, i) => ({
                title: `🖼️ Gambar ${i + 1}`,
                description: 'Kirim gambar ini',
                id: `.igimage ${sessionId} ${i}`
            }))
        ]
        
        if (images.length > MAX_LIST_MEDIA) {
            rowsImage.push({
                title: '➡️ Lihat Selengkapnya',
                description: `${images.length - MAX_LIST_MEDIA} gambar lainnya`,
                id: `.igimagelist ${sessionId} ${MAX_LIST_MEDIA}`
            })
        }
        
            await naze.sendListMsg(
                m.chat,
                {
                    title: '📸 Instagram Downloader',
                    text: caption,
                    footer: '🛡️ Oguri Cap Instagram',
                    buttonText: '📂 Pilih Media',
                    sections: [
                        { title: `🎥 Video (${videos.length})`, rows: rowsVideo },
                        { title: `🖼️ Gambar (${images.length})`, rows: rowsImage }
                    ]
                },
                { quoted: m }
            )
        }

        await m.react('✅')
        console.log(`📸 IG OK (${provider})`)
    } catch (error) {
        console.error('❌ IG →', error)
        await m.react('❌')
        return handleOguriError({ err: error, m, naze, command: 'instagram', text })
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

      // Ambil lirik & unduh cover image buffer secara paralel
      const [lyricsData, coverBuffer] = await Promise.all([
        apiSpotifyLyrics(meta.title, meta.artist, `${meta.title} ${meta.artist}`),
        (async () => {
          try {
            if (coverUrl && coverUrl.startsWith('http')) {
              const imgRes = await axios.get(coverUrl, {
                responseType: 'arraybuffer',
                timeout: 2500,
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
      const filename = stream.filename || 'spotify_track.mp3'
      const audioData = await convertToMp3(stream.download || stream.url, filename)
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
