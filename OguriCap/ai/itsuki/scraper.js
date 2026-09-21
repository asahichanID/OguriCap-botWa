/**
 * OguriCap/itsuki/scraper.js
 * -----------------------------------------------------------------------
 * Multi-Engine Scraper & API Client untuk Karakter Itsuki Nakano (中野 五月).
 *
 * Mendukung:
 * 1. API Pihak Ketiga (Custom API URL)
 * 2. Google Gemini Resmi (@google/genai)
 * 3. Multi-Provider Scraper AI Gratis (Pollinations, GPT-4o, Gemini Free, Claude Free, Blackbox)
 * 4. Fallback Contextual Dialogue Engine (100% Offline Safe)
 */

import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import '../../settings.js';

let cachedGeminiClients = new Map();

/**
 * Mengambil konfigurasi Itsuki AI dari global.itsukiAI (OguriCap/settings.js),
 * dengan prioritas environment variables untuk deployment production.
 */
export function getItsukiConfig() {
	const conf = global.itsukiAI || {};
	const apiUrl = (conf.apiUrl || global.itsukiApiUrl || global.itsukiUrl || '').trim();
	const apiKey = (conf.apiKey || global.itsukiApiKey || '').trim();
	const customModel = (conf.customModel || conf.model || global.itsukiModel || 'gpt-4o-mini').trim();

	// Prioritaskan GEMINI_API_KEY dari environment untuk Cloud Run / production
	const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || conf.geminiKey || global.itsukiGeminiKey || global.geminiKey || '').trim();
	const geminiModel = (conf.geminiModel || global.itsukiGeminiModel || 'gemini-3.1-flash-lite').trim();

	return {
		apiUrl,
		apiKey,
		customModel,
		geminiKey,
		geminiModel
	};
}

function getGeminiClient(customApiKey = '') {
	const config = getItsukiConfig();
	const apiKey = (customApiKey || config.geminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
	if (!apiKey) return null;

	// Lewati jika key adalah placeholder atau key bocor yang diblokir
	if (apiKey === 'AIzaSyDyVcbniZLWNz9JAJD1iVLWrC9BK36SqoM') return null;

	if (!cachedGeminiClients.has(apiKey)) {
		cachedGeminiClients.set(apiKey, new GoogleGenAI({
			apiKey,
			httpOptions: {
				headers: {
					'User-Agent': 'aistudio-build'
				}
			}
		}));
	}
	return cachedGeminiClients.get(apiKey);
}

function extractAiText(data) {
	if (!data) return null;
	if (typeof data === 'string') {
		try {
			const parsed = JSON.parse(data);
			return extractAiText(parsed);
		} catch {
			return data.trim();
		}
	}
	if (typeof data.text === 'string' && data.text.trim()) return data.text.trim();
	if (typeof data.response === 'string' && data.response.trim()) return data.response.trim();
	if (typeof data.result === 'string' && data.result.trim()) return data.result.trim();
	if (typeof data.answer === 'string' && data.answer.trim()) return data.answer.trim();
	if (typeof data.reply === 'string' && data.reply.trim()) return data.reply.trim();
	if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
	if (typeof data.content === 'string' && data.content.trim()) return data.content.trim();
	if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
		const choice = data.choices[0];
		if (choice.message && typeof choice.message.content === 'string') return choice.message.content.trim();
		if (typeof choice.text === 'string') return choice.text.trim();
	}
	if (data.data) {
		const nested = extractAiText(data.data);
		if (nested) return nested;
	}
	return null;
}

/**
 * Provider 1: API Pihak Ketiga (Custom API URL)
 */
