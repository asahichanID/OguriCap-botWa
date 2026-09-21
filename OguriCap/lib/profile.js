import { getLevelInfo } from './xpGlobal.js';

// Kumpulan quote pendek/random bertema Oguri Cap (natural/slang, pakai aku/kamu)
const OGURI_QUOTES = [
  'Lari itu sederhana, yang penting kamu gak noleh ke belakang dan terus maju bareng aku!',
  'Habis latihan berat gini enaknya makan 10 mangkok ramen jumbo... Kamu mau nemenin aku makan gak?',
  'Kacamata boleh lepas, tapi tekad buat menang di lintasan gak boleh pudar. Semangat ya, kamu!',
  'Di Kasamatsu dulu aku belajar satu hal: sekeras apapun treknya, kalau kita barengan pasti bisa kita lewatin!',
  'Carrot steak buatan kamu aromanya selalu bikin langkah kakiku makin kencang di trek lari.',
  'Perut kenyang, hati tenang, lari pun kencang! Kamu udah makan belum hari ini?',
  'Kemenangan itu bukan cuma soal piala, tapi tentang seberapa keras usaha kita buat saling percaya.',
  'Kalau kamu merasa lelah, istirahatlah sejenak bareng aku. Nanti kita lanjut lari lagi sampai garis finis!',
  'Rumput di Tracen Academy selalu segar... tapi lebih segar lagi kalau ngeliat kamu tersenyum hari ini.',
  'Jangan biarkan siapapun bilang kamu gak bisa. Buktikan di lintasan kalau kita berdua gak terkalahkan!',
  'Aku gak pernah takut sama lawan sekuat apapun, asalkan ada kamu yang nyemangatin aku di pinggir trek.',
  'Sepatu lari ini saksi perjuangan kita. Selama kamu masih percaya sama aku, aku bakal terus berlari sekuat tenaga!',
  'Satu suapan carrot cake buat tenaga ekstra! Kamu juga jangan lupa jaga kesehatan ya, jangan sampai sakit.',
  'Garis finis itu bukan akhir, tapi awal dari cerita kemenangan kita berikutnya. Ayo melangkah lagi bareng aku!'
];

function getRandomOguriQuote() {
  return OGURI_QUOTES[Math.floor(Math.random() * OGURI_QUOTES.length)];
}

function getFormattedWIB() {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const findPart = (t) => parts.find(p => p.type === t)?.value || '';

  const dayName = findPart('weekday');
  const dayNum = findPart('day');
  const monthName = findPart('month');
  const year = findPart('year');
  const hour = findPart('hour');
  const minute = findPart('minute');
  const second = findPart('second');

  return {
    dateStr: `${dayName}, ${dayNum} ${monthName} ${year}`,
    timeStr: `${hour}:${minute}:${second} WIB`
  };
}

function cleanTargetName(name, jid) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  const phone = (jid || '').split('@')[0].replace(/[^0-9]/g, '');
  if (trimmed.replace(/[^0-9]/g, '') === phone && phone.length > 5) {
    return null;
  }
  return trimmed;
}

