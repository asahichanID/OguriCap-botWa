/**
 * OguriCap/plugins/userBackupManager.js
 * -----------------------------------------------------------------------------
 * Plugin Manajemen Backup & Restore Database Pengguna (User & Profile History)
 * 
 * Fitur:
 * 1. .bd / .backdata / .backupdata / .backupdb:
 *    - Khusus menyimpan riwayat user / profile (Level, EXP, Koin/Money, Limit,
 *      VIP, Banned, Inventaris Uma/Item, dsb.) dikemas rapi sebagai file .json.
 *    - Manual: Menampilkan status proses & teks ringkasan lengkap beserta dokumen .json.
 * 2. .impd / .importdata / .restordata:
 *    - Membuka pembungkus file .json backup, membongkar isinya, memulihkan data
 *      ke database user masing-masing seperti biasa & normal, lalu tersimpan permanen.
 * 3. Semi-Otomatis 48 Jam (2 Hari Sekali):
 *    - Otomatis mengekspor data user dan mengirim file .json langsung ke nomor WhatsApp
 *      Owner setiap 48 jam.
 *    - Pengiriman otomatis hanya mengirim FILE .JSON DOKUMEN TANPA TEKS (sesuai instruksi).
 *    - Fleksibel: dapat diaktifkan/dinonaktifkan (.bd auto on / .bd auto off) & cek status (.bd status).
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import moment from 'moment-timezone';
import { getLevelInfo } from '../lib/xpGlobal.js';

// Cache sesi pending import (ketika owner ketik .impd sebelum mengirim file)
const pendingImports = new Map();
const PENDING_TIMEOUT = 5 * 60 * 1000; // 5 menit masa tunggu

export function setPendingImport(jid) {
  if (!jid) return;
  pendingImports.set(jid, Date.now());
}

export function isPendingImport(jid) {
  if (!jid || !pendingImports.has(jid)) return false;
  const time = pendingImports.get(jid);
  if (Date.now() - time > PENDING_TIMEOUT) {
    pendingImports.delete(jid);
    return false;
  }
  return true;
}

export function clearPendingImport(jid) {
  if (jid) pendingImports.delete(jid);
}

/**
 * Mengemas seluruh data dan riwayat profile user menjadi berkas JSON
 * @param {Object} db - global.db
 * @returns {{ buffer: Buffer, fileName: string, totalUsers: number, stats: Object, timeFormatted: string, sizeKb: string }}
 */