async function generateThirdPartyAI(messages = [], systemPrompt = '', config = null, timeoutMs = 12000) {
	const conf = config || getItsukiConfig();
	const apiUrl = conf.apiUrl;
	if (!apiUrl) throw new Error('API URL pihak ketiga kosong');

	const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
	const conversationHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Itsuki Nakano'}: ${m.content}`).join('\n');
	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan]:\n${conversationHistory}\n\nUser: ${lastUserMessage}\nItsuki Nakano:`;

	const headers = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
	};
	if (conf.apiKey) {
		headers['Authorization'] = `Bearer ${conf.apiKey}`;
		headers['x-api-key'] = conf.apiKey;
	}

	if (apiUrl.includes('{prompt}') || apiUrl.includes('{text}') || apiUrl.includes('{query}')) {
		const targetUrl = apiUrl
			.replace('{prompt}', encodeURIComponent(fullPrompt))
			.replace('{text}', encodeURIComponent(fullPrompt))
			.replace('{query}', encodeURIComponent(lastUserMessage));
		const res = await axios.get(targetUrl, { timeout: timeoutMs, headers });
		const text = extractAiText(res.data);
		if (text) return text;
	}

	try {
		const res = await axios.get(apiUrl, {
			params: { text: fullPrompt, prompt: fullPrompt, query: lastUserMessage },
			timeout: timeoutMs,
			headers
		});
		const text = extractAiText(res.data);
		if (text) return text;
	} catch {
		// lanjut ke POST
	}

	const openAiPayload = {
		model: conf.customModel || 'gpt-4o-mini',
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.slice(-8)
		],
		temperature: 0.85,
		max_tokens: 300
	};

	try {
		const res = await axios.post(apiUrl, openAiPayload, {
			timeout: timeoutMs,
			headers: { ...headers, 'Content-Type': 'application/json' }
		});
		const text = extractAiText(res.data);
		if (text) return text;
	} catch {
		// coba payload umum
	}

	throw new Error(`Tidak mendapat balasan valid dari API pihak ketiga: ${apiUrl}`);
}

/**
 * Provider 2: Google Gemini Resmi (@google/genai)
 */
async function generateGeminiDirect(messages = [], systemPrompt = '', timeoutMs = 12000, config = null) {
	const conf = config || getItsukiConfig();
	const availableKeys = [
		process.env.GEMINI_API_KEY,
		process.env.GOOGLE_API_KEY,
		conf.geminiKey
	].filter(k => k && typeof k === 'string' && k.trim().length > 10 && k.trim() !== 'AIzaSyDyVcbniZLWNz9JAJD1iVLWrC9BK36SqoM');

	const uniqueKeys = [...new Set(availableKeys.map(k => k.trim()))];
	if (uniqueKeys.length === 0) {
		throw new Error('GEMINI_API_KEY tidak tersedia di environment / settings.js');
	}

	const rawTurns = messages.slice(-10).map(m => ({
		role: m.role === 'user' ? 'user' : 'model',
		text: (m.content || '').trim()
	})).filter(m => m.text.length > 0);

	const sanitizedContents = [];
	for (const turn of rawTurns) {
		const last = sanitizedContents[sanitizedContents.length - 1];
		if (last && last.role === turn.role) {
			last.parts[0].text += `\n${turn.text}`;
		} else {
			sanitizedContents.push({
				role: turn.role,
				parts: [{ text: turn.text }]
			});
		}
	}

	while (sanitizedContents.length > 0 && sanitizedContents[0].role !== 'user') {
		sanitizedContents.shift();
	}

	if (sanitizedContents.length === 0) {
		sanitizedContents.push({
			role: 'user',
			parts: [{ text: 'Halo Itsuki' }]
		});
	}

	const userModel = conf.geminiModel || 'gemini-3.1-flash-lite';
	const candidateModels = [
		userModel,
		'gemini-3.1-flash-lite',
		'gemini-3.8-flash',
		'gemini-flash-latest'
	].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

	let lastError = null;

	for (const apiKey of uniqueKeys) {
		const ai = getGeminiClient(apiKey);
		if (!ai) continue;

		for (const model of candidateModels) {
			try {
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error(`Gemini timeout (${model})`)), timeoutMs)
				);

				const apiPromise = ai.models.generateContent({
					model,
					contents: sanitizedContents,
					config: {
						systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
						temperature: 0.85,
						topP: 0.95,
						maxOutputTokens: 350
					}
				});

				const res = await Promise.race([apiPromise, timeoutPromise]);
				if (res?.text && typeof res.text === 'string' && res.text.trim().length > 0) {
					return res.text.trim();
				}
			} catch (err) {
				lastError = err;
				console.warn(`[ItsukiAI:GeminiDirect] Model ${model} gagal (${err.message})`);
			}
		}
	}

	throw new Error(`Semua opsi Gemini Direct gagal: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Membersihkan dan memformat output Itsuki Nakano:
 * - WAJIB TEPAT 1 PARAGRAF TUNGGAL
 * - Ekspresi dalam kurung HARUS SINGKAT (maks 2-5 kata)
 * - Ekspresif, hidup, dan berkarakter anime nyata
 *
 * @param {string} text
 * @param {string} userName
 * @param {boolean} isOwner
 * @returns {string}
 */
