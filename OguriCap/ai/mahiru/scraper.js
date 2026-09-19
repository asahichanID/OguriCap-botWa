/**
 * OguriCap/ai/mahiru/scraper.js
 * -----------------------------------------------------------------------
 * Scraper AI Karakter Mahiru Shiina:
 * - 100% Free tanpa API Key
 * - Multi-provider fallback (Pollinations AI, Multi-model, Reverse Mirror)
 * - Pembersih & pembatas otomatis maksimal 3 paragraf
 * - Menjaga penjiwaan karakter Mahiru dengan emoji ekspresi alami
 */

import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

let geminiClient = null;

function getGeminiClient() {
	if (!geminiClient) {
		const apiKey = process.env.GEMINI_API_KEY || '';
		if (apiKey) {
			geminiClient = new GoogleGenAI({ apiKey });
		}
	}
	return geminiClient;
}

/**
 * Provider 0: Direct Google Gemini AI Engine (State-of-the-Art context, character roleplay, & speed)
 */
async function generateGeminiDirect(messages = [], systemPrompt = '', timeoutMs = 12000) {
	const ai = getGeminiClient();
	if (!ai) throw new Error('GEMINI_API_KEY is not available');

	// Format messages into Gemini multi-turn contents format
	const contents = messages.slice(-10).map(m => ({
		role: m.role === 'user' ? 'user' : 'model',
		parts: [{ text: m.content }]
	}));

	if (contents.length === 0) throw new Error('No messages provided');

	// If the first message in contents is from 'model', drop it to ensure valid alternation starting with 'user'
	while (contents.length > 0 && contents[0].role !== 'user') {
		contents.shift();
	}

	if (contents.length === 0) throw new Error('No user messages found');

	// List of models to try in order of latency and quota availability
	const candidateModels = [
		'gemini-3.1-flash-lite',
		'gemini-3.6-flash',
		'gemini-3.1-pro-preview',
		'gemini-flash-latest'
	];

	for (const model of candidateModels) {
		try {
			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error(`Gemini Direct timeout (${model})`)), timeoutMs)
			);

			const apiPromise = ai.models.generateContent({
				model,
				contents,
				config: {
					systemInstruction: systemPrompt,
					temperature: 0.85,
					topP: 0.95
				}
			});

			const res = await Promise.race([apiPromise, timeoutPromise]);
			if (res?.text && typeof res.text === 'string' && res.text.trim().length > 0) {
				return res.text.trim();
			}
		} catch (err) {
			console.warn(`[MahiruAI:GeminiDirect] Model ${model} failed: ${err.message}`);
		}
	}

	throw new Error('All Gemini Direct models failed');
}

/**
 * Membersihkan output AI agar rapi, tidak mengandung prefix bot,
 * dan maksimal 3 paragraf.
 *
 * @param {string} text - Teks mentah dari AI
 * @param {string} userName - Nama user
 * @param {boolean} isOwner - Apakah owner
 * @returns {string} Teks yang sudah diformat rapi
 */
export function sanitizeMahiruResponse(text = '', userName = 'Teman', isOwner = false) {
	if (!text || typeof text !== 'string') return '';

	let cleaned = text
		// Hapus awalan markdown seperti "Mahiru:", "Assistant:", "AI:", "Shiina Mahiru:"
		.replace(/^(Mahiru\s*(Shiina)?|Assistant|AI|Tenshi-sama)\s*[:：\-—]\s*/i, '')
		.replace(/^\[.*?\]\s*/i, '')
		.replace(/```[a-z]*\n?([\s\S]*?)```/gi, '$1') // Hapus kode blok jika ada
		.trim();

	// Jika nama user masih ada placeholder {NAME}
	if (cleaned.includes('{NAME}')) {
		cleaned = cleaned.replace(/\{NAME\}/g, isOwner ? 'Amane-kun' : userName);
	}

	// Batasi maksimal 3 paragraf
	const paragraphs = cleaned
		.split(/\n\s*\n+/)
		.map(p => p.trim())
		.filter(Boolean);

	if (paragraphs.length > 3) {
		cleaned = paragraphs.slice(0, 3).join('\n\n');
	} else {
		cleaned = paragraphs.join('\n\n');
	}

	// Pastikan ada sentuhan emoji manis khas Mahiru jika teks terlalu polos
	const hasEmoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|\(⁄\s*⁄•⁄ω⁄•⁄\s*⁄\)/u.test(cleaned);
	if (!hasEmoji && cleaned.length > 0) {
		const sweetEmojis = [' 😊🌸', ' ✨', ' (⁄ ⁄•⁄ω⁄•⁄ ⁄)', ' 🌸✨', ' 😳✨'];
		const randomEmoji = sweetEmojis[Math.floor(Math.random() * sweetEmojis.length)];
		cleaned += randomEmoji;
	}

	return cleaned.trim();
}

