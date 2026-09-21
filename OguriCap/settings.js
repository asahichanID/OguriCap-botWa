import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
	* Create By Naze
	* Follow https://github.com/nazedev
	* Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
*/

//~~~~~~~~~~~~< GLOBAL SETTINGS >~~~~~~~~~~~~\\

global.owner = ['6281563808289'] // ['628','628'] 2 owner atau lebih
global.author = 'Shiro'
global.botname = 'Oguri Cap'
global.packname = '✦ 𝐎𝐠𝐮𝐫𝐢 𝐂𝐚𝐩'
global.timezone = 'Asia/Jakarta' // Ganti pakai command .settimezone
global.locale = 'en' // Ganti pakai command .setlocale
global.listprefix = ['+','!','.']

global.listv = ['•','●','■','✿','▲','➩','➢','➣','➤','✦','✧','△','❀','○','□','♤','♡','◇','♧','々','〆']
global.tempatDB = 'database.json' // Taruh url mongodb di sini jika menggunakan mongodb. Format : 'mongodb+srv://...'
global.tempatStore = 'baileys_store.json' // Taruh url mongodb di sini jika menggunakan mongodb. Format : 'mongodb+srv://...'
global.pairing_code = true
global.number_bot = '' // Kalo pake panel bisa masukin nomer di sini, jika belum ambil session. Format : '628xx'
global.custom_pairing_code = '' // Kosongkan agar menggunakan kode pairing standar resmi Baileys (paling stabil & kompatibel)

const thumbPath = path.join(__dirname, 'src/media/naze.png');
const fakePdfPath = path.join(__dirname, 'src/media/fake.pdf');

global.fake = {
	anonim: 'https://telegra.ph/file/95670d63378f7f4210f03.png',
	thumbnailUrl: 'https://telegra.ph/file/fe4843a1261fc414542c4.jpg',
	thumbnail: fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : Buffer.alloc(0),
	docs: fs.existsSync(fakePdfPath) ? fs.readFileSync(fakePdfPath) : Buffer.alloc(0),
	listfakedocs: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf'],
}

global.my = {
    sc: 'https://github.com/nazedev/hitori',
	yt: 'https://youtube.com/lynzzofficial',
	gh: 'https://github.com/nazedev',
	sc: 'https://github.com/nazedev/hitori',
	gc: 'https://chat.whatsapp.com/KX6Tiq35hBdBpRpKJQQ0pf',
	ch: '120363405828268965@newsletter',
}

global.limit = {
	free: 5,
	premium: 500,
	vip: 900
}

global.money = {
	free: 10000,
	premium: 1000000,
	vip: 10000000
}

global.mess = {
	key: "Apikey limit! Silahkan Upgrade: https://naze.biz.id",
	owner: "Khusus Owner!",
	admin: "Khusus Admin!",
	botAdmin: "Bot harus Admin!",
	onWa: "Nomor tersebut tidak terdaftar di WhatsApp!",
	group: "Khusus Grup!",
	private: "Khusus Private Chat!",
	quoted: "Reply pesannya!",
	limit: `🥕 *Oguri Cap:*
"Haaah... Nafasku habis, Trainer... Energiku (limit) untukmu hari ini sudah habis! 🍚
Aku harus istirahat dan makan wortel dulu... 🥕
Limit harianmu (5 limit) akan terisi kembali besok pukul 00:00 WIB, atau Trainer bisa upgrade ke VIP untuk akses tanpa batas!"`,
	prem: "Khusus Premium!",
	text: "Masukkan teksnya!",
	media: "Kirim medianya!",
	wait: "Proses...",
	fail: "Gagal!",
	error: "Error!",
	done: "Selesai!"
}

global.APIs = {
	naze: 'https://api.naze.biz.id',
	neosantara: 'https://api.neosantara.xyz/v1',
}
global.APIKeys = {
	'https://api.naze.biz.id': 'nz-880c23d4fd',
	'https://api.neosantara.xyz/v1': 'API_KEY_NEOSANTARA_AI',
}

//~~~~~~~~~~~~< MAHIRU SHIINA AI (SETTINGS) >~~~~~~~~~~~~\\
/*
 * PENGATURAN API AI KARAKTER MAHIRU SHIINA:
 * 
 * 1. Pake API Pihak Ketiga (Custom API URL):
 *    - Tempel URL API di 'apiUrl'. Sangat fleksibel!
 *    - Bisa URL GET langsung (contoh: 'https://api.ryzendesu.vip/api/ai/gpt4o?text=')
 *    - Bisa URL dengan placeholder (contoh: 'https://api.example.com/chat?text={prompt}')
 *    - Bisa endpoint OpenAI-compatible (contoh: 'https://api.groq.com/openai/v1/chat/completions')
 *    - Jika TIDAK mau pakai API pihak ketiga, CUKUP KOSONGKAN ('').
 * 
 * 2. Pake Google Gemini Resmi (Official API Key):
 *    - Kosongkan 'apiUrl' di atas, lalu masukkan apikey Gemini resmi di 'geminiKey'.
 *    - Otomatis Mahiru AI akan memakai engine resmi Google Gemini (@google/genai).
 * 
 * 3. Fallback Otomatis:
 *    - Jika 'apiUrl' & 'geminiKey' kosong, bot otomatis memakai multi-provider scraper AI gratis.
 */
global.mahiruAI = {
	// [1] API Pihak Ketiga (URL Luar)
	apiUrl: '', // Tempel URL API pihak ketiga di sini. Kosongkan jika tidak ingin memakai API pihak ketiga.
	apiKey: '', // API key pihak ketiga (jika butuh header auth / Bearer). Kosongkan jika gratis.
	customModel: 'gpt-4o-mini', // Model untuk endpoint pihak ketiga (contoh: 'gpt-4o', 'claude-3-5-sonnet', dll).

	// [2] Google Gemini Resmi (Official API)
	geminiKey: process.env.GEMINI_API_KEY || '', // API Key Gemini resmi (diambil dari environment GEMINI_API_KEY atau isi di sini)
	geminiModel: 'gemini-3.1-flash-lite', // Model Gemini resmi yang hemat token, cepat, dan percakapannya terasa seperti manusia nyata
}

// Lainnya
global.jadwalSholat = {
	Subuh: '04:30',
	Dzuhur: '12:06',
	Ashar: '15:21',
	Maghrib: '18:08',
	Isya: '19:00'
}

global.badWords = ['dongo', 'konsol'] // input kata-kata toxic yg lain. ex: ['dongo','dongonya']
global.chatLength = 1000

fs.watchFile(__filename, async () => {
	console.log(chalk.yellowBright(`[UPDATE] ${__filename}`))
});