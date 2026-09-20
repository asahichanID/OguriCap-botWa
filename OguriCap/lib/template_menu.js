import '../settings.js';
import fs from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';
import { getUmaQuote } from './helperquotes.js';

const oguriMenuThumb = fs.existsSync('./src/media/ogurimenu.jpeg')
  ? fs.readFileSync('./src/media/ogurimenu.jpeg')
  : fs.existsSync('./OguriCap/src/media/ogurimenu.jpeg')
  ? fs.readFileSync('./OguriCap/src/media/ogurimenu.jpeg')
  : Buffer.alloc(0);

const oguriCapAudio = fs.existsSync('./src/media/oguricap.mp3')
  ? fs.readFileSync('./src/media/oguricap.mp3')
  : fs.existsSync('./OguriCap/src/media/oguricap.mp3')
  ? fs.readFileSync('./OguriCap/src/media/oguricap.mp3')
  : Buffer.alloc(0);
const __filename = fileURLToPath(import.meta.url);

function getTopMenu(db, prefix, setv) {
  const total = Object.entries(db.hit || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.min(7, Object.keys(db.hit || {}).length))
    .filter(([command]) => command !== 'totalcmd' && command !== 'todaycmd')
    .slice(0, 5);

  let text = `┌── ‹ 🔥 ᴛᴏᴘ ᴄᴏᴍᴍᴀɴᴅs ›\n`;

  if (total.length >= 5) {
    total.forEach(([command, hit]) => {
      text += `│ ▫ ${prefix}${command} ‹${hit} hits›\n`;
    });
    text += '└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ✦';
  } else {
    text += `│ ▫ ${prefix}ai ‹smart ai chat›
│ ▫ ${prefix}brat ‹sticker maker›
│ ▫ ${prefix}tiktok ‹video downloader›
│ ▫ ${prefix}catur ‹3d multiplayer›
│ ▫ ${prefix}tebakbom ‹arcade minigame›
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ✦`;
  }

  return text;
}

function getMenuSections(prefix) {
  return [
    {
      title: '🌟 SEMUA FITUR (ALL MENU)',
      rows: [
        {
          header: '📚',
          title: 'All Menu',
          description: 'Daftar lengkap seluruh command & utilitas bot',
          id: `${prefix}allmenu`
        }
      ]
    },
    {
      title: '🤖 SISTEM & UTILITAS',
      rows: [
        {
          header: '⚡',
          title: 'Bot Menu',
          description: 'Status bot, ping, latency, speed & sistem info',
          id: `${prefix}botmenu`
        },
        {
          header: '🛠️',
          title: 'Tools Menu',
          description: 'Konverter media, HD enhancer, kalkulator, QR, dll',
          id: `${prefix}toolsmenu`
        },
        {
          header: '🔎',
          title: 'Search Menu',
          description: 'Pencarian web, Pinterest, YouTube, lirik & cuaca',
          id: `${prefix}searchmenu`
        },
        {
          header: '🧠',
          title: 'AI Menu',
          description: 'Mahiru Shiina AI, Gemini, Grok, Claude & DeepSeek',
          id: `${prefix}aimenu`
        }
      ]
    },
    {
      title: '👥 GRUP & KOMUNITAS',
      rows: [
        {
          header: '👥',
          title: 'Group Menu',
          description: 'Administrasi grup, antilink, welcome, setting',
          id: `${prefix}groupmenu`
        },
        {
          header: '🕵️',
          title: 'Stalker Menu',
          description: 'Cek profil GitHub, WhatsApp & identitas',
          id: `${prefix}stalkermenu`
        },
        {
          header: '💬',
          title: 'Quotes Menu',
          description: 'Kutipan motivasi, anime, kata bijak & renungan',
          id: `${prefix}quotesmenu`
        },
        {
          header: '🕌',
          title: 'Jadwal Sholat',
          description: 'Pengingat adzan & jadwal ibadah otomatis',
          id: `${prefix}sholat`
        }
      ]
    },
    {
      title: '📥 MEDIA & DOWNLOADER',
      rows: [
        {
          header: '⬇️',
          title: 'Download Menu',
          description: 'Unduh video TikTok, YouTube, Instagram, FB, dll',
          id: `${prefix}downloadmenu`
        },
        {
          header: '🌸',
          title: 'Anime Menu',
          description: 'Info anime terkini, waifu, wallpaper & neko',
          id: `${prefix}animemenu`
        }
      ]
    },
    {
      title: '🎮 HIBURAN & GAMES',
      rows: [
        {
          header: '🎮',
          title: 'Game Menu',
          description: 'Catur 3D realtime, tebak bom, ular tangga & kuis',
          id: `${prefix}gamemenu`
        },
        {
          header: '😂',
          title: 'Fun Menu',
          description: 'Fitur seru, cek khodam, rate, jokes & games teks',
          id: `${prefix}funmenu`
        },
        {
          header: '🎁',
          title: 'Random Menu',
          description: 'Kopi, fakta unik & generator acak harian',
          id: `${prefix}randommenu`
        }
      ]
    },
    {
      title: '🏆 TRACEN ACADEMY & OWNER',
      rows: [
        {
          header: '🏇',
          title: 'Economy Menu',
          description: 'Bank Tracen, transfer saldo, audit & bansos',
          id: `${prefix}economymenu`
        },
        {
          header: '👑',
          title: 'Owner Menu',
          description: 'Panel kontrol & konfigurasi khusus Trainer Utama',
          id: `${prefix}ownermenu`
        }
      ]
    }
  ];
}

