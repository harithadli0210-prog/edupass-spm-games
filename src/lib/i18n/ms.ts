import type { Dictionary } from "./en";

/**
 * Bahasa Melayu.
 *
 * Written for Malaysian secondary students, not as a literal translation of the
 * English. Where a direct rendering would read stiff, the Malay says the same
 * thing the way a teacher would — "Betul" rather than "Jawapan anda betul",
 * "Belum cukup lagi" rather than "Tidak agak".
 *
 * Deliberately kept in English because students use them that way: XP, Level,
 * Speedy Challenge, Daily Challenge, and the subject name "English".
 */
export const ms: Dictionary = {
  meta: {
    title: "SPM Games 2026 — EduPass",
    titleTemplate: "%s — SPM Games 2026",
    description:
      "Cabaran SPM seluruh negara untuk setiap pelajar Malaysia. Main setiap hari, naik ranking, dan temui di mana kekuatan anda.",
  },

  common: {
    play: "Main",
    playNow: "Main Sekarang",
    points: "mata",
    pts: "mata",
    xp: "XP",
    level: "Tahap",
    streak: "Streak",
    accuracy: "Ketepatan",
    day: "hari",
    days: "hari",
    questions: "soalan",
    answered: "dijawab",
    correct: "betul",
    subject: "Subjek",
    subjects: "Subjek",
    of: "daripada",
    viewAll: "Lihat semua",
    tryAgain: "Cuba lagi",
    back: "Kembali",
    loading: "Memuatkan",
    soon: "Akan Datang",
    adminOnly: "Admin sahaja",
    doneToday: "Selesai hari ini",
    seconds: "saat",
    unlimited: "tanpa had",
    mastery: "penguasaan",
    players: "pemain",
  },

  nav: {
    myDesk: "Ruang Saya",
    compete: "Bertanding",
    support: "Bantuan",
    dashboard: "Papan Utama",
    progress: "Kemajuan Saya",
    miniGames: "Mini Games",
    leaderboard: "Ranking",
    prizes: "Hadiah",
    help: "Pusat Bantuan",
    home: "Utama",
    ranking: "Ranking",
    backToGame: "Kembali ke permainan",
    upsellTitle: "Sedia untuk langkah seterusnya?",
    upsellBody:
      "Lengkapkan profil EduPass anda untuk lihat kursus yang padan dengan cara anda bermain.",
    upsellCta: "Terokai kursus",
  },

  hero: {
    inPrizes: "hadiah",
    seasonBadge: "SPM Games 2026 · Musim 1",
    headline: "Main, naik ranking, menang hadiah sebenar.",
    sub: "Tinggal {days} hari musim ini, {name}. Setiap pusingan yang anda main dikira untuk ranking Malaysia anda.",
    playToday: "Main cabaran hari ini",
    viewPrizes: "Lihat hadiah",
  },

  dashboard: {
    goodMorning: "Selamat pagi",
    goodAfternoon: "Selamat petang",
    goodEvening: "Selamat malam",
    fullProgress: "Kemajuan penuh",
    allModes: "Semua mod",
    malaysiaRank: "Ranking Malaysia",
    ofPlayers: "daripada {total} pemain seluruh negara",
    playToGetRanked: "Main satu pusingan untuk dapat ranking",
    overall: "Keseluruhan",
    performance: "Prestasi",
    performanceEmpty: "Main satu pusingan bagi setiap subjek untuk isi ini.",
    miniGames: "Mini Games",
    dailySubtitle: "Daily Challenge · {done} daripada {total} subjek selesai hari ini",
    prizesTitle: "Apa yang anda rebutkan",
    prizesSubtitle: "RM {pool} merentas {count} kategori musim ini.",
    allPrizes: "Semua hadiah",
    prizesEmptyTitle: "Hadiah belum diumumkan",
    prizesEmptyBody:
      "Butiran hadiah untuk musim ini akan dipaparkan di sini setelah disahkan.",
    topOfMalaysia: "Teratas Malaysia",
    fullRanking: "Ranking penuh",
    you: "Anda",
    pointsToTop100: "mata lagi untuk masuk Top 100",
    subjectMastery: "Penguasaan subjek",
    masteryEmptyTitle: "Belum ada data subjek",
    masteryEmptyBody:
      "Main satu pusingan dalam mana-mana subjek dan penguasaan anda mula terbina di sini.",
    xpToNext: "{xp} XP lagi ke tahap {level}",
  },

  play: {
    chooseMode: "Pilih mod",
    chooseModeSub:
      "Daily dan Speedy ada ranking masing-masing. Kedua-duanya menyumbang kepada ranking keseluruhan anda.",
    daily: "Daily Challenge",
    dailyBlurb:
      "10 soalan setiap subjek, setiap hari. Mata terkumpul sepanjang musim.",
    dailyTitle: "Daily Challenge",
    dailySub:
      "Sepuluh soalan setiap subjek. Semua pelajar di Malaysia dapat set yang sama hari ini, jadi ranking ini perbandingan yang adil.",
    dailyMeta: "10 soalan · sekali sehari",
    speed: "Speedy Challenge",
    speedBlurb:
      "60 saat. Jawab seberapa banyak yang boleh — ketepatan tetap dikira.",
    speedTitle: "Speedy Challenge",
    speedSub:
      "Enam puluh saat, seberapa banyak soalan yang anda mampu. Main sekerap yang anda mahu — tiada had harian.",
    speedMeta: "60 saat · tanpa had",
    mission: "Misi Subjek",
    missionBlurb: "Kuasai satu subjek topik demi topik.",
    boss: "Boss Mingguan",
    bossBlurb: "Satu subjek, 20 soalan, kesukaran meningkat.",
    scoringTitle: "Cara pengiraan mata",
    scoring1: "Jawapan betul yang lebih pantas dapat bonus kelajuan lebih besar.",
    scoring2: "Soalan lebih sukar bernilai lebih tinggi.",
    scoring3: "Jawapan salah menolak mata.",
    scoring4:
      "Jumlah pusingan anda didarab dengan ketepatan — jawab 100 soalan secara sembarangan takkan mengatasi 20 soalan yang dijawab dengan betul.",
    allDoneTitle:
      "Kelima-lima subjek selesai hari ini. Soalan baharu dibuka pada tengah malam — atau main Speedy Challenge sekarang, ia tiada had harian.",
  },

  game: {
    question: "Soalan",
    points: "Mata",
    correct: "Betul",
    notQuite: "Belum tepat",
    speed: "kelajuan",
    endEarly: "Tamatkan pusingan",
    starting: "Memulakan",
    roundScore: "Mata pusingan",
    avgTime: "Purata masa",
    playAgain: "Main lagi",
    backHome: "Kembali ke utama",
    levelUp: "Tahap {level}",
    levelUpBody: "Anda naik daripada tahap {from}.",
    correctOf: "{correct} betul daripada {answered}",
    accuracyMultiplier: "Pendarab ketepatan ×{factor}",
    completionBonus: "Bonus tamat",
    total: "Jumlah",
    gateNote:
      "Jumlah pusingan anda didarab dengan ketepatan, jadi menjawab dengan teliti lebih bernilai daripada menjawab dengan pantas. Lebih banyak betul, lebih tinggi pendarabnya.",
    errorTitle: "Pusingan ini menghadapi masalah",
  },

  leaderboard: {
    title: "Ranking",
    yourPosition: "Kedudukan anda",
    nobodyRanked: "Belum ada sesiapa dalam ranking",
    beFirst: "Jadi yang pertama — main satu pusingan dan nama anda naik.",
    improvedEmpty:
      "Ranking ini dibuka setelah pelajar mempunyai rekod penuh dalam bulan September dan Oktober.",
    noSchools: "Belum ada sekolah dalam ranking",
    noSchoolsBody:
      "Sekolah muncul di sini setelah cukup ramai pelajarnya bermain.",
    tabs: {
      overall: "Keseluruhan",
      daily: "Daily",
      speed: "Speedy",
      subject: "Subjek",
      school: "Sekolah",
      consistency: "Konsisten",
      improved: "Paling Meningkat",
    },
    blurbs: {
      overall:
        "Daily dan Speedy digabung mengikut pemberat. Pertandingan utama.",
      daily: "Mata Daily Challenge sahaja, terkumpul sepanjang musim.",
      speed: "Mata Speedy Challenge sahaja, terkumpul sepanjang musim.",
      subject: "Terbaik dalam setiap subjek.",
      school:
        "Disusun mengikut purata mata, jadi sekolah besar tiada kelebihan.",
      consistency:
        "Memberi ganjaran kepada penyertaan yang tetap, bukan yang paling lama bermain.",
      improved:
        "Peningkatan sebenar terbesar dari September ke Oktober. Perlu rekod penuh dalam kedua-dua bulan untuk layak.",
    },
  },

  performance: {
    title: "Prestasi saya",
    sub: "Bagaimana pencapaian anda musim ini, dan di mana kelemahannya.",
    overallScore: "Mata keseluruhan",
    avgResponse: "Purata jawapan",
    activeDays: "{days} hari aktif",
    accuracyOverTime: "Ketepatan mengikut masa",
    accuracyOverTimeSub: "Setiap titik ialah satu hari bermain.",
    notEnoughDays: "Belum cukup hari",
    notEnoughDaysBody:
      "Main sekurang-kurangnya dua hari berlainan dan trend anda akan muncul di sini.",
    playARound: "Main satu pusingan",
    byDifficulty: "Mengikut kesukaran",
    byDifficultySub: "Di mana ketepatan anda kekal, dan di mana ia menurun.",
    noQuestions: "Belum ada soalan dijawab",
    noQuestionsBody:
      "Bahagian ini memecahkan prestasi anda mengikut soalan mudah, sederhana dan sukar.",
    easy: "Mudah",
    medium: "Sederhana",
    hard: "Sukar",
  },

  prizes: {
    title: "Hadiah",
    poolBadge: "Kumpulan hadiah Musim 1",
    poolSub:
      "Merentas {count} kategori. Setiap kategori ada rankingnya sendiri, jadi ada lebih daripada satu jalan untuk menang.",
    mainCategories: "Kategori utama",
    subjectChampions: "Juara subjek",
    subjectChampionsSub:
      "Satu set hadiah untuk setiap lima subjek SPM.",
    firstPlace: "Tempat pertama",
    sponsoredBy: "Ditaja oleh",
    disclaimer:
      "Hadiah adalah anggaran dan boleh digantikan dengan barangan yang sama atau lebih tinggi nilainya. Pemenang ditentukan oleh ranking akhir musim pada 31 Oktober 2026 dan disahkan sebelum sebarang hadiah diberikan.",
  },

  insights: {
    title: "Apa yang kami pelajari tentang anda",
    sub: "Berdasarkan cara anda bermain setakat ini.",
    stillWatching: "Masih memerhati",
    stillWatchingBody:
      "Beberapa pusingan lagi dan corak permainan anda akan mula terpapar di sini.",
    playFirst: "Main beberapa pusingan dahulu",
    playFirstBody:
      "Selepas anda bermain, di sinilah kami tunjukkan apa yang jawapan anda cadangkan tentang cara anda belajar.",
    signals: {
      FAST_THINKER: {
        label: "Pemikir pantas",
        note: "Anda menjawab dengan ketara lebih pantas daripada kebanyakan pemain.",
      },
      CAREFUL_RESPONDER: {
        label: "Penjawab berhati-hati",
        note: "Anda mengambil masa, dan ia terserlah pada ketepatan anda.",
      },
      ANALYTICAL: {
        label: "Analitikal",
        note: "Anda cemerlang pada soalan yang memerlukan pengiraan dan penaakulan.",
      },
      DIFFICULTY_TOLERANT: {
        label: "Tahan soalan sukar",
        note: "Ketepatan anda kekal walaupun pada soalan paling sukar.",
      },
      PRESSURE_PERFORMER: {
        label: "Kuat bila ditekan masa",
        note: "Ketepatan anda kekal tinggi dalam pusingan bermasa.",
      },
      MATHEMATICAL_STRONG: {
        label: "Kuat dalam Matematik",
        note: "Matematik antara subjek terbaik anda.",
      },
      SCIENCE_STRONG: {
        label: "Kuat dalam Sains",
        note: "Sains antara subjek terbaik anda.",
      },
      LANGUAGE_STRONG: {
        label: "Kuat dalam bahasa",
        note: "Anda menunjukkan prestasi baik dalam BM dan English.",
      },
      CONSISTENT: {
        label: "Konsisten",
        note: "Anda hadir dan bermain secara tetap.",
      },
      PERSISTENT: {
        label: "Tekun",
        note: "Anda kembali kepada topik yang sama sehingga ia difahami.",
      },
    },
  },

  studyAreas: {
    title: "Anda mungkin berminat meneroka",
    emptyTitle: "Belum cukup maklumat",
    emptyBody:
      "Main merentas beberapa subjek dan kami akan cadangkan bidang pengajian yang berbaloi ditinjau.",
    disclaimer:
      "Berdasarkan cara anda bermain setakat ini. Ini cadangan untuk diterokai, bukan keputusan tentang masa depan anda — minat dan profil akademik penuh anda lebih penting daripada sebuah permainan.",
    cta: "Lengkapkan profil EduPass anda untuk padanan lebih tepat →",
  },

  auth: {
    joinTitle: "Sertai SPM Games 2026",
    joinSub:
      "Percuma, terbuka kepada semua pelajar SPM di Malaysia. Log masuk dengan nombor telefon untuk mula bermain.",
    privacyNote:
      "Kami guna nombor telefon anda untuk log masuk dan memastikan pertandingan ini adil dengan menghalang akaun berganda. Ia tidak sekali-kali dipaparkan pada mana-mana ranking.",
    mobileNumber: "Nombor telefon bimbit",
    mobileHint: "Kami akan hantar kod 6 digit melalui SMS.",
    sendCode: "Hantar kod",
    verificationCode: "Kod pengesahan",
    sentTo: "Dihantar ke {phone}",
    verifyContinue: "Sahkan dan teruskan",
    differentNumber: "Guna nombor lain",
    badPhone: "Masukkan nombor telefon bimbit Malaysia, cth. 012-345 6789.",
    badCode: "Kod itu tidak sah. Semak semula dan cuba lagi.",
    emailLabel: "Alamat e-mel",
    emailHint: "Kami akan e-mel kod 6 digit kepada anda.",
    sentToEmail: "Dihantar ke {email}",
    usePhone: "Guna nombor telefon",
    useEmail: "Guna e-mel",
    badEmail: "Masukkan alamat e-mel yang sah.",
    orDivider: "atau",
  },

  onboarding: {
    title: "Butiran anda",
    sub: "Lapan ruangan ringkas, kemudian anda boleh mula bermain. Kami perlukan ini untuk meletakkan anda pada ranking sekolah dan negeri.",
    fullName: "Nama penuh",
    fullNameHint: "Seperti dalam kad pengenalan anda.",
    displayName: "Nama paparan",
    displayNameHint: "Hanya nama ini yang dipaparkan pada ranking.",
    phone: "Nombor telefon",
    email: "E-mel",
    schoolName: "Nama sekolah",
    schoolHint: "Tulis dengan penuh, cth. SMK Taman Melawati.",
    state: "Negeri",
    chooseState: "Pilih negeri anda",
    district: "Daerah / Bandar",
    chooseDistrict: "Pilih daerah anda",
    districtHint: "Pilih negeri anda dahulu.",
    postcode: "Poskod",
    consent:
      "Saya bersetuju EduPass menyimpan butiran ini untuk mengendalikan SPM Games 2026 dan meletakkan saya pada ranking pertandingan.",
    guardianConsent:
      "Saya berumur bawah 18 tahun dan ibu bapa atau penjaga saya bersetuju dengan penyertaan ini.",
    submit: "Mula bermain",
    saveError: "Butiran anda tidak dapat disimpan.",
  },

  help: {
    title: "Pusat Bantuan",
    sub: "Cara pengiraan mata, ranking dan hadiah.",
    stillStuck: "Masih buntu? E-mel {email} dan kami akan balas.",
    faqs: [
      {
        q: "Bagaimana mata saya dikira?",
        a: "Setiap jawapan betul mendapat mata asas, didarab mengikut tahap kesukaran soalan. Dalam Speedy Challenge, jawapan lebih pantas mendapat bonus tambahan. Pada akhir pusingan, jumlah anda didarab dengan ketepatan anda, jadi menjawab dengan teliti lebih bernilai daripada menjawab dengan pantas.",
      },
      {
        q: "Kenapa mata Speedy saya turun selepas menjawab lebih banyak soalan?",
        a: "Jawapan salah menolak mata, dan jumlah pusingan anda didarab dengan faktor ketepatan. Menjawab 100 soalan secara sembarangan takkan mengatasi 20 soalan yang dijawab dengan betul — ini disengajakan, supaya ranking memberi ganjaran kepada kefahaman, bukan kepantasan menekan.",
      },
      {
        q: "Boleh saya main Daily Challenge lebih daripada sekali?",
        a: "Sekali bagi setiap subjek setiap hari, dan semua pelajar di Malaysia dapat sepuluh soalan yang sama, jadi ranking Daily ialah perbandingan yang adil. Speedy Challenge pula tiada had harian.",
      },
      {
        q: "Bagaimana mata Daily dan Speedy digabungkan?",
        a: "Ia tidak digabungkan — setiap satu ada rankingnya sendiri dan hadiahnya sendiri. Ranking Keseluruhan anda menggabungkan kedua-duanya mengikut pemberat yang diterbitkan, selepas setiap mod dinormalkan supaya tiada mod yang mendominasi semata-mata kerana angkanya lebih besar.",
      },
      {
        q: "Apa yang dikira untuk anugerah Konsisten?",
        a: "Hari aktif, berapa banyak Daily Challenge yang anda selesaikan, dan streak terpanjang anda. Jumlah jam bermain sengaja tidak dikira — anugerah ini memberi ganjaran kepada penyertaan yang tetap, bukan kepada yang bermain paling lama.",
      },
      {
        q: "Siapa boleh lihat butiran saya?",
        a: "Ranking hanya memaparkan nama paparan, sekolah dan negeri anda. Nombor telefon, e-mel dan poskod anda tidak sekali-kali dipaparkan secara awam dan tidak boleh dibaca oleh pelajar lain.",
      },
    ],
  },

  policy: {
    rules: "Peraturan Pertandingan",
    privacy: "Notis Privasi",
    contact: "Ada soalan? E-mel",
    consentPrefix: "Saya bersetuju dengan",
    consentRules: "Peraturan Pertandingan",
    consentAnd: "dan",
    consentPrivacy: "Notis Privasi",
    consentSuffix: ", dan EduPass menyimpan butiran saya untuk mengendalikan SPM Games 2026.",
    draftWarning:
      "Draf — belum disemak oleh penasihat undang-undang. Jangan terbitkan kepada pelajar dalam keadaan ini.",
  },

  errors: {
    somethingWrong: "Ada masalah berlaku",
    couldNotLoad:
      "Kami tidak dapat memuatkan bahagian ini sekarang. Semak sambungan anda dan cuba lagi.",
    notSignedIn: "Belum log masuk.",
    couldNotStart: "Pusingan tidak dapat dimulakan.",
    couldNotRecord: "Jawapan anda tidak dapat direkodkan.",
    couldNotFinish: "Pusingan tidak dapat ditamatkan.",
    tooManyRounds:
      "Terlalu banyak pusingan dimulakan. Berehat sebentar dan cuba lagi.",
    slowDown: "Perlahan sikit.",
    noQuestions: "Belum ada soalan tersedia untuk subjek ini.",
    modeUnavailable: "Mod permainan ini belum tersedia.",
    seasonClosed: "Musim ini belum dibuka.",
    profileFirst: "Lengkapkan profil anda dahulu.",
    alreadyPlayed:
      "Anda sudah main cabaran hari ini untuk subjek ini.",
    inProgress: "Cabaran ini sedang anda mainkan.",
    challengeNotOpen: "Cabaran hari ini belum dibuka.",
    timesUp: "Masa tamat.",
    roundFinished: "Pusingan ini sudah tamat.",
  },
};
