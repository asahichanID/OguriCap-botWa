/**
 * OguriCap/plugins/stickerpack.js
 * =========================================================================
 * Fitur Pembuat Sticker Pack Resmi WhatsApp (Multi-Photo to WA Sticker Pack)
 *
 * Fitur Unggulan:
 *  - Mengumpulkan 2 hingga 15 foto dari pengguna dalam satu sesi interaktif.
 *  - Auto-Edit Pesan: Pesan hasil perintah .sp otomatis ter-edit setiap ada
 *    foto baru yang masuk untuk memperbarui jumlah foto terkumpul real-time!
 *  - Konfirmasi Tanpa Reply: Pengguna cukup mengetik "konfirmasi" langsung di chat.
 *  - Verifikasi pembatalan kapan saja ("batal").
 *  - Indikator reaksi waktu (⏳) dan teks status proses estetik.
 *  - Standar Resmi WhatsApp:
 *    • Resolusi 512x512 WebP squared/transparan.
 *    • EXIF chunk metadata seragam (pack_id, packname, author/publisher).
 *    • Pengiriman stiker native berurutan (terikat dalam 1 pack resmi di WA).
 *    • Ekspor file resmi `.wastickers` (kompatibel Sticker Maker & Sticker.ly).
 *  - Perintah / Alias: .sp, .stcp, .stickerpack
 * =========================================================================
 */

import crypto from 'crypto';
import { PassThrough } from 'stream';
import sharp from 'sharp';
import chalk from 'chalk';
import { downloadContentFromMessage } from 'baileys';
import { ZipArchive } from 'archiver';
import { createSticker } from '../lib/sticker/sticker.js';

// Penyimpanan sesi aktif dalam memori: sessionKey -> SessionData
const activeSessions = new Map();

// Penyimpanan cooldown per user: identifier -> expiry timestamp
const userCooldownMap = new Map();

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 15;
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 Menit batas sesi

/**
 * Atur cooldown per user (15 - 20 detik acak)
 */
export function setUserCooldown(senderJid, expiresAt) {
  const cJid = cleanJid(senderJid);
  const num = cJid.split('@')[0];
  if (cJid) userCooldownMap.set(cJid, expiresAt);
  if (num) userCooldownMap.set(num, expiresAt);
}

/**
 * Cek apakah user sedang dalam masa cooldown
 */
export function isUserInCooldown(senderJid, m = null) {
  const now = Date.now();
  const cJid = cleanJid(senderJid);
  const num = cJid.split('@')[0];

  const exp1 = userCooldownMap.get(cJid);
  if (exp1 && now < exp1) return true;

  const exp2 = userCooldownMap.get(num);
  if (exp2 && now < exp2) return true;

  if (m?.key?.participant) {
    const pJid = cleanJid(m.key.participant);
    const pNum = pJid.split('@')[0];
    const expP = userCooldownMap.get(pJid) || userCooldownMap.get(pNum);
    if (expP && now < expP) return true;
  }

  if (m?.key?.fromMe) {
    const expMe = userCooldownMap.get('bot_self');
    if (expMe && now < expMe) return true;
  }

  return false;
}

/**
 * Normalisasi JID WhatsApp (Menghapus suffix device :0, :1 dsb)
 */
export function cleanJid(jid = '') {
  if (!jid || typeof jid !== 'string') return '';
  let clean = jid.trim().toLowerCase();
  if (clean.includes('@')) {
    const [user, domain] = clean.split('@');
    const cleanUser = user.split(':')[0];
    return `${cleanUser}@${domain}`;
  }
  const num = clean.replace(/[^0-9]/g, '');
  return num ? `${num}@s.whatsapp.net` : '';
}

/**
 * Dapatkan sesi sticker pack aktif secara cerdas & kebal variasi JID
 * Mendukung penuh pengujian langsung dari akun bot itu sendiri (Self-Bot / fromMe)
 */