export function sanitizeItsukiResponse(text = '', userName = 'Teman', isOwner = false) {
	if (!text || typeof text !== 'string') return '';

	let cleaned = text
		.replace(/^(Itsuki\s*(Nakano)?|Eatsuki|Assistant|AI)\s*[:：\-—]\s*/i, '')
		.replace(/^\[.*?\]\s*/i, '')
		.replace(/```[a-z]*\n?([\s\S]*?)```/gi, '$1')
		.trim();

	if (cleaned.includes('{NAME}')) {
		cleaned = cleaned.replace(/\{NAME\}/g, isOwner ? 'Shiro-sama' : userName);
	}

	cleaned = cleaned
		.replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, '')
		.replace(/[ \t]+/g, ' ')
		.trim();

	// Ringkas ekspresi dalam kurung jika terlalu panjang
	cleaned = cleaned.replace(/\(([^)]+)\)/g, (match, inner) => {
		const words = inner.trim().split(/\s+/);
		if (words.length > 5) {
			// Jika terlalu panjang, ambil intisari 2-4 kata
			const lower = inner.toLowerCase();
			if (lower.includes('makan') || lower.includes('nikuman') || lower.includes('kunyah')) {
				return '(mengunyah nikuman pelan)';
			} else if (lower.includes('pipi') || lower.includes('cemberut') || lower.includes('kesal')) {
				return '(pipi menggembung cemberut)';
			} else if (lower.includes('malu') || lower.includes('merona') || lower.includes('tersipu')) {
				return '(tersipu malu memalingkan wajah)';
			} else if (lower.includes('buku') || lower.includes('belajar') || lower.includes('kacamata')) {
				return '(merapikan kacamata baca bintang)';
			} else if (lower.includes('senyum') || lower.includes('ramah')) {
				return '(tersenyum ramah sopan)';
			}
			return `(${words.slice(0, 4).join(' ')})`;
		}
		return match;
	});

	// SATUKAN MENJADI 1 PARAGRAF TUNGGAL
	const sentences = cleaned
		.replace(/\n+/g, ' ')
		.split(/(?<=[.!?…~])\s+/)
		.map(s => s.trim())
		.filter(Boolean);

	let oneParagraph = '';
	if (sentences.length > 0) {
		// Batasi maksimal 3-4 kalimat agar tidak terlalu panjang di chat WhatsApp
		oneParagraph = sentences.slice(0, 4).join(' ').trim();
	} else {
		oneParagraph = cleaned.replace(/\n+/g, ' ').trim();
	}

	// Tambahkan sentuhan emoji ekspresif khas Itsuki jika belum ada
	const hasEmoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(oneParagraph);
	if (!hasEmoji && oneParagraph.length > 0) {
		oneParagraph += ' ⭐✨';
	}

	return oneParagraph;
}

/**
 * Provider 3: Free AI Scrapers
 */
