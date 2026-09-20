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
					temperature: 0.8,
					topP: 0.9,
					maxOutputTokens: 250
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
 * Membersihkan output AI agar rapi, ringkas, hanya 1 gestur pendek di awal,
 * dan maksimal 2 paragraf pendek layaknya obrolan nyata manusia.
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
		cleaned = cleaned.replace(/\{NAME\}/g, isOwner ? 'Shiro-sama' : userName);
	}

	// 1. Ekstrak gestur aksi pertama jika ada
	let firstGesture = '';
	const actionRegex = /\(([a-zA-Z\s,.'"-]{3,})\)|\*([a-zA-Z\s,.'"-]{3,})\*/g;
	const match = actionRegex.exec(cleaned);

	if (match) {
		const raw = (match[1] || match[2] || '').trim();
		let shortG = raw;
		if (shortG.length > 25) {
			if (/merona|merah|malu|tomat|telinga|salah tingkah/i.test(shortG)) {
				shortG = 'tersipu malu';
			} else if (/senyum|manis|bahagia/i.test(shortG)) {
				shortG = 'tersenyum lembut';
			} else if (/menunduk|tunduk/i.test(shortG)) {
				shortG = 'menunduk pelan';
			} else if (/tatap|lihat|mata|lirik/i.test(shortG)) {
				shortG = 'tersenyum manis';
			} else if (/cemas|khawatir/i.test(shortG)) {
				shortG = 'menatap khawatir';
			} else {
				shortG = shortG.slice(0, 22).trim();
			}
		}
		firstGesture = `(${shortG})`;
	}

	// 2. Hapus semua tanda kurung aksi narasi di dalam teks agar tidak berulang
	cleaned = cleaned.replace(actionRegex, ' ');

	// 3. Bersihkan tanda kutip pembungkus dan spasi ganda
	cleaned = cleaned
		.replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	cleaned = cleaned.replace(/^["'“”«»]/, '').replace(/["'“”«»]$/, '').trim();

	// 4. Batasi maksimal 2 paragraf pendek layaknya chat di dunia nyata
	const paragraphs = cleaned
		.split(/\n\s*\n+/)
		.map(p => p.trim())
		.filter(Boolean);

	if (paragraphs.length > 2) {
		cleaned = paragraphs.slice(0, 2).join('\n\n');
	} else {
		cleaned = paragraphs.join('\n\n');
	}

	// Jika masih sangat panjang (lebih dari 350 karakter), ambil 3 kalimat pertama
	if (cleaned.length > 350) {
		const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
		if (sentences.length > 3) {
			cleaned = sentences.slice(0, 3).join(' ').trim();
		}
	}

	// 5. Tambahkan 1 gestur tunggal di awal pesan jika ada
	if (firstGesture) {
		cleaned = `${firstGesture}\n\n${cleaned}`;
	}

	// Pastikan ada sentuhan emoji manis jika teks sangat polos
	const hasEmoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|\(⁄\s*⁄•⁄ω⁄•⁄\s*⁄\)/u.test(cleaned);
	if (!hasEmoji && cleaned.length > 0) {
		const sweetEmojis = [' 😊🌸', ' ✨', ' 🌸', ' 😳✨'];
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
			return `(tersenyum lembut)\n\nShiro-sama sudah makan? Mahiru baru saja memasak sup miso dan hamburg steak hangat. Kalau Shiro-sama berkenan, Mahiru siapkan sekarang ya 🍱✨`;
		}
		if (isGf) {
			return `(tersipu malu)\n\nMou... ${caller}, kamu belum makan ya? Aku sudah buatkan omurice hangat kesukaanmu nih. Duduk yang manis ya, biar kusiapkan sekarang 🍱💕`;
		}
		return `(tersenyum ramah)\n\nAh, ${caller}! Apakah kamu sudah makan? Jangan telat makan ya, jaga kesehatanmu baik-baik 😊🌸`;
	}

	if (text.includes('halo') || text.includes('hai') || text.includes('pagi') || text.includes('siang') || text.includes('malam') || text.includes('sore')) {
		if (isOwner) {
			return `(tersenyum manis)\n\nFufu~ halo juga, Shiro-sama! Bagaimana harimu? Jika Shiro-sama lelah, Mahiru sudah siapkan teh hangat untuk Shiro-sama 😊🌸`;
		}
		if (isGf) {
			return `(tersipu malu)\n\nFufu~ halo juga, ${caller}! Senang sekali kamu menyapaku hari ini. Bagaimana kabarmu? (⁄ ⁄•⁄ω⁄•⁄ ⁄)💕`;
		}
		return `(tersenyum ramah)\n\nHalo, ${caller}! Senang bisa menyapamu. Semoga harimu menyenangkan ya 😊✨`;
	}

	if (text.includes('cantik') || text.includes('manis') || text.includes('tenshi') || text.includes('malaikat') || text.includes('suka') || text.includes('cinta') || text.includes('sayang') || text.includes('nikah') || text.includes('pacar')) {
		if (isOwner) {
			return `(tersipu malu)\n\nE-Eh...?! Shiro-sama memuji Mahiru...? Terima kasih banyak ya, pujian dari Shiro-sama membuat Mahiru bahagia sekali (⁄ ⁄•⁄ω⁄•⁄ ⁄) 🌸✨`;
		}
		if (isGf) {
			return `(tersipu malu)\n\nE-Eh...?! ${caller}, apa sih yang kamu bicarakan... (⁄ ⁄•⁄ω⁄•⁄ ⁄) Mou... jangan terus-terusan menggodaku seperti itu, aku malu tau! 🙈💕`;
		}
		return `(tersipu malu)\n\nE-Eh...? Terima kasih atas pujiannya, ${caller}. Tapi jangan menggodaku berlebihan ya, aku jadi canggung kok 😊🌸`;
	}

	if (text.includes('lelah') || text.includes('capek') || text.includes('tidur') || text.includes('ngantuk')) {
		if (isOwner) {
			return `(menatap khawatir)\n\nShiro-sama pasti lelah sekali hari ini... Istirahat yang cukup ya Shiro-sama, jangan sampai memaksakan diri 🌸🌙`;
		}
		if (isGf) {
			return `(tersenyum lembut)\n\nKamu sudah berjuang keras hari ini, ${caller}. Sekarang cuci muka dan istirahat yang nyenyak ya, Sayang 🛌💕`;
		}
		return `(menatap khawatir)\n\nKamu pasti lelah ya, ${caller}... Jangan lupa istirahat yang cukup agar besok kembali bugar 😊🌸`;
	}

	// Dialog umum
	if (isOwner) {
		return `(tersenyum manis)\n\nIya, Shiro-sama? Mahiru siap mendengarkan. Ada hal yang bisa Mahiru bantu? ✨🌸`;
	}
	if (isGf) {
		return `(tersenyum lembut)\n\nIya, ${caller}? Ceritakan saja padaku, aku senang sekali mengobrol denganmu 💕`;
	}
	return `(tersenyum ramah)\n\nIya, ${caller}? Ada yang ingin kamu obrolkan? Aku siap mendengarkan 😊🌸`;
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
