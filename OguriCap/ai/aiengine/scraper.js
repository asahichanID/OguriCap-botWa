/**
 * OguriCap/ai/aiengine/scraper.js
 * -----------------------------------------------------------------------
 * Universal Character-Agnostic AI Scraper & Model Caller.
 * 
 * Fitur:
 * - 100% Karakter-Agnostik (tidak ada hardcode nama karakter di engine)
 * - Dukungan endpoint OpenAI-compatible pihak ketiga (Groq, OpenRouter, Ollama, custom v1)
 * - Dukungan endpoint GET pihak ketiga dengan placeholder ({prompt}, {text}, dll)
 * - Dukungan Google Gemini API (@google/genai)
 * - Multi-provider fallback gratis tanpa API key (Pollinations AI, Ryzendesu GPT-4o, Gemini, Claude, Blackbox)
 * - Pembersih & sanitasi otomatis: hapus <think>...</think>, format chat anime natural
 */

import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

// Cache client GoogleGenAI per apiKey
const geminiClientCache = new Map();

/**
 * Mendapatkan client GoogleGenAI yang valid
 * @param {string} apiKey 
 * @returns {GoogleGenAI|null}
 */
function getGeminiClient(apiKey = '') {
	const key = (apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
	if (!key) return null;
	// Hindari placeholder atau key yang diblokir
	if (key === 'AIzaSyDyVcbniZLWNz9JAJD1iVLWrC9BK36SqoM') return null;

	if (!geminiClientCache.has(key)) {
		geminiClientCache.set(key, new GoogleGenAI({
			apiKey: key,
			httpOptions: {
				headers: {
					'User-Agent': 'aistudio-build'
				}
			}
		}));
	}
	return geminiClientCache.get(key);
}

/**
 * Mengekstrak teks balasan AI secara cerdas dari berbagai format respon API
 * @param {any} data 
 * @returns {string}
 */
export function extractAiText(data) {
	if (!data) return '';
	if (typeof data === 'string') return data.trim();
	if (Array.isArray(data)) {
		if (data.length > 0 && typeof data[0] === 'string') return data[0].trim();
		if (data.length > 0 && data[0]?.content) return String(data[0].content).trim();
		if (data.length > 0 && data[0]?.text) return String(data[0].text).trim();
	}
	if (typeof data === 'object') {
		// OpenAI format: choices[0].message.content
		if (data.choices?.[0]?.message?.content) return String(data.choices[0].message.content).trim();
		if (data.choices?.[0]?.text) return String(data.choices[0].text).trim();

		// Gemini format: candidates[0].content.parts[0].text
		if (data.candidates?.[0]?.content?.parts?.[0]?.text) return String(data.candidates[0].content.parts[0].text).trim();

		// Universal wrappers
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
 * Membersihkan balasan AI dari tag thinking, label role, dan markdown code blocks berlebih
 * @param {string} rawText 
 * @param {Object} options
 * @param {number} [options.maxParagraphs=0] - Batas paragraf (0 = abaikan)
 * @returns {string}
 */
export function sanitizeAiResponse(rawText = '', options = {}) {
	if (!rawText || typeof rawText !== 'string') return '';
	let clean = rawText.trim();

	// 1. Hapus blok <think>...</think> dari model reasoning seperti DeepSeek R1
	clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

	// 2. Hapus tag role awalan seperti "Assistant:", "AI:", "Bot:", "(Nama):"
	clean = clean.replace(/^(Assistant|AI|Bot|[A-Za-z0-9_-]+)\s*:\s*/i, '');

	// 3. Hapus markdown code block pembungkus jika balasan dibungkus ``` ... ```
	if (clean.startsWith('```') && clean.endsWith('```')) {
		clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
	}

	// 4. Normalisasi newline berulang (> 2 baris kosong jadi 1 jeda paragraf)
	clean = clean.replace(/\n{3,}/g, '\n\n').trim();

	// 5. Pembatasan jumlah paragraf jika diatur
	if (options.maxParagraphs && options.maxParagraphs > 0) {
		const paragraphs = clean.split(/\n\s*\n/).filter(p => p.trim().length > 0);
		if (paragraphs.length > options.maxParagraphs) {
			clean = paragraphs.slice(0, options.maxParagraphs).join('\n\n').trim();
		}
	}

	return clean;
}

/**
 * Provider 1: API Pihak Ketiga Kustom (OpenAI-compatible atau Custom GET/POST URL)
 */
async function callThirdPartyEndpoint(messages = [], systemPrompt = '', config = {}, timeoutMs = 12000) {
	const apiUrl = config.apiUrl;
	if (!apiUrl || typeof apiUrl !== 'string') {
		throw new Error('API URL kustom kosong');
	}

	const historyText = messages
		.slice(-8)
		.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
		.join('\n\n');
	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan]:\n${historyText}\n\nBalas pesan terakhir:`;

	const authHeaders = {};
	if (config.apiKey) {
		const token = config.apiKey.startsWith('Bearer ') ? config.apiKey : `Bearer ${config.apiKey}`;
		authHeaders['Authorization'] = token;
		authHeaders['x-api-key'] = config.apiKey;
	}

	// Cek apakah endpoint adalah OpenAI-compatible (/chat/completions atau /v1)
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
			temperature: config.temperature ?? 0.8,
			max_tokens: 800
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
		throw new Error('Format respon OpenAI pihak ketiga kosong');
	}

	// URL GET dengan placeholder atau query parameter
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

		const res = await axios.get(finalUrl, {
			timeout: timeoutMs,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
				...authHeaders
			}
		});

		const text = extractAiText(res.data);
		if (text) return text;
	}

	// Fallback POST payload generik
	const postPayloads = [
		{ text: fullPrompt, model: config.customModel },
		{ prompt: fullPrompt, model: config.customModel },
		{ message: fullPrompt, model: config.customModel },
		{ content: fullPrompt, model: config.customModel }
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
		} catch (_) {
			// Coba payload berikutnya
		}
	}

	throw new Error('Endpoint pihak ketiga tidak mengembalikan teks balasan yang sesuai');
}

/**
 * Provider 2: Google Gemini Official (@google/genai)
 */
async function callGeminiApi(messages = [], systemPrompt = '', config = {}) {
	const apiKey = config.geminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
	const ai = getGeminiClient(apiKey);
	if (!ai) {
		throw new Error('Client Gemini tidak tersedia atau API Key kosong');
	}

	const modelName = config.geminiModel || 'gemini-2.5-flash';

	const formattedContents = messages.slice(-8).map(m => ({
		role: m.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	const response = await ai.models.generateContent({
		model: modelName,
		contents: formattedContents,
		config: {
			systemInstruction: systemPrompt,
			temperature: config.temperature ?? 0.8,
			maxOutputTokens: 800
		}
	});

	const reply = response.text ? response.text.trim() : '';
	if (reply) return reply;
	throw new Error('Respon dari Gemini API kosong');
}

/**
 * Provider 3: Free Multi-Model Scrapers (Pollinations & Free Endpoints)
 */
async function callFreeScrapers(messages = [], systemPrompt = '', timeoutMs = 12000) {
	const historyText = messages
		.slice(-6)
		.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
		.join('\n\n');
	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan Sebelumnya]:\n${historyText}\n\nLanjutkan percakapan dengan merespon pesan terakhir di atas:`;

	const errors = [];

	// 1. Pollinations AI (OpenAI Compatible Endpoint)
	try {
		const payload = {
			model: 'openai',
			messages: [
				{ role: 'system', content: systemPrompt },
				...messages.slice(-6).map(m => ({
					role: m.role === 'assistant' ? 'assistant' : 'user',
					content: m.content
				}))
			],
			temperature: 0.8,
			max_tokens: 700
		};

		const res = await axios.post('https://text.pollinations.ai/openai', payload, {
			timeout: timeoutMs,
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
			}
		});

		const text = extractAiText(res.data);
		if (text) return text;
	} catch (e) {
		errors.push(`Pollinations: ${e.message}`);
	}

	// 2. Ryzendesu GPT-4o
	try {
		const res = await axios.get(`https://api.ryzendesu.vip/api/ai/gpt4o?text=${encodeURIComponent(fullPrompt)}`, {
			timeout: timeoutMs,
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
		});
		const text = extractAiText(res.data);
		if (text) return text;
	} catch (e) {
		errors.push(`Ryzendesu GPT4o: ${e.message}`);
	}

	// 3. Ryzendesu Gemini
	try {
		const res = await axios.get(`https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(fullPrompt)}`, {
			timeout: timeoutMs,
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
		});
		const text = extractAiText(res.data);
		if (text) return text;
	} catch (e) {
		errors.push(`Ryzendesu Gemini: ${e.message}`);
	}

	// 4. Ryzendesu Claude
	try {
		const res = await axios.get(`https://api.ryzendesu.vip/api/ai/claude?text=${encodeURIComponent(fullPrompt)}`, {
			timeout: timeoutMs,
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
		});
		const text = extractAiText(res.data);
		if (text) return text;
	} catch (e) {
		errors.push(`Ryzendesu Claude: ${e.message}`);
	}

	// 5. Ryzendesu Blackbox
	try {
		const res = await axios.get(`https://api.ryzendesu.vip/api/ai/blackbox?chat=${encodeURIComponent(fullPrompt)}`, {
			timeout: timeoutMs,
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
		});
		const text = extractAiText(res.data);
		if (text) return text;
	} catch (e) {
		errors.push(`Ryzendesu Blackbox: ${e.message}`);
	}

	throw new Error(`Semua free scraper gagal: ${errors.join(' | ')}`);
}

/**
 * Fungsi Utama Scraper AI Engine:
 * Menghubungi provider secara berjenjang dengan fallback otomatis.
 *
 * @param {Object} params
 * @param {Array<{role: string, content: string}>} params.messages - Riwayat chat
 * @param {string} params.systemPrompt - System instruction / prompt persona
 * @param {Object} [params.config] - Konfigurasi endpoint / API key
 * @param {Object} [params.options] - Opsi sanitasi & limit
 * @returns {Promise<string>}
 */
export async function callAiModel({ messages = [], systemPrompt = '', config = {}, options = {} }) {
	const timeoutMs = config.timeoutMs || 12000;
	let rawResponse = '';

	// 1. Coba custom endpoint jika dikonfigurasi
	if (config.apiUrl && typeof config.apiUrl === 'string' && config.apiUrl.trim()) {
		try {
			rawResponse = await callThirdPartyEndpoint(messages, systemPrompt, config, timeoutMs);
			if (rawResponse) return sanitizeAiResponse(rawResponse, options);
		} catch (err) {
			console.warn(`[AIEngine:Scraper] Custom endpoint gagal (${err.message}), mencoba provider berikutnya...`);
		}
	}

	// 2. Coba Google Gemini API jika key tersedia
	const geminiKey = config.geminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
	if (geminiKey && geminiKey.length > 10 && geminiKey !== 'AIzaSyDyVcbniZLWNz9JAJD1iVLWrC9BK36SqoM') {
		try {
			rawResponse = await callGeminiApi(messages, systemPrompt, config);
			if (rawResponse) return sanitizeAiResponse(rawResponse, options);
		} catch (err) {
			console.warn(`[AIEngine:Scraper] Gemini API gagal (${err.message}), beralih ke free scrapers...`);
		}
	}

	// 3. Fallback ke multi-provider free scrapers (Pollinations, Ryzendesu, dll)
	try {
		rawResponse = await callFreeScrapers(messages, systemPrompt, timeoutMs);
		if (rawResponse) return sanitizeAiResponse(rawResponse, options);
	} catch (err) {
		console.error(`[AIEngine:Scraper] Seluruh free scraper gagal (${err.message})`);
	}

	throw new Error('Gagal mendapatkan balasan dari seluruh provider AI');
}
