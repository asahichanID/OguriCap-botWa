/**
 * OguriCap/plugins/tandai.js
 * =========================================================================
 * Fitur Penanda Target Grup (Silent Tag-All & Re-Appearance Radar)
 * 
 * Fitur:
 *  - Menandai seseorang dengan julukan/label khusus (femboy, jomok/jmk48, atau teks bebas lainnya).
 *  - Teks simpel, gaul, dan proporsional sesuai kategori:
 *    • Femboy: Pesan waspada femboy manis/cantik.
 *    • Jomok / JMK / JMK48: Pesan bahaya tengkorak 💀☠️ waspada bagian belakang / rapatkan shaf.
 *    • Umum / Lainnya: Teks simpel gaul to the point sesuai label.
 *  - Memantau keaktifan target: Jika target hilang >= 30 menit lalu muncul kembali,
 *    bot otomatis melakukan silent tag-all dan menyambut target sesuai julukannya.
 *  - Penyimpanan mandiri dan terpusat di `datatandai.json`.
 *  - Hak akses: Khusus Owner, Premium, atau Admin Grup.
 * =========================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'datatandai.json');
const AWAY_THRESHOLD_MS = 15 * 60 * 1000; // 15 Menit

// In-memory cache
let dataTandai = {};

/**
 * Muat database penandaan dari file JSON
 */
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content.trim()) {
        dataTandai = JSON.parse(content);
        return;
      }
    }
    dataTandai = {};
    saveDatabase();
  } catch (err) {
    console.error('⚠️ [TANDAI] Gagal membaca datatandai.json:', err.message);
    dataTandai = {};
  }
}

/**
 * Simpan database penandaan secara aman (Atomic Write)
 */
function saveDatabase() {
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(dataTandai, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('⚠️ [TANDAI] Gagal menyimpan datatandai.json:', err.message);
  }
}

// Inisialisasi awal
loadDatabase();

/**
 * Bersihkan format JID WhatsApp
 */
export function cleanJid(jid = '') {
  if (!jid || typeof jid !== 'string') return '';
  const clean = jid.trim();
  if (clean.includes('@')) return clean;
  const num = clean.replace(/[^0-9]/g, '');
  return num ? `${num}@s.whatsapp.net` : '';
}

/**
 * Format durasi milidetik menjadi teks bahasa Indonesia gaul
 */
export function formatDuration(ms) {
  if (ms <= 0) return 'sebentar';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const days = Math.floor(totalSeconds / 86400);

  const parts = [];
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  if (parts.length === 0) parts.push(`${totalSeconds} detik`);
  return parts.join(' ');
}

/**
 * Ambil daftar seluruh participant JID untuk keperluan Silent Tag-All
 */
export function getSilentParticipants(groupMetadata) {
  if (!groupMetadata || !Array.isArray(groupMetadata.participants)) return [];
  return groupMetadata.participants.map(p => p.id || p.jid).filter(Boolean);
}

/**
 * Deteksi Kategori Label: 'femboy' | 'jomok' | 'general'
 */
export function detectCategory(label = '') {
  const l = label.toLowerCase();
  if (/jomok|jmk|jmk48|ambas|rusdi|ngawi/i.test(l)) {
    return 'jomok';
  }
  if (/femboy|trap|cantik|imut/i.test(l)) {
    return 'femboy';
  }
  return 'general';
}

/**
 * Cek dan ambil info penandaan user (berdasarkan JID target)
 */
export function getUserTandaiInfo(userJid, chatId = null) {
  const clean = cleanJid(userJid);
  if (!clean) return null;
  if (chatId && dataTandai[chatId]?.[clean]) {
    return { ...dataTandai[chatId][clean], chatId };
  }
  for (const [gid, group] of Object.entries(dataTandai)) {
    if (group && group[clean]) {
      return { ...group[clean], chatId: gid };
    }
  }
  return null;
}

/**
 * Cek apakah user sedang ditandai
 */
export function isUserMarked(userJid, chatId = null) {
  return Boolean(getUserTandaiInfo(userJid, chatId));
}

/**
 * Generator Pesan Saat Seseorang Baru Ditandai (Simple & Gaul)
 */
