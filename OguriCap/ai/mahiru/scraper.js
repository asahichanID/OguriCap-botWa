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
import '../../settings.js';

let cachedGeminiClients = new Map();

/**
 * Mengambil konfigurasi Mahiru AI dari global.mahiruAI (OguriCap/settings.js),
 * dengan fallback ke environment variables jika ada.
 */
export function getMahiruConfig() {
	const conf = global.mahiruAI || {};
	const apiUrl = (conf.apiUrl || global.mahiruApiUrl || global.mahiruUrl || '').trim();
	const apiKey = (conf.apiKey || global.mahiruApiKey || '').trim();
	const customModel = (conf.customModel || conf.model || global.mahiruModel || 'gpt-4o-mini').trim();
	const geminiKey = (conf.geminiKey || global.mahiruGeminiKey || global.geminiKey || process.env.GEMINI_API_KEY || '').trim();
	const geminiModel = (conf.geminiModel || global.mahiruGeminiModel || 'gemini-2.5-flash').trim();

	return {
		apiUrl,
		apiKey,
		customModel,
		geminiKey,
		geminiModel
	};
}

function getGeminiClient(customApiKey = '') {
	const config = getMahiruConfig();
	const apiKey = customApiKey || config.geminiKey || process.env.GEMINI_API_KEY || '';
	if (!apiKey) return null;

	if (!cachedGeminiClients.has(apiKey)) {
		cachedGeminiClients.set(apiKey, new GoogleGenAI({ apiKey }));
	}
	return cachedGeminiClients.get(apiKey);
}

/**
 * Mengekstrak teks balasan AI secara cerdas dari berbagai format respon API pihak ketiga
 * (OpenAI, Gemini, Groq, Anthropic proxy, Ryzendesu, Blackbox, Ollama, custom JSON, dll).
 */
function extractAiText(data) {
	if (!data) return '';
	if (typeof data === 'string') return data.trim();
	if (Array.isArray(data)) {
		if (data.length > 0 && typeof data[0] === 'string') return data[0].trim();
		if (data.length > 0 && data[0]?.content) return String(data[0].content).trim();
		if (data.length > 0 && data[0]?.text) return String(data[0].text).trim();
	}
	if (typeof data === 'object') {
		// Format OpenAI: choices[0].message.content
		if (data.choices?.[0]?.message?.content) return String(data.choices[0].message.content).trim();
		if (data.choices?.[0]?.text) return String(data.choices[0].text).trim();

		// Format Gemini: candidates[0].content.parts[0].text
		if (data.candidates?.[0]?.content?.parts?.[0]?.text) return String(data.candidates[0].content.parts[0].text).trim();

		// Format API Umum / Bot Wrapper Indonesia
		if (typeof data.answer === 'string') return data.answer.trim();
		if (typeof data.result === 'string') return data.result.trim();
		if (typeof data.result === 'object' && data.result?.text) return String(data.result.text).trim();
		if (typeof data.response === 'string') return data.response.trim();
		if (typeof data.reply === 'string') return data.reply.trim();
		if (typeof data.output === 'string') return data.output.trim();
		if (typeof data.text === 'string') return data.text.trim();
		if (typeof data.message === 'string') return data.message.trim();
		if (typeof data.msg === 'string') return data.msg.trim();
		if (typeof data.data === 'string') return data.data.trim();
		if (typeof data.data === 'object') {
			const nested = extractAiText(data.data);
			if (nested) return nested;
		}
	}
	return '';
}

/**
 * Provider Fleksibel: API Pihak Ketiga (Custom URL di settings.js)
 * Sangat fleksibel:
 * - Mendukung GET URL dengan atau tanpa placeholder ({prompt}, {text}, ?text=, dll)
 * - Mendukung endpoint OpenAI-compatible / Chat Completions (POST)
 * - Mendukung API key / auth Bearer jika endpoint membutuhkan auth
 */
