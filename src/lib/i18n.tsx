import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "zh" | "ms" | "id";

export const LANGS: { code: Lang; label: string; flag: string; native: string }[] = [
  { code: "en", flag: "🇬🇧", label: "English", native: "English" },
  { code: "ms", flag: "🇲🇾", label: "Bahasa Melayu", native: "Bahasa Melayu" },
  { code: "id", flag: "🇮🇩", label: "Bahasa Indonesia", native: "Bahasa Indonesia" },
  { code: "zh", flag: "🇨🇳", label: "中文（简体）", native: "中文（简体）" },
];

// Full EN + ZH dictionaries. MS + ID prepared (currently fallback to EN).
type Dict = Record<string, string>;

const en: Dict = {
  // Nav
  "nav.home": "Home",
  "nav.jobs": "Jobs",
  "nav.team": "Team",
  "nav.skills": "Skills",
  "nav.learn": "Learn",
  "nav.salary": "Salary",
  "nav.advance": "Adv",
  "nav.profile": "Me",

  // Common
  "common.brand": "DHX Team Ops",
  "common.viewAll": "View all",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.submit": "Submit",
  "common.approve": "Approve",
  "common.reject": "Reject",
  "common.signOut": "Sign out",
  "common.showTranslation": "Show Translation",
  "common.showOriginal": "Show Original",
  "common.back": "Back",
  "common.required": "Required",
  "common.current": "Current",
  "common.notes": "Notes",
  "common.reason": "Reason",
  "common.pending": "Pending",
  "common.approved": "Approved",
  "common.rejected": "Rejected",

  // Status
  "status.InProgress": "In Progress",
  "status.PendingQC": "Pending QC",
  "status.Completed": "Completed",
  "status.WaitingParts": "Waiting Parts",
  "status.Received": "Received",
  "status.Repair": "Repair",
  "status.Panel": "Panel",
  "status.Paint": "Paint",
  "status.QC": "QC",
  "status.Ready": "Ready",
  "status.All": "All",

  // Pages
  "page.dashboard.title": "Dashboard",
  "page.dashboard.greet": "Hi",
  "page.dashboard.todayJobs": "Today's jobs",
  "page.dashboard.recent": "Recent activity",
  "page.dashboard.activeWorkers": "Active Workers",
  "page.dashboard.todayJobsKpi": "Today's Jobs",
  "page.dashboard.outstandingSalary": "Outstanding Salary",
  "page.dashboard.employeeAdvances": "Employee Advances",

  "page.jobs.title": "Jobs",
  "page.jobs.subtitle": "{count} jobs shown",

  "page.team.title": "Team",
  "page.team.attendance": "Today Attendance",
  "page.team.currentJobs": "Current Jobs",
  "page.team.workerLoad": "Current Worker Load",
  "page.team.score": "Team Score",
  "page.team.training": "Training Progress",

  "page.skills.title": "Skills",
  "page.skills.requestAssessment": "Request Assessment",
  "page.skills.canTeach": "Can Teach",
  "page.skills.learning": "Learning",
  "page.skills.gap": "Gap",
  "page.skills.recommendedTraining": "Recommended Training",
  "page.skills.history": "Assessment History",

  "page.learning.title": "Learning",
  "page.learning.videos": "Videos",
  "page.learning.notes": "Repair Notes",
  "page.learning.sop": "SOP",
  "page.learning.markViewed": "Mark Viewed",
  "page.learning.markLearned": "Mark Learned",

  "page.salary.title": "Salary",
  "page.advance.title": "Advance",

  "page.profile.title": "Profile",
  "page.profile.account": "Account",
  "page.profile.thisMonth": "This month",
  "page.profile.salary": "Salary",
  "page.profile.ot": "OT hrs",
  "page.profile.advance": "Advance",
  "page.profile.phone": "Phone",
  "page.profile.documents": "Documents",
  "page.profile.settings": "Settings",
  "page.profile.preferredLanguage": "Preferred Language",

  // Job detail
  "job.vehicleInfo": "Vehicle Info",
  "job.plate": "Plate",
  "job.model": "Model",
  "job.customer": "Customer",
  "job.workflow": "Repair Workflow",
  "job.team": "Team Assignment",
  "job.photos": "Photo Timeline",
  "job.before": "Before",
  "job.during": "During",
  "job.after": "After",
  "job.labour": "Labour Tracking",
  "job.completion": "Completion",
  "job.estimated": "Estimated",
  "job.actual": "Actual",
  "job.timeline": "Job Timeline",
  "job.related": "Learning Resources",
  "job.skills": "Worker Skills",
  "job.costs": "Cost Tracking",

  // Language modal
  "lang.choose": "Choose your language",
  "lang.chooseSub": "Select your preferred language to continue.",
  "lang.continue": "Continue",
};