function generateTandaiAlert(targetJid, label) {
  const targetNum = targetJid.split('@')[0];
  const category = detectCategory(label);

  // 1. Kategori JOMOK / JMK / JMK48 (Waspada Tengkorak 💀☠️)
  if (category === 'jomok') {
    const jomokPool = [
      `☠️ *BAHAYA LEVEL TINGGI!* Si @${targetNum} resmi ditandai sebagai *${label}*! Rapatkan shaf, amankan lobang dan bagian belakang kalian gaes! 💀🏴‍☠️`,
      `💀 *SIAGA SATU!* Waspada ada spesies *${label}* @${targetNum} berkeliaran di grup! Jangan ada yang lengah atau nunduk sembarangan! ☠️💀`,
      `☠️ *RADAR JOMOK AKTIF!* Si @${targetNum} sah menyandang gelar *${label}*! Harap amankan diri masing-masing sebelum terlambat! 💀🔥`
    ];
    return jomokPool[Math.floor(Math.random() * jomokPool.length)];
  }

  // 2. Kategori FEMBOY (Manis & Waspada 💅✨)
  if (category === 'femboy') {
    const femboyPool = [
      `💅 *WASPADA GAES!* Ada femboy manis @${targetNum} yang resmi ditandai sebagai *${label}*! Pasang mata jangan sampe ada yang terpesona atau khilaf! 👀✨`,
      `⚠️ *PERINGATAN!* Si @${targetNum} sah dinobatkan jadi *${label}* di grup ini! Jangan gampang tergoda gaes, pantau terus gerak-geriknya! 💅✨`,
      `✨ *FEMBOY TERDETEKSI!* Si @${targetNum} fix ditandai sebagai *${label}*! Seluruh warga harap waspada tingkat tinggi! 💖👀`
    ];
    return femboyPool[Math.floor(Math.random() * femboyPool.length)];
  }

  // 3. Kategori UMUM / LAINNYA (Simple & Gaul sesuai teks label)
  const generalPool = [
    `📢 *PERHATIAN WARGA!* Si @${targetNum} resmi ditandai sebagai *${label}*! Pantau terus gerak-geriknya gaes! 👀🔥`,
    `📌 *CATAT GAES!* Mulai sekarang si @${targetNum} sah menyandang gelar *${label}* di grup ini! Jangan kasih panggung! 📢⚡`,
    `⚠️ *TARGET DITANDAI!* Si @${targetNum} fix masuk daftar *${label}*! Harap seluruh anggota tetap waspada! 🎯🔥`
  ];
  return generalPool[Math.floor(Math.random() * generalPool.length)];
}

/**
 * Generator Pesan Saat Target Muncul Kembali Setelah >= 30 Menit Hilang
 */
function generateReturnAlert(targetJid, label, awayText) {
  const targetNum = targetJid.split('@')[0];
  const category = detectCategory(label);

  // 1. Kategori JOMOK / JMK / JMK48 (Tengkorak 💀☠️)
  if (category === 'jomok') {
    const jomokReturn = [
      `💀🚨 *DARURAT KEAMANAN!* Makhluk jomok @${targetNum} (*${label}*) balik lagi setelah *${awayText}* ngilang! Awas ada penyerangan mendadak, amankan lobang kalian! ☠️💀`,
      `☠️ *SIAGA SATU!* Si *${label}* @${targetNum} nongol lagi setelah *${awayText}* AFK! Rapatkan barisan, jangan ada yang kasih celah! 💀🏴‍☠️`,
      `💀 *TARGET JOMOK TERDETEKSI!* Si @${targetNum} (*${label}*) akhirnya keluar sarang setelah *${awayText}*! Amankan diri masing-masing gaes! ☠️🔥`
    ];
    return jomokReturn[Math.floor(Math.random() * jomokReturn.length)];
  }

  // 2. Kategori FEMBOY (💅✨)
  if (category === 'femboy') {
    const femboyReturn = [
      `💅 *WOYY LIAT SIAPA YANG NONGOL!* Si femboy kesayangan @${targetNum} (*${label}*) akhirnya ngetik lagi setelah *${awayText}* ngilang! Jangan kasih kendor gaes! ✨👀`,
      `✨ Si *${label}* @${targetNum} kembali ke permukaan setelah *${awayText}* bertapa! Awas pesonanya berbahaya, pantau terus! 💅💖`,
      `💖 *FEMBOY SPOTTED!* Si @${targetNum} (*${label}*) udah aktif lagi di grup setelah *${awayText}* AFK! Sambut gaes! 💅✨`
    ];
    return femboyReturn[Math.floor(Math.random() * femboyReturn.length)];
  }

  // 3. Kategori UMUM / LAINNYA (Simple & Gaul)
  const generalReturn = [
    `📢 *WOYY NONGOL JUGA!* Si @${targetNum} (*${label}*) akhirnya muncul lagi setelah *${awayText}* ngilang! 📢🔥`,
    `👀 *TARGET TERPANTAU AKTIF!* Si *${label}* @${targetNum} baru balik ke grup setelah *${awayText}* AFK! 🎯⚡`,
    `🔊 *LIAT SIAPA YANG BALIK!* Si @${targetNum} (*${label}*) akhirnya ngetik lagi setelah *${awayText}* absen! Hayolo kemana aja lu?! 🤡🔥`
  ];
  return generalReturn[Math.floor(Math.random() * generalReturn.length)];
}