async function generateThirdPartyAI(messages = [], systemPrompt = '', config = {}, timeoutMs = 12000) {
	const apiUrl = config.apiUrl;
	if (!apiUrl || typeof apiUrl !== 'string') {
		throw new Error('API URL pihak ketiga kosong');
	}

	const historyText = messages
		.slice(-8)
		.map(m => `${m.role === 'user' ? 'User' : 'Mahiru Shiina'}: ${m.content}`)
		.join('\n\n');
	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan Sebelumnya]:\n${historyText}\n\nLanjutkan percakapan dengan merespon pesan terakhir di atas sebagai Mahiru Shiina:`;
	const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || 'Halo Mahiru';

	const authHeaders = {};
	if (config.apiKey) {
		const token = config.apiKey.startsWith('Bearer ') ? config.apiKey : `Bearer ${config.apiKey}`;
		authHeaders['Authorization'] = token;
		authHeaders['x-api-key'] = config.apiKey;
	}

	// 1. Cek apakah endpoint adalah format OpenAI-compatible / Chat Completions
	const isOpenAiEndpoint = /\/chat\/completions|\/v1\b/i.test(apiUrl) && !apiUrl.includes('?text=') && !apiUrl.includes('?prompt=');

	if (isOpenAiEndpoint) {
		let endpoint = apiUrl;
		if (!endpoint.includes('/chat/completions')) {
			endpoint = `${endpoint.replace(/\/+$/, '')}/chat/completions`;
		}

		const payload = {
			model: config.customModel || 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: systemPrompt },
				...messages.slice(-8).map(m => ({
					role: m.role === 'assistant' ? 'assistant' : 'user',
					content: m.content
				}))
			],
			temperature: 0.8,
			max_tokens: 300
		};

		const res = await axios.post(endpoint, payload, {
			timeout: timeoutMs,
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
				...authHeaders
			}
		});

		const text = extractAiText(res.data);
		if (text) return text;
		throw new Error('Respons dari endpoint OpenAI pihak ketiga kosong atau format tidak sesuai');
	}

	// 2. URL GET dengan placeholder atau query parameter
	const hasPlaceholder = /{prompt}|{text}|%text|{query}|{msg}|{q}/i.test(apiUrl);
	const hasQueryParam = apiUrl.includes('?') || apiUrl.endsWith('=');

	if (hasPlaceholder || hasQueryParam) {
		let finalUrl = apiUrl;
		if (hasPlaceholder) {
			finalUrl = finalUrl
				.replace(/{prompt}/gi, encodeURIComponent(fullPrompt))
				.replace(/{text}/gi, encodeURIComponent(fullPrompt))
				.replace(/%text/gi, encodeURIComponent(fullPrompt))
				.replace(/{query}/gi, encodeURIComponent(fullPrompt))
				.replace(/{msg}/gi, encodeURIComponent(fullPrompt))
				.replace(/{q}/gi, encodeURIComponent(fullPrompt));
		} else if (finalUrl.endsWith('=')) {
			finalUrl = `${finalUrl}${encodeURIComponent(fullPrompt)}`;
		} else if (finalUrl.includes('?')) {
			finalUrl = `${finalUrl}&text=${encodeURIComponent(fullPrompt)}`;
		}

		try {
			const res = await axios.get(finalUrl, {
				timeout: timeoutMs,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
					...authHeaders
				}
			});

			const text = extractAiText(res.data);
			if (text) return text;
		} catch (getErr) {
			console.warn(`[MahiruAI:ThirdParty] GET ${finalUrl.slice(0, 50)}... gagal (${getErr.message}), mencoba fallback POST...`);
		}
	}

	// 3. Fallback POST Universal (mengirim prompt dalam format JSON fleksibel)
	const postPayloads = [
		{
			model: config.customModel || 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: systemPrompt },
				...messages.slice(-8)
			],
			prompt: fullPrompt,
			text: fullPrompt,
			query: fullPrompt
		},
		{
			text: fullPrompt,
			prompt: fullPrompt,
			content: fullPrompt,
			q: lastUserMsg
		}
	];

	for (const payload of postPayloads) {
		try {
			const res = await axios.post(apiUrl, payload, {
				timeout: timeoutMs,
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
					...authHeaders
				}
			});

			const text = extractAiText(res.data);
			if (text) return text;
		} catch {
			// lanjut ke format payload berikutnya
		}
	}

	throw new Error(`Tidak mendapat balasan teks yang valid dari API pihak ketiga: ${apiUrl}`);
}

/**
 * Provider 0: Direct Google Gemini AI Engine Resmi (@google/genai)
 */
async function generateGeminiDirect(messages = [], systemPrompt = '', timeoutMs = 12000, config = null) {
	const conf = config || getMahiruConfig();
	const ai = getGeminiClient(conf.geminiKey);
	if (!ai) throw new Error('GEMINI_API_KEY tidak tersedia di settings.js maupun env');

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

	// Model prioritas: model yang dipilih user di settings.js, lalu fallback resmi lainnya
	const userModel = conf.geminiModel || 'gemini-3.6-flash';
	const candidateModels = [
		userModel,
		'gemini-3.6-flash',
		'gemini-3.1-flash-lite',
		'gemini-2.5-flash',
		'gemini-1.5-flash'
	].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

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
 * Prioritas eksekusi:
 * 1. API Pihak Ketiga (jika apiUrl di settings.js diisi)
 * 2. Google Gemini Resmi (jika apiUrl kosong, atau pihak ketiga gagal, dan geminiKey / GEMINI_API_KEY tersedia)
 * 3. Multi-Provider Scraper AI Gratis (jika tidak ada API key)
 * 4. Fallback Mesin Dialog Mahiru Offline (100% aman tanpa error di chat)
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
	const config = getMahiruConfig();

	// [1] Prioritas Utama: API Pihak Ketiga (Custom URL di settings.js)
	if (config.apiUrl) {
		try {
			console.log(`[MahiruAI] Menggunakan API pihak ketiga: ${config.apiUrl}`);
			const rawResponse = await generateThirdPartyAI(messages, systemPrompt, config, 12000);
			if (rawResponse && typeof rawResponse === 'string' && rawResponse.trim().length > 0) {
				const sanitized = sanitizeMahiruResponse(rawResponse, userName, isOwner);
				if (sanitized && sanitized.length > 5) {
					return sanitized;
				}
			}
		} catch (err) {
			console.warn(`[MahiruAI:ThirdParty] Gagal menggunakan API pihak ketiga (${config.apiUrl}): ${err.message}. Beralih ke provider berikutnya...`);
		}
	}

	// [2] Prioritas Kedua: Google Gemini Resmi (@google/genai)
	// Aktif jika ada geminiKey di settings.js ATAU GEMINI_API_KEY di environment
	const hasGeminiKey = Boolean(config.geminiKey || process.env.GEMINI_API_KEY);
	if (hasGeminiKey) {
		try {
			const rawResponse = await generateGeminiDirect(messages, systemPrompt, 10000, config);
			if (rawResponse && typeof rawResponse === 'string' && rawResponse.trim().length > 0) {
				const sanitized = sanitizeMahiruResponse(rawResponse, userName, isOwner);
				if (sanitized && sanitized.length > 5) {
					return sanitized;
				}
			}
		} catch (err) {
			console.warn(`[MahiruAI:GeminiOfficial] Gemini resmi gagal: ${err.message}. Beralih ke scraper gratis...`);
		}
	}

	// [3] Prioritas Ketiga: Multi-Provider Scraper AI Gratis
	const freeProviders = [
		() => scrapeGeminiFree(messages, systemPrompt, 6000),
		() => scrapeGpt4oFree(messages, systemPrompt, 6000),
		() => scrapeClaudeFree(messages, systemPrompt, 6000),
		() => scrapeBlackboxFree(messages, systemPrompt, 6000),
		() => scrapePollinationsOpenAI(messages, systemPrompt, 7000)
	];

	for (const provider of freeProviders) {
		try {
			const rawResponse = await provider();
			if (rawResponse && typeof rawResponse === 'string' && rawResponse.trim().length > 0) {
				const sanitized = sanitizeMahiruResponse(rawResponse, userName, isOwner);
				if (sanitized && sanitized.length > 5) {
					return sanitized;
				}
			}
		} catch (err) {
			// Lanjut ke provider scraper gratis berikutnya
		}
	}

	// [4] Prioritas Keempat: Dialog Kontekstual Offline Mahiru (100% aman tanpa error)
	const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
	return fallbackMahiruDialogue(lastUserMsg, userName, isOwner, relationship);
}