export function generateUserBackup(db) {
  const users = db?.users || {};
  const userKeys = Object.keys(users);

  let totalMoney = 0;
  let totalExp = 0;
  let totalVip = 0;
  let totalBanned = 0;
  let totalRegistered = 0;
  let totalUmaCards = 0;

  for (const jid of userKeys) {
    const u = users[jid];
    if (!u || typeof u !== 'object') continue;
    totalMoney += Number(u.money) || 0;
    totalExp += Number(u.exp) || 0;
    if (u.vip) totalVip++;
    if (u.ban) totalBanned++;
    if (u.register) totalRegistered++;
    if (Array.isArray(u.uma)) totalUmaCards += u.uma.length;
  }

  const tz = global.timezone || 'Asia/Jakarta';
  const now = moment().tz(tz);
  const dateStr = now.format('YYYYMMDD_HHmmss');
  const timeFormatted = now.format('DD/MM/YYYY HH:mm:ss') + ' WIB';
  const fileName = `oguricap_backup_users_${dateStr}.json`;

  const payload = {
    app: 'OguriCap-botWa',
    type: 'oguricap_user_backup',
    version: '2.0.0',
    createdAt: now.toISOString(),
    createdAtFormatted: timeFormatted,
    timestamp: Date.now(),
    stats: {
      totalUsers: userKeys.length,
      totalMoney,
      totalExp,
      totalVip,
      totalBanned,
      totalRegistered,
      totalUmaCards
    },
    // Riwayat user dan profile (Level, Koin/Money, Limit, Status, Inventory, dsb.)
    users: users,
    // Data status keanggotaan pengguna
    premium: Array.isArray(db?.premium) ? db.premium : [],
    sewa: Array.isArray(db?.sewa) ? db.sewa : []
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const buffer = Buffer.from(jsonString, 'utf-8');

  return {
    buffer,
    jsonString,
    fileName,
    totalUsers: userKeys.length,
    stats: payload.stats,
    timeFormatted,
    sizeKb: (buffer.length / 1024).toFixed(2)
  };
}

/**
 * Membuka pembungkus file JSON backup dan membongkar datanya ke database bot
 * @param {Object} db - global.db
 * @param {Buffer|string} jsonBufferOrString
 * @returns {Promise<{ success: boolean, totalRestored: number, totalMoney: number, totalExp: number, vipCount: number, backupMeta: Object }>}
 */
export async function restoreUserBackup(db, jsonBufferOrString) {
  let rawStr = '';
  if (Buffer.isBuffer(jsonBufferOrString)) {
    rawStr = jsonBufferOrString.toString('utf-8');
  } else if (typeof jsonBufferOrString === 'string') {
    rawStr = jsonBufferOrString;
  } else {
    throw new Error('Data backup tidak valid (harus berupa buffer berkas atau string JSON).');
  }

  rawStr = rawStr.trim();
  if (rawStr.charCodeAt(0) === 0xFEFF) {
    rawStr = rawStr.slice(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawStr);
  } catch (err) {
    throw new Error(`Berkas bukan format JSON yang valid: ${err.message}`);
  }

  let usersToRestore = null;
  let premiumToRestore = null;
  let backupMeta = null;

  if (parsed && typeof parsed === 'object') {
    if (parsed.type === 'oguricap_user_backup' && parsed.users && typeof parsed.users === 'object') {
      usersToRestore = parsed.users;
      premiumToRestore = parsed.premium;
      backupMeta = {
        version: parsed.version,
        createdAtFormatted: parsed.createdAtFormatted || 'Tidak diketahui',
        stats: parsed.stats || {}
      };
    } else if (parsed.users && typeof parsed.users === 'object') {
      usersToRestore = parsed.users;
      premiumToRestore = parsed.premium;
      backupMeta = {
        version: '1.0.0 (Legacy)',
        createdAtFormatted: 'Arsip Data',
        stats: {}
      };
    } else if (Object.keys(parsed).some(k => k.includes('@s.whatsapp.net') || k.includes('@lid') || /^\d{5,16}/.test(k))) {
      // Struktur langsung dictionary user JID
      usersToRestore = parsed;
      backupMeta = {
        version: 'Direct Map',
        createdAtFormatted: 'Arsip Data',
        stats: {}
      };
    }
  }

  if (!usersToRestore || typeof usersToRestore !== 'object') {
    throw new Error('Tidak ditemukan data riwayat pengguna ("users") di dalam berkas JSON backup.');
  }

  const userEntries = Object.entries(usersToRestore);
  if (userEntries.length === 0) {
    throw new Error('Data pengguna ("users") di dalam berkas JSON backup kosong.');
  }

  if (!db.users) db.users = {};

  let restoredCount = 0;
  let totalMoney = 0;
  let totalExp = 0;
  let vipCount = 0;

  for (const [jid, data] of userEntries) {
    if (!data || typeof data !== 'object') continue;

    let cleanJid = jid;
    if (!cleanJid.includes('@')) {
      cleanJid = cleanJid + '@s.whatsapp.net';
    }

    const existing = db.users[cleanJid] || {};

    // Bongkar pembungkus dan kembalikan semua properti profil ke bentuk normal
    db.users[cleanJid] = {
      ...existing,
      ...data,
      // Pastikan nilai-nilai penting bertipe data aman
      exp: typeof data.exp === 'number' ? data.exp : (typeof existing.exp === 'number' ? existing.exp : 0),
      money: typeof data.money === 'number' ? data.money : (typeof existing.money === 'number' ? existing.money : 0),
      limit: typeof data.limit === 'number' ? data.limit : (typeof existing.limit === 'number' ? existing.limit : 5),
      vip: Boolean(data.vip ?? existing.vip),
      ban: Boolean(data.ban ?? existing.ban),
      name: data.name || existing.name || 'Trainer',
      customName: data.customName || existing.customName || '',
    };

    restoredCount++;
    totalMoney += Number(db.users[cleanJid].money) || 0;
    totalExp += Number(db.users[cleanJid].exp) || 0;
    if (db.users[cleanJid].vip) vipCount++;
  }

  // Restore premium list jika ada di backup
  if (Array.isArray(premiumToRestore) && premiumToRestore.length > 0) {
    if (!Array.isArray(db.premium)) db.premium = [];
    for (const p of premiumToRestore) {
      if (p && p.id && !db.premium.some(x => x.id === p.id)) {
        db.premium.push(p);
      }
    }
  }

  // Sinkronkan ke database penyimpanan lokal / MongoDB
  global._dbDirty = true;
  if (global.database && typeof global.database.write === 'function') {
    try {
      await global.database.write(db);
      global._dbDirty = false;
    } catch (writeErr) {
      console.warn('[USER RESTORE] Gagal menyimpan langsung ke disk database:', writeErr?.message || writeErr);
    }
  }

  return {
    success: true,
    totalRestored: restoredCount,
    totalMoney,
    totalExp,
    vipCount,
    backupMeta
  };
}

/**
 * Inisialisasi scheduler otomatis tiap 48 jam (2 hari sekali)
 * Pengiriman berkas dilakukan secara mandiri ke nomor Owner tanpa pesan teks.
 */
export function initAutoBackup48hScheduler(naze, getDb, getOwnerNumbers) {
  if (global._autoBackup48hTimer) return;

  const INTERVAL_48H_MS = 48 * 60 * 60 * 1000; // 48 Jam (2 Hari)
  const CHECK_INTERVAL_MS = 15 * 60 * 1000; // Periksa setiap 15 menit

  console.log(chalk.greenBright('[AUTO BACKUP 48H] Layanan backup database user otomatis (interval 48 jam) aktif.'));

  global._autoBackup48hTimer = setInterval(async () => {
    try {
      if (!naze || !naze.user) return;
      const db = typeof getDb === 'function' ? getDb() : global.db;
      if (!db || !db.users) return;

      const botNumber = typeof naze.decodeJid === 'function' ? naze.decodeJid(naze.user.id) : (naze.user.id || '');
      const setBot = db.set?.[botNumber] || {};

      // Cek apakah fitur 48h auto-backup diaktifkan (default: true)
      if (setBot.autobackup48h === false) {
        return; // Pemilik menonaktifkan fitur auto 48h
      }

      const lastBackup = Number(setBot.lastAutoBackup48h) || 0;
      const now = Date.now();

      // Jika belum pernah dibackup, set timestamp awal agar mulai menghitung 48 jam dari sekarang
      if (!lastBackup) {
        setBot.lastAutoBackup48h = now;
        global._dbDirty = true;
        return;
      }

      // Periksa apakah sudah mencapai atau melewati batas 48 jam
      if (now - lastBackup >= INTERVAL_48H_MS) {
        const ownerList = typeof getOwnerNumbers === 'function' ? getOwnerNumbers() : (global.owner || []);
        const rawOwner = Array.isArray(ownerList) && ownerList.length > 0 ? ownerList[0] : (global.owner?.[0] || '');
        const cleanOwnerNum = String(rawOwner).replace(/[^0-9]/g, '');

        if (!cleanOwnerNum) {
          console.warn('[AUTO BACKUP 48H] Nomor owner tidak ditemukan untuk pengiriman otomatis.');
          return;
        }

        const ownerJid = cleanOwnerNum + '@s.whatsapp.net';
        const backupResult = generateUserBackup(db);

        console.log(chalk.cyanBright(`[AUTO BACKUP 48H] Memulai pengiriman otomatis berkas ${backupResult.fileName} ke owner ${ownerJid}...`));

        // PENTING: Pengiriman semi-otomatis 48 jam HANYA MENGIRIM FILE .JSON TANPA TEKS
        await naze.sendMessage(ownerJid, {
          document: backupResult.buffer,
          mimetype: 'application/json',
          fileName: backupResult.fileName
        });

        // Catat waktu sukses dan tandai database
        setBot.lastAutoBackup48h = now;
        global._dbDirty = true;
        if (global.database && typeof global.database.write === 'function') {
          global.database.write(db).catch(() => {});
        }

        console.log(chalk.greenBright(`[AUTO BACKUP 48H] Berkas backup user sukses dikirim ke owner ${ownerJid} tanpa teks!`));
      }
    } catch (schedErr) {
      console.error('[AUTO BACKUP 48H ERROR]', schedErr?.message || schedErr);
    }
  }, CHECK_INTERVAL_MS);

  if (global._autoBackup48hTimer?.unref) {
    global._autoBackup48hTimer.unref();
  }
}

/**
 * Handler utama untuk perintah backup (.bd, .backdata, .backup database, dll.)
 */
export async function handleBackupCommand({ naze, m, db, args = [], text = '', isCreator, prefix, command, ownerNumber }) {
  if (!isCreator) return m.reply(global.mess?.owner || '❌ Khusus Head Trainer (Owner)!');

  const sub = (args[0] || '').toLowerCase().trim();
  const botNumber = typeof naze.decodeJid === 'function' ? naze.decodeJid(naze.user.id) : (naze.user.id || '');
  const setBot = db.set?.[botNumber] || {};

  // 1. Opsi konfigurasi auto backup 48 jam (.bd auto on / .bd auto off)
  if (['auto', '48h', 'cron', 'otomatis'].includes(sub)) {
    const subAction = (args[1] || '').toLowerCase().trim();

    if (['on', 'enable', 'aktif', '1', 'true'].includes(subAction)) {
      setBot.autobackup48h = true;
      global._dbDirty = true;
      return m.reply(
        `🟢 *[AUTO BACKUP 48 JAM DIAKTIFKAN]*\n\n` +
        `• *Status:* Aktif ✅\n` +
        `• *Interval:* Tiap 48 Jam (2 Hari Sekali)\n` +
        `• *Penerima:* Chat Pribadi Owner (${Array.isArray(ownerNumber) && ownerNumber[0] ? ownerNumber[0] : 'Owner Utama'})\n` +
        `• *Format:* File Dokumen .JSON dikirim langsung tanpa teks\n\n` +
        `_Bot akan otomatis menjaga database user dan profil agar tidak pernah hilang!_`
      );
    }

    if (['off', 'disable', 'mati', '0', 'false'].includes(subAction)) {
      setBot.autobackup48h = false;
      global._dbDirty = true;
      return m.reply(
        `🔴 *[AUTO BACKUP 48 JAM DINONAKTIFKAN]*\n\n` +
        `Pengiriman otomatis berkas backup setiap 48 jam telah dimatikan.\n` +
        `Anda tetap bisa membuat backup manual kapan saja dengan mengetik:\n` +
        `👉 *${prefix + command}*`
      );
    }

    // Tampilkan status & panduan jika tanpa sub-aksi on/off
    const isAutoActive = setBot.autobackup48h !== false;
    const lastBackupTime = setBot.lastAutoBackup48h
      ? moment(setBot.lastAutoBackup48h).tz(global.timezone || 'Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss') + ' WIB'
      : 'Belum pernah';

    let nextBackupInfo = 'Menunggu siklus';
    if (setBot.lastAutoBackup48h) {
      const nextTimeMs = setBot.lastAutoBackup48h + (48 * 60 * 60 * 1000);
      const remainingMs = Math.max(0, nextTimeMs - Date.now());
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      nextBackupInfo = `${remainingHours} jam ${remainingMins} menit lagi`;
    }

    return m.reply(
      `⚙️ *[PENGATURAN AUTO BACKUP 48 JAM]*\n\n` +
      `• *Status Auto:* ${isAutoActive ? '🟢 Aktif' : '🔴 Nonaktif'}\n` +
      `• *Interval:* 48 Jam (2 Hari)\n` +
      `• *Terakhir Terkirim:* ${lastBackupTime}\n` +
      `• *Jadwal Berikutnya:* ${nextBackupInfo}\n` +
      `• *Karakteristik:* File backup .json dikirim otomatis tanpa teks\n\n` +
      `*Perintah Pengaturan:*\n` +
      `• *${prefix + command} auto on* — Mengaktifkan auto backup\n` +
      `• *${prefix + command} auto off* — Menonaktifkan auto backup\n` +
      `• *${prefix + command}* — Lakukan backup manual sekarang`
    );
  }

  // 2. Opsi cek status (.bd status / .bd info)
  if (['status', 'info', 'cek'].includes(sub)) {
    const isAutoActive = setBot.autobackup48h !== false;
    const userCount = Object.keys(db?.users || {}).length;
    const lastBackupTime = setBot.lastAutoBackup48h
      ? moment(setBot.lastAutoBackup48h).tz(global.timezone || 'Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss') + ' WIB'
      : 'Belum pernah';

    return m.reply(
      `📊 *[STATUS SISTEM BACKUP DATABASE]*\n\n` +
      `• *Total Pengguna Terdaftar:* ${userCount} Trainer\n` +
      `• *Auto Backup 48 Jam:* ${isAutoActive ? '🟢 Aktif (Tiap 2 Hari)' : '🔴 Nonaktif'}\n` +
      `• *Pengiriman Terakhir:* ${lastBackupTime}\n` +
      `• *Mode Pengiriman:* Mandiri (Tanpa teks ke no Owner)\n\n` +
      `_Gunakan *${prefix + command}* untuk mengekspor berkas backup JSON saat ini._`
    );
  }

  // 3. Backup Manual (default) — Memiliki pesan teks proses dan hasil statistik
  try {
    await m.reply(
      `⏳ *[MEMBUAT BACKUP DATABASE USER]*\n\n` +
      `Sedang mengumpulkan seluruh riwayat pengguna (Level, EXP, Koin/Money, Limit, VIP, Banned, Inventaris Uma/Item, dan Profil)...\n` +
      `Mohon tunggu sebentar.`
    );

    const backupData = generateUserBackup(db);

    // Kirim dokumen .json backup ke chat
    await naze.sendMessage(
      m.chat,
      {
        document: backupData.buffer,
        mimetype: 'application/json',
        fileName: backupData.fileName
      },
      { quoted: m }
    );

    // Kirim laporan detail keberhasilan backup
    await m.reply(
      `✅ *[BACKUP USER SELESAI]*\n\n` +
      `📦 *Nama Berkas :* ${backupData.fileName}\n` +
      `👥 *Total User  :* ${backupData.totalUsers.toLocaleString('id-ID')} Trainer\n` +
      `💰 *Total Koin  :* Rp ${backupData.stats.totalMoney.toLocaleString('id-ID')}\n` +
      `⭐ *Total EXP   :* ${backupData.stats.totalExp.toLocaleString('id-ID')} EXP\n` +
      `💎 *Total VIP   :* ${backupData.stats.totalVip} Trainer\n` +
      `🏇 *Total Uma   :* ${backupData.stats.totalUmaCards} kartu\n` +
      `📁 *Ukuran File :* ${backupData.sizeKb} KB\n` +
      `⏰ *Waktu Cetak :* ${backupData.timeFormatted}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *CARA MENGEMBALIKAN (RESTORE) DATA:*\n` +
      `1. Balas (reply) file *.json* di atas lalu ketik:\n` +
      `   👉 *${prefix}impd* atau *${prefix}importdata*\n` +
      `2. Bot akan otomatis membongkar pembungkus JSON dan menyinkronkan seluruh database user kembali normal!\n\n` +
      `_Auto-backup 48 jam: *${prefix + command} auto on/off*_`
    );
  } catch (err) {
    console.error('[BACKUP COMMAND ERROR]', err);
    m.reply(`❌ *Gagal membuat backup database user:* ${err.message}`);
  }
}

/**
 * Handler utama untuk perintah restore / import data (.impd, .importdata)
 */
export async function handleImportCommand({ naze, m, db, args = [], text = '', isCreator, prefix, command, store }) {
  if (!isCreator) return m.reply(global.mess?.owner || '❌ Khusus Head Trainer (Owner)!');

  // Identifikasi target media (apakah dari pesan yang di-reply atau pesan yang sedang dikirim)
  const isQuotedMedia = Boolean(
    m.quoted &&
    (
      m.quoted.isMedia ||
      m.quoted.type === 'documentMessage' ||
      m.quoted.msg?.mimetype?.includes('json') ||
      m.quoted.mime?.includes('json') ||
      (typeof m.quoted.msg?.fileName === 'string' && m.quoted.msg.fileName.toLowerCase().endsWith('.json'))
    )
  );

  const isCurrentMedia = Boolean(
    m.isMedia ||
    m.type === 'documentMessage' ||
    m.msg?.mimetype?.includes('json') ||
    m.mime?.includes('json') ||
    (typeof m.msg?.fileName === 'string' && m.msg.fileName.toLowerCase().endsWith('.json'))
  );

  // Jika tidak ada berkas yang dilampirkan atau di-reply
  if (!isQuotedMedia && !isCurrentMedia) {
    setPendingImport(m.sender);
    return m.reply(
      `📥 *[IMPORT & RESTORE DATABASE USER]*\n\n` +
      `Untuk mengembalikan data riwayat user dari backup:\n\n` +
      `*Cara 1 (Praktis):*\n` +
      `Balas (reply) berkas *.json* hasil backup yang ada di chat ini dengan mengetik:\n` +
      `👉 *${prefix}impd* atau *${prefix}importdata*\n\n` +
      `*Cara 2 (Upload Langsung):*\n` +
      `Kirimkan berkas *.json* sekarang ke chat ini.\n\n` +
      `⏳ *Status Sesi:* Menunggu file .json backup dari Anda (aktif 5 menit)...\n` +
      `_Begitu berkas terkirim, bot akan otomatis membongkar pembungkus JSON dan memulihkan profil, level, serta koin semua user seperti sedia kala!_`
    );
  }

  // Jika ada media dokumen JSON yang ditargetkan
  try {
    clearPendingImport(m.sender);

    await m.reply(
      `⚙️ *[MEMPROSES DOKUMEN BACKUP]*\n\n` +
      `Sedang mengunduh dan memeriksa isi file JSON...\n` +
      `Pembungkus akan segera dibuka dan dibongkar ke database.`
    );

    const target = isQuotedMedia ? m.quoted : m;
    let fileBuffer = null;

    if (typeof target.download === 'function') {
      fileBuffer = await target.download();
    } else if (typeof naze.downloadMediaMessage === 'function') {
      fileBuffer = await naze.downloadMediaMessage(target);
    }

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new Error('Gagal mengunduh berkas dokumen JSON dari server WhatsApp.');
    }

    // Bongkar pembungkus dan masukkan ke database
    const restoreResult = await restoreUserBackup(db, fileBuffer);

    // Beritahukan proses pemulihan selesai
    const metaInfo = restoreResult.backupMeta?.createdAtFormatted
      ? `\n• 📅 Tanggal Arsip : ${restoreResult.backupMeta.createdAtFormatted}`
      : '';

    await m.reply(
      `🎉 *[PEMULIHAN DATABASE SELESAI]*\n\n` +
      `Pembungkus JSON berhasil dibuka dan dibongkar! Seluruh database user (Level, EXP, Koin/Money, Limit, Status VIP, dan Inventaris) telah kembali normal seperti semula.\n\n` +
      `📊 *Rincian Pemulihan:*${metaInfo}\n` +
      `• 👥 User Dipulihkan : ${restoreResult.totalRestored.toLocaleString('id-ID')} Trainer\n` +
      `• 💰 Total Saldo Koin: Rp ${restoreResult.totalMoney.toLocaleString('id-ID')}\n` +
      `• ⭐ Akumulasi EXP  : ${restoreResult.totalExp.toLocaleString('id-ID')} EXP\n` +
      `• 💎 Trainer VIP     : ${restoreResult.vipCount} Akun\n\n` +
      `✅ *Status Sistem:* Sinkronisasi data sukses & tersimpan permanen 100%.`
    );
  } catch (err) {
    console.error('[IMPORT RESTORE ERROR]', err);
    m.reply(`❌ *Gagal memulihkan database dari JSON:* ${err.message}`);
  }
}