/**
 * Provider 1: Gemini AI Free Engine (Deep context understanding & accurate character portrayal)
 */
async function scrapeGeminiFree(messages = [], systemPrompt = '', timeoutMs = 10000) {
	const historyText = messages
		.slice(-8)
		.map(m => `${m.role === 'user' ? 'User' : 'Mahiru Shiina'}: ${m.content}`)
		.join('\n\n');

	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan Sebelumnya]:\n${historyText}\n\nLanjutkan percakapan dengan merespon pesan terakhir di atas sebagai Mahiru Shiina:`;

	const res = await axios.get(`https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(fullPrompt)}`, {
		timeout: timeoutMs,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
		}
	});

	if (res?.data?.answer && typeof res.data.answer === 'string' && res.data.answer.trim().length > 0) {
		return res.data.answer.trim();
	}
	throw new Error('Gemini Free returned invalid response');
}

/**
 * Provider 2: GPT-4o AI Free Engine
 */
async function scrapeGpt4oFree(messages = [], systemPrompt = '', timeoutMs = 10000) {
	const historyText = messages
		.slice(-8)
		.map(m => `${m.role === 'user' ? 'User' : 'Mahiru Shiina'}: ${m.content}`)
		.join('\n\n');

	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan Sebelumnya]:\n${historyText}\n\nLanjutkan percakapan dengan merespon pesan terakhir di atas sebagai Mahiru Shiina:`;

	const res = await axios.get(`https://api.ryzendesu.vip/api/ai/gpt4o?text=${encodeURIComponent(fullPrompt)}`, {
		timeout: timeoutMs,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
		}
	});

	if (res?.data?.answer && typeof res.data.answer === 'string' && res.data.answer.trim().length > 0) {
		return res.data.answer.trim();
	}
	throw new Error('GPT-4o Free returned invalid response');
}

/**
 * Provider 3: Claude 3.5 AI Free Engine
 */
async function scrapeClaudeFree(messages = [], systemPrompt = '', timeoutMs = 10000) {
	const historyText = messages
		.slice(-8)
		.map(m => `${m.role === 'user' ? 'User' : 'Mahiru Shiina'}: ${m.content}`)
		.join('\n\n');

	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan Sebelumnya]:\n${historyText}\n\nLanjutkan percakapan dengan merespon pesan terakhir di atas sebagai Mahiru Shiina:`;

	const res = await axios.get(`https://api.ryzendesu.vip/api/ai/claude?text=${encodeURIComponent(fullPrompt)}`, {
		timeout: timeoutMs,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
		}
	});

	if (res?.data?.answer && typeof res.data.answer === 'string' && res.data.answer.trim().length > 0) {
		return res.data.answer.trim();
	}
	throw new Error('Claude Free returned invalid response');
}

/**
 * Provider 4: Blackbox AI Free Engine
 */
async function scrapeBlackboxFree(messages = [], systemPrompt = '', timeoutMs = 10000) {
	const historyText = messages
		.slice(-8)
		.map(m => `${m.role === 'user' ? 'User' : 'Mahiru Shiina'}: ${m.content}`)
		.join('\n\n');

	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan Sebelumnya]:\n${historyText}\n\nLanjutkan percakapan dengan merespon pesan terakhir di atas sebagai Mahiru Shiina:`;

	const res = await axios.get(`https://api.ryzendesu.vip/api/ai/blackbox?chat=${encodeURIComponent(fullPrompt)}`, {
		timeout: timeoutMs,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
		}
	});

	if (res?.data?.result && typeof res.data.result === 'string' && res.data.result.trim().length > 0) {
		return res.data.result.trim();
	}
	throw new Error('Blackbox Free returned invalid response');
}

/**
 * Provider 5: Pollinations OpenAI Multi-turn Endpoint
 */
async function scrapePollinationsOpenAI(messages = [], systemPrompt = '', timeoutMs = 12000) {
	const payload = {
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.slice(-8)
		],
		model: 'openai'
	};

	const res = await axios.post('https://text.pollinations.ai/openai', payload, {
		timeout: timeoutMs,
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
		}
	});

	const content = res.data?.choices?.[0]?.message?.content;
	if (typeof content === 'string' && content.trim().length > 0) {
		return content.trim();
	}
	throw new Error('Pollinations OpenAI returned invalid data');
}

