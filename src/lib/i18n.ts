// Mock translation layer — offline phrase dictionary + per-word fallback.
// No backend. Keeps original text verbatim and produces a best-effort translation
// for the viewer's chosen display language. Items not in the dictionary
// (plates, names, models, SOP codes, technical terms) pass through unchanged.

export type Lang = "en" | "ms" | "id" | "zh";

export const LANGS: { code: Lang; label: string; native: string; flag: string }[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "ms", label: "Bahasa Melayu", native: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "id", label: "Bahasa Indonesia", native: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "zh", label: "Chinese (Simplified)", native: "中文", flag: "🇨🇳" },
];

export const langMeta = (code: Lang) => LANGS.find((l) => l.code === code)!;

// Whole-phrase dictionary — checked first (case-insensitive).
// Keyed by canonical English phrase.
const PHRASES: Record<string, Record<Lang, string>> = {
  "panel completed": {
    en: "Panel completed.",
    ms: "Panel siap.",
    id: "Panel selesai.",
    zh: "板金完成。",
  },
  "paint tomorrow": {
    en: "Paint tomorrow.",
    ms: "Cat esok.",
    id: "Cat besok.",
    zh: "明天喷漆。",
  },
  "waiting for parts": {
    en: "Waiting for parts.",
    ms: "Menunggu alat ganti.",
    id: "Menunggu suku cadang.",
    zh: "等待零件。",
  },
  "qc passed": { en: "QC passed.", ms: "QC lulus.", id: "QC lulus.", zh: "质检通过。" },
  "ready for delivery": {
    en: "Ready for delivery.",
    ms: "Sedia untuk dihantar.",
    id: "Siap diserahkan.",
    zh: "可以交车。",
  },
  "good job team": {
    en: "Good job, team.",
    ms: "Syabas, pasukan.",
    id: "Kerja bagus, tim.",
    zh: "干得好,团队。",
  },
  "please clean the booth": {
    en: "Please clean the booth.",
    ms: "Sila bersihkan bilik cat.",
    id: "Tolong bersihkan booth.",
    zh: "请清洁喷漆房。",
  },
};

// Per-token dictionary — used when no whole-phrase match exists.
// Tokens are lowercased; values keyed by destination language.
const TOKENS: Record<string, Partial<Record<Lang, string>>> = {
  // verbs / status
  panel: { ms: "panel", id: "panel", zh: "板金" },
  completed: { ms: "siap", id: "selesai", zh: "完成" },
  complete: { ms: "siap", id: "selesai", zh: "完成" },
  done: { ms: "siap", id: "selesai", zh: "完成" },
  paint: { ms: "cat", id: "cat", zh: "喷漆" },
  painting: { ms: "mengecat", id: "mengecat", zh: "喷漆中" },
  repair: { ms: "baiki", id: "perbaiki", zh: "维修" },
  repaired: { ms: "dibaiki", id: "diperbaiki", zh: "已维修" },
  ready: { ms: "sedia", id: "siap", zh: "完成" },
  qc: { ms: "QC", id: "QC", zh: "质检" },
  passed: { ms: "lulus", id: "lulus", zh: "通过" },
  waiting: { ms: "menunggu", id: "menunggu", zh: "等待" },
  parts: { ms: "alat ganti", id: "suku cadang", zh: "零件" },
  booth: { ms: "bilik cat", id: "booth cat", zh: "喷漆房" },
  clean: { ms: "bersihkan", id: "bersihkan", zh: "清洁" },
  please: { ms: "sila", id: "tolong", zh: "请" },
  team: { ms: "pasukan", id: "tim", zh: "团队" },
  good: { ms: "bagus", id: "bagus", zh: "好" },
  job: { ms: "kerja", id: "kerja", zh: "工作" },
  bumper: { ms: "bampar", id: "bemper", zh: "保险杠" },
  dent: { ms: "kemik", id: "penyok", zh: "凹陷" },
  scratch: { ms: "calar", id: "goresan", zh: "划痕" },
  // time words
  today: { ms: "hari ini", id: "hari ini", zh: "今天" },
  tomorrow: { ms: "esok", id: "besok", zh: "明天" },
  yesterday: { ms: "semalam", id: "kemarin", zh: "昨天" },
  morning: { ms: "pagi", id: "pagi", zh: "早上" },
  // common
  the: { ms: "", id: "", zh: "" },
  is: { ms: "", id: "", zh: "" },
  for: { ms: "untuk", id: "untuk", zh: "为" },
  and: { ms: "dan", id: "dan", zh: "和" },
};

// Chinese phrase tokens used during zh -> other detection
const ZH_TOKENS: Record<string, Partial<Record<Lang, string>>> = {
  板金: { en: "panel", ms: "panel", id: "panel" },
  完成: { en: "completed", ms: "siap", id: "selesai" },
  喷漆: { en: "paint", ms: "cat", id: "cat" },
  明天: { en: "tomorrow", ms: "esok", id: "besok" },
  今天: { en: "today", ms: "hari ini", id: "hari ini" },
  质检: { en: "QC", ms: "QC", id: "QC" },
  通过: { en: "passed", ms: "lulus", id: "lulus" },
  等待: { en: "waiting", ms: "menunggu", id: "menunggu" },
  零件: { en: "parts", ms: "alat ganti", id: "suku cadang" },
  请: { en: "please", ms: "sila", id: "tolong" },
  团队: { en: "team", ms: "pasukan", id: "tim" },
};

