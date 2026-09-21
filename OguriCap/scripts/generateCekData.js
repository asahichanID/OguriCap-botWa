import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_FILE = path.join(__dirname, 'cekData.json');

// Definisi 165 Kategori Gaul & Unik:
// Format: [key, title, emoji, [low: 0-40%], [mid: 41-80%], [high: 81-100%]]
const rawCategories = [
	// ========================
	// 1. PENAMPILAN & VISUAL
	// ========================
	[
		"ganteng", "Ganteng", "😎",
		[
			"Waduh bro, ketolong filter doang itu juga masih ngos-ngosan.",
			"Kamera depan auto ngeblur saking gak sanggupnya nangkep visualmu.",
			"Ganteng lu kayak sinyal di pelosok gunung, ada tapi tipis banget.",
			"Mending fokus kembangin skill dan kepribadian aja ya, lebih prospek."
		],
		[
			"Standar cowok ramah alfamart lah ya, enak dilihat dan gak bikin kaget.",
			"Cakepnya pas, gak bikin silau tapi lumayan bikin orang noleh dua kali.",
			"Kategori manis lumayan, modal sisiran dikit udah aman buat nongkrong.",
			"Bukan model majalah, tapi kalau senyum manisnya dapet kok."
		],
		[
			"Anjir keturunan dewa Olympus dari mana ini? Visualnya bikin overthinking se-kecamatan!",
			"Aura pangeran manhwa tumpah-tumpah, cewek auto salting kalau tatap mata!",
			"Gantengnya gak ada obat, malaikat maut aja sungkan mau nyabut saking cakepnya!",
			"Definisi ganteng mutlak no debat, kamera analog pun auto jernih!"
		]
	],
	[
		"cantik", "Cantik", "✨",
		[
			"Cantiknya masih dalam tahap konsep blueprint, belum ada realisasi.",
			"Filter instagram menangis melihat kenyataan di dunia nyata.",
			"Bagusan pas lampu mati, auranya lebih dapet misteriusnya.",
			"Lumayan lah ya buat nakut-nakutin tikus di loteng rumah."
		],
		[
			"Manis alami tanpa pemanis buatan, adem dipandang kayak es kelapa muda.",
			"Cantik khas cewek santai, dipakein kaos oblong aja udah enak dilihat.",
			"Tipe cantik yang makin lama diliat makin nagih, gak bosenin.",
			"Parasnya ramah lingkungan dan bikin suasana hati langsung adem."
		],
		[
			"Bidadari kahyangan turun ke bumi nyasar ke grup WA! Visualnya luar nalar!",
			"Aura cantiknya setara ratu kerajaan, sekali senyum cowok-cowok auto lumpuh!",
			"Gila sih cantiknya unreal banget, filter IG aja minder sama aslinya!",
			"Pesona mahakarya tuhan yang paling paripurna, gak ada celah secuilpun!"
		]
	],
	[
		"kece", "Kece", "🕶️",
		[
			"Bukannya kece malah kayak mau ronda malam keliling komplek.",
			"Outfit lu tabrakan warna sampe polisi lalu lintas mau nilang.",
			"Gaya lu maksa banget sumpah, kayak bocil baru kenal fashion hypebeast.",
			"Aura kece lu tertimbun beban hidup 7 turunan."
		],
		[
			"Gayanya asik dan masuk di tongkrongan, gak lebay gak kaku.",
			"Outfit matching, vibesnya dapet, enak diliat pas lagi jalan santai.",
			"Lumayan keren lah, udah cocok diajak foto OOTD estetik.",
			"Stylenya santai tapi tetep punya karakter tersendiri."
		],
		[
			"Keren maksimal bro! Sekali pose kamera langsung auto fokus ke lu!",
			"Aura bintang terpancar nyata, outfit dan karismanya kelas internasional!",
			"Swag tingkat dewa, jalan biasa aja serasa lagi catwalk fashion week!",
			"Kece badai tanpa tandingan, definisi keren alami dari orok!"
		]
	],
	[
		"imut", "Imut", "🥺",
		[
			"Imut dari mana, muka lu sangar kayak debt collector nagih pinjol.",
			"Mencoba sok imut malah bikin orang pengen buru-buru istighfar.",
			"Tolong jangan sok uwu, merinding bulu kuduk orang serumah.",
			"Level keimutan lu minus, mending pasang muka tegas aja bro."
		],
		[
			"Gemesin dikit lah ya, ada sisi unyunya pas lagi bengong.",
			"Lucu pas senyum, gak overacting tapi tetep bikin gemes.",
			"Lumayan gemoy, auranya kayak adek kelas yang polos.",
			"Tingkahnya kadang receh dan bikin orang senyum tipis."
		],
		[
			"Gemoy maksimal tolong! Pengen dikantongin terus dibawa pulang sekarang juga!",
			"Tingkat keimutan melampaui batas wajar, bikin hati siapa aja auto meleleh!",
			"Lucunya kebangetan! Definisi mochi bernyawa yang paling menggemaskan!",
			"Tiap gerak-gerik bikin orang diabetes saking manis dan imutnya!"
		]
	],
	[
		"glowing", "Glowing", "🌟",
		[
			"Bukan glowing skincare itu mah, itu minyak jelantah sisa gorengan bakwan.",
			"Kusamnya legendaris, sinar matahari aja mantul saking gelapnya.",
			"Skincare sejuta botol gak sanggup ngangkat kegelapan nasib muka lu.",
			"Muka lu butuh di-steam ulang di bengkel las ketok magic."
		],
		[
			"Kulit sehat terawat, kelihatan rajin cuci muka sebelum tidur.",
			"Cerah alami, gak abu-abu dempul bedak dan seger dilihat.",
			"Glowing tipis-tipis khas anak rumahan yang cukup minum air putih.",
			"Bersih dan terawat, hasil skincare rutin mulai kelihatan hasilnya."
		],
		[
			"Silau men! Mukanya bercahaya sampe bisa gantiin lampu jalan komplek!",
			"Glowing kaca tanpa pori-pori, nyamuk mau nemplok aja auto kepeleset!",
			"Kulitnya sebening kristal es, aura dewa/dewi skincare sejati!",
			"Pancaran cahayanya menembus dimensi lain, bersih kinclong sempurna!"
		]
	],
	[
		"burik", "Burik", "🧌",
		[
			"Aman bro, kulit mulus kinclong no noda, anti burik-burik club!",
			"Muka bersih terawat, gak ada jejak kusam sama sekali.",
			"Jauh dari kata burik, lu lebih cocok jadi bintang iklan sabun muka.",
			"Kebersihannya terjaga sempurna, glow up level dewa!"
		],
		[
			"Ada burik dikit efek jarang mandi sore sama begadang main game.",
			"Standar manusia bumi yang sering kena polusi debu knalpot.",
			"Gak burik-burik amat, cuma butuh di-scrub sama rajin wudhu aja.",
			"Kondisi wajah normal pejuang rupiah di jalanan ibukota."
		],
		[
			"Waduh rekor burik nasional dipecahkan! Ini muka apa aspal jalur pantura?!",
			"Kusamnya udah mengendap 7 abad, sabun batangan pun menyerah angkat tangan!",
			"Tingkat keburikan mencapai level bencana alam, tolong segera dievakuasi!",
			"Parah banget bro, layar HP lu aja auto redup pas lu mirror selfie!"
		]
	],
	[
		"wangi", "Wangi", "🌸",
		[
			"Bau asem matahari campur keringat basi tercium radius 5 kilometer.",
			"Mandi setahun sekali apa gimana? Aromanya kayak comberan mampet!",
			"Parfum sebotol langsung netral kalah telak sama bau badan lu.",
			"Kecoa aja pingsan kalau lewat di samping lu saking semerbaknya."
		],
		[
			"Aroma sabun mandi biasa, seger dan gak mengganggu pernapasan orang lain.",
			"Wangi tipis-tipis khas orang rapi abis mandi sore.",
			"Ada bau parfum refillan 15 ribuan, lumayan enak dicium.",
			"Cukup wangi dan higienis, aman diajak boncengan motor."
		],
		[
			"Aroma surga tumpah ruah! Semerbak wangi parfum mewah semerbak 7 kelurahan!",
			"Wangi semerbak ningrat, orang yang papasan auto pengen hirup napas dalam-dalam!",
			"Seger dan elegan banget aromanya, bikin betah nempel seharian!",
			"Aroma tubuhnya definisi kesegaran abadi, parfum jutaan rupiah aja kalah!"
		]
	],
	[
		"dekil", "Dekil", "🧹",
		[
			"Bersih kinclong terawat, debu aja sungkan mau nempel di badan lu.",
			"Rapi dan wangi, jauh dari kata kucel apalagi dekil.",
			"Level kebersihan 100%, hygiene freak sejati nih boss.",
			"Terlihat segar dan terurus dengan sangat amat baik."
		],
		[
			"Dekil dikit karena abis motoran siang bolong, wajar lah ya.",
			"Ada bekas daki tipis di leher, mandi sore nanti langsung beres.",
			"Kelihatan capek aja sih, belum masuk kategori dekil parah.",
			"Agak kucel efek deadline tugas menumpuk, masih manusiawi."
		],
		[
			"Dekil akut bro! Ini abis kerja bakti gali selokan apa gimana ceritanya?!",
			"Daki di leher udah bisa dipanen buat pupuk kompos saking tebelnya!",
			"Tolong siram air keras dulu biar daki purbakalanya rontok semua!",
			"Tingkat kedekilan memecahkan rekor dunia, daki udah jadi armor pelindung!"
		]
	],
	[
		"estetik", "Estetik", "📸",
		[
			"Gak ada estetik-estetiknya, feeds IG lu kayak gudang rongsokan pasar loak.",
			"Foto lu miring, pencahayaan remang-remang, vibesnya kayak uji nyali.",
			"Mencoba estetik malah jatuhnya miris dan memprihatinkan.",
			"Jiwa seni lu tertinggal di zaman batu purbakala."
		],
		[
			"Paham komposisi foto dikit-dikit, feeds medsos lumayan rapi lah ya.",
			"Pilihan tone warna foto cukup enak dilihat, gak norak.",
			"Ada bakat fotografi terpendam, tinggal poles dikit lagi.",
			"Gaya estetik anak kopi senja yang kalem dan sederhana."
		],
		[
			"Estetik tingkat dewa! Bernapas aja vibesnya serasa scene film indie Eropa!",
			"Visualnya artistik banget, tiap jepretan foto auto viral di Pinterest!",
			"Aura senja dan sinematiknya nembus layar, karya seni berjalan!",
			"Definisi estetik sejati, bayangan lu di lantai aja ada nilai seninya!"
		]
	],
	[
		"jamet", "Jamet", "🕺",
		[
			"Sama sekali gak ada bibit jamet, selera outfit dan lagunya berkelas.",
			"Jauh dari joget jedag-jedug, seleranya elegan dan santun.",
			"Aman dari virus jamet kuproy, aura lu berpendidikan.",
			"Bukan golongan goyang pargoy di atas motor mogok."
		],
		[
			"Pernah joget jedag-jedug sekali dua kali pas lagi gabut di tongkrongan.",
			"Ada potongan rambut rada ngembang dikit, tapi masih terselamatkan.",
			"Kadang pake celana pensil ketat pas nongkrong di warkop.",
			"Vibes jamet tipis-tipis buat seru-seruan bareng kawan."
		],
		[
			"Ketua Paguyuban Jamet Nasional seumur hidup! Goyang pargoy nomor satu!",
			"Rambut landak pirang samping, knalpot mberr, celana pensil sobek! Juara jamet!",
			"Jiwa jametnya mendarah daging, bunyi jedag-jedug langsung refleks goyang patah-patah!",
			"Kaisar Jamet terkuat di bumi, dewa tiktok jedag-jedug sujud di hadapanmu!"
		]
	],
	[
		"kalem", "Kalem", "🍃",
		[
			"Kalem apanya, urat leher lu urat petasan, senggol dikit auto ngamuk!",
			"Gak ada tenang-tenangnya, pecicilan kayak cacing kepanasan.",
			"Suara lu menggelegar sampe radius 3 blok rumah.",
			"Jauh dari kata kalem, lu sumber keributan sejati."
		],
		[
			"Tenang dan santai, bisa ngontrol emosi di depan umum.",
			"Tipe pendengar yang baik, gak suka cari ribut.",
			"Cukup stabil, senyum adem kalau ada masalah.",
			"Kalem standar anak rumahan yang suka ketenangan."
		],
		[
			"Zen master tingkat dewa! Kiamat sekalipun lu cuma bakal nyeruput teh sambil senyum!",
			"Kedamaian batinnya menyinari alam semesta, aura sucinya bikin orang auto tenang!",
			"Gak ada yang bisa mancing emosinya, jiwa sedingin salju abadi kutub utara!",
			"Kalemnya begitu berwibawa, orang sekeliling auto hormat!"
		]
	],
	[
		"karismatik", "Karismatik", "👑",
		[
			"Aura lu tenggelam kayak kapal titanic, gak ada wibawanya sama sekali.",
			"Ngomong di depan dua orang aja lu udah gemeteran kayak kedinginan.",
			"Karismanya menguap bersama rasa percaya diri yang fiktif.",
			"Orang lewat gak bakal ngeh kalau di situ ada lu."
		],
		[
			"Punya pesona tersendiri pas lagi fokus ngerjain sesuatu.",
			"Cukup dipercaya omongannya pas lagi diskusi serius.",
			"Ada wibawa tipis-tipis kalau lagi pake baju rapi.",
			"Enak diajak ngobrol dan suaranya cukup meyakinkan."
		],
		[
			"Aura pemimpin sejati! Sekali buka mulut seluruh ruangan langsung hening terpesona!",
			"Karismanya menyengat kayak aliran listrik tegangan tinggi, magnet manusia sejati!",
			"Wibawa tingkat kaisar imperium, bikin orang auto takluk dan hormat!",
			"Pesona berkelas yang gak bisa dibeli dengan uang, mutlak berkharisma!"
		]
	],
	[
		"macho", "Macho", "💪",
		[
			"Buka tutup botol kecap aja lu nangis minta tolong tetangga.",
			"Otot lu kayak agar-agar lembek, kena angin malam langsung masuk angin.",
			"Macho dari hongkong, liat kecoa terbang aja teriak histeris.",
			"Fisiknya rapuh bagaikan kerupuk kena kuah soto."
		],
		[
			"Lumayan tegap lah, kuat angkat galon air ke dispenser tanpa ngeluh.",
			"Ada otot tipis hasil angkat beban galon dan cucian baju.",
			"Fisik fit standar cowok rajin gerak dan olahraga santai.",
			"Cukup gagah dan gak gampang tumbang kena cuaca buruk."
		],
		[
			"Binaragawan Spartan minder liat postur lu! Otot kawat balung wesi sejati!",
			"Macho level monster! Tarik tambang lawan buldoser pun buldosernya yang mundur!",
			"Testosteron murni tumpah-tumpah, genteng bocor dibenerin pake tatapan mata doang!",
			"Kekuatan fisik mutlak tanpa tandingan, giga chad versi dunia nyata!"
		]
	],
	[
		"feminim", "Feminim", "🎀",
		[
			"Feminim apaan, gaya duduk lu ngangkang kayak bapak-bapak pos ronda.",
			"Suara tawanya kayak suara knalpot bajaj jebol, menggelegar.",
			"Gak ada anggun-anggunnya, jalan aja serasa mau nendang pintu.",
			"Jiwa tomboy lu udah mendarah daging sampe sumsum tulang."
		],
		[
			"Anggun dan manis, tutur katanya sopan dan tertata baik.",
			"Suka hal-hal estetik dan lembut, aura wanitanya terpancar adem.",
			"Punya keanggunan alami yang bikin nyaman orang di sekitar.",
			"Cukup anggun dan modis dengan gaya feminin yang pas."
		],
		[
			"Putri bangsawan ningrat! Kelembutan dan keanggunannya menyejukkan semesta!",
			"Definisi primadona idaman, tiap langkahnya menebarkan semerbak bunga melati!",
			"Anggun tiada tara, tata krama dan pesonanya layak jadi permaisuri istana!",
			"Keanggunan paripurna yang membuat siapapun takluk terpukau!"
		]
	],
	[
		"tomboy", "Tomboy", "🧢",
		[
			"Gak ada tomboy-tomboynya, manja dikit-dikit nangis minta dipangku.",
			"Kena ulet bulu langsung histeris pingsan 3 hari 3 malam.",
			"Hatinya selembut sutra, gak cocok gaya sok sangar.",
			"Jauh dari jiwa petualang tangguh."
		],
		[
			"Santai, suka pake sneakers dan kaos gombrong, anti ribet club.",
			"Gak gengsian, diajak makan di pinggir jalan hayuk aja.",
			"Asik diajak nongkrong bareng cowok-cowok tanpa rasa canggung.",
			"Mandiri dan tangguh, gak gampang manja kalau lagi susah."
		],
		[
			"Ratu petarung jalanan! Benerin rantai motor mogok sambil ngopi santai!",
			"Tangguh abis no debat! Jiwa petualang liar, keberaniannya di atas rata-rata!",
			"Keren pol! Tomboy karismatik yang bikin cowok maupun cewek auto kagum!",
			"Kekuatan dan ketangguhannya setara kapten pasukan elite tempur!"
		]
	],
	[
		"seksi", "Seksi", "🔥",
		[
			"Seksi apanya, lu lebih mirip karung beras diiket tali rafia.",
			"Gak ada aura menggoda, auranya lebih ke orang kurang tidur 5 hari.",
			"Mencoba pose seksi malah kayak orang lagi encok pinggang.",
			"Seksi lu fiktif, mending pake baju hangat aja biar gak masuk angin."
		],
		[
			"Punya daya tarik tersendiri, postur tubuh proposional dan menarik.",
			"Tatapan matanya lumayan bikin deg-degan kalau lagi fokus.",
			"Pesona alaminya cukup memikat tanpa perlu dibuat-buat.",
			"Menarik dengan karisma dewasa yang elegan."
		],
		[
			"Hot overload! Suhu ruangan mendadak naik 100 derajat pas lu lewat!",
			"Sensualitas tingkat tinggi! Bikin mata siapapun gak sanggup berkedip!",
			"Aura siren berbahaya! Sekali lirik cowok se-kabupaten auto ambyar!",
			"Daya pikat luar biasa, keseksian mematikan level internasional!"
		]
	],
	[
		"bogel", "Bogel", "🍄",
		[
			"Tiang listrik komplek aja minder sama tinggimu, semampai banget bro!",
			"Tinggi atletis, aman dari razia bocil stunting.",
			"Tinggi ideal model catwalk, jauh dari kata bogel.",
			"Ketinggian lu melampaui rata-rata orang Indonesia."
		],
		[
			"Tinggi standar orang Indonesia lah ya, gak pendek gak jangkung.",
			"Ukuran minimalis tapi gesit, pas buat nyelip di kerumunan.",
			"Tinggi sedang yang imut dan proporsional.",
			"Aman, masih nyampe pegangan tangan di busway."
		],
		[
			"Bogel mini saku portable! Jalan di rumput aja kepalamu tenggelam!",
			"Tinggi badanmu setara botol sirup Marjan! Kalau nonton konser wajib digendong!",
			"Ukuran kurcaci sejati! Naik motor matic kakinya melayang gak nyampe aspal!",
			"Definisi manusia sachet mini! Tapi gemoy sih buat diuwek-uwek!"
		]
	],
	[
		"jangkung", "Jangkung", "🦒",
		[
			"Jangkung apaan, lu berdiri sama duduk tingginya sama aja.",
			"Ketinggianmu minimalis, gak bakal mentok pintu gerbang.",
			"Ukuran saku, gak ada bakat jadi pemain basket.",
			"Jauh dari kata tiang, lu masuk kategori kurcaci imut."
		],
		[
			"Tinggi badan lumayan, gampang disuruh ganti bohlam lampu ruang tamu.",
			"Cukup tinggi dan proporsional, enak dilihat pas pake celana panjang.",
			"Postur semampai yang pas, gak terlalu kurus gak terlalu jangkung.",
			"Tinggi di atas rata-rata kawan sebaya."
		],
		[
			"Jerapah Afrika tercengang melihat tinggimu! Kepala lu udah nyundul awan!",
			"Tiang sutet berjalan! Tiap lewat pintu rumah auto wajib nunduk 90 derajat!",
			"Tinggi tanpa batas! Mau ngobrol sama orang harus pake megafon dari atas!",
			"Pemain basket NBA aja minder liat panjang kakimu!"
		]
	],
	[
		"gembrot", "Gembrot", "🥟",
		[
			"Ramping singset kayak lidi layangan, tertiup angin sore auto melayang.",
			"Kurus ideal, gak ada tumpukan lemak jahat di perut.",
			"Body goals ramping bugar, metabolisme tubuh secepat kilat.",
			"Bebas dari lipatan perut, langsing menawan."
		],
		[
			"Berisi menggemaskan, pipi tembem kenyal enak buat dicubit.",
			"Gizi sangat tercukupi, badan padat berisi dan sehat bugar.",
			"Chubby menggemaskan khas orang yang hidupnya bahagia dan doyan makan.",
			"Ada tumpukan bahagia di pipi dan perut, pertanda makmur."
		],
		[
			"Raja/Ratu karbohidrat sejati! Timbangan digital langsung ngeluarin tulisan 'Error Tolong Satu-satu'!",
			"Gembrot menggelegar! Duduk di kasur busa langsung amblas ke lantai semen!",
			"Pipinya tumpah ruah kayak adonan roti mengembang 3 kali lipat!",
			"Definisi makmur sentosa! Tumpukan lemaknya cukup buat hibernasi 2 musim dingin!"
		]
	],
	[
		"kurus", "Kurus", "🦴",
		[
			"Padat berisi, otot dan lemak seimbang sempurna, gak ada kurus-kurusnya.",
			"Badan makmur berotot, jauh dari kata krempeng.",
			"Nutrisi terjaga dengan sangat baik, fisik tegap bugar.",
			"Kebugaran maksimal, berisi dan berbobot."
		],
		[
			"Langsing proporsional, gak kekurusan dan tetap sehat berenergi.",
			"Kurus standar anak aktif yang metabolisme tubuhnya cepet.",
			"Bodi ramping, gampang nyari ukuran baju di distro.",
			"Cukup ideal dan lincah buat gerak ke mana-mana."
		],
		[
			"Krempeng akut bro! Kena tiup kipas angin angin kosan no 1 aja lu langsung melayang ke atap!",
			"Kerangka hidup bernyawa! Rongga tulang rusuk lu bisa dijadiin tempat mainan hamster!",
			"Tolong makan nasi padang lauk rendang dobel sekarang juga sebelum lu larut disiram air hujan!",
			"Definisi lidi berjalan! Kalo berdiri pas siang bolong bayangannya cuma garis lurus tipis!"
		]
	],

	// ========================
	// 2. KELAKUAN & PERILAKU
	// ========================
	[
		"gila", "Gila", "🤪",
		[
			"Lu terlalu waras dan membosankan, hidup lu lempeng kayak jalan tol subuh.",
			"Tingkat kewarasan 100%, gak ada bakat bikin rusuh di tongkrongan.",
			"Normal banget, tipe orang yang patuh aturan lalu lintas.",
			"Kurang bumbu kegilaan buat seru-seruan bareng kawan."
		],
		[
			"Kocak dan agak gesrek dikit pas lagi kumpul bareng bestie.",
			"Suka nyeletuk aneh-aneh yang bikin orang ketawa lepas.",
			"Kegilaan terukur dan menghibur, asik diajak seru-seruan.",
			"Ada momen random tapi masih dalam batas wajar manusia bumi."
		],
		[
			"PASIEN RSJ LEPAS TOLLONGG! Tingkat kegilaan lu udah melampaui dimensi galaksi bimasakti!",
			"Otak lu konslet permanen! Kelakuan lu di luar nalar manusia berakal sehat!",
			"Gila kuadrat pangkat sepuluh! Dukun santet aja angkat tangan gak sanggup ngobatin!",
			"Orang gila di lampu merah pun sungkem minta berguru ke lu saking liarnya!"
		]
	],
	[
		"tengil", "Tengil", "😏",
		[
			"Sopan santun beradab, gak ada tampang tengil sama sekali.",
			"Wajah ramah penurut, auranya adek manis anak baik-baik.",
			"Terlalu kalem buat pasang muka nyebelin.",
			"Aman dari ancaman digebuk massa di gang sempit."
		],
		[
			"Suka ngeledek tipis-tipis kalau temen lagi kalah main game.",
			"Senyum songong dikit tapi niatnya cuma buat becandaan santai.",
			"Tengil wajar anak tongkrongan yang suka roasting sahabatnya.",
			"Tampang nyebelin tapi ngangenin pas gak ada."
		],
		[
			"Muka lu minta ditampol pake batako mentah sumpah! Tengilnya bikin darah tinggi naik ke ubun-ubun!",
			"Puncak ketengilan semesta! Tiap senyum sinis rasanya pengen ngirim lu ke planet mars!",
			"Songong maksimal tanpa tandingan! Aura ngenyek-nya nembus lapisan atmosfer!",
			"Gelar Tengil Abadi dipegang lu seumur hidup! Bikin gregetan se-RT!"
		]
	],
	[
		"linglung", "Linglung", "😵‍💫",
		[
			"Fokus tajam setajam silet, ingatan kuat dan gak pernah salah langkah.",
			"Konsentrasi penuh, anti linglung-linglung club.",
			"Otak fresh dan responsif, selalu tanggap situasi.",
			"Koneksi otak ke panca indra lancar jaya 5G."
		],
		[
			"Kadang nyari HP padahal lagi dipegang di tangan sendiri, wajar lah ya.",
			"Suka ngeblank 3 detik pas abis bangun tidur siang.",
			"Lupa naruh kunci motor sesekali karena kepikiran utang.",
			"Agak loading dikit tapi langsung connect lagi."
		],
		[
			"Loading 99% buffering selamanya! Ditanya 'lagi di mana' jawabnya 'hari selasa'!",
			"Linglung kronis tingkat dewa! Kacamata nempel di jidat tapi nyariin keliling kecamatan!",
			"Otak lu lagi dipause sama tuhan ya?! Tatapannya kosong kayak rumah kontrakan kosong 10 tahun!",
			"Definisi nyawa belum ngumpul seutuhnya, jalan aja nabrak pintu terbuka!"
		]
	],
	[
		"receh", "Receh", "🤣",
		[
			"Selera humor lu kaku kayak kanebo kering jemur seminggu.",
			"Jokes bapak-bapak aja gak mempan bikin lu senyum tipis.",
			"Terlalu serius hidupnya, nonton komedi malah sibuk menganalisis plot.",
			"Susah banget dibikin ketawa, hatinya sedingin kulkas dua pintu."
		],
		[
			"Gampang ketawa denger celetukan lucu di tongkrongan.",
			"Humor standar netizen tiktok, jokes meme kucing masih bikin ngakak.",
			"Asik diajak becanda, gak gampang baperan.",
			"Ketawanya nular dan bikin suasana jadi makin rame."
		],
		[
			"Daun jatuh ditiup angin aja lu ketawain sampe salto guling-guling di lantai!",
			"Receh tiada ampun! Liat sendal jepit kebalik langsung ketawa ngik-ngik sampe asma kambuh!",
			"Selera humor terbelakang sedunia! Huruf 'A' doang di chat bisa bikin lu nangis ngakak!",
			"Tingkat kerecehan menembus kerak bumi, ketawanya kedengeran sampe planet tetangga!"
		]
	],
	[
		"cringe", "Cringe", "😬",
		[
			"Selera dan omongannya keren, gak ada unsur jijik atau cringe sama sekali.",
			"Natural dan berkelas, jauh dari kata alay norak.",
			"Tingkah lakunya elegan dan gak bikin orang risih.",
			"Anti-cringe sejati, selalu tau batasan."
		],
		[
			"Pernah bikin status galau alay pas zaman SMP/SMA dulu, wajar lah.",
			"Kadang gombalannya rada garing dikit tapi masih lucu.",
			"Tingkah konyol sesekali buat cairin suasana.",
			"Ada sisi cringe tipis tapi masih bisa ditoleransi pertemanan."
		],
		[
			"CRINGE OVERDOSE SAMPE MERINDING SE-BADAN! Tolong hapus postingan lu sekarang juga sebelum FBI turun tangan!",
			"Tingkat ke-cringe-an lu bikin malaikat pencatat amal garuk-garuk kepala!",
			"Mendengar lu ngomong gombal rasanya pengen pindah kewarganegaraan ke antartika!",
			"Definisi cringe mutlak! Bikin orang se-grup nahan napas saking malunya!"
		]
	],
	[
		"caper", "Caper", "🤡",
		[
			"Pendiam misterius, gak butuh validasi publik dan santai di balik layar.",
			"Rendah hati dan gak suka pamer kelakuan.",
			"Jauh dari drama haus perhatian, hidupnya adem ayem.",
			"Fokus pada diri sendiri tanpa perlu sorak penonton."
		],
		[
			"Kadang suka mancing perhatian di grup kalau lagi sepi, wajar buat rame-rame.",
			"Suka pamer pencapaian kecil ke temen deket.",
			"Butuh sedikit apresiasi dari orang tercinta.",
			"Caper tipis-tipis yang masih menghibur dan gak bikin eneg."
		],
		[
			"BOS BESAR SIRKUS CAPER INTERNASIONAL! Gak dipuji sedetik langsung tantrum guling-guling di trotoar!",
			"Haus perhatian tingkat dewa! Segala cara dilakuin demi dipandang orang se-kabupaten!",
			"Topeng badut lu udah menyatu permanen sama tengkorak saking capernya!",
			"Darah dagingnya murni butuh sorotan kamera 24 jam nonstop tanpa henti!"
		]
	],
	[
		"toxic", "Toxic", "☠️",
		[
			"Jiwa malaikat tanpa noda, selalu membawa aura positif dan damai bagi siapapun.",
			"Santun, pemaaf, dan gak suka nyakitin perasaan orang lain.",
			"Green flag berjalan, oasis di tengah gurun manusia jahat.",
			"Teman idaman yang selalu mendukung kawan-kawannya."
		],
		[
			"Pernah ngomel toxic pas kalah ranked main Mobile Legends, manusiawi lah ya.",
			"Suka sarkas tipis-tipis kalau ada orang nyebelin.",
			"Bisa tegas dan agak pedes omongannya kalau dipancing emosi.",
			"Masih dalam batas normal kelakuan anak muda masa kini."
		],
		[
			"LIMBAH NUKLIR CHERNOBYL PUN KALAH BERACUN! Buka mulut langsung membunuh populasi tanaman hias!",
			"Pabrik racun berjalan! Temenan sama lu 5 menit langsung butuh cuci darah dan rukiyah massal!",
			"Toxic maksimal kuadrat! Siapapun yang dekat auto depresi kena mental berkepanjangan!",
			"Kaisar Racun Dunia Hitam! Hobi bikin orang lain menderita demi kesenangan pribadi!"
		]
	],
	[
		"baperan", "Baperan", "🥺",
		[
			"Hati baja anti peluru, dicaci maki dibecandain tetep ketawa santai.",
			"Mental sekuat beton cor, gak gampang tersinggung.",
			"Sangat santai dan memahami konteks candaan kawan.",
			"Jauh dari drama air mata, hidupnya rileks tanpa beban."
		],
		[
			"Kadang kepikiran omongan orang kalau lagi overthinking tengah malam.",
			"Sensitif kalau topik yang dibahas nyenggol hal-hal yang sifatnya personal.",
			"Bisa sedih sesekali tapi besoknya udah ceria lagi.",
			"Hati manusia biasa yang punya titik lemah wajar."
		],
		[
			"HATI KACA RETAK TERTIPIS SEDUNIA! Ditiup angin sepoi-sepoi aja langsung bikin story galau 20 slide!",
			"Baperan akut! Dicuekin 2 menit langsung ngerasa satu dunia membenci dirinya!",
			"Drama queen/king sejati! Air mata buaya langsung mengalir deras menenggelamkan rumah!",
			"Baper level dewa! Candaan receh diartikan sebagai konspirasi pembunuhan karakter!"
		]
	],
	[
		"santuy", "Santuy", "🌴",
		[
			"Panikan akut, ada kecoa lewat aja langsung panik seakan kiamat tiba.",
			"Overthinking non-stop 24/7, hidupnya tegang kayak kawat jemuran.",
			"Gampang stres kena deadline mepet, gak bisa rileks.",
			"Detak jantungnya selalu mode balapan F1."
		],
		[
			"Bisa tenang menghadapi masalah santai, gak gampang panik.",
			"Tipe orang yang ngerjain tugas selow tapi tetep selesai tepat waktu.",
			"Punya mindset 'yaudahlah ya' yang menyelamatkan kesehatan mental.",
			"Santai tapi tetap bertanggung jawab pada kewajiban."
		],
		[
			"DEWA KESANTUY-AN ABADI! Rumah kebakaran pun lu masih asik bakar marshmallow sambil rebahan!",
			"Santuy level dewa nirwana! Deadline 5 menit lagi lu masih santai nyeruput kopi susu!",
			"Gak ada urat panik sama sekali di tubuhmu! Terlalu damai bagaikan biksu di puncak gunung salju!",
			"Hidup lempeng no drama, badai topan lewat cuma lu anggap kipas angin gratis!"
		]
	],
	[
		"wibu", "Wibu", "🎌",
		[
			"Sama sekali gak paham anime, taunya cuma Upin Ipin sama Doraemon.",
			"Alergi bau bawang, hidup normal di dunia nyata 3 dimensi.",
			"Gak punya waifu/husbu 2D, selera orang beneran.",
			"Jauh dari budaya jejepangan, normies sejati."
		],
		[
			"Nonton anime yang lagi viral kayak Kimetsu atau Jujutsu Kaisen, wajar lah ya.",
			"Punya satu dua waifu/husbu favorit buat foto profil medsos.",
			"Suka dengerin lagu J-Pop pas lagi belajar atau kerja.",
			"Wibu santai yang masih bisa diajak sosialisasi di dunia nyata."
		],
		[
			"WIBU AKUT BAU BAWANG LEVEL DEWA! Kamar lu penuh bantal dakimakura dan foto waifu!",
			"Tiap ngomong diselipin kata 'Yamete', 'Nani', 'Baka' pake suara cempreng!",
			"Lebih mencintai gambar 2D gepeng daripada masa depan dan keluarga sendiri!",
			"Sudah siap ditabrak truk isekai demi reinkarnasi jadi slime terkuat!"
		]
	],
	[
		"koleb", "Koleb", "🤝",
		[
			"Koleb apaan, lu diajak ngobrol aja nolehnya ogah-ogahan kayak musuh bebuyutan.",
			"Anti-sosial akut, mending mojok sendirian daripada diajak kerja bareng.",
			"Gak ada jiwa kolaborasi sama sekali.",
			"Bakat soliter sejati, susah nyatu sama kelompok."
		],
		[
			"Enak diajak diskusi bareng dan bagi-bagi tugas kelompok.",
			"Bisa menyesuaikan diri sama karakter rekan kerja yang beda-beda.",
			"Cukup kooperatif dan gak egois pas ada projek bareng.",
			"Partner yang bisa diandalkan dalam tim kerja."
		],
		[
			"MASTER OF COLLABORATION! Sekali senyum semua orang auto pengen bikin projek bareng!",
			"Koneksi seluas samudra pasifik! Diajak kolab sama presiden pun lu gas tanpa ragu!",
			"Jiwa networking tingkat dewa! Siapapun bisa akrab dalam tempo 5 detik!",
			"Partner legendaris idaman semua orang, sinergi 1000% selalu sukses!"
		]
	],
	[
		"bucin", "Bucin", "💘",
		[
			"Hatinya beku kayak gletser kutub selatan, anti bucin-bucin club.",
			"Logika di atas perasaan, gak mempan dirayu gombalan receh.",
			"Lebih milih game dan tidur daripada ngeladenin drama percintaan.",
			"Single tangguh yang bahagia dengan kemandirian hidupnya."
		],
		[
			"Sayang pasangan dengan wajar dan gak bikin risih orang lain.",
			"Suka ngasih perhatian manis di momen-momen spesial.",
			"Mau berkorban hal-hal kecil demi kebahagiaan si dia.",
			"Bucin sehat yang bikin hubungan awet dan langgeng."
		],
		[
			"BUCIN KOMA TAK TERTOLONG! Disuruh minum air kobokan pacar pun lu teguk dengan senyum bahagia!",
			"Hamba cinta sejati! Gaji sebulan abis buat beliin si doi hadiah padahal lu makan mie instan!",
			"Otak dan logika lu udah digadaikan demi ayang tercinta seutuhnya!",
			"Tingkat kebucinan menembus batas gravitasi bumi, rela jadi keset kaki si dia!"
		]
	],
	[
		"nolep", "Nolep", "🚪",
		[
			"Anak gaul nongkrong 24 jam di kafe hits, temennya dari Sabang sampe Merauke.",
			"Jadwal weekend padat merayap, gak pernah betah diem di kamar.",
			"Sosialita sejati, energi ekstrovertnya gak ada habisnya.",
			"Kamar cuma tempat numpang naruh tas dan tidur sebentar."
		],
		[
			"Suka rebahan di kamar pas weekend buat ngecas energi sosial.",
			"Sesekali nongkrong kalau diajak temen deket, tapi tetep cinta kasur.",
			"Keseimbangan antara me-time di rumah sama main di luar.",
			"Anak rumahan yang masih punya kehidupan sosial normal."
		],
		[
			"FOSIL KASUR PURBAKALA! Sinar matahari kena kulit lu langsung menguap kayak vampir!",
			"Nolep tingkat dewa! Keluar kamar cuma buat ambil paket dan ke kamar mandi!",
			"Lumut udah tumbuh subur di kasur saking gak pernahnya lu beranjak dari situ!",
			"Teman terdekat lu cuma dinding kamar dan layar HP 6 inch!"
		]
	],
	[
		"gabut", "Gabut", "🥱",
		[
			"Jadwal padat merayap, sibuk berkarya dan produktif dari pagi sampe malam.",
			"Gak ada waktu buat bengong, setiap detik menghasilkan cuan dan ilmu.",
			"Super sibuk dengan berbagai macam kegiatan berfaedah.",
			"Kata 'gabut' tidak ada dalam kamus hidup orang sukses ini."
		],
		[
			"Kadang bengong scroll medsos 1-2 jam pas kerjaan udah kelar.",
			"Gabut santai di hari libur sambil nonton serial favorit.",
			"Ada momen bosen tapi biasanya langsung cari cemilan.",
			"Tingkat kegabutan standar manusia normal butuh hiburan."
		],
		[
			"PENGANGGURAN WAKTU PROFESIONAL! Sampe ngitungin butiran beras di karung saking gak ada kerjaannya!",
			"Gabut tingkat dewa! Bernapas aja rasanya males, scroll timeline kosong bolak-balik 500 kali!",
			"Tingkat kebosanan melampaui batas nalar, sampe ngajak ngobrol cicak di dinding!",
			"Definisi manusia paling gabut se-alam semesta, bingung mau ngapain hidupnya!"
		]
	],
	[
		"kepo", "Kepo", "🧐",
		[
			"Cuek bebek seratus persen, ada tetangga cerai pun lu gak bakal peduli.",
			"Bukan urusan gua = gak peduli, prinsip hidup damai anti ghibah.",
			"Terlalu sibuk sama urusan sendiri buat ngurusin orang lain.",
			"Pribadi yang sangat menghargai privasi orang sekitar."
		],
		[
			"Suka mantau update berita viral atau gosip tipis-tipis di medsos.",
			"Penasaran dikit kalau ada keributan rame di grup.",
			"Kepo wajar seputar kabar temen lama yang baru jadian.",
			"Cukup tau aja tanpa berniat ikut campur lebih jauh."
		],
		[
			"AGEN INTELIJEN GOSIP TETANGGA PALING GANAS! Silsilah keluarga orang lain sampe 7 turunan lu hafal!",
			"Kepo tingkat dewa! Akun fake lu ada 15 biji cuma buat stalking story mantan dan gebetannya!",
			"Radar kepo mendeteksi segala pergerakan rahasia dalam radius 50 kilometer!",
			"Detektif FBI minder sama kecepatan lu ngepoin aib orang lain!"
		]
	],
	[
		"pansos", "Pansos", "📈",
		[
			"Murni berkarya dari nol, anti dompleng nama besar orang lain.",
			"Gak butuh sorotan gratisan, mandiri dan percaya diri dengan kemampuan sendiri.",
			"Jauh dari drama panjat sosial murahan.",
			"Rendah hati dan menjaga integritas diri sejati."
		],
		[
			"Suka foto bareng kawan yang lagi hits buat kenang-kenangan medsos.",
			"Paham cara memanfaatkan momen biar akunnya makin rame dikit.",
			"Pansos tipis-tipis demi memperluas relasi pertemanan.",
			"Masih dalam batas wajar pergaulan anak muda modern."
		],
		[
			"PANJAT SOSIAL SAMPE KE PUNCAK GUNUNG EVEREST! Tiap ada orang viral langsung nempel kayak lintah!",
			"Haus popularitas tingkat dewa! Rela bikin konten drama settingan demi seiprit follower!",
			"Pansos tanpa urat malu! Semua artis di-DM diajak kolab padahal gak kenal!",
			"Bakal lakuin apa aja demi centang biru dan sorotan kamera!"
		]
	],
	[
		"sangean", "Sangean", "🔞",
		[
			"Pikiran suci murni seputih salju pegunungan, anti pikiran ngeres.",
			"Alim berwibawa, pandangan mata selalu terjaga dengan sangat baik.",
			"Jauh dari hawa nafsu duniawi yang menyesatkan.",
			"Jiwa yang bersih dan penuh kendali diri tinggi."
		],
		[
			"Pikiran dewasa normal manusia biologis berakal sehat.",
			"Kadang mikir agak ngeres kalau denger lelucon berbau dewasa.",
			"Masih bisa mengontrol diri dengan akal sehat dan norma sosial.",
			"Wajar lah ya, hormon manusia normal pada umumnya."
		],
		[
			"OTAKNYA SUDAH TERCEMAR ZAT MESUM PERMANEN! Liat lubang sedotan aja langsung overthinking ngeres!",
			"Darurat nafsu liar! Tiap detik otaknya cuma muter video terlarang 4K!",
			"Tolong guyur air es satu toren biar hawa nafsunya padam seketika!",
			"Pikiran kotor tingkat dewa! Butuh dicuci pake deterjen dan dirukiyah massal!"
		]
	],
	[
		"sambat", "Sambat", "😮‍💨",
		[
			"Penyabar sejati, dihantam cobaan hidup bertubi-tubi tetep senyum tegar.",
			"Gak pernah ngeluh di medsos, masalah diselesaikan dengan tenang.",
			"Baja mental yang tahan banting menghadapi kerasnya dunia.",
			"Sosok tangguh yang selalu optimis dan penuh syukur."
		],
		[
			"Kadang curhat capek di status close friend kalau hari lagi berat.",
			"Sambat tipis-tipis pas dapet tugas menumpuk dari atasan.",
			"Keluh kesah wajar pejuang kehidupan demi melepas penat.",
			"Ngeluh sebentar terus lanjut berjuang lagi kayak biasa."
		],
		[
			"DUTA SAMBAT INTERNASIONAL SEUMUR HIDUP! Bangun tidur buka mata langsung ngeluhin cuaca dan nasib!",
			"Keluhanmu lebih panjang dari skripsi mahasiswa abadi! Tiap detik update status mengeluh!",
			"Energi negatifnya sanggup bikin tanaman hias di samping rumah layu mendadak!",
			"Napas aja disambat-in saking hobinya mengeluh tentang segala hal di dunia!"
		]
	],
	[
		"gibah", "Gibah", "🗣️",
		[
			"Mulutnya terjaga rapi, gak tertarik sama sekali ngomongin kejelekan orang lain.",
			"Selalu ngomongin ide dan hal positif, anti ghibah club.",
			"Pendengar yang amanah, rahasia apapun aman di tangannya.",
			"Pribadi berkelas yang menghargai kehormatan sesama."
		],
		[
			"Ikut nimbrung dengerin gosip hangat kalau lagi kumpul arisan atau nongkrong.",
			"Kadang penasaran sama berita perselingkuhan artis yang lagi viral.",
			"Ghibah tipis buat seru-seruan bareng bestie terdekat.",
			"Masih tau batasan dan gak berniat nyebarin fitnah jahat."
		],
		[
			"KETUA UMUM PERSATUAN GHIBAH SE-GALAKSI! Topik obrolannya 100% aib tetangga dari ujung gang!",
			"Mulut kompor gas LPG 12 KG! Sekali nyalain gosip satu komplek langsung geger kebakaran jenggot!",
			"Pabrik ghibah beroperasi 24 jam nonstop tanpa mengenal hari libur nasional!",
			"Malaikat pencatat dosa sampe kehabisan tinta nyatet omongan ghibah lu!"
		]
	],
	[
		"drama", "Drama", "🎭",
		[
			"Hidup lempeng no drama, ada masalah langsung to the point selesaikan.",
			"Anti lebay dan gak suka membesar-besarkan hal sepele.",
			"Realistis dan logis menghadapi segala situasi kehidupan.",
			"Sosok tenang yang sangat tidak menyukai keributan gak penting."
		],
		[
			"Kadang ada sedikit bumbu overreaksi pas lagi kaget atau emosi.",
			"Suka nonton drakor tapi di dunia nyata hidupnya cukup santai.",
			"Bisa dramatis dikit buat seru-seruan bikin lelucon.",
			"Masih dalam batas wajar emosi manusia normal."
		],
		[
			"AKTOR/AKTRIS UTAMA SINETRON AZAB 10.000 EPISODE! Masalah debu nempel di baju dibikin tangisan histeris!",
			"Ratu/Raja drama paling lebay sedunia! Hidupnya penuh skenario lebay dan tangisan buaya!",
			"Piala oscar kategori Ter-Drama sepantasnya diberikan ke lu sekarang juga!",
			"Semua hal di dunia ini selalu dibikin heboh dan ribet luar biasa!"
		]
	],

	// ========================
	// 3. SIFAT & KEPRIBADIAN
	// ========================
	[
		"pelit", "Pelit", "🪙",
		[
			"Dermawan sejati! Ringan tangan suka traktir kawan tanpa perhitungan.",
			"Sultan pemurah, uang bukan segalanya demi kebersamaan.",
			"Suka berbagi rezeki dan gak perhitungan soal makanan.",
			"Hatinya seluas samudra, sosok yang sangat royal."
		],
		[
			"Hemat pangkal kaya, perhitungan di pos pengeluaran yang tepat.",
			"Bisa traktir sesekali kalau lagi dapet rezeki nomplok.",
			"Teliti mengelola uang jajan biar gak boros di akhir bulan.",
			"Masih wajar lah ya, menjaga kestabilan finansial pribadi."
		],
		[
			"PELITNYA SAMPE KE TULANG SUMSUM! Uang kembalian seratus perak kurang aja lu kejar sampe ujung dunia!",
			"Kikir tingkat dewa! Mau bagi permen sebutir aja dipotong jadi empat bagian!",
			"Dompet lu ada gembok 10 lapis pake sidik jari dan retina mata!",
			"Definisi manusia paling medit se-alam semesta, beli es teh aja minta air keran gratis!"
		]
	],
	[
		"sombong", "Sombong", "🦚",
		[
			"Rendah hati bagaikan padi makin berisi makin merunduk.",
			"Sangat santun dan gak pernah memamerkan kekayaan atau kepintaran.",
			"Bisa bergaul akrab dengan siapa saja dari berbagai kalangan.",
			"Sosok bersahaja yang dicintai banyak orang."
		],
		[
			"Punya rasa bangga diri yang wajar atas pencapaian hasil kerja keras.",
			"Kadang pamer tipis di story kalau dapet barang impian baru.",
			"Percaya diri tinggi tapi tetap menghargai kemampuan orang lain.",
			"Batas wajar kebanggaan diri manusia sukses."
		],
		[
			"HIDUNGNYA MENDONGAK SAMPE NYUNDUL LANGIT KE TUJUH! Sombongnya nauzubillah bikin orang eneg!",
			"Firaun pun sujud minder melihat tingkat kesombonganmu yang tiada batas!",
			"Merasa paling suci, paling kaya, dan paling sempurna se-alam semesta raya!",
			"Sombong maksimal! Harta orang tua dipamerin serasa hasil keringat dewa!"
		]
	],
	[
		"peduli", "Peduli", "💖",
		[
			"Dingin gak berperasaan, ada orang jatuh di depan mata cuma diliatin doang.",
			"Egois tingkat akut, yang penting diri sendiri selamat dan kenyang.",
			"Kurang empati sama penderitaan orang di sekitarnya.",
			"Hatinya keras kayak batu kali di sungai kering."
		],
		[
			"Peduli sama temen dan keluarga terdekat yang lagi butuh bantuan.",
			"Punya empati yang baik dan siap mendengarkan curhatan sahabat.",
			"Mau nolong sesama semampunya tanpa pamrih berlebih.",
			"Sosok hangat yang cukup peka terhadap lingkungan."
		],
		[
			"MALAIKAT BERHATI EMAS DI BUMI! Pedulinya melampaui batas, semut keinjek aja lu bikinin upacara pemakaman!",
			"Empati tingkat dewa! Rela ngasih makanan terakhirnya ke orang lain biar gak kelaparan!",
			"Penyelamat sejati! Kehangatan hatinya sanggup mencairkan es abadi kutub utara!",
			"Definisi kebaikan mutlak tanpa cela, sosok pelindung bagi yang lemah!"
		]
	],
	[
		"jujur", "Jujur", "😇",
		[
			"Raja bohong bersertifikat! Tiap buka mulut isinya bualan dongeng fiktif!",
			"Pinokio minder liat hidungmu yang memanjang 10 meter saking seringnya bohong!",
			"Omongannya gak bisa dipegang, penuh dusta dan tipu muslihat.",
			"Kebenaran adalah musuh terbesar dalam hidupnya."
		],
		[
			"Cukup jujur dan bisa dipercaya dalam hal-hal penting dan pekerjaan.",
			"Kadang bohong putih (white lies) demi menjaga perasaan orang lain.",
			"Berusaha selalu terbuka pada sahabat dan keluarga tercinta.",
			"Integritas yang lumayan terjaga di kehidupan sehari-hari."
		],
		[
			"JUJUR POL TANPA FILTER! Kalo muka temen jelek langsung diomongin depan umum tanpa basa-basi!",
			"Kejujuran mutlak tingkat nabi! Duit nemu di jalan sejuta pun langsung diserahin ke kantor polisi!",
			"Integritas baja anti gores! Pantang berbohong demi keuntungan duniawi!",
			"Sosok paling amanah dan terpercaya di muka bumi, no debat!"
		]
	],
	[
		"setia", "Setia", "💍",
		[
			"BUAYA DARAT KEPALA SEPULUH! Mata jelalatan liat yang bening dikit langsung meluncur!",
			"Spesialis selingkuh berseri, komitmen cuma dianggap lelucon belaka.",
			"Gak bisa dipegang janjinya, hatinya gampang pindah ke lain hati.",
			"Definisi red flag berjalan yang berbahaya buat kesehatan mental."
		],
		[
			"Cukup setia dan berkomitmen kalau udah nemu pasangan yang cocok.",
			"Menjaga batasan pertemanan pas lagi punya pacar/pasangan.",
			"Bisa dipercaya dan mau berjuang bareng pasangannya.",
			"Tipe pasangan yang bisa diandalkan kesetiaannya."
		],
		[
			"SETIA MATI SAMPAI TITIK DARAH PENGHABISAN! Dikasih bidadari kahyangan pun lu tolak demi si doi seorang!",
			"Kesetiaan tingkat dewa legenda Hachiko! Menunggu si dia selamanya tanpa pernah goyah!",
			"Hatinya udah digembok paten khusus satu nama seumur hidup di dunia dan akhirat!",
			"Definisi pasangan paling setia di galaksi bimasakti, langka dan berharga!"
		]
	],
	[
		"sabar", "Sabar", "🧘",
		[
			"Sumbu pendek sependek korek api kayu! Senggol dikit langsung perang dunia ketiga!",
			"Gak ada sabar-sabarnya, emosian dan suka ngamuk meledak-ledak.",
			"Nunggu lampu merah 30 detik aja klakson udah dibunyiin non-stop.",
			"Darah tinggi selalu kambuh setiap ada hambatan kecil."
		],
		[
			"Cukup bisa menahan emosi saat menghadapi situasi menyebalkan.",
			"Bisa menghela napas panjang dan berpikir jernih sebelum bertindak.",
			"Penyabar standar yang masih bisa memaklumi kesalahan orang lain.",
			"Tenang dalam menghadapi cobaan sehari-hari."
		],
		[
			"KESABARAN TINGKAT DEWA NIRWANA! Dihina, dicaci, diinjak-injak pun lu cuma tersenyum manis sambil mendoakan kebaikan!",
			"Lautan kesabaran tanpa batas dasar! Badai tsunami ujian hidup dihadapi dengan hati tenang selembut sutra!",
			"Urat marahnya sudah putus sejak lahir digantikan kedamaian abadi semesta!",
			"Sosok paling sabar yang pernah ada dalam sejarah peradaban manusia!"
		]
	],
	[
		"pemaaf", "Pemaaf", "🤝",
		[
			"PENDENDAM KRONIS SAMPE LIANG LAHAT! Dosa orang 10 tahun lalu masih dicatet rapi di buku harian darah!",
			"Sekali tersakiti, dendamnya diwariskan turun-temurun ke anak cucu!",
			"Gak ada kata maaf dalam kamus hidupnya, mata dibalas mata kepala dibalas kepala!",
			"Hatinya dipenuhi dendam kesumat yang membara selamanya."
		],
		[
			"Bisa memaafkan kesalahan orang lain kalau yang bersangkutan tulus minta maaf.",
			"Gak suka memelihara dendam terlalu lama biar hati tenang.",
			"Kadang butuh waktu buat melupakan, tapi tetap berlapang dada.",
			"Pribadi yang cukup bijak dalam menyikapi konflik antar teman."
		],
		[
			"HATI SELUAS SAMUDRA PASIFIK! Dikhianati sahabat sendiri pun langsung dimaafkan dan dirangkul erat!",
			"Pemaaf sejati tanpa pamrih! Selalu memberi kesempatan kedua bagi siapa saja yang bersalah!",
			"Jiwa suci penuh welas asih, melupakan semua luka dengan senyuman tulus!",
			"Sosok paling mulia yang selalu mendahulukan perdamaian di atas ego pribadi!"
		]
	],
	[
		"ambisius", "Ambisius", "🚀",
		[
			"Kaum rebahan sejati, mimpi besarnya cuma pengen tidur siang tanpa diganggu.",
			"Gak ada target hidup, mengalir pasrah kayak sampah di sungai ciliwung.",
			"Males berjuang, lebih suka zona nyaman yang aman dari keringat.",
			"Nol motivasi untuk berkembang menjadi lebih baik."
		],
		[
			"Punya target dan rencana masa depan yang realistis dan terukur.",
			"Mau berusaha dan belajar hal baru demi karier yang lebih baik.",
			"Punya semangat juang yang cukup untuk meraih cita-cita.",
			"Keseimbangan antara kerja keras dan menikmati hasil jerih payah."
		],
		[
			"AMBISI MENGGUNCANG BUMI! Kalau bisa matahari pun pengen dibeli dan dikuasai sekarang juga!",
			"Workaholic gila kerja! 24 jam nonstop ngerjain projek demi jadi penguasa dunia!",
			"Semangat juang membara setara ledakan supernova! Pantang mundur sebelum jadi nomor satu!",
			"Tekad baja tak tertembus, siap melibas segala rintangan demi kejayaan abadi!"
		]
	],
	[
		"pemalas", "Pemalas", "🦥",
		[
			"Rajin luar biasa! Bangun subuh langsung beres-beres rumah dan olahraga pagi.",
			"Gak bisa diem santai, selalu ada aja hal produktif yang dikerjakan.",
			"Anti malas-malasan, disiplin tinggi terhadap waktu.",
			"Definisi pekerja keras yang pantang buang-buang kesempatan."
		],
		[
			"Kadang malas gerak kalau lagi hujan atau hari libur kerja.",
			"Butuh sedikit dorongan atau mood booster buat mulai ngerjain tugas.",
			"Malas standar manusia normal yang butuh waktu istirahat santai.",
			"Masih bisa diandalkan kalau sudah masuk jam kerja darurat."
		],
		[
			"RAJA KUKANG BERDARAH DINGIN! Mau ngambil remot TV jarak setengah meter aja manggil orang dari lantai dua!",
			"Tingkat kemalasan memecahkan rekor dunia! Bernapas aja kalo bisa diwakilin orang lain!",
			"Fosil kasur sejati! Bergerak satu jengkal rasanya kayak lari maraton keliling benua asia!",
			"Juara bertahan Olimpiade Mager Internasional seumur hidup!"
		]
	],
	[
		"kepo", "Kepo", "🕵️",
		[
			"Cuek bebek seratus persen, ada tetangga cerai pun lu gak bakal peduli.",
			"Bukan urusan gua = gak peduli, prinsip hidup damai anti ghibah.",
			"Terlalu sibuk sama urusan sendiri buat ngurusin orang lain.",
			"Pribadi yang sangat menghargai privasi orang sekitar."
		],
		[
			"Suka mantau update berita viral atau gosip tipis-tipis di medsos.",
			"Penasaran dikit kalau ada keributan rame di grup.",
			"Kepo wajar seputar kabar temen lama yang baru jadian.",
			"Cukup tau aja tanpa berniat ikut campur lebih jauh."
		],
		[
			"AGEN INTELIJEN GOSIP TETANGGA PALING GANAS! Silsilah keluarga orang lain sampe 7 turunan lu hafal!",
			"Kepo tingkat dewa! Akun fake lu ada 15 biji cuma buat stalking story mantan dan gebetannya!",
			"Radar kepo mendeteksi segala pergerakan rahasia dalam radius 50 kilometer!",
			"Detektif FBI minder sama kecepatan lu ngepoin aib orang lain!"
		]
	],
	[
		"nekat", "Nekat", "🧨",
		[
			"Penuh perhitungan dan kehati-hatian, nyebrang jalan sepi aja nengok kanan kiri 10 kali.",
			"Takut ambil risiko, lebih milih jalan aman dan terjamin selamat.",
			"Sangat waspada terhadap segala kemungkinan bahaya di sekitar.",
			"Jiwa penuh kalkulasi yang mengutamakan keselamatan jiwa."
		],
		[
			"Berani mencoba hal baru setelah mempertimbangkan dampaknya.",
			"Cukup punya nyali buat ambil kesempatan emas yang menantang.",
			"Keberanian yang terukur dan masih memakai akal sehat.",
			"Siap melangkah keluar dari zona nyaman jika dibutuhkan."
		],
		[
			"GILA NYALI TANPA TAKUT MATI! Bensin tinggal setetes nekat turing keliling pulau jawa tengah malam!",
			"Nekat tingkat dewa kamikaze! Masuk kandang buaya buat ngajak selfie bareng pun dijabanin!",
			"Otak dan rasa takut lu sudah dicopot permanen! Adrenalin junkie sejati!",
			"Definisi manusia paling nekat di dunia, bahaya maut cuma dianggap wahana hiburan!"
		]
	],
	[
		"penakut", "Penakut", "👻",
		[
			"Pemberani sejati! Tidur sendirian di kuburan keramat pun pulas tanpa mimpi buruk.",
			"Nyali baja anti gentar menghadapi hal-hal mistis maupun bahaya nyata.",
			"Tenang menghadapi ancaman dan selalu siap pasang badan.",
			"Sosok tangguh yang menjadi pelindung bagi teman-temannya."
		],
		[
			"Kaget wajar kalau ada suara aneh tiba-tiba di malam hari.",
			"Agak ngeri nonton film horor sendirian di kamar gelap.",
			"Rasa takut normal manusiawi untuk menjaga keselamatan diri.",
			"Masih berani mengatasi rasa takut jika terpaksa keadaan."
		],
		[
			"NYALI SEUKURAN BIJI JARAK! Bayangan sendiri di tembok aja disangka genderuwo langsung jerit-jerit!",
			"Penakut akut stadium akhir! Denger bunyi cicak berdecak langsung sembunyi di dalem selimut!",
			"Ke kamar mandi tengah malam harus dikawal pasukan pengawal istana saking takutnya!",
			"Jantungnya copot setiap kali ada kucing lewat di kegelapan malam!"
		]
	],
	[
		"humoris", "Humoris", "🎭",
		[
			"Garing sekering gurun sahara, leluconnya bikin suasana langsung hening canggung.",
			"Kaku dan gak bisa bikin orang lain tertawa.",
			"Mencoba melucu malah bikin orang pengen buru-buru pulang.",
			"Bukan bakatnya di bidang komedi dan hiburan santai."
		],
		[
			"Cukup asik dan punya selera humor yang pas di tongkrongan.",
			"Suka melempar celetukan lucu yang mencairkan suasana kaku.",
			"Bisa membuat orang tersenyum dengan candaan ringannya.",
			"Teman yang menyenangkan untuk diajak mengobrol santai."
		],
		[
			"DEWA KOMEDI STAND UP! Sekali buka mulut seluruh isi ruangan langsung ketawa terjungkal-jungkal!",
			"Pabrik tawa berjalan! Celotehannya selalu segar, cerdas, dan bikin perut kram ngakak!",
			"Bakat komedian legendaris, auranya saja sudah bikin orang bahagia dan terhibur!",
			"Juara dunia humoris, mampu mengubah duka menjadi tawa bahagia dalam sekejap!"
		]
	],
	[
		"kreatif", "Kreatif", "🎨",
		[
			"Miskin ide dan inovasi, cuma bisa meniru dan menjiplak karya orang lain.",
			"Otaknya buntu kayak jalan buntu komplek perumahan lama.",
			"Gak ada imajinasi sama sekali, serba monoton dan membosankan.",
			"Sulit menemukan solusi baru saat menghadapi masalah."
		],
		[
			"Punya banyak ide menarik untuk menyelesaikan pekerjaan sehari-hari.",
			"Suka mencoba cara-cara unik yang belum pernah dicoba sebelumnya.",
			"Cukup kreatif dalam memodifikasi hal-hal sederhana jadi lebih menarik.",
			"Imajinasi yang cukup hidup dan solutif."
		],
		[
			"GENIUS KREATIF TANPA BATAS! Barang rongsokan bekas di tangannya auto disulap jadi mahakarya bernilai miliaran!",
			"Imajinasinya melampaui batas dimensi logika manusia biasa!",
			"Inovator sejati yang selalu melahirkan ide-ide gila dan revolusioner!",
			"Kreativitas tingkat dewa maestro dunia, selalu selangkah lebih maju dari zamannya!"
		]
	],
	[
		"bijak", "Bijak", "🦉",
		[
			"Gak ada bijak-bijaknya, keputusannya selalu ceroboh dan merugikan diri sendiri.",
			"Omongannya ngelantur tanpa dasar pemikiran yang matang.",
			"Mudah terpengaruh dan gegabah dalam mengambil tindakan.",
			"Jauh dari sosok penasihat yang bisa diandalkan."
		],
		[
			"Bisa memberi saran yang baik dan menenangkan saat teman sedang curhat.",
			"Berpikir sebelum bertindak dan mempertimbangkan dampak jangka panjang.",
			"Cukup dewasa dalam memandang persoalan hidup.",
			"Pribadi yang cukup berkepala dingin saat menghadapi masalah."
		],
		[
			"MAHAGURU KEBIJAKSANAAN AGUNG! Nasihatmu sanggup menyelesaikan krisis perang dunia dalam tempo singkat!",
			"Pikiran setenang danau suci di puncak gunung, sarat dengan ilmu hakikat kehidupan!",
			"Setiap kata yang terucap adalah mutiara kebijaksanaan yang menyadarkan jiwa!",
			"Sosok teladan sejati yang perkataan dan tindakannya selalu menjadi panutan!"
		]
	],
	[
		"ceroboh", "Ceroboh", "💥",
		[
			"Sangat teliti dan hati-hati, tidak ada kesalahan sekecil apapun yang terlewat.",
			"Perfeksionis sejati dalam menjaga kerapian dan keamanan barang.",
			"Cek dan ricek berkali-kali sebelum melangkah.",
			"Aman dari bencana kecelakaan kecil akibat keteledoran."
		],
		[
			"Kadang tersandung kaki meja atau menumpahkan sedikit air minum, manusiawi.",
			"Lupa menutup rapat resleting tas sesekali saat terburu-buru.",
			"Kecerobohan ringan yang masih bisa diperbaiki dengan mudah.",
			"Terkadang kurang fokus jika sedang memikirkan banyak hal."
		],
		[
			"RAJA BENCANA KETELLEDORAN DUNIA! Jalan di lantai datar aja bisa kepeleset nabrak etalase kaca!",
			"Piring dan gelas di rumah auto waspada kalau lu lewat saking seringnya dipecahin!",
			"Kunci motor ketinggalan di kontak, dompet ketinggalan di warung, HP masuk ke kloset!",
			"Definisi manusia paling teledor se-galaksi, pembawa malapetaka kecil bagi barang pecah belah!"
		]
	],
	[
		"royal", "Royal", "💸",
		[
			"Dompetnya berdebu dan berkarat, perhitungan sampai seratus rupiah terkecil.",
			"Gak pernah mau keluar modal, maunya gratisan dan nebeng terus.",
			"Sangat pelit dan enggan berbagi rezeki dengan sesama.",
			"Sosok kikir yang menjauhkan rezeki berkah."
		],
		[
			"Suka mentraktir teman dekat saat sedang berulang tahun atau dapat bonus.",
			"Gak pelit makanan kalau ada camilan di meja tongkrongan.",
			"Cukup dermawan dalam batas kemampuan kantong pribadi.",
			"Teman yang menyenangkan dan tidak perhitungan dalam pergaulan."
		],
		[
			"SULTAN MINYAK DUBAI MINDER LIAT LU! Sekali nongkrong seisi kafe dibayarin lunas tanpa sisa!",
			"Royal tiada tanding! Rezeki mengalir deras dibagikan ke semua orang tanpa pandang bulu!",
			"Kedermawanan tingkat dewa, dompetnya selalu terbuka lebar untuk membahagiakan sesama!",
			"Sosok donatur legendaris yang selalu membawa berkah ke mana pun melangkah!"
		]
	],
	[
		"alim", "Alim", "📿",
		[
			"Astagfirullah tobat bro! Kelakuan lu lebih sering bikin malaikat pencatat kebaikan geleng-geleng!",
			"Jauh dari tempat ibadah, lebih akrab sama tempat hiburan malam.",
			"Sering lalai kewajiban dan terbawa hawa nafsu duniawi.",
			"Butuh bimbingan rohani segera sebelum tersesat lebih jauh."
		],
		[
			"Rajin ibadah standar dan selalu berusaha menjaga perbuatan baik.",
			"Sopan santun kepada yang lebih tua dan menghormati sesama.",
			"Menjaga amanah dan berusaha istiqomah dalam kebaikan.",
			"Pribadi yang cukup taat dan menjauhi perbuatan tercela."
		],
		[
			"CALON PENGHUNI SURGA FIRDAUS MUTLAK! Cahaya iman memancar terang dari wajah dan hatinya!",
			"Kesalehan tingkat waliyullah! Doa-doanya langsung tembus ke langit tertinggi tanpa perantara!",
			"Ibadahnya tak pernah putus, lisannya selalu basah dengan kebaikan dan dzikir!",
			"Sosok alim sejati yang menyejukkan hati siapa saja yang memandangnya!"
		]
	],
	[
		"barbar", "Barbar", "🪓",
		[
			"Halus dan lembut bagaikan sutra, bicara pun berbisik santun.",
			"Anti kekerasan dan selalu mengutamakan diplomasi damai.",
			"Takut melihat keributan dan lebih memilih menghindar.",
			"Sosok cinta damai yang sangat berhati-hati."
		],
		[
			"Bisa tegas dan agak beringas kalau membela teman yang dizalimi.",
			"Gaya mainnya agresif kalau lagi tanding olahraga atau game.",
			"Cukup punya taring dan tidak bisa ditindas sembarangan.",
			"Kekuatan fisik dan keberanian yang siap keluar di saat darurat."
		],
		[
			"PASUKAN VIKING KESURUPAN BERSERK! Masalah sepele langsung diselesaikan dengan adu jotos dan lempar kursi!",
			"Barbar maksimal tanpa ampun! Gak ada rem logika, maju terus pantang mundur hancurkan lawan!",
			"Tingkat kebarbaran melebihi monster purbakala yang baru bangun tidur!",
			"Pemberontak liar tanpa tandingan, siap meratakan apa saja yang menghalangi jalannya!"
		]
	],
	[
		"polos", "Polos", "🍼",
		[
			"Licik dan penuh intrik, otaknya licik penuh siasat bulus.",
			"Terlalu banyak makan asam garam dunia hitam, gak ada polos-polosnya.",
			"Sangat cerdik dan paham betul seluk-beluk tipu muslihat manusia.",
			"Sulit untuk dikelabui karena instingnya sangat tajam."
		],
		[
			"Cukup polos dalam beberapa hal percintaan dan pergaulan gaul.",
			"Terkadang percaya begitu saja jika dibohongi candaan ringan.",
			"Hati yang bersih dan tidak mudah berburuk sangka pada orang lain.",
			"Kepolosan yang manis dan disukai banyak kawan."
		],
		[
			"BAYI BARU LAHIR PUN LEBIH FAHAM DUNIA DARIPADA LU! Polosnya keterlaluan sampe gampang banget dibodoh-bodohin!",
			"Kepolosan tingkat dewa malaikat! Dibilang 'pesawat terbang bisa parkir di genteng' pun lu percaya seutuhnya!",
			"Hatinya terlalu suci dan murni untuk tinggal di dunia yang penuh tipu daya ini!",
			"Definisi makhluk paling lugu di muka bumi, wajib dilindungi dari bahaya pergaulan!"
		]
	],
	[
		"hoki", "Hoki", "🍀",
		[
			"Apes abadi sedunia! Beli kuaci isinya batu kerikil semua saking sialnya nasibmu!",
			"Gak pernah menang undian, ketiban sial terus menerus tanpa jeda.",
			"Dewi fortuna berpaling membelakangi setiap langkah hidupmu.",
			"Butuh ruwatan massal untuk membuang aura kesialan menahun."
		],
		[
			"Hoki standar manusia biasa, kadang dapat rezeki tak terduga sesekali.",
			"Pernah menang doorprize hadiah hiburan sabun cuci piring.",
			"Keberuntungan seimbang dengan usaha dan kerja keras.",
			"Cukup beruntung terhindar dari musibah-musibah besar."
		],
		[
			"ANAK KESAYANGAN DEWI FORTUNA SEJATI! Beli ciki berhadiah mobil mewah langsung di depan kasir!",
			"Keberuntungan tingkat dewa takdir! Jalan santai kesandung nemu segepok uang tunai tanpa pemilik!",
			"Semua hal yang disentuh selalu berbuah keberhasilan dan rezeki nomplok!",
			"Hoki mutlak sepanjang hayat, selalu selamat dan beruntung di segala situasi!"
		]
	],
	[
		"sial", "Sial", "🕳️",
		[
			"Aman sentosa bebas petaka! Hidupnya selalu dipayungi keberuntungan dan keselamatan.",
			"Jauh dari kata sial, segala urusan berjalan lancar tanpa hambatan berarti.",
			"Penuh berkah dan selalu dilindungi dari marabahaya.",
			"Dewi fortuna selalu tersenyum manis mendampingi langkahnya."
		],
		[
			"Pernah ketumpahan kuah bakso pas pake baju putih baru, sial wajar lah ya.",
			"Sesekali kena tilang karena lupa nyalain lampu motor di siang hari.",
			"Kesialan kecil sehari-hari yang menjadi bumbu cerita lucu bersama teman.",
			"Masih dalam batas normal pasang surut kehidupan manusia."
		],
		[
			"MAGNET KESIALAN TERKUAT DI TATA SURYA! Nyebrang jalan sepi aja bisa ketabrak sepeda ontel dari belakang!",
			"Kesialan legendaris tanpa jeda! Beli es krim baru satu jilatan langsung jatoh ke comberan!",
			"Apes kuadrat pangkat sepuluh! Tiap hari selalu ada saja musibah konyol yang menimpa dirinya!",
			"Definisi manusia paling apes di alam semesta, butuh mandi kembang tujuh rupa sekarang juga!"
		]
	],
	[
		"wibawa", "Wibawa", "🦁",
		[
			"Gak ada wibawanya sama sekali, ngomong di depan bocil aja ditertawakan.",
			"Tampak rapuh dan tidak memiliki ketegasan dalam memimpin.",
			"Mudah disepelekan orang karena tidak memiliki prinsip yang kuat.",
			"Kurang disegani di dalam pergaulan sehari-hari."
		],
		[
			"Cukup dihormati teman karena sikapnya yang adil dan tenang.",
			"Punya ketegasan yang baik saat memegang tanggung jawab penting.",
			"Wibawa yang terbentuk dari kedewasaan dan tutur kata yang sopan.",
			"Sosok yang dapat dipercaya memimpin kelompok kecil."
		],
		[
			"KHARISMA SINGA RAJA RIMBA! Sekali menatap tajam seluruh bawahan langsung tunduk patuh tanpa bantahan!",
			"Kewibawaan tingkat kaisar agung! Langkah kakinya memancarkan aura ketegasan yang menggetarkan ruangan!",
			"Pemimpin sejati yang disegani kawan maupun lawan karena keadilannya!",
			"Kewibawaan mutlak yang membuat siapapun menaruh hormat setinggi-tingginya!"
		]
	],
	[
		"setres", "Setres", "🤯",
		[
			"Pikiran tenang bagaikan permukaan danau di pagi hari yang sunyi.",
			"Bebas stres dan selalu bahagia menikmati setiap detik kehidupan.",
			"Manajemen emosi sangat luar biasa, tidak terbebani masalah hidup.",
			"Jiwa yang sehat, bugar, dan selalu dipenuhi rasa syukur."
		],
		[
			"Pusing dikit kalau tagihan bulanan datang bersamaan dengan deadline tugas.",
			"Kadang butuh liburan akhir pekan untuk menyegarkan pikiran yang penat.",
			"Stres wajar manusia pekerja keras yang sedang berjuang mencari nafkah.",
			"Bisa pulih kembali setelah tidur nyenyak dan makan makanan lezat."
		],
		[
			"KABEL OTAK PUTUS SEMUA KORSLET TOTAL! Rambut rontok mikirin cicilan dan masalah hidup yang tak berujung!",
			"Stres tingkat dewa bencana! Mau lari ke hutan tapi hutannya juga udah gundul ditebang!",
			"Tekanan batin mencapai 10.000 psi! Sedikit lagi meledak seperti gunung krakatau purba!",
			"Butuh healing ke luar angkasa selama 10 tahun untuk memulihkan kewarasan yang hilang!"
		]
	],
	[
		"peka", "Peka", "📡",
		[
			"Tidak peka sama sekali bagaikan tembok beton cor sepuluh lapis!",
			"Kode keras dari pasangan pun dianggap cuma lelucon angin lalu.",
			"Sangat tidak sensitif terhadap perasaan dan suasana hati orang lain.",
			"Bikin pasangan frustrasi setengah mati karena ketidakpekaannya."
		],
		[
			"Cukup peka jika sahabat atau pasangan mulai menunjukkan gelagat murung.",
			"Bisa memahami maksud tersirat dalam percakapan penting.",
			"Kepekaan yang wajar untuk menjaga keharmonisan hubungan sosial.",
			"Berusaha mendengarkan dan mengerti kebutuhan orang terdekat."
		],
		[
			"RADAR TELEPATI DETEKTOR HATI SUPERNATURAL! Pasangan baru mikir mau makan apa, lu udah mesen makanannya di meja!",
			"Kepekaan tingkat dewa paranormal! Sekali lirik sudut mata orang langsung tahu rahasia terdalamnya!",
			"Sangat pengertian tiada tara, mampu merasakan gelombang emosi orang lain dari jarak ribuan kilometer!",
			"Sosok paling peka di alam semesta, idaman seluruh pasangan di dunia!"
		]
	]
];