/**
 * Handler Command .tandai <label>
 */
export async function handleTandai(conn, m, args = [], extra = {}) {
  const { isCreator, isPremium, isAdmins, groupMetadata } = extra;

  if (!m.isGroup) {
    return m.reply('❌ Fitur *.tandai* hanya bisa digunakan di dalam grup!');
  }

  // Validasi Hak Akses: Owner, Premium, atau Admin Grup
  if (!isCreator && !isPremium && !isAdmins) {
    return m.reply(
`╭─❖「 🔒 𝐀𝐊𝐒𝐄𝐒 𝐃𝐈𝐓𝐎𝐋𝐀𝐊 🌸 」
│
├ ⚠️ Fitur *.tandai* khusus untuk:
│ • 👑 *Owner Bot*
│ • ⭐ *User Premium*
│ • 🛡️ *Admin Grup*
│
├ 💡 Silakan hubungi Owner / Admin untuk akses.
╰─────────────❖`
    );
  }

  // Dapatkan Target User (dari Reply atau Mention atau Argumen)
  let targetJid = null;
  let labelParts = [...args];

  if (m.quoted && m.quoted.sender) {
    targetJid = cleanJid(m.quoted.sender);
  } else if (m.mentionedJid && m.mentionedJid.length > 0) {
    targetJid = cleanJid(m.mentionedJid[0]);
    labelParts = labelParts.filter(p => !p.startsWith('@') && !targetJid.includes(p.replace(/[^0-9]/g, '')));
  } else if (labelParts.length > 0 && /^\d{10,25}/.test(labelParts[0].replace(/[^0-9]/g, ''))) {
    targetJid = cleanJid(labelParts[0]);
    labelParts.shift();
  }

  if (!targetJid) {
    return m.reply(
`╭─❖「 📌 𝐂𝐀𝐑𝐀 𝐏𝐀𝐊𝐀𝐈 .𝐓𝐀𝐍𝐃𝐀𝐈 🌸 」
│
├ 💡 *Format:*
│ • Reply pesan target: *.tandai <julukan>*
│ • Atau tag target: *.tandai @user <julukan>*
│
├ 📝 *Contoh:*
│ • *.tandai femboy*
│ • *.tandai jomok*
│ • *.tandai jmk48*
│ • *.tandai tukang ngarungin*
│ • *.tandai jamet*
│
├ 🗑️ *Perintah Lain:*
│ • *.untandai* / *.deltandai* (hapus tanda)
│ • *.listtandai* (lihat daftar yang ditandai)
╰─────────────❖`
    );
  }

  // Label Julukan
  let label = labelParts.join(' ').trim();
  if (!label) {
    label = 'Buronan Tongkrongan';
  }

  // Cegah bot menandai dirinya sendiri
  const botNumber = conn.decodeJid(conn.user?.id || '');
  if (targetJid === botNumber) {
    return m.reply('❌ Jangan nandai bot sendiri dong! 🗿');
  }

  const chatId = m.chat;
  dataTandai[chatId] = dataTandai[chatId] || {};

  const now = Date.now();
  dataTandai[chatId][targetJid] = {
    jid: targetJid,
    label,
    markedBy: m.sender,
    markedByName: m.pushName || 'Komandan',
    markedAt: now,
    lastSeen: now,
    lastAlertSent: 0
  };

  saveDatabase();

  // Dapatkan seluruh member untuk Silent Tag-All
  const allParticipants = getSilentParticipants(groupMetadata);
  const mentions = Array.from(new Set([targetJid, ...allParticipants]));

  const alertText = generateTandaiAlert(targetJid, label);

  const formattedMsg =
`╭─❖「 🎯 𝐓𝐀𝐑𝐆𝐄𝐓 𝐃𝐈𝐓𝐀𝐍𝐃𝐀𝐈 🌸 」
│
├ 👤 *Target:* @${targetJid.split('@')[0]}
├ 🏷️ *Julukan:* *${label}*
├ 👮 *Ditandai Oleh:* @${m.sender.split('@')[0]}
╰─────────────❖

${alertText}`;

  return conn.sendMessage(m.chat, {
    text: formattedMsg,
    mentions: mentions
  }, { quoted: m });
}