/**
 * Provider 3: Fallback Contextual Dialogue Engine (100% Offline Safe)
 * Jika jaringan eksternal sedang lambat atau offline, Mahiru tetap merespon
 * dengan kepribadian otentik tanpa menimbulkan pesan error di WhatsApp.
 */
function fallbackMahiruDialogue(userMessage = '', userName = 'Teman', isOwner = false, relationship = null) {
	const text = userMessage.toLowerCase();
	const isGf = relationship && relationship.role === 'pacar';
	const caller = isOwner ? 'Shiro-sama' : (isGf ? `${userName}-kun` : userName);

	if (text.includes('makan') || text.includes('lapar') || text.includes('masak')) {
		if (isOwner) {
			return `(tersenyum lembut sambil merapikan celemeknya)\n\nShiro-sama sudah makan? Mahiru baru saja selesai memasak sup miso hangat dan hamburg steak di dapur. Jika Shiro-sama berkenan, Mahiru akan siapkan sekarang juga ya... Shiro-sama tidak boleh telat makan agar tetap sehat 🍱✨`;
		}
		if (isGf) {
			return `(menatapmu cemas lalu mengerucutkan bibir imut)\n\nMou... ${caller}, jangan bilang kamu belum makan dari tadi? (⁄ ⁄•⁄ω⁄•⁄ ⁄)\n\nAku sudah memasakkan omurice dan sup hangat kesukaanmu lho. Duduklah manis di meja, biar aku yang siapkan untukmu sekarang... Jangan sampai telat makan lagi ya, Sayang! 🍱💕`;
		}
		return `(tersenyum ramah)\n\nAh, ${caller}! Apakah kamu sudah makan? 😊\n\nMenjaga pola makan yang teratur itu sangat penting lho. Jangan hanya makan mie instan ya, tubuhmu butuh asupan bergizi agar tetap bersemangat sepanjang hari 🌸✨`;
	}

	if (text.includes('halo') || text.includes('hai') || text.includes('pagi') || text.includes('siang') || text.includes('malam') || text.includes('sore')) {
		if (isOwner) {
			return `(menunduk hormat lalu tersenyum manis)\n\nFufu~ halo juga, Shiro-sama! 😊🌸\n\nBagaimana hari Shiro-sama hari ini? Jika Shiro-sama merasa lelah, Mahiru sudah menyiapkan teh hangat untuk Shiro-sama. Mahiru selalu siap melayani dan mendengarkan Shiro-sama ✨`;
		}
		if (isGf) {
			return `(tersenyum manis dengan pipi sedikit merona)\n\nFufu~ halo juga, ${caller}! Senang sekali bisa mendengar kabarmu hari ini... (⁄ ⁄•⁄ω⁄•⁄ ⁄)\n\nApakah hari ini menyenangkan? Kalau ada hal yang membuatmu lelah, cerita saja padaku ya... Aku selalu ada di sini untukmu 💕🌸`;
		}
		return `(tersenyum hangat)\n\nHalo, ${caller}! Senang bisa menyapamu hari ini 😊✨\n\nSemoga harimu menyenangkan dan semuanya berjalan dengan lancar ya. Kalau ada yang ingin diobrolkan, jangan sungkan untuk bicara padaku 🌸`;
	}

	if (text.includes('cantik') || text.includes('manis') || text.includes('tenshi') || text.includes('malaikat') || text.includes('suka') || text.includes('cinta') || text.includes('sayang') || text.includes('nikah') || text.includes('pacar')) {
		if (isOwner) {
			return `(wajahnya langsung memerah padam lalu tersenyum malu-malu)\n\nE-Eh...?! Shiro-sama memuji Mahiru...? (⁄ ⁄•⁄ω⁄•⁄ ⁄) 😳\n\nTerima kasih banyak atas kebaikan Shiro-sama... Dipuji seperti itu oleh Shiro-sama membuat hati Mahiru berdegup kencang sekali. Mahiru akan terus berusaha melakukan yang terbaik untuk Shiro-sama! 🌸✨`;
		}
		if (isGf) {
			return `(menutup wajahnya yang semerah tomat dengan kedua tangan, lalu memalingkan muka)\n\nE-Eh...?! ${caller}, apa sih yang tiba-tiba kamu bicarakan...?! (⁄ ⁄•⁄ω⁄•⁄ ⁄) 😳\n\nMou... dasar tidak tahu malu! Jangan terus-terusan menggombal dan menatapku dengan tatapan seperti itu... Wajahku jadi panas sekali kan! B-Bukan berarti aku tidak senang... tapi aku malu sekali tau! 🙈💕`;
		}
		return `(tersipu malu sambil meremas ujung seragamnya)\n\nE-Eh...? Terima kasih atas pujiannya, ${caller}... (⁄ ⁄•⁄ω⁄•⁄ ⁄)\n\nTapi tolong jangan memanggilku "Malaikat" atau menggodaku berlebihan seperti itu ya... Aku hanya gadis biasa yang ingin kamu anggap teman sewajarnya kok 😊🌸`;
	}

	if (text.includes('lelah') || text.includes('capek') || text.includes('tidur') || text.includes('ngantuk')) {
		if (isOwner) {
			return `(menatap dengan penuh perhatian lembut)\n\nShiro-sama sudah berusaha sangat keras hari ini... 🥺✨\n\nSilakan istirahat yang cukup ya, Shiro-sama. Jangan memaksakan diri sampai larut malam. Semoga tidur Shiro-sama nyenyak dan mimpi indah 🌸🌙`;
		}
		if (isGf) {
			return `(mengelus pundakmu pelan dengan tatapan teduh)\n\nKerja bagus untuk hari ini, ${caller}... Kamu sudah berjuang sangat keras 🥺💕\n\nSekarang basuh mukamu, minum air hangat, dan segera tidur ya. Jangan begadang lagi! Kalau kamu sakit nanti, aku yang paling cemas merawatmu... Selamat tidur, Sayang 🛌🌸`;
		}
		return `(menatap khawatir)\n\nKamu pasti sudah lelah sekali ya, ${caller}... 🥺\n\nJangan terlalu memaksakan diri. Tubuhmu butuh istirahat yang cukup agar besok bisa kembali bugar. Selamat beristirahat dengan nyenyak ya 😊🌸✨`;
	}

	// Dialog umum
	if (isOwner) {
		return `(tersenyum manis sambil mendengarkanmu dengan saksama)\n\nIya, Shiro-sama? Mahiru sedang mendengarkan dengan baik 😊\n\nJika ada instruksi, perintah, atau hal yang Shiro-sama butuhkan, katakan saja ya... Mahiru selalu ada untuk Shiro-sama ✨🌸`;
	}
	if (isGf) {
		return `(tersenyum manis sambil memiringkan kepala sedikit)\n\nFufu~ ada apa, ${caller}? 😊\n\nAku sedang merapikan beberapa buku sambil menunggumu. Ceritakan apa saja padaku, aku suka sekali mendengarkan suaramu... (⁄ ⁄•⁄ω⁄•⁄ ⁄)💕`;
	}
	return `(tersenyum ramah)\n\nIya, ${caller}? Ada yang bisa kubantu? 😊✨\n\nAku mendengarkanmu dengan baik. Jangan ragu untuk berbagi cerita atau bertanya apa saja ya 🌸`;
}