export function getSession(chatId, senderJid, m = null) {
  const cChat = cleanJid(chatId);
  const cSender = cleanJid(senderJid);
  const senderNum = cSender.split('@')[0];
  const isFromMe = Boolean(m?.key?.fromMe || m?.fromMe);

  for (const [key, session] of activeSessions.entries()) {
    if (cleanJid(session.chatId) === cChat) {
      // 1. Dukungan penuh untuk Pengguna Bot Itu Sendiri (Self-Bot / fromMe: true)
      if (isFromMe && session.fromMe) {
        return session;
      }
      // 2. Cek kecocokan JID normal atau nomor pengirim
      if (cleanJid(session.senderJid) === cSender || (senderNum && session.senderNum === senderNum)) {
        return session;
      }
      // 3. Cek kecocokan participant LID atau participantAlt
      if (m?.key?.participant && session.participant && cleanJid(m.key.participant) === cleanJid(session.participant)) {
        return session;
      }
      if (m?.key?.participantAlt && session.participantAlt && cleanJid(m.key.participantAlt) === cleanJid(session.participantAlt)) {
        return session;
      }
      // 4. Jika di chat pribadi (1-on-1): sesi otomatis milik obrolan tersebut
      if (!cChat.endsWith('@g.us')) {
        return session;
      }
    }
  }
  return null;
}

/**
 * Cek apakah user memiliki sesi sticker pack aktif
 */
export function hasStickerPackSession(chatId, senderJid, m = null) {
  return Boolean(getSession(chatId, senderJid, m));
}

/**
 * Hapus sesi sticker pack
 */
export function clearStickerPackSession(chatId, senderJid, m = null) {
  const session = getSession(chatId, senderJid, m);
  if (session) {
    if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
    for (const [key, val] of activeSessions.entries()) {
      if (val === session) {
        activeSessions.delete(key);
      }
    }
  }
}

/**
 * Buat tampilan kartu utama .sp yang bisa di-edit secara dinamis
 */
function buildCardTeks(session) {
  const count = session.photos.length;
  let statusInfo = '';

  if (count >= MAX_PHOTOS) {
    statusInfo = `🔴 *Batas Maksimal (${MAX_PHOTOS} Foto) Terpenuhi!*`;
  } else if (count >= MIN_PHOTOS) {
    statusInfo = `🟢 *Siap Diproses!* (Bisa tambah s/d ${MAX_PHOTOS} foto)`;
  } else {
    statusInfo = `🟡 *Butuh minimal ${MIN_PHOTOS - count} foto lagi*`;
  }

  return `╭─❖「 📦 𝐒𝐓𝐈𝐂𝐊𝐄𝐑 𝐏𝐀𝐂𝐊 𝐌𝐀𝐊𝐄𝐑 🌸 」
│
├ 📸 *Silakan kirim foto-foto yang ingin dijadikan paket stiker!*
│
├ 🏷️ *Nama Paket:* *${session.packName}*
├ ✍️ *Publisher:* *Oguri Cap*
├ 📊 *Ketentuan:* Minimal ${MIN_PHOTOS} & Maksimal ${MAX_PHOTOS} Foto
├ 📸 *Foto Terkumpul:* *${count} / ${MAX_PHOTOS}* Foto
├ 📡 *Status Antrean:* ${statusInfo}
│
├ 📋 *PETUNJUK:*
│ 1️⃣ Kirim foto satu per satu atau sekaligus (bisa ber-caption/tanpa).
│ 2️⃣ Pesan ini *otomatis ter-update* setiap foto baru masuk! 🔄
│ 3️⃣ Jika semua foto sudah dikirim, langsung ketik:
│    👉 *konfirmasi* (tanpa perlu reply)
│ 4️⃣ Bot akan mengirimkan *Paket Stiker Resmi WhatsApp*
│    dengan tombol *[Lihat paket stiker]*! 📦✨
│ 5️⃣ Untuk membatalkan kapan saja, ketik:
│    👉 *batal*
│
├ ⏳ *Waktu Sesi:* 10 Menit
╰─────────────❖`;
}

/**
 * Buat file archive .wastickers resmi (zip berisi WebP, icon tray 96x96, dan file meta)
 */