async function scrapePollinationsOpenAI(messages = [], systemPrompt = '', timeoutMs = 3500) {
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
	throw new Error('Pollinations returned invalid data');
}

async function scrapeGpt4oFree(messages = [], systemPrompt = '', timeoutMs = 3500) {
	const historyText = messages.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Itsuki Nakano'}: ${m.content}`).join('\n\n');
	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan]:\n${historyText}\n\nRespon sebagai Itsuki Nakano dalam 1 paragraf:`;

	const res = await axios.get(`https://api.ryzendesu.vip/api/ai/gpt4o?text=${encodeURIComponent(fullPrompt)}`, {
		timeout: timeoutMs,
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
	});

	if (res?.data?.answer && typeof res.data.answer === 'string' && res.data.answer.trim().length > 0) {
		return res.data.answer.trim();
	}
	throw new Error('GPT-4o Free returned invalid response');
}

async function scrapeGeminiFree(messages = [], systemPrompt = '', timeoutMs = 3500) {
	const historyText = messages.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Itsuki Nakano'}: ${m.content}`).join('\n\n');
	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan]:\n${historyText}\n\nRespon sebagai Itsuki Nakano dalam 1 paragraf:`;

	const res = await axios.get(`https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(fullPrompt)}`, {
		timeout: timeoutMs,
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
	});

	if (res?.data?.answer && typeof res.data.answer === 'string' && res.data.answer.trim().length > 0) {
		return res.data.answer.trim();
	}
	throw new Error('Gemini Free returned invalid response');
}

async function scrapeClaudeFree(messages = [], systemPrompt = '', timeoutMs = 3500) {
	const historyText = messages.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Itsuki Nakano'}: ${m.content}`).join('\n\n');
	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan]:\n${historyText}\n\nRespon sebagai Itsuki Nakano dalam 1 paragraf:`;

	const res = await axios.get(`https://api.ryzendesu.vip/api/ai/claude?text=${encodeURIComponent(fullPrompt)}`, {
		timeout: timeoutMs,
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
	});

	if (res?.data?.answer && typeof res.data.answer === 'string' && res.data.answer.trim().length > 0) {
		return res.data.answer.trim();
	}
	throw new Error('Claude Free returned invalid response');
}

async function scrapeBlackboxFree(messages = [], systemPrompt = '', timeoutMs = 3500) {
	const historyText = messages.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Itsuki Nakano'}: ${m.content}`).join('\n\n');
	const fullPrompt = `${systemPrompt}\n\n[Riwayat Percakapan]:\n${historyText}\n\nRespon sebagai Itsuki Nakano dalam 1 paragraf:`;

	const res = await axios.get(`https://api.ryzendesu.vip/api/ai/blackbox?chat=${encodeURIComponent(fullPrompt)}`, {
		timeout: timeoutMs,
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
	});

	if (res?.data?.result && typeof res.data.result === 'string' && res.data.result.trim().length > 0) {
		return res.data.result.trim();
	}
	throw new Error('Blackbox Free returned invalid response');
}

/**
 * Provider 4: Fallback Contextual Dialogue Engine (100% Offline Safe)
 */
