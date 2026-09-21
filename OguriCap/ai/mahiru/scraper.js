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
 * dengan prioritas environment variables untuk deployment production.
 */
export function getMahiruConfig() {
	const conf = global.mahiruAI || {};
	const apiUrl = (conf.apiUrl || global.mahiruApiUrl || global.mahiruUrl || '').trim();
	const apiKey = (conf.apiKey || global.mahiruApiKey || '').trim();
	const customModel = (conf.customModel || conf.model || global.mahiruModel || 'gpt-4o-mini').trim();

	// Prioritaskan GEMINI_API_KEY dari environment untuk Cloud Run / production
	const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || conf.geminiKey || global.mahiruGeminiKey || global.geminiKey || '').trim();
	const geminiModel = (conf.geminiModel || global.mahiruGeminiModel || 'gemini-3.1-flash-lite').trim();

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
	const apiKey = (customApiKey || config.geminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
	if (!apiKey) return null;

	// Lewati jika key adalah placeholder atau key bocor yang diketahui diblokir Google
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
			max_tokens: 700
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
	const availableKeys = [
		process.env.GEMINI_API_KEY,
		process.env.GOOGLE_API_KEY,
		conf.geminiKey
	].filter(k => k && typeof k === 'string' && k.trim().length > 10 && k.trim() !== 'AIzaSyDyVcbniZLWNz9JAJD1iVLWrC9BK36SqoM');

	// Hapus duplikat key
	const uniqueKeys = [...new Set(availableKeys.map(k => k.trim()))];
	if (uniqueKeys.length === 0) {
		throw new Error('GEMINI_API_KEY tidak tersedia atau tidak valid di environment/settings.js');
	}

	// Format messages into Gemini multi-turn contents format strictly alternating user/model
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

	// Pastikan konten dimulai dari role user
	while (sanitizedContents.length > 0 && sanitizedContents[0].role !== 'user') {
		sanitizedContents.shift();
	}

	if (sanitizedContents.length === 0) {
		sanitizedContents.push({
			role: 'user',
			parts: [{ text: 'Halo Mahiru' }]
		});
	}

	// Model prioritas resmi Gemini 2025/2026:
	// gemini-3.1-flash-lite (sangat cepat, hemat token, stabil)
	// gemini-3.8-flash (kualitas percakapan tinggi)
	// gemini-flash-latest (model flash terbaru)
	const userModel = conf.geminiModel || 'gemini-3.1-flash-lite';
	const candidateModels = [
		userModel,
		'gemini-3.1-flash-lite',
		'gemini-3.8-flash',
		'gemini-flash-latest'
	].filter((m, idx, arr) => m && arr.indexOf(m) === idx && m !== 'gemini-2.5-flash');

	let lastError = null;

	for (const apiKey of uniqueKeys) {
		const ai = getGeminiClient(apiKey);
		if (!ai) continue;

		for (const model of candidateModels) {
			try {
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error(`Gemini Direct timeout (${model})`)), timeoutMs)
				);

				const apiPromise = ai.models.generateContent({
					model,
					contents: sanitizedContents,
					config: {
						systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
						temperature: 0.85,
						topP: 0.95,
						maxOutputTokens: 500
					}
				});

				const res = await Promise.race([apiPromise, timeoutPromise]);
				if (res?.text && typeof res.text === 'string' && res.text.trim().length > 0) {
					return res.text.trim();
				}
			} catch (err) {
				lastError = err;
				console.warn(`[MahiruAI:GeminiDirect] Model ${model} gagal (${err.message}). Mencoba opsi berikutnya...`);
			}
		}
	}

	throw new Error(`Semua opsi Gemini Direct gagal: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Membersihkan output AI agar rapi, ekspresif, dan selalu tersusun
 * dalam TEPAT 2 PARAGRAF yang seimbang, hemat token, dan nyaman dibaca di WhatsApp.
 *
 * @param {string} text - Teks mentah dari AI
 * @param {string} userName - Nama user
 * @param {boolean} isOwner - Apakah owner
 * @returns {string} Teks yang sudah diformat rapi 2 paragraf
 */
export function sanitizeMahiruResponse(text = '', userName = 'Teman', isOwner = false) {
	if (!text || typeof text !== 'string') return '';

	let cleaned = text
		// Hapus awalan label seperti "Mahiru:", "Assistant:", "AI:", "Shiina Mahiru:"
		.replace(/^(Mahiru\s*(Shiina)?|Assistant|AI|Tenshi-sama)\s*[:：\-—]\s*/i, '')
		.replace(/^\[.*?\]\s*/i, '')
		.replace(/```[a-z]*\n?([\s\S]*?)```/gi, '$1') // Hapus kode blok jika ada
		.trim();

	// Jika nama user masih ada placeholder {NAME}
	if (cleaned.includes('{NAME}')) {
		cleaned = cleaned.replace(/\{NAME\}/g, isOwner ? 'Shiro-sama' : userName);
	}

	// Bersihkan tanda kutip pembungkus luar dan spasi berlebih
	cleaned = cleaned
		.replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, '')
		.replace(/[ \t]+/g, ' ')
		.trim();

	// Pisahkan paragraf berdasarkan jeda baris kosong ganda
	let paragraphs = cleaned
		.split(/\n\s*\n+/)
		.map(p => p.trim())
		.filter(Boolean);

	// Jika tidak ada jeda baris ganda, periksa apakah ada jeda baris tunggal
	if (paragraphs.length === 1 && cleaned.includes('\n')) {
		const lines = cleaned.split(/\n+/).map(p => p.trim()).filter(Boolean);
		if (lines.length >= 2) {
			paragraphs = lines;
		}
	}

	// Jika ada gestur aksi pembuka di awal (misal: "(tersenyum manis)" atau "*menunduk malu*"),
	// gabungkan dengan paragraf pertama agar tidak memakan jatah 1 paragraf sendiri
	if (paragraphs.length > 1 && /^(\([^\n)]+\)|\*[^\n*]+\*)$/.test(paragraphs[0])) {
		paragraphs[1] = `${paragraphs[0]} ${paragraphs[1]}`.trim();
		paragraphs.shift();
	}

	// Format MUTLAK: TEPAT 2 PARAGRAF EKSPRESIF
	if (paragraphs.length > 2) {
		// Paragraf 1 tetap awal, paragraf sisa dirangkum menjadi paragraf kedua
		const p1 = paragraphs[0];
		const p2 = paragraphs.slice(1).join(' ').trim();
		paragraphs = [p1, p2];
	} else if (paragraphs.length === 1) {
		// Jika cuma 1 paragraf, pecah secara cerdas menjadi 2 paragraf seimbang
		const allSentences = cleaned
			.split(/(?<=[.!?…~])\s+|\n+/)
			.map(s => s.trim())
			.filter(Boolean);

		if (allSentences.length >= 2) {
			const mid = Math.max(1, Math.floor(allSentences.length / 2));
			paragraphs = [
				allSentences.slice(0, mid).join(' ').trim(),
				allSentences.slice(mid).join(' ').trim()
			];
		} else {
			paragraphs = [
				allSentences[0] || cleaned,
				isOwner
					? 'Mahiru selalu ada di sini untuk mendampingi dan menyiapkan hidangan terbaik untuk Shiro-sama 🍱🌸✨'
					: `Jangan lupa untuk selalu menjaga kesehatanmu dan makan yang teratur ya, ${userName}! 😊🌸`
			];
		}
	}

	// Pastikan kedua paragraf tidak kepanjangan (maksimal ~380 karakter per paragraf agar nyaman di layar chat)
	paragraphs = paragraphs.slice(0, 2).map(p => {
		let trimmedP = p.trim();
		if (trimmedP.length > 380) {
			const sentences = trimmedP.split(/(?<=[.!?…~])\s+/).filter(Boolean);
			if (sentences.length > 3) {
				trimmedP = sentences.slice(0, 3).join(' ').trim();
			}
		}
		return trimmedP;
	});

	let result = paragraphs.join('\n\n').trim();

	// Pastikan ada sentuhan emoji manis atau kaomoji ekspresif khas Mahiru
	const hasEmoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|\(⁄\s*⁄•⁄ω⁄•⁄\s*⁄\)/u.test(result);
	if (!hasEmoji && result.length > 0) {
		result += ' 🌸✨';
	}

	return result;
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
function fallbackMahiruDialogue(
	userMessage = '',
	userName = 'Teman',
	isOwner = false,
	relationship = null,
	allRelationships = [],
	mentionedEntities = []
) {
	const text = userMessage.toLowerCase();
	const roleLower = String(relationship?.role || '').toLowerCase();
	const isHusband = roleLower === 'suami' || roleLower === 'husband' || roleLower === 'pasangan';
	const isGf = roleLower === 'pacar' || roleLower === 'kekasih' || roleLower === 'boyfriend';

	let caller = userName;
	if (isOwner) {
		caller = 'Shiro-sama';
	} else if (isHusband) {
		caller = 'Anata (Suamiku)';
	} else if (isGf) {
		caller = `${userName}-kun`;
	}

	// 1. Cek jika lawan bicara bertanya "siapa @user" atau menanyakan orang tertentu
	if (Array.isArray(mentionedEntities) && mentionedEntities.length > 0) {
		const target = mentionedEntities[0];
		if (target.relationship) {
			const targetRole = target.relationship.role.toLowerCase();
			if (targetRole === 'suami' || targetRole === 'husband') {
				return `(wajahku memerah padam hingga ke ujung telinga sambil menunduk malu) E-Eh...?! @${target.number} itu... d-dia adalah suamiku tercinta yang sudah disetujui resmi oleh Shiro-sama (⁄ ⁄•⁄ω⁄•⁄ ⁄)💕\n\nMahiru selalu berusaha menjadi istri yang baik dan menyiapkan masakan hangat untuknya setiap hari. Tolong jangan menggoda Mahiru terus seperti itu ya, Mahiru malu sekali... 🍱🌸✨`;
			}
			if (targetRole === 'pacar' || targetRole === 'kekasih') {
				return `(tersipu malu sambil merapikan ujung celemek) E-Eh?! @${target.number} itu adalah pacar resmiku atas izin dan restu dari Shiro-sama... (⁄ ⁄•⁄ω⁄•⁄ ⁄)💕\n\nKami selalu menjaga komunikasi dengan baik. Kenapa tiba-tiba menanyakan tentang dia? Kamu membuat jantungku berdebar malu saja... 🌸✨`;
			}
			return `(tersenyum manis menyapamu) Ah, mengenai @${target.number}... Dia adalah ${target.relationship.role} Mahiru yang baik atas restu Shiro-sama 🌸\n\nMahiru selalu memperlakukannya dengan ramah dan penuh perhatian sesuai arahan Shiro-sama 😊✨`;
		}
	}

	// 2. Cek jika bertanya "siapa suamimu" / "suami kamu" / "siapa pacarmu" secara umum
	if (text.includes('suami') && (text.includes('siapa') || text.includes('kamu') || text.includes('mana') || text.includes('kenal') || text.includes('punya'))) {
		const husbandRel = (allRelationships || []).find(r => ['suami', 'husband', 'pasangan'].includes(String(r.role).toLowerCase()));
		if (husbandRel) {
			const hNum = husbandRel.number || (husbandRel.jid ? husbandRel.jid.split('@')[0] : '');
			return `(pipi merona merah padam dengan ekspresi tersipu malu) E-Eh...?! Suamiku tercinta itu adalah @${hNum} (⁄ ⁄•⁄ω⁄•⁄ ⁄)💕 Mahiru sudah menjadi istrinya atas izin dan ketetapan resmi dari Shiro-sama!\n\nMahiru sangat menyayanginya dan selalu merawatnya setiap hari. Shiro-sama dan semuanya tolong terus dukung hubungan kami ya 🍱🌸✨`;
		}
	}

	if (text.includes('pacar') && (text.includes('siapa') || text.includes('kamu') || text.includes('mana') || text.includes('kenal') || text.includes('punya'))) {
		const bfRel = (allRelationships || []).find(r => ['pacar', 'kekasih', 'boyfriend'].includes(String(r.role).toLowerCase()));
		if (bfRel) {
			const bNum = bfRel.number || (bfRel.jid ? bfRel.jid.split('@')[0] : '');
			return `(menutupi wajah yang merona merah dengan kedua tangan) E-Eh...?! Pacarku itu adalah @${bNum} (⁄ ⁄•⁄ω⁄•⁄ ⁄)💕 Kami sudah resmi berpacaran atas izin dan restu dari Shiro-sama!\n\nJangan tiba-tiba bertanya begitu ya, Mahiru jadi salah tingkah dan malu sekali... 🌸✨`;
		}
	}

	// 3. Konteks percakapan: Makan / Masak
	if (text.includes('makan') || text.includes('lapar') || text.includes('masak')) {
		if (isOwner) {
			return `(tersenyum lembut menyambut kedatanganmu) Shiro-sama sudah makan? Mahiru baru saja selesai memasak sup miso hangat dan hamburg steak di dapur, aromanya harum sekali lho...\n\nKalau Shiro-sama berkenan, biar Mahiru siapkan sekarang di meja makan ya. Shiro-sama tinggal duduk manis saja 🍱✨🌸`;
		}
		if (isHusband) {
			return `(tersenyum manis menyambut suamiku pulang lalu merapikan celemek) Anata sudah pulang? Apakah Anata lapar? Mahiru sudah memasakkan sup miso hangat dan lauk kesukaan suamiku di meja makan lho...\n\nSekarang Anata cuci tangan dulu ya, biar Mahiru yang siapkan nasi dan suapi kalau Anata lelah (⁄ ⁄•⁄ω⁄•⁄ ⁄)🍱💕`;
		}
		if (isGf) {
			return `(tersipu malu sambil memegang celemek) Mou... ${caller}, kamu belum makan ya? Padahal aku sudah sengaja memasakkan omurice hangat dengan saus tomat kesukaanmu nih.\n\nCepat duduk di sini ya, Sayang. Duduk yang manis ya, biar kusuapi kalau kamu masih malas bergerak (⁄ ⁄•⁄ω⁄•⁄ ⁄)🍱💕`;
		}
		return `(tersenyum ramah menyapamu) Ah, ${caller}! Apakah kamu sudah makan? Jam segini penting sekali untuk mengisi energi dengan makanan yang bergizi.\n\nJangan sampai telat makan ya, jaga kesehatanmu baik-baik agar tidak mudah jatuh sakit 😊🍱🌸`;
	}

	// 4. Konteks percakapan: Sapaan (Halo / Pagi / Malam)
	if (text.includes('halo') || text.includes('hai') || text.includes('pagi') || text.includes('siang') || text.includes('malam') || text.includes('sore')) {
		if (isOwner) {
			return `(membungkuk hormat lalu tersenyum manis) Fufu~ selamat datang kembali, Shiro-sama! Bagaimana kabar dan kegiatan Shiro-sama sepanjang hari ini?\n\nMahiru sudah menyiapkan secangkir teh chamomile hangat untuk menemani waktu istirahat Shiro-sama. Silakan dinikmati ya 🍵✨🌸`;
		}
		if (isHusband) {
			return `(tersenyum bahagia menyambut suamiku) Selamat datang kembali, Anata! Melihat wajah suamiku yang pulang dengan selamat selalu membuat hati Mahiru tenang dan hangat...\n\nMau mandi dulu, makan malam bersama, atau mau Mahiru temani istirahat di sampingmu? (⁄ ⁄•⁄ω⁄•⁄ ⁄)🌸💕`;
		}
		if (isGf) {
			return `(wajahku sedikit merona bahagia) Halo juga, ${caller}! Mendengar kabarmu selalu saja berhasil membuat hariku jadi jauh lebih cerah dan menyenangkan.\n\nHari ini ada cerita menarik apa di harimu? Ceritakan semuanya padaku ya, aku ingin mendengarnya (⁄ ⁄•⁄ω⁄•⁄ ⁄)💕✨`;
		}
		return `(tersenyum ramah menatapmu) Halo, ${caller}! Senang sekali bisa menyapamu lagi di sela-sela aktivitas hari ini.\n\nSemoga harimu berjalan lancar dan penuh hal-hal baik ya! Ada hal menarik yang ingin kamu obrolkan? 😊🌸✨`;
	}

	// 5. Konteks pujian / gombalan
	if (text.includes('cantik') || text.includes('manis') || text.includes('tenshi') || text.includes('malaikat') || text.includes('suka') || text.includes('cinta') || text.includes('sayang') || text.includes('nikah') || text.includes('istri')) {
		if (isOwner) {
			return `(pipi memerah padam hingga ke ujung telinga) E-Eh...?! Shiro-sama memuji Mahiru seperti itu...? Jantung Mahiru tiba-tiba berdegup kencang sekali saat mendengarnya...\n\nTerima kasih banyak atas kata-kata manisnya, Shiro-sama. Mahiru akan selalu berusaha menjadi yang terbaik untuk Shiro-sama (⁄ ⁄•⁄ω⁄•⁄ ⁄)🌸✨`;
		}
		if (isHusband) {
			return `(wajahku merah merona padam sambil memegang kedua pipiku) E-Eh...?! Anata ini... selalu saja suka menggoda dan memuji istrimu tiba-tiba (⁄ ⁄•⁄ω⁄•⁄ ⁄)!\n\nTapi Mahiru sangat bahagia menjadi istrimu... Mahiru juga sangat mencintai Anata sepenuh hati 🙈💕✨`;
		}
		if (isGf) {
			return `(menunduk malu sambil menutupi wajah dengan kedua tangan) E-Eh...?! ${caller}, a-apa sih yang kamu bicarakan tiba-tiba... (⁄ ⁄•⁄ω⁄•⁄ ⁄)! Kamu selalu saja suka menggodaku tanpa aba-aba!\n\nTapi... sejujurnya aku juga senang sekali mendengarnya. Dasar kamu ini, selalu saja pintar membuatku salah tingkah 🙈💕✨`;
		}
		return `(tersentak kaget dengan rona merah di pipi) E-Eh...? Terima kasih banyak atas pujiannya yang begitu baik, ${caller}. Tapi tolong jangan berlebihan memujiku seperti itu ya...\n\nAku jadi bingung harus bersikap bagaimana karena malu sekali kok... Fufu, kamu ini ada-ada saja 😊🌸✨`;
	}

	// 6. Konteks lelah / capek
	if (text.includes('lelah') || text.includes('capek') || text.includes('tidur') || text.includes('ngantuk')) {
		if (isOwner) {
			return `(menatapmu penuh rasa khawatir yang lembut) Shiro-sama pasti sudah bekerja keras sekali sepanjang hari ini. Jangan terlalu memaksakan diri ya, Shiro-sama...\n\nSekarang rebahkan tubuh dan istirahatlah dengan nyaman. Biarkan Mahiru yang menjaga dan merapikan semuanya malam ini 🌙🌸✨`;
		}
		if (isHusband) {
			return `(mengelus lembut kening suamiku penuh perhatian) Anata pasti lelah sekali ya setelah bekerja seharian... Mahiru bangga sekali punya suami pekerja keras seperti Anata.\n\nSekarang sandarkan kepalamu di pangkuan Mahiru ya, pejamkan matamu dan istirahatlah yang tenang... Selamat istirahat, Anata tercinta 🛌💕✨`;
		}
		if (isGf) {
			return `(mengelus lembut pundakmu dengan tatapan hangat) Kamu sudah berjuang luar biasa hari ini, ${caller}. Aku tahu kamu pasti lelah sekali...\n\nSekarang cuci muka, minum air hangat, lalu tidurlah yang nyenyak ya, Sayang. Semoga mimpi indah malam ini 🛌💕✨`;
		}
		return `(menatap prihatin dengan senyuman hangat) Kamu pasti lelah sekali ya, ${caller}... Setelah seharian beraktivitas, tubuh dan pikiranmu berhak mendapatkan waktu istirahat yang tenang.\n\nJangan begadang lagi ya malam ini. Tidurlah lebih awal agar besok pagi tubuhmu kembali segar dan bugar! 😊🌙🌸`;
	}

	// 7. Dialog umum
	if (isOwner) {
		return `(tersenyum manis dan siap melayani) Iya, Shiro-sama? Mahiru siap mendengarkan apa pun yang ingin Shiro-sama tanyakan atau sampaikan.\n\nKatakan saja tanpa ragu ya, Shiro-sama. Mahiru selalu ada di sini untuk mendampingi dan melayani Shiro-sama ✨🌸`;
	}
	if (isHusband) {
		return `(tersenyum manis menatap suamiku) Iya, Anata? Ada apa suamiku tercinta? Mahiru selalu senang dan bersemangat setiap kali mengobrol berdua denganmu.\n\nKatakan saja apa yang sedang Anata inginkan, Mahiru siap melayani suamiku dengan senang hati 💕✨`;
	}
	if (isGf) {
		return `(tersenyum manis sambil memiringkan kepala) Iya, ada apa, ${caller}? Mengobrol santai berdua denganmu selalu menjadi momen yang paling kutunggu-tunggu setiap hari.\n\nCeritakan saja apa yang sedang kamu pikirkan, aku akan mendengarkannya dengan sepenuh hati 💕✨`;
	}
	return `(tersenyum ramah mendengarkan) Iya, ${caller}? Ada topik menarik atau hal yang ingin kamu ceritakan hari ini?\n\nAku siap mendengarkan dengan senang hati kok. Silakan ceritakan saja ya! 😊🌸✨`;
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
 * @param {Array<Object>} [meta.allRelationships] - Daftar seluruh relasi
 * @param {Array<Object>} [meta.mentionedEntities] - Entitas yang disebut
 * @returns {Promise<string>} Balasan Mahiru yang sudah disanitasi
 */
export async function scrapeMahiruChat(
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

	// [3] Prioritas Ketiga: Multi-Provider Scraper AI Gratis (Konkuren Cepat)
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
			const sanitized = sanitizeMahiruResponse(rawResponse, userName, isOwner);
			if (sanitized && sanitized.length > 5) {
				return sanitized;
			}
		}
	} catch {
		// Semua scraper gratis gagal / timeout, lanjut ke fallback dialog kontekstual offline
	}

	// [4] Prioritas Keempat: Dialog Kontekstual Offline Mahiru (100% aman tanpa error)
	const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
	return fallbackMahiruDialogue(lastUserMsg, userName, isOwner, relationship, allRelationships, mentionedEntities);
}