/**
 * Handler Command .untandai / .deltandai
 */
export async function handleHapusTandai(conn, m, args = [], extra = {}) {
  const { isCreator, isPremium, isAdmins } = extra;

  if (!m.isGroup) {
    return m.reply('❌ Fitur ini hanya bisa digunakan di dalam grup!');
  }

  if (!isCreator && !isPremium && !isAdmins) {
    return m.reply('❌ Khusus Owner, Premium, atau Admin Grup!');
  }

  let targetJid = null;
  if (m.quoted && m.quoted.sender) {
    targetJid = cleanJid(m.quoted.sender);
  } else if (m.mentionedJid && m.mentionedJid.length > 0) {
    targetJid = cleanJid(m.mentionedJid[0]);
  } else if (args.length > 0 && /^\d{10,25}/.test(args[0].replace(/[^0-9]/g, ''))) {
    targetJid = cleanJid(args[0]);
  }

  const chatId = m.chat;
  if (!dataTandai[chatId] || Object.keys(dataTandai[chatId]).length === 0) {
    return m.reply('ℹ️ Belum ada member yang sedang ditandai di grup ini.');
  }

  if (args[0] === 'semua' || args[0] === 'all') {
    const count = Object.keys(dataTandai[chatId]).length;
    delete dataTandai[chatId];
    saveDatabase();
    return m.reply(`✅ Berhasil menghapus ${count} status penandaan di grup ini!`);
  }

  if (!targetJid) {
    return m.reply('💡 Reply pesan target atau tag orangnya: *.untandai @user* atau *.untandai semua*');
  }

  if (!dataTandai[chatId][targetJid]) {
    return m.reply(`ℹ️ User @${targetJid.split('@')[0]} memang tidak sedang ditandai di grup ini.`, {
      mentions: [targetJid]
    });
  }

  const oldLabel = dataTandai[chatId][targetJid].label || 'Buronan';
  delete dataTandai[chatId][targetJid];
  saveDatabase();

  const pesanHapus =
`╭─❖「 🔓 𝐓𝐀𝐍𝐃𝐀 𝐃𝐈𝐂𝐀𝐁𝐔𝐓 🌸 」
│
├ 👤 *User:* @${targetJid.split('@')[0]}
├ 🏷️ *Mantan Julukan:* ~${oldLabel}~
├ ✅ Status penandaan resmi dicabut oleh @${m.sender.split('@')[0]}.
╰─────────────❖`;

  return conn.sendMessage(m.chat, {
    text: pesanHapus,
    mentions: [targetJid, m.sender]
  }, { quoted: m });
}

/**
 * Handler Command .listtandai
 */