// Heuristic language detection.
export function detectLang(text: string): Lang {
  if (!text) return "en";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  const t = text.toLowerCase();
  // Indonesian-specific markers
  if (/\b(selesai|besok|kemarin|tolong|suku cadang|bemper|penyok|goresan)\b/.test(t)) return "id";
  // Malay-specific markers
  if (/\b(siap|esok|semalam|sila|bilik cat|bampar|kemik|calar|syabas)\b/.test(t)) return "ms";
  return "en";
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[。.!?,，]+$/g, "");

// Translate `text` to `target`. Returns original if target equals detected source.
export function translate(text: string, target: Lang): { text: string; source: Lang; translated: boolean } {
  const source = detectLang(text);
  if (!text.trim() || source === target) {
    return { text, source, translated: false };
  }

  // Whole-phrase lookup — find any English canonical phrase whose content
  // matches the input (after normalizing to English first if source != en).
  const englishish = source === "en" ? norm(text) : null;
  if (englishish) {
    for (const key of Object.keys(PHRASES)) {
      if (englishish.includes(key)) {
        return { text: PHRASES[key][target], source, translated: true };
      }
    }
  }

  // Chinese tokenization — substring replace.
  if (source === "zh") {
    let out = text;
    for (const [zh, map] of Object.entries(ZH_TOKENS)) {
      const repl = map[target];
      if (repl !== undefined) out = out.replaceAll(zh, ` ${repl} `);
    }
    out = out.replace(/[。]/g, ".").replace(/\s+/g, " ").trim();
    // Capitalize first letter if latin target
    if (target !== "zh" && out) out = out[0].toUpperCase() + out.slice(1);
    return { text: out || text, source, translated: out !== text };
  }

  // Per-word translation for latin sources.
  const tokens = text.split(/(\s+|[.,!?;:])/);
  let changed = false;
  const out = tokens
    .map((tok) => {
      const key = tok.toLowerCase().replace(/[.,!?;:]/g, "");
      if (!key) return tok;
      const entry = TOKENS[key];
      if (!entry) return tok;
      const repl = entry[target];
      if (repl === undefined) return tok;
      changed = true;
      // Preserve trailing punctuation
      const punct = tok.match(/[.,!?;:]+$/)?.[0] ?? "";
      return repl + punct;
    })
    .join("");

  return { text: changed ? out : text, source, translated: changed };
}

// Static UI labels (chrome text — separate from user-generated content)
export const UI: Record<Lang, Record<string, string>> = {
  en: {
    chooseLang: "Choose your language",
    chooseLangSub: "You can change this later in Settings.",
    continue: "Continue",
    welcomeBack: "Welcome back",
    register: "Create your account",
    name: "Your name",
    role: "Your role",
    phone: "Phone (optional)",
    signIn: "Continue",
    showOriginal: "Show original",
    showTranslation: "Show translation",
    settings: "Settings",
    language: "Language",
    preferredLang: "Preferred display language",
    signOut: "Sign out",
    original: "Original",
    translated: "Translated",
    tapForOriginal: "Tap to see original",
    owner: "Owner",
    manager: "Manager",
    worker: "Worker",
  },
  ms: {
    chooseLang: "Pilih bahasa anda",
    chooseLangSub: "Anda boleh ubah kemudian di Tetapan.",
    continue: "Teruskan",
    welcomeBack: "Selamat kembali",
    register: "Cipta akaun anda",
    name: "Nama anda",
    role: "Jawatan anda",
    phone: "Telefon (pilihan)",
    signIn: "Teruskan",
    showOriginal: "Tunjuk asal",
    showTranslation: "Tunjuk terjemahan",
    settings: "Tetapan",
    language: "Bahasa",
    preferredLang: "Bahasa paparan pilihan",
    signOut: "Log keluar",
    original: "Asal",
    translated: "Terjemahan",
    tapForOriginal: "Ketik untuk teks asal",
    owner: "Pemilik",
    manager: "Pengurus",
    worker: "Pekerja",
  },
  id: {
    chooseLang: "Pilih bahasa Anda",
    chooseLangSub: "Bisa diubah nanti di Pengaturan.",
    continue: "Lanjutkan",
    welcomeBack: "Selamat datang kembali",
    register: "Buat akun Anda",
    name: "Nama Anda",
    role: "Peran Anda",
    phone: "Telepon (opsional)",
    signIn: "Lanjutkan",
    showOriginal: "Tampilkan asli",
    showTranslation: "Tampilkan terjemahan",
    settings: "Pengaturan",
    language: "Bahasa",
    preferredLang: "Bahasa tampilan pilihan",
    signOut: "Keluar",
    original: "Asli",
    translated: "Terjemahan",
    tapForOriginal: "Ketuk untuk teks asli",
    owner: "Pemilik",
    manager: "Manajer",
    worker: "Pekerja",
  },
  zh: {
    chooseLang: "选择您的语言",
    chooseLangSub: "您可以稍后在设置中更改。",
    continue: "继续",
    welcomeBack: "欢迎回来",
    register: "创建您的账户",
    name: "您的姓名",
    role: "您的角色",
    phone: "电话(可选)",
    signIn: "继续",
    showOriginal: "显示原文",
    showTranslation: "显示翻译",
    settings: "设置",
    language: "语言",
    preferredLang: "首选显示语言",
    signOut: "退出登录",
    original: "原文",
    translated: "翻译",
    tapForOriginal: "点击查看原文",
    owner: "老板",
    manager: "经理",
    worker: "员工",
  },
};