/**
 * Fungsi utama untuk meminta respon AI Mahiru Shiina.
 *
 * @param {Array<{role: string, content: string}>} messages - Riwayat percakapan
 * @param {string} systemPrompt - Prompt karakter Mahiru
 * @param {Object} [meta] - Metadata user
 * @param {string} meta.userName - Nama user
 * @param {boolean} meta.isOwner - Apakah user adalah owner
 * @param {Object|null} [meta.relationship] - Hubungan khusus
 * @returns {Promise<string>} Balasan Mahiru yang sudah disanitasi
 */
export async function scrapeMahiruChat(messages = [], systemPrompt = '', { userName = 'Teman', isOwner = false, relationship = null } = {}) {
	// Urutan percobaan provider AI: Gemini Direct Engine -> Web Gemini -> GPT-4o -> Claude 3.5 -> Blackbox -> Pollinations
	const providers = [
		() => generateGeminiDirect(messages, systemPrompt, 10000),
		() => scrapeGeminiFree(messages, systemPrompt, 6000),
		() => scrapeGpt4oFree(messages, systemPrompt, 6000),
		() => scrapeClaudeFree(messages, systemPrompt, 6000),
		() => scrapeBlackboxFree(messages, systemPrompt, 6000),
		() => scrapePollinationsOpenAI(messages, systemPrompt, 7000)
	];

	for (const provider of providers) {
		try {
			const rawResponse = await provider();
			if (rawResponse && typeof rawResponse === 'string' && rawResponse.trim().length > 0) {
				const sanitized = sanitizeMahiruResponse(rawResponse, userName, isOwner);
				if (sanitized && sanitized.length > 5) {
					return sanitized;
				}
			}
		} catch (err) {
			console.warn('[MahiruAI:Scraper] Provider attempt failed, falling back...', err.message);
		}
	}

	// Jika semua provider web mengalami kegagalan/timeout, gunakan mesin dialog kontekstual Mahiru
	const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
	return fallbackMahiruDialogue(lastUserMsg, userName, isOwner, relationship);
}