async function generateWastickersPackage(packName, author, webpBuffers, trayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const zip = new ZipArchive({ zlib: { level: 9 } });
      const passthrough = new PassThrough();
      const chunks = [];

      passthrough.on('data', chunk => chunks.push(chunk));
      passthrough.on('end', () => resolve(Buffer.concat(chunks)));
      passthrough.on('error', reject);

      zip.pipe(passthrough);
      zip.append(packName || 'Sticker Pack', { name: 'title.meta' });
      zip.append(author || 'Oguri Cap', { name: 'author.meta' });

      if (trayBuffer && Buffer.isBuffer(trayBuffer)) {
        zip.append(trayBuffer, { name: 'tray.png' });
      }

      webpBuffers.forEach((buf, idx) => {
        zip.append(buf, { name: `${idx + 1}.webp` });
      });

      zip.finalize();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Buat tray icon resmi WhatsApp (96x96 PNG transparan)
 */
async function generateTrayIcon(firstImageBuffer) {
  try {
    return await sharp(firstImageBuffer)
      .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch (err) {
    console.warn('[STICKERPACK] Gagal membuat tray icon:', err.message);
    return null;
  }
}

/**
 * Inisialisasi atau mulai sesi baru pembuat sticker pack (.sp, .stcp, .stickerpack)
 */
export async function handleStickerPackCommand(naze, m, args = []) {
  const chatId = m.chat;
  const senderJid = m.sender || (m.key?.fromMe ? naze.decodeJid(naze.user?.id) : '');
  const senderNum = cleanJid(senderJid).split('@')[0];

  // 1. Cek Cooldown (15-20 detik acak): Jika cooldown masih ada, DIBIARIN (diam tanpa respon)
  if (isUserInCooldown(senderJid, m)) {
    return;
  }

  // Cek apakah user sudah punya sesi aktif di chat ini
  const existing = getSession(chatId, senderJid, m);
  if (existing) {
    const count = existing.photos.length;
    return m.reply(
`╭─❖「 📦 𝐒𝐄𝐒𝐈 𝐒𝐔𝐃𝐀𝐇 𝐀𝐊𝐓𝐈𝐅 🌸 」
│
├ 👤 *Pembuat:* @${senderNum}
├ 🏷️ *Nama Pack:* ${existing.packName}
├ 📸 *Foto Terkumpul:* *${count} / ${MAX_PHOTOS}* Foto
│
├ 💡 *Petunjuk:*
│ • Kirim foto tambahan untuk dimasukkan ke pack.
│ • Ketik *konfirmasi* untuk langsung memproses (${count >= MIN_PHOTOS ? '✅ Siap diproses' : `⚠️ Butuh minimal ${MIN_PHOTOS - count} foto lagi`}).
│ • Ketik *batal* jika ingin membatalkan dan mulai ulang.
╰─────────────❖`,
      { mentions: [senderJid] }
    );
  }

  // Parse kustom nama pack (contoh: .sp by shiro anna atau .sp Agnes Tachyon)
  // Nama pembuat paten Oguri Cap sesuai permintaan pengguna
  let rawText = args.join(' ').trim();
  let packName = rawText ? rawText.trim() : `Pack by @${senderNum}`;
  const author = 'Oguri Cap';

  const sessionKey = `${cleanJid(chatId)}_${cleanJid(senderJid)}`;
  const packId = `oguri-pack-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const isFromMe = Boolean(m.key?.fromMe || m.fromMe);

  const session = {
    chatId,
    senderJid,
    senderNum,
    fromMe: isFromMe,
    participant: m.key?.participant || '',
    participantAlt: m.key?.participantAlt || '',
    packId,
    packName,
    author,
    photos: [],
    msgKey: null, // Key pesan hasil .sp untuk diedit otomatis
    createdAt: Date.now(),
    lastActivity: Date.now(),
    timeoutTimer: null
  };

  // Auto-cleanup setelah 10 menit jika idle
  session.timeoutTimer = setTimeout(() => {
    if (hasStickerPackSession(chatId, senderJid, m)) {
      clearStickerPackSession(chatId, senderJid, m);
      naze.sendMessage(chatId, {
        text: `⏳ *Sesi Sticker Pack Kedaluwarsa*\nSesi pembuatan sticker pack untuk @${senderNum} telah otomatis dibatalkan karena tidak ada aktivitas selama 10 menit.`,
        mentions: [senderJid]
      }).catch(() => {});
    }
  }, SESSION_TIMEOUT_MS);

  // Periksa apakah perintah ini menyertakan foto langsung atau me-reply sebuah foto
  const quoted = m.quoted;
  const isDirectImage = m.type === 'imageMessage' || m.msg?.mimetype?.startsWith('image/');
  const isQuotedImage = quoted && (quoted.type === 'imageMessage' || quoted.mimetype?.startsWith('image/'));

  if (isDirectImage || isQuotedImage) {
    try {
      const mediaBuf = isDirectImage ? await m.download() : await quoted.download();
      if (mediaBuf && Buffer.isBuffer(mediaBuf) && mediaBuf.length > 0) {
        session.photos.push(mediaBuf);
        session.lastActivity = Date.now();
        console.log(chalk.black.bgMagenta(' [STICKERPACK] ') + chalk.greenBright(` 📸 Foto awal #1/${MAX_PHOTOS} terdeteksi dari ${isFromMe ? 'Bot/Owner (Self)' : '@' + senderNum}`));
      }
    } catch (eMedia) {
      console.warn('[STICKERPACK] Gagal mengunduh foto awal:', eMedia.message);
    }
  }

  activeSessions.set(sessionKey, session);
  console.log(chalk.black.bgMagenta(' [STICKERPACK] ') + chalk.cyanBright(` 🌸 Sesi sticker pack baru dibuka untuk ${isFromMe ? 'Bot/Owner (Self)' : '@' + senderNum} di ${chatId}`));

  const cardTeks = buildCardTeks(session);
  const sent = await naze.sendMessage(chatId, {
    text: cardTeks,
    mentions: [senderJid]
  }, { quoted: m });

  // Simpan key pesan agar bot bisa meng-edit pesan ini setiap kali foto baru masuk
  session.msgKey = sent?.key || null;
  return sent;
}