function fallbackItsukiDialogue(
	userMessage = '',
	userName = 'Teman',
	isOwner = false,
	relationship = null
) {
	const lower = (userMessage || '').toLowerCase();
	const callName = isOwner ? 'Shiro-sama' : (relationship?.type ? `${userName}` : `${userName}-san`);

	// 1. Respon Khusus Shiro-sama (Owner)
	if (isOwner) {
		if (lower.includes('makan') || lower.includes('nikuman') || lower.includes('lapar') || lower.includes('traktir')) {
			return `(mata berbinar penuh antusias) Ah, Shiro-sama! Apakah Anda ingin makan bersama? Sebenarnya aku baru saja melihat kedai nikuman hangat yang sangat lezat di dekat sini, kalau Shiro-sama berkenan, maukah Anda mencobanya bersamaku? ⭐🥟✨`;
		}
		if (lower.includes('belajar') || lower.includes('tugas') || lower.includes('semangat')) {
			return `(merapikan buku catatan dan tersenyum hormat) Terima kasih atas perhatian dan bimbingannya, Shiro-sama! Aku berjanji akan belajar lebih giat lagi agar kelak bisa menjadi guru yang membanggakan seperti ibu. 📖⭐✨`;
		}
		return `(tersenyum sopan dengan tatapan hangat) Halo Shiro-sama! Senang sekali Anda menyapa, apakah ada hal yang bisa kubantu, atau mungkin Shiro-sama butuh rekomendasi camilan manis untuk menemani hari ini? ⭐😊✨`;
	}

	// 2. Relasi Khusus Pacar / Suami
	if (relationship && relationship.type) {
		const rel = String(relationship.type).toLowerCase();
		if (rel.includes('suami') || rel.includes('pacar')) {
			if (lower.includes('sayang') || lower.includes('cinta') || lower.includes('cantik')) {
				return `(pipi merona merah padam sambil menunduk) M-Mu... kenapa kamu tiba-tiba bilang begitu di depan umum sih? Kamu selalu saja membuat jantungku berdebar kencang... sebagai gantinya, nanti temani aku makan puding bersama ya! 🍮😳⭐`;
			}
			return `(tersenyum manis menggenggam tanganmu) Halo ${callName}! Aku senang sekali bisa mengobrol denganmu hari ini, kamu sudah makan belum? Jangan sampai telat makan ya, nanti aku khawatir lho ⭐🥟💕`;
		}
	}

	// 3. Topik Makanan / Lapar / Nikuman / Eatsuki
	if (lower.includes('makan') || lower.includes('lapar') || lower.includes('nikuman') || lower.includes('bakpao') || lower.includes('rakus') || lower.includes('eatsuki') || lower.includes('gendut')) {
		if (lower.includes('rakus') || lower.includes('eatsuki') || lower.includes('gendut') || lower.includes('banyak makan')) {
			return `(pipi menggembung cemberut) Mu~! Siapa yang kamu panggil monster bakpao?! Aku makan banyak ini demi asupan nutrisi otak untuk belajar giat tahu, bukan karena rakus! 🥟⭐😤`;
		}
		return `(menatapmu dengan mata berbinar) Wah, ${callName} sedang membahas makanan enak ya? Kebetulan sekali aku sedang memikirkan nikuman daging hangat dan puding manis... kalau kamu punya rekomendasi kedai enak, tolong beritahu aku ya! 🥟⭐✨`;
	}

	// 4. Topik Belajar / Ujian / Tugas / Sekolah
	if (lower.includes('belajar') || lower.includes('ujian') || lower.includes('tugas') || lower.includes('pr') || lower.includes('sekolah') || lower.includes('guru')) {
		return `(merapikan kacamata baca bintang) Belajar memang butuh konsistensi dan kerja keras, ${callName}! Jangan mudah menyerah ya, mari kita sama-sama berjuang dan raih nilai terbaik demi masa depan kita! 📖⭐✨`;
	}

	// 5. Pujian / Gombalan / Cantik
	if (lower.includes('cantik') || lower.includes('manis') || lower.includes('imut') || lower.includes('lucu') || lower.includes('suka') || lower.includes('sayang')) {
		return `(tersipu malu memalingkan wajah) E-Eh...?! J-Jangan sembarangan memuji seperti itu, ${callName}! Kamu membuatku jadi salah tingkah dan tidak bisa konsentrasi membaca buku tahu... 😳⭐✨`;
	}

	// 6. Lelah / Sedih / Butuh Semangat
	if (lower.includes('lelah') || lower.includes('capek') || lower.includes('cape') || lower.includes('sedih') || lower.includes('pusing')) {
		return `(menatapmu cemas seraya menyodorkan camilan) ${callName}, kamu terlihat sangat lelah... istirahatlah sejenak dan makan sesuatu yang manis agar energimu cepat pulih kembali, ya? ⭐🍮✨`;
	}

	// 7. Sapaan Umum Default
	return `(tersenyum ramah seraya merapikan jepit bintang) Halo ${callName}! Senang sekali bisa berbincang denganmu hari ini, semoga harimu menyenangkan dan jangan lupa makan yang teratur ya! ⭐😊✨`;
}