function getMenuRows(prefix) {
  return getMenuSections(prefix).flatMap(section => section.rows);
}

function getNativeMenuButton(prefix) {
  const sections = getMenuSections(prefix);
  const params = {
    title: 'TRACEN MENU',
    sections: sections
  };

  return {
    name: 'single_select',
    buttonParamsJson: JSON.stringify(params),
    buttonId: 'tracen_menu',
    buttonText: {
      displayText: 'TRACEN MENU'
    },
    nativeFlowInfo: {
      name: 'single_select',
      paramsJson: JSON.stringify(params)
    },
    type: 2
  };
}

async function setTemplateMenu(
  naze,
  type,
  m,
  prefix,
  setv,
  db,
  options = {}
) {
  const uma = getUmaQuote();
  const topText = getTopMenu(db, prefix, setv);

  const senderNumber = m.sender.split('@')[0];
  const ownerNumber = String(global.owner?.[0] || owner?.[0] || '').replace(/[^0-9]/g, '');
  const botName = db?.set?.[options.botNumber]?.botname || global.botname || 'Oguri Cap';
  const prefixDisplay = db?.set?.[options.botNumber]?.multiprefix
    ? '「 MULTI-PREFIX 」'
    : `[ ${prefix} ]`;
  const userStatus = options.isVip ? '🌟 LEGEND TRAINER' : options.isPremium ? '⭐ SENIOR TRAINER' : '🌱 ROOKIE TRAINER';
  const userLimit = options.isVip ? 'UNLIMITED (VIP)' : `${db.users?.[m.sender]?.limit ?? 0} Tickets`;
  const userCarats = db.users?.[m.sender]?.money ? `${db.users[m.sender].money.toLocaleString('id-ID')} Coins` : '0 Coins';

  const menunya = `┌── ✦ 𝐎𝐆𝐔𝐑𝐈 𝐂𝐀𝐏 ✦ ──┐
│ ᴛʀᴀᴄᴇɴ ᴀᴄᴀᴅᴇᴍʏ ᴀssɪsᴛᴀɴᴛ
└── ─ ─ ─ ─ ─ ─ ─ ─ ──┘

┌─ ‹ ᴛʀᴀɪɴᴇʀ ɪɴꜰᴏ ›
├ ◦ ɴᴀᴍᴇ   : ${m.pushName || 'Trainer'}
├ ◦ ɪᴅ     : @${senderNumber}
├ ◦ ʀᴀɴᴋ   : ${userStatus}
├ ◦ ʟɪᴍɪᴛ  : ${userLimit}
└ ◦ ᴄᴀʀʀᴏᴛ : ${userCarats}

┌─ ‹ ᴀᴄᴀᴅᴇᴍʏ ꜱʏꜱᴛᴇᴍ ›
├ ◦ ᴀssɪsᴛᴀɴᴛ : ${botName}
├ ◦ ᴍᴏᴅᴇ      : ${naze.public ? '🌍 Public Race' : '🏠 Private Training'}
├ ◦ ᴘʀᴇғɪx    : ${prefixDisplay}
├ ◦ ʜᴇᴀᴅ ᴛʀ   : @${ownerNumber}
${options.date ? `├ ◦ ᴅᴀᴛᴇ      : ${options.locale_day ? options.locale_day + ', ' : ''}${options.date}\n` : ''}${options.date_time ? `└ ◦ ᴛɪᴍᴇ      : ${options.date_time}\n` : '└ ◦ sᴛᴀᴛᴜs    : 🟢 Online\n'}
┌─ ‹ ᴜᴍᴀ ᴛᴀʟᴋ ›
│ 💬 *${uma.name}* ${uma.title ? `‹${uma.title}›` : ''}
│ "${uma.quote}"
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ✦`;

  // Standard menu buttons list with TRACEN MENU single_select (Sairidev NativeFlow)
  const menuButtons = [
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: '📚 All Menu',
        id: `${prefix}allmenu`
      }),
      buttonId: `${prefix}allmenu`,
      buttonText: {
        displayText: '📚 All Menu'
      },
      type: 1
    },
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: '👑 Owner',
        id: `${prefix}owner`
      }),
      buttonId: `${prefix}owner`,
      buttonText: {
        displayText: '👑 Owner'
      },
      type: 1
    },
    getNativeMenuButton(prefix)
  ];

  // ==========================================
  // .menu & .menubutton (NYATU: THUMBNAIL + TEKS + BUTTON DALAM 1 PESAN)
  // ==========================================
  if (
    type === 'menu' ||
    type === 'menubutton' ||
    type === 1 ||
    type === 'buttonMessage' ||
    type === 2 ||
    type === 'listMessage'
  ) {
    const greetingText = options.ucapanWaktu ? `🌸 *${options.ucapanWaktu.toUpperCase()}*, Trainer @${senderNumber}!` : `🌸 *SELAMAT DATANG*, Trainer @${senderNumber}!`;
    const fullCaption =
      `${greetingText}\n\n` +
      menunya +
      '\n\n' +
      topText +
      `\n\n💡 *Tekan tombol TRACEN MENU di bawah untuk membuka daftar kategori menu:*`;

    const menuFooter = options.ucapanWaktu
      ? `✨ ${options.ucapanWaktu} • OguriCap MD`
      : 'Tracen Academy Navigation • OguriCap MD';

    const mentionsList = [
      m.sender,
      '0@s.whatsapp.net',
      `${ownerNumber}@s.whatsapp.net`
    ];

    try {
      // Kirim 1 PESAN TUNGGAL: Thumbnail (Header) + Teks (Body) + Button (NativeFlow)
      await naze.sendButtonMsg(
        m.chat,
        {
          image: oguriMenuThumb,
          text: fullCaption,
          caption: fullCaption,
          footer: menuFooter,
          mentions: mentionsList,
          buttons: menuButtons
        },
        { quoted: m }
      );
    } catch (btnErr) {
      console.error('[MENU] Gagal mengirim menu interaktif nyatu, fallback ke sendMessage biasa:', btnErr);
      // Fallback jika pengiriman pesan interaktif gagal
      await naze.sendMessage(
        m.chat,
        {
          image: oguriMenuThumb,
          caption: fullCaption,
          mentions: mentionsList
        },
        { quoted: m }
      );
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Kirim audio sambutan Oguri Cap
    try {
      await naze.sendMessage(
        m.chat,
        {
          audio: oguriCapAudio,
          mimetype: 'audio/mpeg'
        },
        { quoted: m }
      );
    } catch (audioErr) {
      console.error('[MENU] Gagal mengirim audio:', audioErr);
    }

    return;
  }

  // ==========================================
  // FALLBACK
  // ==========================================
  m.reply(
    `${options.ucapanWaktu || ''} @${senderNumber}\n` +
    `Silahkan gunakan ${prefix}menu atau ${prefix}menubutton`
  );
}

export { getNativeMenuButton, getMenuSections, getTopMenu };
export default setTemplateMenu;

fs.watchFile(__filename, async () => {
  fs.unwatchFile(__filename);
  console.log(chalk.yellowBright(`[UPDATE] ${__filename}`));
  await import(`${import.meta.url}?update=${Date.now()}`);
});