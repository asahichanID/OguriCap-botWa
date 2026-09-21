/**
 * OguriCap/random/cekEngine.js
 * ---------------------------------------------------------
 * Engine sistem random check dengan Anti-Repeat Shuffled Queue.
 * Mengatur:
 * - Anti-repeat persentase & tiering teks dengan shuffled pool
 * - Shuffled queue untuk variasi teks per range (rendah, sedang, tinggi)
 * - Shuffled queue untuk rekomendasi/random kategori jika diminta
 * - Pencocokan kategori (case-insensitive, alias, trimming)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'cekData.json');

// Memuat data kategori dari JSON
let categoriesData = {};
try {
	const raw = fs.readFileSync(DATA_FILE, 'utf-8');
	categoriesData = JSON.parse(raw);
} catch (e) {
	console.error('[CekRandomEngine] Gagal membaca cekData.json:', e);
	categoriesData = {};
}

// Memory pool per key untuk anti-repeat hasil
// Key format: `${chatId}:${targetId}:${normalizedCategory}`
const antiRepeatPools = new Map();

/**
 * Fisher-Yates shuffle untuk mengacak array secara merata
 * @param {Array} array 
 * @returns {Array} Shuffled shallow copy
 */
export function shuffleArray(array) {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

/**
 * Generate pool persentase terdistribusi yang diacak
 * @returns {number[]} Array 0-100 yang ter-shuffle
 */
function generatePercentagePool() {
	const pool = [];
	for (let i = 0; i <= 100; i++) {
		pool.push(i);
	}
	return shuffleArray(pool);
}

/**
 * Membuat atau memperbarui pool antrean teks anti-repeat
 * @param {string[]} listText 
 * @returns {string[]} Shuffled list
 */
function createTextPool(listText) {
	if (!listText || listText.length === 0) return [];
	return shuffleArray(listText);
}

/**
 * Ambil item berikutnya dari state queue.
 * Jika antrean habis, reset dan shuffle ulang (Anti-repeat).
 * @param {string} poolKey 
 * @param {string} subKey ('percent' | 'low' | 'mid' | 'high')
 * @param {Function} generatorFn 
 * @returns {*} Item dari pool
 */
function getNextFromPool(poolKey, subKey, generatorFn) {
	if (!antiRepeatPools.has(poolKey)) {
		antiRepeatPools.set(poolKey, {});
	}
	const state = antiRepeatPools.get(poolKey);

	if (!state[subKey] || !Array.isArray(state[subKey]) || state[subKey].length === 0) {
		state[subKey] = generatorFn();
	}

	return state[subKey].pop();
}

/**
 * Normalisasi query kategori (buang whitespace berlebih, lowercase, dll)
 * @param {string} category 
 * @returns {string}
 */
export function normalizeCategory(category = '') {
	return String(category || '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');
}

// Alias pemetaan sinonim atau kata gaul umum
const CATEGORY_ALIASES = {
	stres: 'stress',
	setres: 'stress',
	depresi: 'stress',
	pusing: 'stress',
	cakep: 'ganteng',
	tampan: 'ganteng',
	cantik: 'cantik',
	anggun: 'feminim',
	gemoy: 'imut',
	lucu: 'imut',
	mager: 'pemalas',
	malas: 'pemalas',
	woles: 'santuy',
	selow: 'santuy',
	slow: 'santuy',
	baper: 'baperan',
	sange: 'sangean',
	horny: 'sangean',
	kaya: 'sultan',
	tajir: 'sultan',
	pinter: 'pintar',
	cerdas: 'pintar',
	bodoh: 'goblok',
	tolol: 'goblok',
	bego: 'goblok',
	dungu: 'goblok',
	konyol: 'receh',
	lawak: 'receh',
	humor: 'humoris',
	jutek: 'cuek',
	dingin: 'cuek',
	setia: 'setia',
	selingkuh: 'buaya',
	fakboy: 'buaya',
	playboy: 'buaya'
};

/**
 * Mencari data kategori dari cekData.json.
 * @param {string} category 
 * @returns {{ key: string, data: Object } | null}
 */
export function findCategoryData(category) {
	const norm = normalizeCategory(category);
	if (!norm) return null;

	// 0. Cek dictionary alias
	const aliased = CATEGORY_ALIASES[norm];
	if (aliased && categoriesData[aliased]) {
		return { key: aliased, data: categoriesData[aliased] };
	}

	// 1. Cek exact match key
	if (categoriesData[norm]) {
		return { key: norm, data: categoriesData[norm] };
	}

	// 2. Cek apakah ada alias atau kecocokan tanpa imbuhan umum (e.g., 'si gila' -> 'gila')
	const stripped = norm.replace(/^(si|ter|paling|agak|sangat|super)\s+/i, '');
	if (CATEGORY_ALIASES[stripped] && categoriesData[CATEGORY_ALIASES[stripped]]) {
		const targetKey = CATEGORY_ALIASES[stripped];
		return { key: targetKey, data: categoriesData[targetKey] };
	}
	if (categoriesData[stripped]) {
		return { key: stripped, data: categoriesData[stripped] };
	}

	// 3. Cek di daftar key dengan plural/singular atau variasi
	const keys = Object.keys(categoriesData);
	const matchedKey = keys.find(k => k === norm || k === stripped);
	if (matchedKey) {
		return { key: matchedKey, data: categoriesData[matchedKey] };
	}

	return null;
}

/**
 * Mengambil persentase acak dengan anti-repeat pool
 * @param {string} poolKey 
 * @returns {number} 0 - 100
 */
export function getShuffledPercentage(poolKey) {
	const val = getNextFromPool(poolKey, 'percent', generatePercentagePool);
	return typeof val === 'number' ? val : Math.floor(Math.random() * 101);
}

/**
 * Mendapatkan teks tanggapan kontekstual berdasarkan persentase
 * Aturan persentase:
 * - 0% - 40% : Ejekan / roast / rendah
 * - 41% - 80% : Normal / seimbang / wajar (50-80% sesuai prompt)
 * - 81% - 100% : Pujian / reaksi ekstrem (90-100% sesuai prompt)
 * 
 * @param {string} poolKey 
 * @param {Object} catData 
 * @param {number} percentage 
 * @returns {string|null} Teks deskriptif
 */
export function getContextualText(poolKey, catData, percentage) {
	if (!catData || !catData.responses) return null;

	let tier = 'mid';
	if (percentage <= 40) {
		tier = 'low';
	} else if (percentage >= 81) {
		tier = 'high';
	} else {
		tier = 'mid';
	}

	const list = catData.responses[tier];
	if (!list || list.length === 0) return null;

	return getNextFromPool(poolKey, tier, () => createTextPool(list));
}

/**
 * List semua kategori yang tersedia
 * @returns {string[]}
 */
export function getAllCategories() {
	return Object.keys(categoriesData);
}

/**
 * Ambil kategori acak jika user tidak mengetik kategori
 * @param {string} poolKey 
 * @returns {string}
 */
export function getRandomCategory(poolKey) {
	const all = getAllCategories();
	if (all.length === 0) return 'hoki';
	return getNextFromPool(poolKey, 'categoryPool', () => shuffleArray(all));
}

/**
 * Generate visual progress bar (10 kotak)
 * @param {number} percent 
 * @returns {string}
 */
export function generateProgressBar(percent) {
	const filledCount = Math.round(percent / 10);
	const emptyCount = 10 - filledCount;
	return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}

/**
 * Ambil badge/status rating berdasarkan persentase
 * @param {number} percent 
 * @returns {string}
 */
export function getRatingBadge(percent) {
	if (percent >= 95) return '👑 Legendary / Mutlak';
	if (percent >= 85) return '🔥 Ekstrem Tinggi';
	if (percent >= 70) return '✨ Sangat Dominan';
	if (percent >= 50) return '⚖️ Rata-rata / Lumayan';
	if (percent >= 30) return '📉 Tipis-tipis';
	if (percent >= 10) return '⚠️ Sangat Rendah';
	return '💀 Ampas / Hampir Nol';
}