const zh: Dict = {
  "nav.home": "首页",
  "nav.jobs": "工单",
  "nav.team": "团队",
  "nav.skills": "技能",
  "nav.learn": "学习",
  "nav.salary": "薪资",
  "nav.advance": "预支",
  "nav.profile": "我",

  "common.brand": "DHX Team Ops",
  "common.viewAll": "查看全部",
  "common.save": "保存",
  "common.cancel": "取消",
  "common.submit": "提交",
  "common.approve": "批准",
  "common.reject": "拒绝",
  "common.signOut": "退出登录",
  "common.showTranslation": "显示译文",
  "common.showOriginal": "显示原文",
  "common.back": "返回",
  "common.required": "要求",
  "common.current": "当前",
  "common.notes": "备注",
  "common.reason": "原因",
  "common.pending": "待处理",
  "common.approved": "已批准",
  "common.rejected": "已拒绝",

  "status.InProgress": "进行中",
  "status.PendingQC": "待质检",
  "status.Completed": "已完成",
  "status.WaitingParts": "等待配件",
  "status.Received": "已接收",
  "status.Repair": "维修",
  "status.Panel": "钣金",
  "status.Paint": "喷漆",
  "status.QC": "质检",
  "status.Ready": "完成",
  "status.All": "全部",

  "page.dashboard.title": "工作台",
  "page.dashboard.greet": "你好",
  "page.dashboard.todayJobs": "今日工单",
  "page.dashboard.recent": "最近动态",
  "page.dashboard.activeWorkers": "在岗员工",
  "page.dashboard.todayJobsKpi": "今日工单",
  "page.dashboard.outstandingSalary": "未付薪资",
  "page.dashboard.employeeAdvances": "员工预支",

  "page.jobs.title": "工单",
  "page.jobs.subtitle": "共 {count} 张工单",

  "page.team.title": "团队",
  "page.team.attendance": "今日出勤",
  "page.team.currentJobs": "进行中工单",
  "page.team.workerLoad": "员工工作量",
  "page.team.score": "团队评分",
  "page.team.training": "培训进度",

  "page.skills.title": "技能",
  "page.skills.requestAssessment": "申请评估",
  "page.skills.canTeach": "可带教",
  "page.skills.learning": "学习中",
  "page.skills.gap": "差距",
  "page.skills.recommendedTraining": "推荐培训",
  "page.skills.history": "评估记录",

  "page.learning.title": "学习",
  "page.learning.videos": "视频",
  "page.learning.notes": "维修笔记",
  "page.learning.sop": "SOP",
  "page.learning.markViewed": "标记已看",
  "page.learning.markLearned": "标记已学",

  "page.salary.title": "薪资",
  "page.advance.title": "预支",

  "page.profile.title": "个人资料",
  "page.profile.account": "账户",
  "page.profile.thisMonth": "本月",
  "page.profile.salary": "薪资",
  "page.profile.ot": "加班小时",
  "page.profile.advance": "预支",
  "page.profile.phone": "电话",
  "page.profile.documents": "文件",
  "page.profile.settings": "设置",
  "page.profile.preferredLanguage": "首选语言",

  "job.vehicleInfo": "车辆信息",
  "job.plate": "车牌",
  "job.model": "型号",
  "job.customer": "客户",
  "job.workflow": "维修流程",
  "job.team": "团队分配",
  "job.photos": "照片时间线",
  "job.before": "维修前",
  "job.during": "维修中",
  "job.after": "完工后",
  "job.labour": "工时跟踪",
  "job.completion": "完成日期",
  "job.estimated": "预计",
  "job.actual": "实际",
  "job.timeline": "工单时间线",
  "job.related": "学习资源",
  "job.skills": "员工技能",
  "job.costs": "成本跟踪",

  "lang.choose": "选择您的语言",
  "lang.chooseSub": "请选择您的首选语言以继续。",
  "lang.continue": "继续",
};

// MS + ID: structure prepared, currently fall back to EN. Translators can fill in later.
const ms: Dict = {};
const id: Dict = {};

const dicts: Record<Lang, Dict> = { en, zh, ms, id };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
};

const LangCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "dhx_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const [needsChoice, setNeedsChoice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && dicts[stored]) {
      setLangState(stored);
      setReady(true);
    } else {
      setNeedsChoice(true);
      setReady(true);
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
    setNeedsChoice(false);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    const dict = dicts[lang];
    let str = dict[key] ?? en[key] ?? key;
    if (vars) for (const k in vars) str = str.replace(`{${k}}`, String(vars[k]));
    return str;
  };

  return (
    <LangCtx.Provider value={{ lang, setLang, t, ready }}>
      {children}
      {ready && needsChoice && <LanguageModal onChoose={setLang} />}
    </LangCtx.Provider>
  );
}

export function useT() {
  const ctx = useContext(LangCtx);
  if (!ctx) return { lang: "en" as Lang, setLang: () => {}, t: (k: string) => k, ready: true };
  return ctx;
}

function LanguageModal({ onChoose }: { onChoose: (l: Lang) => void }) {
  const [selected, setSelected] = useState<Lang | null>(null);
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">DHX Team Ops</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Choose your language</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          请选择您的首选语言 · Pilih bahasa anda
        </p>
        <ul className="mt-5 space-y-2">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                onClick={() => setSelected(l.code)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  selected === l.code
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background"
                }`}
              >
                <span className="text-2xl">{l.flag}</span>
                <span className="flex-1 text-sm font-medium">{l.native}</span>
                {selected === l.code && (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </button>
            </li>
          ))}
        </ul>
        <button
          disabled={!selected}
          onClick={() => selected && onChoose(selected)}
          className="mt-5 w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export function LanguagePicker({ onClose }: { onClose: () => void }) {
  const { lang, setLang } = useT();
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold tracking-tight">Preferred Language</h2>
        <ul className="mt-4 space-y-2">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                onClick={() => { setLang(l.code); onClose(); }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${
                  lang === l.code ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <span className="text-2xl">{l.flag}</span>
                <span className="flex-1 text-sm font-medium">{l.native}</span>
                {lang === l.code && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Maps for translating status strings coming from mock data without changing source.
export function tStatus(t: Ctx["t"], status: string): string {
  const map: Record<string, string> = {
    "In Progress": "status.InProgress",
    "Pending QC": "status.PendingQC",
    "Completed": "status.Completed",
    "Waiting Parts": "status.WaitingParts",
    "Received": "status.Received",
    "Repair": "status.Repair",
    "Panel": "status.Panel",
    "Paint": "status.Paint",
    "QC": "status.QC",
    "Ready": "status.Ready",
    "All": "status.All",
  };
  return map[status] ? t(map[status]) : status;
}