// Buat generator tambahan untuk melengkapi hingga 160 kategori
// Kita lengkapi variasi kategori gaul lainnya
const additionalKeywords = [
	["sangar", "Sangar", "🐺", "penampilan"],
	["ramah", "Ramah", "😊", "sifat"],
	["judes", "Judes", "😒", "kelakuan"],
	["bacot", "Bacot", "📢", "kelakuan"],
	["sultan", "Sultan", "💎", "vibe"],
	["gembel", "Gembel", "🪱", "vibe"],
	["setia", "Setia", "💍", "sifat"],
	["playboy", "Playboy", "💔", "kelakuan"],
	["playgirl", "Playgirl", "💅", "kelakuan"],
	["cemburuan", "Cemburuan", "😡", "sifat"],
	["cuek", "Cuek", "🧊", "sifat"],
	["humble", "Humble", "🌱", "sifat"],
	["pintar", "Pintar", "🧠", "kemampuan"],
	["tolol", "Tolol", "🤡", "kemampuan"],
	["beban", "Beban", "🎒", "kelakuan"],
	["pro", "Pro Player", "🎮", "kemampuan"],
	["noob", "Noob", "🕹️", "kemampuan"],
	["alap", "Alap-alap", "🦅", "kelakuan"],
	["bengis", "Bengis", "👹", "sifat"],
	["manis", "Manis", "🍭", "penampilan"],
	["asin", "Asin", "🧂", "vibe"],
	["hambar", "Hambar", "🥛", "vibe"],
	["garing", "Garing", "🍘", "kelakuan"],
	["segar", "Segar", "🍉", "penampilan"],
	["loyal", "Loyal", "🛡️", "sifat"],
	["khianat", "Pengkhianat", "🐍", "kelakuan"],
	["licik", "Licik", "🦊", "sifat"],
	["tulus", "Tulus", "🕊️", "sifat"],
	["pamrih", "Pamrih", "🧾", "kelakuan"],
	["berani", "Berani", "🦁", "sifat"],
	["penurut", "Penurut", "🐑", "sifat"],
	["pembangkang", "Pembangkang", "🏴‍☠️", "kelakuan"],
	["ngambekan", "Ngambekan", "😤", "kelakuan"],
	["boros", "Boros", "💸", "kelakuan"],
	["hemat", "Hemat", "🏦", "kelakuan"],
	["kepoan", "Kepoan", "🔎", "kelakuan"],
	["halu", "Halu", "🦄", "kelakuan"],
	["fokus", "Fokus", "🎯", "kemampuan"],
	["gugup", "Gugup", "😰", "kelakuan"],
	["santun", "Santun", "🙏", "sifat"],
	["kurangajar", "Kurang Ajar", "💢", "kelakuan"],
	["dermawan", "Dermawan", "🎁", "sifat"],
	["tamak", "Tamak", "🐲", "sifat"],
	["rajin", "Rajin", "🐝", "kelakuan"],
	["kocak", "Kocak", "😆", "kelakuan"],
	["kaku", "Kaku", "🗿", "penampilan"],
	["lincah", "Lincah", "🐒", "kemampuan"],
	["lambat", "Lambat", "🐌", "kemampuan"],
	["cekatan", "Cekatan", "⚡", "kemampuan"],
	["lelet", "Lelet", "🐢", "kemampuan"],
	["gesit", "Gesit", "🐆", "kemampuan"],
	["cerdas", "Cerdas", "💡", "kemampuan"],
	["oon", "Oon", "🥴", "kemampuan"],
	["lemot", "Lemot", "🐌", "kemampuan"],
	["gesrek", "Gesrek", "🪛", "kelakuan"],
	["songong", "Songong", "🤨", "kelakuan"],
	["berbakat", "Berbakat", "⭐", "kemampuan"],
	["beruntung", "Beruntung", "🎰", "vibe"],
	["melarat", "Melarat", "🍂", "vibe"],
	["tajir", "Tajir Melintir", "💰", "vibe"],
	["kere", "Kere", "🪹", "vibe"],
	["berisi", "Berisi", "🥐", "penampilan"],
	["langsing", "Langsing", "🎋", "penampilan"],
	["krempeng", "Krempeng", "🥢", "penampilan"],
	["atletis", "Atletis", "🏋️", "penampilan"],
	["gendut", "Gendut", "🍔", "penampilan"],
	["kurus", "Kurus", "🦴", "penampilan"],
	["tinggi", "Tinggi", "🦒", "penampilan"],
	["pendek", "Pendek", "🐧", "penampilan"],
	["mungil", "Mungil", "🐥", "penampilan"],
	["gemuk", "Gemuk", "🐻", "penampilan"],
	["tegap", "Tegap", "🏛️", "penampilan"],
	["gagah", "Gagah", "🦅", "penampilan"],
	["anggun", "Anggun", "🦢", "penampilan"],
	["elok", "Elok", "🌺", "penampilan"],
	["rupawan", "Rupawan", "🌟", "penampilan"],
	["jelek", "Jelek", "👺", "penampilan"],
	["burukrupa", "Buruk Rupa", "🧟", "penampilan"],
	["menawan", "Menawan", "💫", "penampilan"],
	["memikat", "Memikat", "🧲", "penampilan"],
	["modis", "Modis", "👗", "penampilan"],
	["kucel", "Kucel", "🧺", "penampilan"],
	["kumel", "Kumel", "🧽", "penampilan"],
	["rapi", "Rapi", "👔", "penampilan"],
	["berantakan", "Berantakan", "🌪️", "penampilan"],
	["elegan", "Elegan", "🍷", "penampilan"],
	["norak", "Norak", "🎪", "penampilan"],
	["kampungan", "Kampungan", "🌾", "kelakuan"],
	["trendy", "Trendy", "✨", "penampilan"],
	["jadul", "Jadul", "📻", "penampilan"],
	["gaul", "Gaul", "🛹", "kelakuan"],
	["kuper", "Kuper", "🕳️", "kelakuan"],
	["ansos", "Ansos", "📵", "kelakuan"],
	["ekstrovert", "Ekstrovert", "🎉", "sifat"],
	["introvert", "Introvert", "☕", "sifat"],
	["ambivert", "Ambivert", "🌓", "sifat"],
	["optimis", "Optimis", "☀️", "sifat"],
	["pesimis", "Pesimis", "🌧️", "sifat"],
	["realistis", "Realistis", "🧭", "sifat"],
	["idealis", "Idealis", "📐", "sifat"],
	["kepo", "Kepo", "🧐", "kelakuan"],
	["cuekbebek", "Cuek Bebek", "🦆", "kelakuan"],
	["sensitif", "Sensitif", "🥀", "sifat"],
	["keras", "Keras Kepala", "🗿", "sifat"],
	["lembek", "Lembek", "🍮", "sifat"],
	["tegas", "Tegas", "⚖️", "sifat"],
	["labil", "Labil", "🎢", "sifat"],
	["konsisten", "Konsisten", "🧱", "sifat"],
	["tertutup", "Tertutup", "🔒", "sifat"],
	["terbuka", "Terbuka", "📖", "sifat"],
	["hangat", "Hangat", "🍵", "sifat"],
	["dingin", "Dingin", "🧊", "sifat"],
	["ceria", "Ceria", "🌻", "sifat"],
	["murung", "Murung", "☁️", "sifat"],
	["pemalu", "Pemalu", "🙈", "sifat"],
	["pede", "Percaya Diri", "🦚", "sifat"],
	["minder", "Minder", "🦔", "sifat"],
	["waspada", "Waspada", "🛡️", "sifat"],
	["ceroboh", "Ceroboh", "🧨", "sifat"],
	["teliti", "Teliti", "🔬", "sifat"],
	["apik", "Apik", "🪡", "sifat"],
	["cengeng", "Cengeng", "😭", "kelakuan"],
	["tangguh", "Tangguh", "🛡️", "sifat"],
	["caper", "Caper", "🎪", "kelakuan"],
	["lebay", "Lebay", "🎭", "kelakuan"],
	["wajar", "Wajar", "🍃", "kelakuan"],
	["asik", "Asik", "🎸", "kelakuan"],
	["boring", "Boring", "📦", "kelakuan"],
	["seru", "Seru", "🎡", "kelakuan"],
	["ribet", "Ribet", "🧶", "kelakuan"],
	["simpel", "Simpel", "⚪", "kelakuan"],
	["polos", "Polos", "🍼", "kelakuan"],
	["nakal", "Nakal", "😈", "kelakuan"],
	["penurut", "Penurut", "👼", "kelakuan"],
	["bandel", "Bandel", "🔥", "kelakuan"],
	["jinak", "Jinak", "🐱", "kelakuan"],
	["liar", "Liar", "🐆", "kelakuan"],
	["galak", "Galak", "🐯", "kelakuan"],
	["lembut", "Lembut", "🪶", "kelakuan"],
	["manja", "Manja", "🐱", "kelakuan"],
	["mandiri", "Mandiri", "🦅", "kelakuan"],
	["ngeselin", "Ngeselin", "🦟", "kelakuan"],
	["ngangenin", "Ngangenin", "💌", "kelakuan"],
	["nyebelin", "Nyebelin", "🌶️", "kelakuan"],
	["bikinadem", "Bikin Adem", "🎐", "kelakuan"]
];

