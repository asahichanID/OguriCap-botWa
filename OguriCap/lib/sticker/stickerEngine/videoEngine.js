/**
 * ============================================================
 *  Sticker Engine V2 — Video Engine
 * ============================================================
 *
 * Tujuan: Validasi durasi, validasi resolusi, dan menyiapkan
 * ("prepare") task siap pakai untuk FFmpeg Engine. Video Engine
 * SENDIRI TIDAK melakukan transcoding berat — itulah sebabnya
 * Performance Target-nya jauh lebih ketat (< 100 ms) dibanding
 * FFmpeg Engine (500 – 2500 ms): Pipeline diagram pada
 * ARCHITECTURE.md menggambarkan "Video Engine -> FFmpeg Engine"
 * sebagai DUA tahap Pipeline terpisah yang dijalankan Sticker
 * Engine (orchestrator), bukan Video Engine memanggil FFmpeg
 * Engine secara internal.
 *
 * Public API : process(context)
 * Return     : { task, metadata }
 * Error      : Duration Too Long, Unsupported Codec, Invalid Video
 * Performance Target : < 100 ms
 *
 * Dependency Rule: Metadata Engine (metadata sudah tersedia lewat
 * context.metadata, diisi Media Engine) + FFmpeg Engine (relasi data
 * lewat `task`, TANPA memanggil execute() di sini). TIDAK memakai
 * Canvas/Font/Emoji Engine.
 * ============================================================
 */

import { StickerEngineError, ERROR_CODES, createLogger, PERFORMANCE_TARGET, STICKER_LIMITS } from './constants.js'

const logger = createLogger('VideoEngine')

/**
 * process(context): nama internal `processVideo` (bukan `process`) supaya
 * tidak men-shadow object global Node.js `process`.
 */
async function processVideo(context) {
	const start = process.hrtime.bigint()

	if (!context || !Buffer.isBuffer(context.buffer) || context.buffer.length === 0) {
		throw new StickerEngineError('VideoEngine', ERROR_CODES.INVALID_VIDEO, 'context.buffer harus berupa Buffer video/animasi yang valid.')
	}

	const metadata = context.metadata || {}
	const cfg = context.config || {}

	if (metadata.width < 0 || metadata.height < 0) {
		throw new StickerEngineError('VideoEngine', ERROR_CODES.INVALID_VIDEO, 'Resolusi video tidak terbaca dengan benar.')
	}

	// Validasi durasi — jaring pengaman (defense in depth) di level Engine,
	// terlepas dari validasi yang sudah ada di command layer (naze.js, mis.
	// batas 11 detik pada command .sticker/.take/dst — TIDAK diubah/di-duplicate
	// di sini, hanya dipastikan tidak ada input yang jauh di luar nalar yang
	// lolos lewat jalur lain di masa depan).
	// Batasi durasi stiker animasi maksimal 7 detik agar aman di protokol WhatsApp
	const maxAllowedDuration = 7.0
	const maxDuration = Math.min(cfg.video?.maxDurationSec || STICKER_LIMITS.maxDurationSec, maxAllowedDuration)
	if (metadata.duration && metadata.duration > maxDuration * 6) {
		throw new StickerEngineError(
			'VideoEngine',
			ERROR_CODES.DURATION_TOO_LONG,
			`Durasi video (${metadata.duration.toFixed(1)}s) jauh melebihi batas wajar (${maxDuration}s).`
		)
	}
	const duration = Math.min(metadata.duration || maxDuration, maxDuration)

	const maxDim = cfg.video?.maxDimension || STICKER_LIMITS.maxDimension
	
	// Deteksi format input khusus: Animated WebP (Stiker Video / WebP animasi)
	const isAnimatedWebp = (context.mime === 'image/webp' || metadata.format === 'webp') && Boolean(metadata.animated)

	// Pertahankan FPS asli media agar kecepatan gerak 100% identik dengan file original
	const rawFps = metadata.fps && metadata.fps > 0 ? Math.round(metadata.fps) : (isAnimatedWebp ? 15 : 30)
	const inputSize = context.buffer ? context.buffer.length : 0
	const isLargeVideo = inputSize >= 3_000_000

	let fps = rawFps
	let quality = 45

	if (isAnimatedWebp) {
		// Untuk stiker animasi WebP: FPS harus sama persis dengan FPS aslinya agar gerakannya tidak percepat
		fps = rawFps
		quality = 48
	} else if (isLargeVideo) {
		fps = Math.min(30, rawFps)
		quality = 40
	} else if (duration <= 3.5) {
		fps = rawFps
		quality = 48
	} else if (duration <= 5.5) {
		fps = Math.min(30, Math.max(20, rawFps))
		quality = 42
	} else {
		fps = Math.min(24, Math.max(15, rawFps))
		quality = 38
	}

	// task: instruksi siap pakai untuk FFmpeg Engine pada tahap Pipeline berikutnya.
	const task = {
		inputPath: context._tempInputPath || undefined,
		input: context._tempInputPath ? undefined : context.buffer,
		inputExt: isAnimatedWebp ? 'webp' : 'input',
		isAnimatedWebp,
		size: maxDim,
		fps,
		inputFps: rawFps,
		duration,
		quality,
		overlayPath: context.overlayPath || undefined,
		crop: Boolean(context.options?.crop),
		resource: context.resource
	}

	const resultMetadata = {
		...metadata,
		width: maxDim,
		height: maxDim,
		fps,
		duration,
		animated: true
	}

	const ms = Number(process.hrtime.bigint() - start) / 1_000_000
	if (ms > PERFORMANCE_TARGET.video) logger.warn(`process() melebihi target performa: ${ms.toFixed(2)}ms`)
	else logger.debug(`process() selesai ${ms.toFixed(2)}ms (durasi=${duration}s fps=${fps})`)

	return { task, metadata: resultMetadata }
}

export const videoEngine = {
	process: processVideo
}

export default videoEngine
