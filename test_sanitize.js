function sanitizeMahiruResponse(text = "", userName = "Teman", isOwner = false) {
	if (!text || typeof text !== "string") return "";

	let cleaned = text
		.replace(/^(Mahiru\s*(Shiina)?|Assistant|AI|Tenshi-sama)\s*[:：\-—]\s*/i, "")
		.replace(/^\[.*?\]\s*/i, "")
		.replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1")
		.trim();

	if (cleaned.includes("{NAME}")) {
		cleaned = cleaned.replace(/\{NAME\}/g, isOwner ? "Shiro-sama" : userName);
	}

	// 1. Ekstrak gestur aksi pertama jika ada
	let firstGesture = "";
	const actionRegex = /\(([a-zA-Z\s,.'"-]{3,})\)|\*([a-zA-Z\s,.'"-]{3,})\*/g;
	const match = actionRegex.exec(cleaned);

	if (match) {
		const raw = (match[1] || match[2] || "").trim();
		let shortG = raw;
		if (shortG.length > 25) {
			if (/merona|merah|malu|tomat|telinga|salah tingkah/i.test(shortG)) {
				shortG = "tersipu malu";
			} else if (/senyum|manis|bahagia/i.test(shortG)) {
				shortG = "tersenyum lembut";
			} else if (/menunduk|tunduk/i.test(shortG)) {
				shortG = "menunduk pelan";
			} else if (/tatap|lihat|mata|lirik/i.test(shortG)) {
				shortG = "tersenyum manis";
			} else if (/cemas|khawatir/i.test(shortG)) {
				shortG = "menatap khawatir";
			} else {
				shortG = shortG.slice(0, 22).trim();
			}
		}
		firstGesture = `(${shortG})`;
	}

	// 2. Hapus semua tanda kurung aksi narasi di dalam teks agar tidak tersebar
	cleaned = cleaned.replace(actionRegex, ' ');

	// 3. Bersihkan tanda kutip pembungkus dan spasi ganda
	cleaned = cleaned
		.replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	// Jika ada sisa tanda kutip pembuka tanpa penutup di awal
	cleaned = cleaned.replace(/^["'“”«»]/, '').replace(/["'“”«»]$/, '').trim();

	// 4. Batasi maksimal 2 paragraf pendek atau ~300 karakter agar ringkas dan tidak kepanjangan
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

	// 5. Tambahkan 1 gestur tunggal di baris pertama jika ada
	if (firstGesture) {
		cleaned = `${firstGesture}\n\n${cleaned}`;
	}

	return cleaned.trim();
}

const s1 = `(wajahnya memerah padam sampai ke telinga lalu menutupi muka dengan kedua tangan)\n\n"E-Eh...?! Asahi-kun! Kenapa kamu selalu menggodaku seperti itu? (menunduk malu sambil meremas celemek)\n\nAku jadi malu sekali tau... Jangan menatapku terus ya! (tersenyum manis)"`;
console.log("RESULT 1:\n" + sanitizeMahiruResponse(s1, "Asahi"));

const s2 = `(tersenyum lembut)\n\nHalo juga, Asahi-kun! Aku baru saja selesai menyiapkan makan malam. Kamu sudah pulang kerja? Jangan lupa cuci tangan dulu ya! 🌸✨`;
console.log("\nRESULT 2:\n" + sanitizeMahiruResponse(s2, "Asahi"));