const database = {};

// 1. Masukkan rawCategories yang sudah didefinisikan lengkap
for (const item of rawCategories) {
	const [key, name, emoji, low, mid, high] = item;
	database[key] = {
		title: name,
		emoji: emoji,
		responses: {
			low,
			mid,
			high
		}
	};
}

// 2. Buat respons otomatis yang dinamis dan sangat gaul untuk sisa kategori
for (const add of additionalKeywords) {
	const [key, name, emoji, type] = add;
	if (database[key]) continue; // Jangan overwrite yang sudah ada

	let lowTexts = [];
	let midTexts = [];
	let highTexts = [];

	if (type === 'penampilan') {
		lowTexts = [
			`Aduh maaf banget, aura ${name.toLowerCase()}-mu sama sekali gak kelihatan di radar.`,
			`Kamera depan aja bingung mau nyari sisi ${name.toLowerCase()}-nya di sebelah mana.`,
			`Level ${name.toLowerCase()} masih minus, butuh upgrade penampilan besar-besaran.`,
			`Gak ada jejak ${name.toLowerCase()} secuilpun, nasib visual yang memprihatinkan.`
		];
		midTexts = [
			`Standar lah ya, aura ${name.toLowerCase()}-nya lumayan dapet kalau diliat dari samping.`,
			`Cukup ${name.toLowerCase()} dan sedap dipandang, gak bikin kaget orang yang papasan.`,
			`Tingkat ${name.toLowerCase()} wajar khas anak muda yang cukup rapi.`,
			`Ada potensi ${name.toLowerCase()} yang lumayan terpancar kalau dipoles dikit.`
		];
		highTexts = [
			`ANJAY PARIPURNA! Tingkat ${name.toLowerCase()} mencapai puncak semesta tiada lawan!`,
			`Visual ${name.toLowerCase()}-nya gak ada obat, bikin siapapun yang noleh auto terpesona!`,
			`Mahakarya visual sejati! Level ${name.toLowerCase()} setara dewa/dewi kahyangan!`,
			`Definisi ${name.toLowerCase()} mutlak! Semua mata tertuju padamu tanpa syarat!`
		];
	} else if (type === 'kelakuan') {
		lowTexts = [
			`Jauh dari kata ${name.toLowerCase()}, lu terlalu kalem dan membosankan bro.`,
			`Gak ada bibit ${name.toLowerCase()} sama sekali, hidup lu terlalu lurus dan tertib.`,
			`Kurang bumbu ${name.toLowerCase()} buat seru-seruan di tongkrongan malam.`,
			`Tingkat ${name.toLowerCase()} mendekati angka nol mutlak, lempeng banget.`
		];
		midTexts = [
			`Kadang ada sifat ${name.toLowerCase()} tipis-tipis pas lagi kumpul bareng kawan.`,
			`Cukup ${name.toLowerCase()} di momen tertentu, masih dalam batas aman sosial.`,
			`Tingkat ${name.toLowerCase()} wajar, menghibur dan gak bikin orang risih.`,
			`Kelakuan ${name.toLowerCase()} standar yang bikin pertemanan makin asik.`
		];
		highTexts = [
			`JUARA BERTAHAN KELAKUAN ${name.toUpperCase()} SEUMUR HIDUP! Tiada tandingan di galaksi ini!`,
			`Tingkat ${name.toLowerCase()}-nya sudah melampaui akal sehat manusia beradab!`,
			`Pabrik ${name.toLowerCase()} tanpa henti! Bikin semua orang sekeliling geleng-geleng kepala!`,
			`Definisi manusia paling ${name.toLowerCase()} di bumi, rekor dunia tercatat resmi!`
		];
	} else if (type === 'sifat') {
		lowTexts = [
			`Sifat ${name.toLowerCase()}-mu tertidur lelap di dasar samudra terdalam.`,
			`Sulit menemukan sisi ${name.toLowerCase()} dalam dirimu, hampir gak ada jejaknya.`,
			`Gak ada tanda-tanda lu punya sifat ${name.toLowerCase()} sama sekali.`,
			`Mungkin sifat ${name.toLowerCase()} lu tertinggal di masa lalu.`
		];
		midTexts = [
			`Punya kadar ${name.toLowerCase()} yang seimbang, tahu kapan harus menunjukkannya.`,
			`Cukup ${name.toLowerCase()} dalam menyikapi persoalan sehari-hari dengan baik.`,
			`Sifat ${name.toLowerCase()} yang wajar dan menyejukkan orang sekitar.`,
			`Bisa diandalkan sifat ${name.toLowerCase()}-nya dalam situasi tertentu.`
		];
		highTexts = [
			`JIWA KEMURNIAN SIFAT ${name.toUpperCase()} MUTLAK! Hati dan kepribadianmu adalah teladan semesta!`,
			`Kadar ${name.toLowerCase()} mencapai 100% sempurna tanpa noda sedikitpun!`,
			`Luar biasa mengagumkan! Tingkat ${name.toLowerCase()} yang langka dan sangat dihormati!`,
			`Sosok paripurna dengan sifat ${name.toLowerCase()} sejati yang menginspirasi banyak jiwa!`
		];
	} else {
		// Vibe atau kemampuan
		lowTexts = [
			`Energi ${name.toLowerCase()} lu lagi padam total, butuh cas baterai sekarang juga.`,
			`Gak kerasa sama sekali getaran ${name.toLowerCase()} dari dalam dirimu.`,
			`Hampir mustahil menemukan aura ${name.toLowerCase()} pada dirimu hari ini.`,
			`Kondisi ${name.toLowerCase()} sedang berada di titik terendah sepanjang sejarah.`
		];
		midTexts = [
			`Vibes ${name.toLowerCase()}-nya cukup berasa dan pas dinikmati santai.`,
			`Ada sentuhan ${name.toLowerCase()} yang menghangatkan suasana di sekelilingmu.`,
			`Kategori ${name.toLowerCase()} lumayan, cukup memberikan dampak positif.`,
			`Aliran energi ${name.toLowerCase()} yang stabil dan menyenangkan.`
		];
		highTexts = [
			`RESONANSI ENERGI ${name.toUpperCase()} MAKSIMAL! Mengguncang semesta dan alam bawah sadar!`,
			`Aura ${name.toLowerCase()}-mu terpancar begitu kuat hingga ribuan kilometer!`,
			`Puncak kekuatan ${name.toLowerCase()} sejati! Semua hal tunduk pada vibrasi hebatmu!`,
			`Definisi ${name.toLowerCase()} absolut no debat, magnet takdir tertinggi!`
		];
	}

	database[key] = {
		title: name,
		emoji: emoji,
		responses: {
			low: lowTexts,
			mid: midTexts,
			high: highTexts
		}
	};
}

fs.writeFileSync(TARGET_FILE, JSON.stringify(database, null, 2), 'utf-8');
const count = Object.keys(database).length;
console.log(`[Success] Berhasil membuat ${count} kategori di ${TARGET_FILE}`);