/**
 * Tangani pesan masuk saat user memiliki sesi sticker pack aktif
 * Mendukung teks "konfirmasi" dan "batal" secara langsung TANPA perlu me-reply bot!
 */
export async function handleStickerPackIncoming(naze, m) {
  if (!m || !m.chat) return false;

  const chatId = m.chat;
  const senderJid = m.sender || (m.key?.fromMe ? naze.decodeJid(naze.user?.id) : '');
  const session = getSession(chatId, senderJid, m);

  if (!session) return false;

  // Ekstraksi teks dari segala tipe pesan
  const rawText = (
    (typeof m.text === 'string' ? m.text : '') ||
    (typeof m.body === 'string' ? m.body : '') ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.msg?.text ||
    m.msg?.caption ||
    ''
  ).trim().toLowerCase();

  const isConfirm = /^(?:[.!#/])?(?:konfirmasi|confirm|proses|lanjut|gas|oke|ok)[.!]?$/i.test(rawText);
  const isCancel = /^(?:[.!#/])?(?:batal|cancel|stop|hapus)[.!]?$/i.test(rawText);

  // 1. OPSI BATALKAN SESI (batal / cancel dsb)
  if (isCancel) {
    clearStickerPackSession(chatId, senderJid, m);
    console.log(chalk.black.bgMagenta(' [STICKERPACK] ') + chalk.yellowBright(` ❌ Sesi sticker pack dibatalkan oleh ${session.fromMe ? 'Bot/Owner (Self)' : '@' + session.senderNum}`));
    await m.reply(
`╭─❖「 ❌ 𝐒𝐄𝐒𝐈 𝐃𝐈𝐁𝐀𝐓𝐀𝐋𝐊𝐀𝐍 🌸 」
│
├ 🗑️ Sesi pembuatan sticker pack berhasil dibatalkan.
├ 💡 Ketik *.sp* untuk memulai sesi baru kapan saja!
╰─────────────❖`
    );
    return true;
  }

  // 2. OPSI KONFIRMASI DAN PROSES (konfirmasi / confirm / proses dsb) — TANPA PERLU REPLY
  if (isConfirm) {
    const totalPhotos = session.photos.length;

    // Validasi Minimal Foto (Minimal 2)
    if (totalPhotos < MIN_PHOTOS) {
      await m.reply(
`╭─❖「 ⚠️ 𝐅𝐎𝐓𝐎 𝐁𝐄𝐋𝐔𝐌 𝐂𝐔𝐊𝐔𝐏 🌸 」
│
├ 📸 *Jumlah Foto Saat Ini:* ${totalPhotos} / ${MAX_PHOTOS}
├ ⚠️ Minimal pembuatan sticker pack adalah *${MIN_PHOTOS} foto*!
│
├ 💡 Silakan kirim minimal *${MIN_PHOTOS - totalPhotos} foto lagi*,
│ lalu langsung ketik *konfirmasi* kembali (tanpa perlu reply).
╰─────────────❖`
      );
      return true;
    }

    console.log(chalk.black.bgMagenta(' [STICKERPACK] ') + chalk.cyanBright(` ⚡ Mengonfirmasi ${totalPhotos} foto, memproses WhatsApp Sticker Pack resmi...`));

    // 1. Pasang reaksi jam pasir (⏳) pada pesan konfirmasi user
    try {
      if (typeof m.react === 'function') {
        await m.react('⏳');
      } else {
        await naze.sendMessage(chatId, { react: { text: '⏳', key: m.key } }).catch(() => {});
      }
    } catch {}

    // 2. Pesan proses simpel & elegan (pesan ini nanti otomatis di-edit sendiri saat selesai)
    const teksProses =
`╭─❖「 ⚙️ 𝐌𝐄𝐌𝐏𝐑𝐎𝐒𝐄𝐒 𝐏𝐀𝐊𝐄𝐓 𝐒𝐓𝐈𝐊𝐄𝐑 🌸 」
│
├ 📦 *Paket:* ${session.packName}
├ 📸 *Jumlah:* ${totalPhotos} Foto
├ ⏳ *Status:* Mengemas stiker ke Paket Resmi WhatsApp...
╰─────────────────────────────❖`;

    // Kirim pesan status proses
    const statusMsg = await m.reply(teksProses);
    const statusKey = statusMsg?.key;

    // Hapus sesi agar tidak tumpang tindih
    clearStickerPackSession(chatId, senderJid, m);

    try {
      // Buat icon tray (96x96 PNG)
      const trayBuffer = await generateTrayIcon(session.photos[0]);

      // Konversi tiap foto menjadi stiker WebP 512x512 resmi dengan metadata seragam
      const webpStickers = [];
      for (let i = 0; i < session.photos.length; i++) {
        try {
          const stickerBuf = await createSticker(session.photos[i], {
            pack_id: session.packId,
            packname: session.packName,
            author: session.author,
            categories: ['🌸', '✨', '📦'],
            command: 'stickerpack'
          });
          if (stickerBuf && Buffer.isBuffer(stickerBuf)) {
            webpStickers.push(stickerBuf);
          }
        } catch (eConv) {
          console.warn(`[STICKERPACK] Gagal konversi foto #${i + 1}:`, eConv.message);
        }
      }

      if (webpStickers.length === 0) {
        throw new Error('Gagal mengonversi foto-foto menjadi stiker.');
      }

      // 1. Siapkan data stiker untuk Paket Resmi WhatsApp (stickerPackMessage)
      const packStickers = webpStickers.map((buf, idx) => ({
        data: buf,
        emojis: ['🌸', '✨', '📦'],
        accessibilityLabel: `${session.packName} #${idx + 1}`
      }));

      // 2. Siapkan cover paket stiker (foto pertama 512x512 WebP)
      let coverBuffer = null;
      try {
        coverBuffer = await sharp(session.photos[0])
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 80 })
          .toBuffer();
      } catch {
        coverBuffer = webpStickers[0];
      }

      // 3. Kirim Paket Stiker Resmi WhatsApp (stickerPackMessage)
      // Pesan ini menampilkan kartu paket dengan preview grid 2x2, Judul, Publisher, dan tombol [Lihat paket stiker]
      let sentPack = null;
      try {
        sentPack = await naze.sendMessage(chatId, {
          stickers: packStickers,
          cover: coverBuffer,
          name: session.packName,
          publisher: 'Oguri Cap',
          description: `Pack resmi ${session.packName} dibuat oleh Oguri Cap Bot`
        }, { quoted: m });
        console.log(chalk.black.bgMagenta(' [STICKERPACK] ') + chalk.greenBright(` 📦 Berhasil mengirim Paket Stiker Resmi WhatsApp (${packStickers.length} stiker) ke ${chatId}`));
      } catch (ePackSend) {
        console.error('[STICKERPACK] Gagal mengirim paket stiker resmi via sendMessage:', ePackSend);
        // Fallback jika socket mengalami kendala upload pack ke server WA
        for (let i = 0; i < webpStickers.length; i++) {
          await naze.sendMessage(chatId, {
            sticker: webpStickers[i]
          }, { quoted: i === 0 ? m : undefined });
          await new Promise(res => setTimeout(res, 250));
        }
      }

      // Pasang reaksi centang hijau (✅) pada pesan konfirmasi user
      try {
        if (typeof m.react === 'function') {
          await m.react('✅');
        } else {
          await naze.sendMessage(chatId, { react: { text: '✅', key: m.key } }).catch(() => {});
        }
      } catch {}

      // Hitung Cooldown acak 15-20 detik per user
      const cdSeconds = Math.floor(Math.random() * 6) + 15; // 15, 16, 17, 18, 19, atau 20 detik
      const cdExpiresAt = Date.now() + (cdSeconds * 1000);
      setUserCooldown(senderJid, cdExpiresAt);
      if (session.fromMe || m?.key?.fromMe) {
        userCooldownMap.set('bot_self', cdExpiresAt);
      }
      console.log(chalk.black.bgMagenta(' [STICKERPACK] ') + chalk.yellowBright(` ⏳ Cooldown diaktifkan untuk user: ${cdSeconds}s`));

      // Kartu Selesai Simpel & Elegan (Menggabungkan pesan status proses -> selesai secara otomatis via edit)
      const teksSelesai =
`╭─❖「 ✨ 𝐏𝐀𝐊𝐄𝐓 𝐒𝐓𝐈𝐊𝐄𝐑 𝐒𝐄𝐋𝐄𝐒𝐀𝐈 🌸 」
│
├ 📦 *Paket:* ${session.packName}
├ 👤 *Publisher:* Oguri Cap
├ 📸 *Jumlah:* ${webpStickers.length} Stiker
├ ⏳ *Cooldown:* ${cdSeconds}s
│
├ 💡 Ketuk tombol *[Lihat paket stiker]* pada
│    pesan di atas untuk menyimpannya! ⭐
╰─────────────────────────────❖`;

      // Otomatis edit pesan status proses menjadi teks selesai tanpa spam pesan baru!
      if (statusKey) {
        await naze.sendMessage(chatId, {
          text: teksSelesai,
          edit: statusKey
        }).catch(() => {});
      } else {
        await m.reply(teksSelesai);
      }

    } catch (errProc) {
      console.error('[STICKERPACK ERROR]:', errProc);
      await m.reply(`❌ Terjadi kendala saat memproses sticker pack: ${errProc.message || errProc}`);
    }

    return true;
  }

  // 3. MENERIMA FOTO BARU
  const isImage = Boolean(
    m.type === 'imageMessage' ||
    m.msg?.mimetype?.startsWith('image/') ||
    m.mime?.startsWith('image/') ||
    (m.isMedia && (m.msg?.mimetype?.startsWith('image/') || m.mime?.startsWith('image/'))) ||
    m.message?.imageMessage ||
    m.message?.ephemeralMessage?.message?.imageMessage ||
    m.message?.viewOnceMessage?.message?.imageMessage ||
    m.message?.viewOnceMessageV2?.message?.imageMessage ||
    m.message?.viewOnceMessageV2Extension?.message?.imageMessage ||
    m.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype?.startsWith('image/')
  );

  if (isImage) {
    // Cek batas maksimum (15 Foto)
    if (session.photos.length >= MAX_PHOTOS) {
      await m.reply(
`╭─❖「 ⚠️ 𝐁𝐀𝐓𝐀𝐒 𝐌𝐀𝐊𝐒𝐈𝐌𝐀𝐋 🌸 」
│
├ 📦 Kuota maksimal *${MAX_PHOTOS} foto* sudah terpenuhi!
├ 💡 Ketik *konfirmasi* untuk langsung membuat sticker pack.
╰─────────────❖`
      );
      return true;
    }

    try {
      let mediaBuf = null;

      // 1. Coba download via m.download()
      if (typeof m.download === 'function') {
        try {
          mediaBuf = await m.download();
        } catch (eDown1) {
          mediaBuf = null;
        }
      }

      // 2. Coba download via naze.downloadMediaMessage
      if ((!mediaBuf || !Buffer.isBuffer(mediaBuf) || mediaBuf.length === 0) && naze?.downloadMediaMessage) {
        try {
          mediaBuf = await naze.downloadMediaMessage(m);
        } catch (eDown2) {
          mediaBuf = null;
        }
      }

      // 3. Fallback langsung ekstraksi objek imageMessage & stream downloadContentFromMessage
      if (!mediaBuf || !Buffer.isBuffer(mediaBuf) || mediaBuf.length === 0) {
        const rawImg = m.msg?.imageMessage || m.msg || m.message?.imageMessage || m.message?.ephemeralMessage?.message?.imageMessage || m.message?.viewOnceMessage?.message?.imageMessage || m.message?.viewOnceMessageV2?.message?.imageMessage;
        if (rawImg && (rawImg.mediaKey || rawImg.url)) {
          try {
            const stream = await downloadContentFromMessage(rawImg, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            mediaBuf = Buffer.concat(chunks);
          } catch (eStream) {
            mediaBuf = null;
          }
        }
      }

      if (mediaBuf && Buffer.isBuffer(mediaBuf) && mediaBuf.length > 0) {
        session.photos.push(mediaBuf);
        session.lastActivity = Date.now();

        // LOG KONSOL RESMI AGAR SELALU TERPANTAU DI PTERODACTYL
        console.log(chalk.black.bgMagenta(' [STICKERPACK] ') + chalk.greenBright(` 📸 Foto #${session.photos.length}/${MAX_PHOTOS} berhasil dibaca & disimpan dari ${session.fromMe ? 'Bot/Owner (Self)' : '@' + session.senderNum} di ${chatId}`));

        // Refresh timeout timer 10 menit
        if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
        session.timeoutTimer = setTimeout(() => {
          if (hasStickerPackSession(chatId, senderJid, m)) {
            clearStickerPackSession(chatId, senderJid, m);
          }
        }, SESSION_TIMEOUT_MS);

        // 1. React kamera 📸 pada foto yang dikirim
        try {
          if (typeof m.react === 'function') {
            await m.react('📸');
          } else {
            await naze.sendMessage(chatId, { react: { text: '📸', key: m.key } }).catch(() => {});
          }
        } catch {}

        // 2. Edit pesan .sp awal secara otomatis untuk memperbarui nilai foto terkumpul
        if (session.msgKey) {
          const updatedCard = buildCardTeks(session);
          await naze.sendMessage(chatId, {
            text: updatedCard,
            edit: session.msgKey
          }).catch(errEdit => {
            console.warn('[STICKERPACK] Gagal meng-edit pesan .sp:', errEdit?.message || errEdit);
          });
        }

        return true;
      }
    } catch (errDown) {
      console.warn('[STICKERPACK] Gagal mengunduh foto:', errDown.message);
      await m.reply('❌ Gagal mengunduh foto yang dikirim. Silakan coba kirim ulang fotonya.');
      return true;
    }
  }

  return false;
}

export default {
  handleStickerPackCommand,
  handleStickerPackIncoming,
  hasStickerPackSession,
  getSession,
  clearStickerPackSession,
  isUserInCooldown,
  setUserCooldown
};