function makeProgressBar(percent) {
  const total = 10;
  const filled = Math.min(total, Math.max(0, Math.round((percent / 100) * total)));
  const empty = total - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export const profile = async (
  naze,
  m,
  db,
  premium,
  checkStatus
) => {
  try {
    let target;
    if (m.mentionedJid?.[0]) {
      target = m.mentionedJid[0];
    } else if (m.quoted) {
      target = m.quoted.sender;
    } else {
      target = m.sender;
    }

    if (!db.users) db.users = {};
    if (!db.users[target]) {
      db.users[target] = {
        name: target === m.sender ? m.pushName : 'Trainer',
        customName: '',
        age: '',
        keterangan: '',
        tagTitle: '',
        exp: 0,
        money: 0,
        limit: 5,
        lastFeature: '-'
      };
    }

    const infoUser = db.users[target];

    const isOwner = (global.owner || [])
      .map(v => String(v).replace(/[^0-9]/g, '') + '@s.whatsapp.net')
      .includes(target) || (target === m.sender && m?.key?.fromMe);

    const isPremium = checkStatus ? checkStatus(target, premium) : false;

    let role = '👤 Member';
    if (isOwner) role = '👑 Bot Owner';
    else if (isPremium) role = '⭐ Premium User';
    else if (infoUser.vip) role = '💎 VIP User';

    // 1. Nama Akun WhatsApp / Custom (.setnama)
    let fetchedName = null;
    if (naze?.getName) {
      try {
        fetchedName = await naze.getName(target);
      } catch {}
    }
    const displayName = infoUser.customName ||
      cleanTargetName(infoUser.name, target) ||
      (target === m.sender ? cleanTargetName(m.pushName, target) : null) ||
      cleanTargetName(fetchedName, target) ||
      (target === m.sender ? m.pushName : null) ||
      'Trainer';

    // 2. Umur (.setumur)
    const ageDisplay = infoUser.age ? `${infoUser.age} Tahun` : 'Belum diatur (.setumur)';

    // 3. Keterangan (.setket / .setketerangan)
    const ketDisplay = infoUser.keterangan || infoUser.bio || 'Belum diatur (.setket)';

    // 4. Tag (.settag)
    const tagDisplay = infoUser.tagTitle ? `[ ${infoUser.tagTitle} ]` : 'Belum diatur (.settag)';

    // 5. XP Global & Level
    const levelInfo = getLevelInfo(infoUser.exp || 0);
    const progressBar = makeProgressBar(levelInfo.progressPercent);

    // 6. Last Feature
    const lastFeatureDisplay = infoUser.lastFeature || '-';

    // 7. Waktu WIB & Tanggal Aktual
    const { dateStr, timeStr } = getFormattedWIB();

    // 8. Quote Random Oguri Cap
    const quote = getRandomOguriQuote();

    // Format Caption Profile
    const targetMention = `@${target.split('@')[0]}`;
    const caption = `╭───❖「 👤 𝗨𝗦𝗘𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 👤 」
│
│ 👤 *Nama*       : ${displayName}
│ 📱 *Tag WA*     : ${targetMention}
│ 🏷️ *Tag Khusus* : ${tagDisplay}
│ 🎂 *Umur*       : ${ageDisplay}
│ 📝 *Keterangan* : ${ketDisplay}
│ 🎖️ *Status*     : ${role}
│
├───❖「 📊 𝗦𝗧𝗔𝗧𝗨𝗦 & 𝗚𝗔𝗠𝗘 」
│
│ ⚡ *Level*      : Level ${levelInfo.level}
│ 🔮 *XP*         : ${levelInfo.currentLevelExp.toLocaleString('id-ID')} / ${levelInfo.expNeededForNextLevel.toLocaleString('id-ID')} XP (${levelInfo.progressPercent}%)
│    [${progressBar}]
│ 🥕 *Carrot*     : ${(infoUser.money || 0).toLocaleString('id-ID')} Carats
│ 🎫 *Limit*      : ${infoUser.limit ?? 0} Saldo
│ ⚡ *Last Fitur* : ${lastFeatureDisplay}
│
├───❖「 🕒 𝗜𝗡𝗙𝗢 𝗪𝗔𝗞𝗧𝗨 (𝗪𝗜𝗕) 」
│
│ 📅 *Tanggal*    : ${dateStr}
│ ⏰ *Waktu*      : ${timeStr}
│
├───❖「 🐴 𝗢𝗚𝗨𝗥𝗜 𝗖𝗔𝗣 」
│ ❝ _${quote}_ ❞
╰───────────────────────────❖`;

    // Ambil foto profile target jika tersedia
    let ppUrl = null;
    if (naze?.profilePictureUrl) {
      try {
        ppUrl = await naze.profilePictureUrl(target, 'image');
      } catch {
        ppUrl = null;
      }
    }

    if (ppUrl) {
      return await naze.sendMessage(m.chat, {
        image: { url: ppUrl },
        caption,
        mentions: [target]
      }, { quoted: m });
    }

    return await naze.sendMessage(m.chat, {
      text: caption,
      mentions: [target]
    }, { quoted: m });
  } catch (err) {
    console.error('[PROFILE]', err);
    return m.reply('❌ Gagal memuat profil user.');
  }
};

export const leaderboard = async (naze, m, db, owner) => {
  try {
    let users = Object.entries(db.users || {})
      .map(([id, user]) => {
        const levelInfo = getLevelInfo(user.exp || 0);
        return {
          id,
          money: user.money || 0,
          limit: user.limit || 0,
          level: levelInfo.level
        };
      })
      .sort((a, b) => b.money - a.money)
      .slice(0, 10);

    let teks = `╭─❖「 🏆 𝐓𝐎𝐏 𝐋𝐄𝐀𝐃𝐄𝐑𝐁𝐎𝐀𝐑𝐃 🏆 」
│
│ 💰 *Top 10 Pengguna Terkaya*
│
`;

    for (let i = 0; i < users.length; i++) {
      let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
      let tag = `@${users[i].id.split('@')[0]}`;
      teks += `│ ${medal} *#${i + 1}* ${tag}\n`;
      teks += `│   💰 ${(users[i].money).toLocaleString('id-ID')} Carats | Level ${users[i].level}\n`;
    }

    teks += `│\n╰───────────────────────────❖`;

    return await naze.sendMessage(m.chat, {
      text: teks,
      mentions: users.map(u => u.id)
    }, { quoted: m });
  } catch (err) {
    console.error('[LEADERBOARD]', err);
    return m.reply('❌ Gagal memuat leaderboard.');
  }
};