export async function handleListTandai(conn, m) {
  if (!m.isGroup) {
    return m.reply('❌ Fitur ini hanya bisa digunakan di dalam grup!');
  }

  const chatId = m.chat;
  const groupTargets = dataTandai[chatId] || {};
  const entries = Object.values(groupTargets);

  if (entries.length === 0) {
    return conn.sendMessage(m.chat, {
      text:
`╭─❖「 📋 𝐃𝐀𝐅𝐓𝐀𝐑 𝐓𝐀𝐑𝐆𝐄𝐓 𝐓𝐀𝐍𝐃𝐀𝐈 🌸 」
│
├ ℹ️ Tidak ada member yang sedang ditandai di grup ini.
├ 💡 Gunakan *.tandai <julukan>* untuk menandai seseorang!
╰─────────────❖`
    }, { quoted: m });
  }

  const now = Date.now();
  let listTeks = '';
  const mentions = [];

  entries.forEach((item, idx) => {
    const targetNum = item.jid.split('@')[0];
    const markerNum = (item.markedBy || '').split('@')[0];
    const elapsed = now - (item.lastSeen || item.markedAt);
    const awayText = formatDuration(elapsed);
    const statusAktif = elapsed >= AWAY_THRESHOLD_MS ? '🔴 AFK (>15m)' : '🟢 Aktif';

    mentions.push(item.jid);
    if (item.markedBy) mentions.push(item.markedBy);

    listTeks += `├ *${idx + 1}.* @${targetNum}\n`;
    listTeks += `│   🏷️ *Julukan:* *${item.label}*\n`;
    listTeks += `│   👮 *Ditandai Oleh:* @${markerNum}\n`;
    listTeks += `│   ⏱️ *Terakhir Aktif:* ${awayText} yang lalu\n`;
    listTeks += `│   📡 *Status:* ${statusAktif}\n`;
    if (idx < entries.length - 1) listTeks += '│\n';
  });

  const fullTeks =
`╭─❖「 📋 𝐃𝐀𝐅𝐓𝐀𝐑 𝐓𝐀𝐑𝐆𝐄𝐓 𝐓𝐀𝐍𝐃𝐀𝐈 🌸 」
│
├ 👥 *Total Ditandai:* ${entries.length} Orang
│
${listTeks}
│
├ 💡 *Catatan:*
│ Jika target AFK > 15 menit lalu muncul kembali,
│ bot otomatis melakukan silent tag-all dan callout!
╰─────────────❖`;

  return conn.sendMessage(m.chat, {
    text: fullTeks,
    mentions: Array.from(new Set(mentions))
  }, { quoted: m });
}

/**
 * Hook Pemeriksaan Pesan Masuk (Deteksi Target Muncul Kembali)
 * Dipanggil secara otomatis pada setiap pesan grup yang masuk di naze.js
 */
export async function checkTandaiOnMessage(conn, m, groupMetadata) {
  try {
    if (!m || !m.isGroup || !m.sender || m.key?.fromMe) return;

    const chatId = m.chat;
    const senderJid = cleanJid(m.sender);

    const groupTargets = dataTandai[chatId];
    if (!groupTargets || !groupTargets[senderJid]) return;

    const targetInfo = groupTargets[senderJid];
    const now = Date.now();
    const lastSeen = targetInfo.lastSeen || targetInfo.markedAt || now;
    const elapsed = now - lastSeen;

    // Jika target sudah menghilang / tidak bersuara selama >= 15 menit
    if (elapsed >= AWAY_THRESHOLD_MS) {
      // Cooldown antar alert kemunculan (minimal 5 menit agar tidak spam jika target ngetik bertubi-tubi)
      const lastAlert = targetInfo.lastAlertSent || 0;
      if (now - lastAlert >= 5 * 60 * 1000) {
        const awayText = formatDuration(elapsed);
        const returnMsg = generateReturnAlert(senderJid, targetInfo.label, awayText);

        const allParticipants = getSilentParticipants(groupMetadata);
        const mentions = Array.from(new Set([senderJid, ...allParticipants]));

        const fullAlert =
`╭─❖「 🚨 𝐓𝐀𝐑𝐆𝐄𝐓 𝐓𝐄𝐑𝐃𝐄𝐓𝐄𝐊𝐒𝐈 𝐊𝐄𝐌𝐁𝐀𝐋𝐈 🌸 」
│
├ 👤 *Target:* @${senderJid.split('@')[0]}
├ 🏷️ *Status:* *${targetInfo.label}*
├ ⏳ *Lama Menghilang:* ${awayText}
╰─────────────❖

${returnMsg}`;

        await conn.sendMessage(chatId, {
          text: fullAlert,
          mentions: mentions
        }, { quoted: m }).catch(() => {});

        targetInfo.lastAlertSent = now;
      }
    }

    // Selalu perbarui lastSeen target
    targetInfo.lastSeen = now;
    saveDatabase();

  } catch (err) {
    console.error('⚠️ [TANDAI HOOK ERROR]:', err.message);
  }
}

export default {
  handleTandai,
  handleHapusTandai,
  handleListTandai,
  checkTandaiOnMessage,
  getUserTandaiInfo,
  isUserMarked,
  detectCategory
};