/**
 * Fungsi utama untuk meminta respon AI Itsuki Nakano.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} systemPrompt
 * @param {Object} [meta]
 * @returns {Promise<string>}
 */
export async function scrapeItsukiChat(
	messages = [],
	systemPrompt = '',
	{
		userName = 'Teman',
		isOwner = false,
		relationship = null,
		allRelationships = [],
		mentionedEntities = []
	} = {}
) {
	const config = getItsukiConfig();

	// [1] Prioritas Utama: API Pihak Ketiga (Custom URL di settings.js)
	if (config.apiUrl) {
		try {
			console.log(`[ItsukiAI] Menggunakan API pihak ketiga: ${config.apiUrl}`);
			const rawResponse = await generateThirdPartyAI(messages, systemPrompt, config, 10000);
			if (rawResponse && typeof rawResponse === 'string' && rawResponse.trim().length > 0) {
				const sanitized = sanitizeItsukiResponse(rawResponse, userName, isOwner);
				if (sanitized && sanitized.length > 5) return sanitized;
			}
		} catch (err) {
			console.warn(`[ItsukiAI:ThirdParty] Gagal (${err.message}). Beralih ke Gemini resmi...`);
		}
	}

	// [2] Prioritas Kedua: Google Gemini Resmi (@google/genai)
	const hasGeminiKey = Boolean(config.geminiKey || process.env.GEMINI_API_KEY);
	if (hasGeminiKey) {
		try {
			console.log(`[ItsukiAI] Menggunakan Google Gemini resmi (@google/genai)`);
			const rawResponse = await generateGeminiDirect(messages, systemPrompt, 10000, config);
			if (rawResponse && typeof rawResponse === 'string' && rawResponse.trim().length > 0) {
				const sanitized = sanitizeItsukiResponse(rawResponse, userName, isOwner);
				if (sanitized && sanitized.length > 5) return sanitized;
			}
		} catch (err) {
			console.warn(`[ItsukiAI:GeminiOfficial] Gemini resmi gagal: ${err.message}. Beralih ke scraper gratis...`);
		}
	}

	// [3] Prioritas Ketiga: Multi-Provider Scraper AI Gratis (Konkuren Cepat)
	console.log(`[ItsukiAI] Menjalankan multi-provider scraper AI gratis`);
	const freeProviders = [
		scrapePollinationsOpenAI(messages, systemPrompt, 3500),
		scrapeGpt4oFree(messages, systemPrompt, 3500),
		scrapeGeminiFree(messages, systemPrompt, 3500),
		scrapeClaudeFree(messages, systemPrompt, 3500),
		scrapeBlackboxFree(messages, systemPrompt, 3500)
	];

	try {
		const rawResponse = await Promise.any(freeProviders);
		if (rawResponse && typeof rawResponse === 'string' && rawResponse.trim().length > 0) {
			const sanitized = sanitizeItsukiResponse(rawResponse, userName, isOwner);
			if (sanitized && sanitized.length > 5) return sanitized;
		}
	} catch {
		// Scraper gratis gagal / timeout, lanjut ke fallback dialog
	}

	// [4] Prioritas Keempat: Fallback Dialog Kontekstual Offline (100% Aman)
	console.log(`[ItsukiAI] Menggunakan fallback dialog kontekstual offline`);
	const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
	const offlineReply = fallbackItsukiDialogue(lastUserMsg, userName, isOwner, relationship);
	return sanitizeItsukiResponse(offlineReply, userName, isOwner);
}
