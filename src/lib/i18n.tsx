import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "zh" | "ms" | "id";

export const LANGS: { code: Lang; label: string; flag: string; native: string }[] = [
  { code: "en", flag: "🇬🇧", label: "English", native: "English" },
  { code: "ms", flag: "🇲🇾", label: "Bahasa Melayu", native: "Bahasa Melayu" },
  { code: "id", flag: "🇮🇩", label: "Bahasa Indonesia", native: "Bahasa Indonesia" },
  { code: "zh", flag: "🇨🇳", label: "中文（简体）", native: "中文（简体）" },
];

// Full dictionaries keyed by English source string. EN passes through.
// Skipped: vehicle plates, names, customer names, vehicle models, SOP codes,
// skill levels (numbers), part numbers, currency.
type Dict = Record<string, string>;

const ZH: Dict = {
  // Brand / Nav
  "DHX Team Ops": "DHX Team Ops",
  "Home": "首页",
  "Jobs": "工单",
  "Team": "团队",
  "Skills": "技能",
  "Learn": "学习",
  "Salary": "薪资",
  "Adv": "预支",
  "Me": "我",

  // Common
  "View all": "查看全部",
  "Save": "保存",
  "Cancel": "取消",
  "Submit": "提交",
  "Approve": "批准",
  "Reject": "拒绝",
  "Sign out": "退出登录",
  "Show Translation": "显示译文",
  "Show Original": "显示原文",
  "Back": "返回",
  "Required": "要求",
  "Current": "当前",
  "Notes": "备注",
  "Reason": "原因",
  "Pending": "待处理",
  "Approved": "已批准",
  "Rejected": "已拒绝",
  "Done": "完成",
  "Edit": "编辑",
  "OK": "达标",
  "Photos": "照片",
  "Progress": "进度",
  "Total": "合计",

  // Status
  "In Progress": "进行中",
  "Pending QC": "待质检",
  "Completed": "已完成",
  "Waiting Parts": "等待配件",
  "Received": "已接收",
  "Repair": "维修",
  "Panel": "钣金（Panel）",
  "Paint": "喷漆（Paint）",
  "QC": "品质检查（QC）",
  "Ready": "已就绪",
  "All": "全部",
  // Terminology
  "Respray": "重喷",
  "Job Card": "工单",
  "Fleet": "车队",
  "Rental": "租赁",
  "Ops": "营运",
  "Technician": "技师",
  "Painter": "喷漆师傅",
  "Helper": "助理",
  "Body Repair Technician": "钣金技师",

  // Dashboard
  "Dashboard": "工作台",
  "Hi": "你好",
  "Today's jobs": "今日工单",
  "Recent activity": "最近动态",
  "Active Workers": "在岗员工",
  "Today's Jobs": "今日工单",
  "Outstanding Salary": "未付薪资",
  "Employee Advances": "员工预支",
  "PNG 2210 marked Completed": "PNG 2210 已完成",
  "Rizal requested RM250 advance": "Rizal 申请预支 RM250",
  "Suresh's salary paid for May": "Suresh 五月薪资已支付",
  "JKL 4421 waiting for parts": "JKL 4421 等待配件",
  "1h ago": "1 小时前",
  "3h ago": "3 小时前",
  "Yesterday": "昨天",
  "2d ago": "2 天前",

  // Jobs list
  "{n} jobs shown": "共 {n} 张工单",
  "Started": "开始",
  "Due": "预计",
  "Assigned staff": "分配员工",

  // Team
  "Today's overview": "今日概览",
  "Today Attendance": "今日出勤",
  "Current Jobs": "进行中工单",
  "Worker Load": "员工工作量",
  "Team Score": "团队评分",
  "Training Progress": "培训进度",
  "Present": "出勤",
  "Late": "迟到",
  "Off": "休假",
  "{n} staff": "{n} 名员工",
  "Average completion across all team members.": "全体成员平均完成率。",
  "Workers": "员工",
  "Vehicle": "车辆",
  "Score": "评分",
  "Training": "培训",

  // Skills
  "Capability, assessments & training": "能力、评估与培训",
  "Viewing as": "查看身份",
  "Owner": "老板",
  "Manager": "经理",
  "Worker": "员工",
  "Total Gaps": "总差距",
  "Avg Skill": "平均技能",
  "Tap +/- for quick adjust": "点击 +/- 快速调整",
  "Quick adjust available (Owner)": "可快速调整（老板）",
  "Request Skill Assessment": "申请技能评估",
  "Request Assessment": "申请评估",
  "Category": "类别",
  "Current {a} → Requested": "当前 {a} → 申请",
  "Level {n}": "等级 {n}",
  "Reason / evidence (e.g. completed 10 jobs solo)": "原因 / 证据（如：独立完成 10 个工单）",
  "Assessment Requests": "评估申请",
  "Flow: Worker → Manager → Owner": "流程：员工 → 经理 → 老板",
  "No requests": "无申请",
  "Approve → Owner": "批准 → 老板",
  "Final Approve": "最终批准",
  "Comment (optional)": "备注（选填）",
  "Team Skills": "团队技能",
  "Last assessed: {d}": "上次评估：{d}",
  "Last assessed: —": "上次评估：—",
  "Gap": "差距",
  "Can Teach": "可带教",
  "Learning": "学习中",
  "Req": "需",
  "Cur": "当前",
  "Recommended · gap in {c}": "推荐 · {c} 存在差距",
  "Assessment History": "评估记录",
  "Permissions": "权限",
  "Manager Review": "经理审核",
  "Owner Approval": "老板批准",
  "Full edit · quick adjust · final approval": "完全编辑 · 快速调整 · 最终批准",
  "Review requests · comment · forward to Owner": "审核申请 · 评论 · 转交老板",
  "View · request assessment": "查看 · 申请评估",

  // Learning
  "Train, learn, level up": "训练、学习、升级",
  "My Learning Progress": "我的学习进度",
  "{a} of {b} marked learned": "已学 {a}/{b}",
  "Videos": "视频",
  "Repair Notes": "维修笔记",
  "SOP": "标准作业程序（SOP）",
  "Paste YouTube or Facebook link": "粘贴 YouTube 或 Facebook 链接",
  "YouTube": "YouTube",
  "Facebook": "Facebook",
  "Add repair note or photo": "添加维修笔记或照片",
  "Photo": "照片",
  "Note": "笔记",
  "Doc": "文档",
  "Mark Viewed": "标记已看",
  "Mark Learned": "标记已学",
  "Viewed": "已看",
  "Learned": "已学",
  "by {a}": "作者：{a}",
  "Body": "钣金",
  "Reference": "参考",
  "Intake": "入厂",
  "Safety": "安全",
  "Delivery": "交付",
  "Dent Pulling Basics — Front Fender": "钣金拉拔基础 — 前翼子板",
  "Spray Gun Setup & Pressure Tuning": "喷枪设置与气压调节",
  "Live: Bumper Respray Walkthrough": "直播：保险杠重喷演示",
  "Civic 2019 — Bumper Clip Locations": "Civic 2019 — 保险杠卡扣位置",
  "Mixing Ratios — 2K Clear Coat": "混合比例 — 2K 清漆",
  "Common BMW 3-series Realignment Tips": "BMW 3 系常见调校技巧",
  "SOP-01 Vehicle Intake Checklist": "SOP-01 车辆入厂检查清单",
  "SOP-02 Panel Beating Safety": "SOP-02 钣金安全",
  "SOP-03 Paint Booth Operation": "SOP-03 喷漆房操作",
  "SOP-04 QC Final Inspection": "SOP-04 质检终检",
  "SOP-05 Customer Handover": "SOP-05 客户交付",

  // Salary
  "June 2026": "2026 年 6 月",
  "Payroll month": "薪资月份",
  "Total payroll": "薪资总额",
  "Paid": "已支付",
  "Outstanding": "未支付",
  "Basic": "底薪",
  "OT": "加班",
  "Bonus": "奖金",
  "Deduction": "扣款",
  "Net salary": "实发薪资",

  // Advance
  "Employee credit ledger": "员工预支台账",
  "Borrow": "借支",
  "Repayment": "还款",
  "Balance": "余额",
  "Borrowed": "已借",
  "Repaid": "已还",
  "No entries.": "无记录。",
  "Repaid {a} of {b}": "已还 {a} / {b}",

  // Profile
  "Profile": "个人资料",
  "Account": "账户",
  "This month": "本月",
  "OT hrs": "加班小时",
  "Advance": "预支",
  "Phone": "电话",
  "Documents": "文件",
  "Settings": "设置",
  "Preferred Language": "首选语言",
  "{n} files": "{n} 个文件",

  // Job detail
  "Vehicle Info": "车辆信息",
  "Plate Number": "车牌",
  "Model": "型号",
  "Customer (optional)": "客户（选填）",
  "Repair Workflow": "维修流程",
  "Team Assignment": "团队分配",
  "Manager Notes": "经理备注",
  "Before Photos": "维修前照片",
  "During Photos": "维修中照片",
  "After Photos": "完工后照片",
  "Pending — job not complete": "待处理 — 工单未完成",
  "No photos yet": "暂无照片",
  "{n} photos": "{n} 张照片",
  "{n} photo": "{n} 张照片",
  "Workshop Checklist": "车间检查清单",
  "Parts": "配件",
  "Labour Tracking": "工时跟踪",
  "Estimated Hours": "预计工时",
  "Actual Hours": "实际工时",
  "Over budget": "超支",
  "{n}h remaining": "剩余 {n} 小时",
  "Completion": "完成",
  "Estimated": "预计",
  "Actual": "实际",
  "Learning Integration": "学习联动",
  "Focus area for this job: ": "本工单重点：",
  "Related Videos": "相关视频",
  "Related SOP": "相关 SOP",
  "Skills Integration": "技能联动",
  "On par": "达标",
  "Gap {n}": "差距 {n}",
  "Suggested: ": "建议：",
  "Job Timeline": "工单时间线",
  "Created": "已创建",
  "Updated": "已更新",
  "Cost tracking": "成本跟踪",
  "Labour": "工时",
  "Paint & Materials": "喷漆与材料",
  "Estimated — not yet invoiced.": "预估 — 尚未开单。",
  "Job not found.": "未找到工单。",
  "ETA": "预计完工",
  "Customer Walk-in": "散客",
  "Walk-in": "散客",
  "Fleet": "车队",
  "Source": "来源",
  "Assigned Manager": "负责经理",
  "Job Status": "工单状态",
  "Current Stage": "当前阶段",
  "Rollback": "回退",
  "Delivered": "已交付",
  "Current task": "当前任务",
  "Add helper": "添加助理",
  "Reassign": "重新分配",
  "QC walk-through": "质检走查",
  "Paint blending": "喷漆调色",
  "Panel alignment": "钣金校正",
  "Support / prep": "辅助 / 准备",
  "Upload": "上传",
  "Before": "维修前",
  "During": "维修中",
  "After": "完工后",
  "Internal notes": "内部备注",
  "Customer notes": "客户备注",
  "Risk alerts": "风险提示",
  "Intake complete": "入厂完成",
  "Damage recorded": "损坏已记录",
  "Parts ordered": "配件已订购",
  "Repair complete": "维修完成",
  "Paint complete": "喷漆完成",
  "QC passed": "质检通过",
  "Customer notified": "已通知客户",
  "Variance": "差异",
  "Staff involved": "参与员工",
  "Parts Tracking": "配件跟踪",
  "Installed": "已安装",
  "Waiting": "等待中",
  "Returned": "已退回",
  "Front Bumper": "前保险杠",
  "Headlight Clip": "前灯卡扣",
  "Paint 2K Clear": "2K 清漆",
  "Rear Quarter Panel": "后侧围板",
  "View Training": "查看培训",
  "View SOP": "查看 SOP",
  "Request Support": "请求支援",
  "Materials": "材料",
  "Assigned": "已分配",
  "Start": "开始",
  "Pause": "暂停",
  "Complete": "完成",
  "Move Stage": "移至下阶段",
  "Override": "覆盖",
  "Approve Final": "最终批准",
  "Today": "今天",
  "Keep customer updated every 24h. Photograph each stage.": "每 24 小时与客户更新，逐阶段拍照存档。",
  "Parts ordered — follow up with supplier daily.": "配件已订购 — 每日跟进供应商。",

  // Language modal
  "Choose your language": "选择您的语言",
  "Select your preferred language to continue.": "请选择您的首选语言以继续。",
  "Continue": "继续",

  // Skills — dynamic / mock content
  "Completed 12 full respray jobs solo this quarter.": "本季度独立完成 12 单全车重喷。",
  "Led QC sign-off on 8 vehicles, zero rework.": "主导 8 台车辆质检签收，零返工。",
  "Assisted Suresh on 6 panel replacements.": "协助 Suresh 完成 6 次钣金更换。",
  "Requested without log evidence.": "申请时未附记录证据。",
  "Completed 10 paint jobs independently.": "独立完成 10 单喷漆工单。",
  "Passed internal QC audit.": "通过内部质检审核。",
  "Completed onboarding panel module.": "完成新人钣金模块培训。",
  "Mentor sign-off on advanced colour matching.": "导师签核高级调色能力。",

  "Panel Repair & Alignment Workshop": "钣金修复与校正工作坊",
  "Spray Technique & Colour Mixing": "喷涂技巧与调色训练",
  "Quality Control Inspection Cert": "质检员认证课程",
  "Standard Operating Procedures Refresher": "标准作业程序复训",
  "Onboarding & Mentorship Programme": "新人入职与带教计划",

  "Panel Alignment 101": "钣金校正入门 101",
  "Dent Pulling Basics": "钣金拉拔基础",
  "Spray Gun Setup": "喷枪设置教学",
  "Colour Mixing Masterclass": "调色大师课",
  "QC Checklist Walkthrough": "质检清单演示",
  "Workshop SOP Overview": "车间 SOP 概览",
  "Mentorship Best Practices": "带教最佳实践",

  "SOP-PNL-02 Panel Replacement": "SOP-PNL-02 钣金更换",
  "SOP-PNT-01 Booth Prep": "SOP-PNT-01 喷漆房准备",
  "SOP-PNT-04 Blending": "SOP-PNT-04 颜色过渡",
  "SOP-QC-01 Final Inspection": "SOP-QC-01 终检",
  "SOP-GEN-00 Workshop Standards": "SOP-GEN-00 车间标准",
  "SOP-TRN-01 Onboarding": "SOP-TRN-01 新人入职",

  "Shadow Suresh on next panel job": "下一单钣金工单跟随 Suresh 学习",
  "Assist on Myvi rear quarter": "协助处理 Myvi 后侧围",
  "Solo respray on Vios bumper": "独立完成 Vios 保险杠重喷",
  "Shadow Hafiz on BMW bonnet": "跟随 Hafiz 学习 BMW 引擎盖喷漆",
  "Run QC on next 3 completed jobs": "对下 3 单完成工单执行质检",
  "Document next job using SOP template": "用 SOP 模板记录下一单工单",
  "Mentor helper on 1 job this week": "本周指导助理完成 1 单工单",
};

const MS: Dict = {
  "DHX Team Ops": "DHX Team Ops",
  "Home": "Utama",
  "Jobs": "Kerja",
  "Team": "Pasukan",
  "Skills": "Kemahiran",
  "Learn": "Belajar",
  "Salary": "Gaji",
  "Adv": "Pendahuluan",
  "Me": "Saya",

  "View all": "Lihat semua",
  "Save": "Simpan",
  "Cancel": "Batal",
  "Submit": "Hantar",
  "Approve": "Lulus",
  "Reject": "Tolak",
  "Sign out": "Log keluar",
  "Show Translation": "Tunjuk Terjemahan",
  "Show Original": "Tunjuk Asal",
  "Back": "Kembali",
  "Required": "Diperlukan",
  "Current": "Semasa",
  "Notes": "Nota",
  "Reason": "Sebab",
  "Pending": "Menunggu",
  "Approved": "Diluluskan",
  "Rejected": "Ditolak",
  "Done": "Siap",
  "Edit": "Edit",
  "OK": "OK",
  "Photos": "Gambar",
  "Progress": "Kemajuan",
  "Total": "Jumlah",

  "In Progress": "Sedang Dibuat",
  "Pending QC": "Menunggu QC",
  "Completed": "Selesai",
  "Waiting Parts": "Menunggu Alat Ganti",
  "Received": "Diterima",
  "Repair": "Baik Pulih",
  "Panel": "Panel",
  "Paint": "Cat",
  "QC": "QC",
  "Ready": "Sedia",
  "All": "Semua",
  "Respray": "Cat Semula",
  "Job Card": "Kad Kerja",
  "Fleet": "Armada",
  "Rental": "Sewa",
  "Ops": "Operasi",
  "Technician": "Juruteknik",
  "Painter": "Tukang Cat",
  "Helper": "Pembantu",
  "Body Repair Technician": "Juruteknik Baik Pulih Badan",

  "Dashboard": "Papan Pemuka",
  "Hi": "Hai",
  "Today's jobs": "Kerja hari ini",
  "Recent activity": "Aktiviti terkini",
  "Active Workers": "Pekerja Aktif",
  "Today's Jobs": "Kerja Hari Ini",
  "Outstanding Salary": "Gaji Tertunggak",
  "Employee Advances": "Pendahuluan Pekerja",
  "PNG 2210 marked Completed": "PNG 2210 ditanda Selesai",
  "Rizal requested RM250 advance": "Rizal memohon pendahuluan RM250",
  "Suresh's salary paid for May": "Gaji Suresh untuk Mei dibayar",
  "JKL 4421 waiting for parts": "JKL 4421 menunggu alat ganti",
  "1h ago": "1j lalu",
  "3h ago": "3j lalu",
  "Yesterday": "Semalam",
  "2d ago": "2h lalu",

  "{n} jobs shown": "{n} kerja dipaparkan",
  "Started": "Mula",
  "Due": "Tarikh",
  "Assigned staff": "Pekerja ditugaskan",

  "Today's overview": "Tinjauan hari ini",
  "Today Attendance": "Kehadiran Hari Ini",
  "Current Jobs": "Kerja Semasa",
  "Worker Load": "Beban Pekerja",
  "Team Score": "Skor Pasukan",
  "Training Progress": "Kemajuan Latihan",
  "Present": "Hadir",
  "Late": "Lewat",
  "Off": "Cuti",
  "{n} staff": "{n} pekerja",
  "Average completion across all team members.": "Purata penyiapan seluruh ahli pasukan.",
  "Workers": "Pekerja",
  "Vehicle": "Kenderaan",
  "Score": "Skor",
  "Training": "Latihan",

  "Capability, assessments & training": "Kebolehan, penilaian & latihan",
  "Viewing as": "Lihat sebagai",
  "Owner": "Pemilik",
  "Manager": "Pengurus",
  "Worker": "Pekerja",
  "Total Gaps": "Jumlah Jurang",
  "Avg Skill": "Purata Kemahiran",
  "Tap +/- for quick adjust": "Tekan +/- untuk laras pantas",
  "Quick adjust available (Owner)": "Laras pantas tersedia (Pemilik)",
  "Request Skill Assessment": "Mohon Penilaian Kemahiran",
  "Request Assessment": "Mohon Penilaian",
  "Category": "Kategori",
  "Current {a} → Requested": "Semasa {a} → Dipohon",
  "Level {n}": "Tahap {n}",
  "Reason / evidence (e.g. completed 10 jobs solo)": "Sebab / bukti (cth: selesaikan 10 kerja sendiri)",
  "Assessment Requests": "Permohonan Penilaian",
  "Flow: Worker → Manager → Owner": "Aliran: Pekerja → Pengurus → Pemilik",
  "No requests": "Tiada permohonan",
  "Approve → Owner": "Lulus → Pemilik",
  "Final Approve": "Lulus Akhir",
  "Comment (optional)": "Komen (pilihan)",
  "Team Skills": "Kemahiran Pasukan",
  "Last assessed: {d}": "Penilaian terakhir: {d}",
  "Last assessed: —": "Penilaian terakhir: —",
  "Gap": "Jurang",
  "Can Teach": "Boleh Ajar",
  "Learning": "Belajar",
  "Req": "Perlu",
  "Cur": "Semasa",
  "Recommended · gap in {c}": "Disyorkan · jurang dalam {c}",
  "Assessment History": "Sejarah Penilaian",
  "Permissions": "Kebenaran",
  "Manager Review": "Semakan Pengurus",
  "Owner Approval": "Kelulusan Pemilik",
  "Full edit · quick adjust · final approval": "Edit penuh · laras pantas · kelulusan akhir",
  "Review requests · comment · forward to Owner": "Semak permohonan · komen · majukan ke Pemilik",
  "View · request assessment": "Lihat · mohon penilaian",

  "Train, learn, level up": "Latih, belajar, tingkat",
  "My Learning Progress": "Kemajuan Pembelajaran Saya",
  "{a} of {b} marked learned": "{a} daripada {b} ditanda dipelajari",
  "Videos": "Video",
  "Repair Notes": "Nota Baik Pulih",
  "SOP": "SOP",
  "Paste YouTube or Facebook link": "Tampal pautan YouTube atau Facebook",
  "YouTube": "YouTube",
  "Facebook": "Facebook",
  "Add repair note or photo": "Tambah nota baik pulih atau gambar",
  "Photo": "Gambar",
  "Note": "Nota",
  "Doc": "Dok",
  "Mark Viewed": "Tanda Dilihat",
  "Mark Learned": "Tanda Dipelajari",
  "Viewed": "Dilihat",
  "Learned": "Dipelajari",
  "by {a}": "oleh {a}",
  "Body": "Badan",
  "Reference": "Rujukan",
  "Intake": "Penerimaan",
  "Safety": "Keselamatan",
  "Delivery": "Penghantaran",
  "Dent Pulling Basics — Front Fender": "Asas Tarik Lekuk — Fender Depan",
  "Spray Gun Setup & Pressure Tuning": "Pemasangan Spray Gun & Tekanan",
  "Live: Bumper Respray Walkthrough": "Langsung: Cat Semula Bumper",
  "Civic 2019 — Bumper Clip Locations": "Civic 2019 — Lokasi Klip Bumper",
  "Mixing Ratios — 2K Clear Coat": "Nisbah Campuran — 2K Clear Coat",
  "Common BMW 3-series Realignment Tips": "Tip Penjajaran BMW 3-series",
  "SOP-01 Vehicle Intake Checklist": "SOP-01 Senarai Semak Penerimaan",
  "SOP-02 Panel Beating Safety": "SOP-02 Keselamatan Panel Beating",
  "SOP-03 Paint Booth Operation": "SOP-03 Operasi Bilik Cat",
  "SOP-04 QC Final Inspection": "SOP-04 Pemeriksaan Akhir QC",
  "SOP-05 Customer Handover": "SOP-05 Serahan Pelanggan",

  "June 2026": "Jun 2026",
  "Payroll month": "Bulan gaji",
  "Total payroll": "Jumlah gaji",
  "Paid": "Dibayar",
  "Outstanding": "Tertunggak",
  "Basic": "Asas",
  "OT": "OT",
  "Bonus": "Bonus",
  "Deduction": "Potongan",
  "Net salary": "Gaji bersih",

  "Employee credit ledger": "Lejar kredit pekerja",
  "Borrow": "Pinjam",
  "Repayment": "Bayar Balik",
  "Balance": "Baki",
  "Borrowed": "Dipinjam",
  "Repaid": "Dibayar",
  "No entries.": "Tiada rekod.",
  "Repaid {a} of {b}": "Dibayar {a} daripada {b}",

  "Profile": "Profil",
  "Account": "Akaun",
  "This month": "Bulan ini",
  "OT hrs": "Jam OT",
  "Advance": "Pendahuluan",
  "Phone": "Telefon",
  "Documents": "Dokumen",
  "Settings": "Tetapan",
  "Preferred Language": "Bahasa Pilihan",
  "{n} files": "{n} fail",

  "Vehicle Info": "Maklumat Kenderaan",
  "Plate Number": "No. Plat",
  "Model": "Model",
  "Customer (optional)": "Pelanggan (pilihan)",
  "Repair Workflow": "Aliran Baik Pulih",
  "Team Assignment": "Tugasan Pasukan",
  "Manager Notes": "Nota Pengurus",
  "Before Photos": "Gambar Sebelum",
  "During Photos": "Gambar Semasa",
  "After Photos": "Gambar Selepas",
  "Pending — job not complete": "Menunggu — kerja belum siap",
  "No photos yet": "Tiada gambar lagi",
  "{n} photos": "{n} gambar",
  "{n} photo": "{n} gambar",
  "Workshop Checklist": "Senarai Semak Bengkel",
  "Parts": "Alat Ganti",
  "Labour Tracking": "Jejak Buruh",
  "Estimated Hours": "Anggaran Jam",
  "Actual Hours": "Jam Sebenar",
  "Over budget": "Lebih bajet",
  "{n}h remaining": "{n}j berbaki",
  "Completion": "Penyiapan",
  "Estimated": "Anggaran",
  "Actual": "Sebenar",
  "Learning Integration": "Integrasi Pembelajaran",
  "Focus area for this job: ": "Fokus untuk kerja ini: ",
  "Related Videos": "Video Berkaitan",
  "Related SOP": "SOP Berkaitan",
  "Skills Integration": "Integrasi Kemahiran",
  "On par": "Setara",
  "Gap {n}": "Jurang {n}",
  "Suggested: ": "Disyorkan: ",
  "Job Timeline": "Garis Masa Kerja",
  "Created": "Dicipta",
  "Updated": "Dikemaskini",
  "Cost tracking": "Jejak Kos",
  "Labour": "Buruh",
  "Paint & Materials": "Cat & Bahan",
  "Estimated — not yet invoiced.": "Anggaran — belum diinvois.",
  "Job not found.": "Kerja tidak dijumpai.",
  "ETA": "Anggaran Siap",
  "Walk-in": "Walk-in",

  "Choose your language": "Pilih bahasa anda",
  "Select your preferred language to continue.": "Pilih bahasa pilihan untuk teruskan.",
  "Continue": "Teruskan",

  "Completed 12 full respray jobs solo this quarter.": "Selesaikan 12 kerja cat semula penuh sendiri suku ini.",
  "Led QC sign-off on 8 vehicles, zero rework.": "Mengetuai pengesahan QC untuk 8 kenderaan, tiada kerja semula.",
  "Assisted Suresh on 6 panel replacements.": "Membantu Suresh dalam 6 penggantian panel.",
  "Requested without log evidence.": "Permohonan tanpa bukti rekod.",
  "Completed 10 paint jobs independently.": "Selesaikan 10 kerja cat secara sendiri.",
  "Passed internal QC audit.": "Lulus audit QC dalaman.",
  "Completed onboarding panel module.": "Selesaikan modul panel untuk pekerja baharu.",
  "Mentor sign-off on advanced colour matching.": "Pengesahan mentor untuk padanan warna lanjutan.",

  "Panel Repair & Alignment Workshop": "Bengkel Baik Pulih & Penjajaran Panel",
  "Spray Technique & Colour Mixing": "Teknik Sembur & Campuran Warna",
  "Quality Control Inspection Cert": "Sijil Pemeriksaan Kawalan Kualiti",
  "Standard Operating Procedures Refresher": "Ulang Kaji SOP",
  "Onboarding & Mentorship Programme": "Program Penerimaan & Mentor",

  "Panel Alignment 101": "Asas Penjajaran Panel 101",
  "Dent Pulling Basics": "Asas Tarik Lekuk",
  "Spray Gun Setup": "Pemasangan Spray Gun",
  "Colour Mixing Masterclass": "Kelas Mahir Campuran Warna",
  "QC Checklist Walkthrough": "Panduan Senarai Semak QC",
  "Workshop SOP Overview": "Tinjauan SOP Bengkel",
  "Mentorship Best Practices": "Amalan Terbaik Mentor",

  "SOP-PNL-02 Panel Replacement": "SOP-PNL-02 Penggantian Panel",
  "SOP-PNT-01 Booth Prep": "SOP-PNT-01 Penyediaan Bilik Cat",
  "SOP-PNT-04 Blending": "SOP-PNT-04 Padanan Warna",
  "SOP-QC-01 Final Inspection": "SOP-QC-01 Pemeriksaan Akhir",
  "SOP-GEN-00 Workshop Standards": "SOP-GEN-00 Standard Bengkel",
  "SOP-TRN-01 Onboarding": "SOP-TRN-01 Penerimaan",

  "Shadow Suresh on next panel job": "Ikut Suresh pada kerja panel seterusnya",
  "Assist on Myvi rear quarter": "Bantu pada suku belakang Myvi",
  "Solo respray on Vios bumper": "Cat semula bumper Vios secara sendiri",
  "Shadow Hafiz on BMW bonnet": "Ikut Hafiz pada bonet BMW",
  "Run QC on next 3 completed jobs": "Jalankan QC pada 3 kerja siap berikutnya",
  "Document next job using SOP template": "Dokumenkan kerja seterusnya guna templat SOP",
  "Mentor helper on 1 job this week": "Bimbing pembantu pada 1 kerja minggu ini",
};

const ID: Dict = {
  "DHX Team Ops": "DHX Team Ops",
  "Home": "Beranda",
  "Jobs": "Pekerjaan",
  "Team": "Tim",
  "Skills": "Keahlian",
  "Learn": "Belajar",
  "Salary": "Gaji",
  "Adv": "Kasbon",
  "Me": "Saya",

  "View all": "Lihat semua",
  "Save": "Simpan",
  "Cancel": "Batal",
  "Submit": "Kirim",
  "Approve": "Setujui",
  "Reject": "Tolak",
  "Sign out": "Keluar",
  "Show Translation": "Tampilkan Terjemahan",
  "Show Original": "Tampilkan Asli",
  "Back": "Kembali",
  "Required": "Diperlukan",
  "Current": "Saat ini",
  "Notes": "Catatan",
  "Reason": "Alasan",
  "Pending": "Menunggu",
  "Approved": "Disetujui",
  "Rejected": "Ditolak",
  "Done": "Selesai",
  "Edit": "Ubah",
  "OK": "OK",
  "Photos": "Foto",
  "Progress": "Progres",
  "Total": "Total",

  "In Progress": "Berlangsung",
  "Pending QC": "Menunggu QC",
  "Completed": "Selesai",
  "Waiting Parts": "Menunggu Suku Cadang",
  "Received": "Diterima",
  "Repair": "Perbaikan",
  "Panel": "Panel",
  "Paint": "Cat",
  "QC": "QC",
  "Ready": "Siap",
  "All": "Semua",
  "Respray": "Cat Ulang",
  "Job Card": "Kartu Kerja",
  "Fleet": "Armada",
  "Rental": "Sewa",
  "Ops": "Operasional",
  "Technician": "Teknisi",
  "Painter": "Tukang Cat",
  "Helper": "Asisten",
  "Body Repair Technician": "Teknisi Perbaikan Bodi",

  "Dashboard": "Dasbor",
  "Hi": "Hai",
  "Today's jobs": "Pekerjaan hari ini",
  "Recent activity": "Aktivitas terbaru",
  "Active Workers": "Pekerja Aktif",
  "Today's Jobs": "Pekerjaan Hari Ini",
  "Outstanding Salary": "Gaji Tertunggak",
  "Employee Advances": "Kasbon Karyawan",
  "PNG 2210 marked Completed": "PNG 2210 ditandai Selesai",
  "Rizal requested RM250 advance": "Rizal meminta kasbon RM250",
  "Suresh's salary paid for May": "Gaji Suresh bulan Mei dibayar",
  "JKL 4421 waiting for parts": "JKL 4421 menunggu suku cadang",
  "1h ago": "1j lalu",
  "3h ago": "3j lalu",
  "Yesterday": "Kemarin",
  "2d ago": "2h lalu",

  "{n} jobs shown": "{n} pekerjaan ditampilkan",
  "Started": "Mulai",
  "Due": "Tenggat",
  "Assigned staff": "Staf yang ditugaskan",

  "Today's overview": "Ringkasan hari ini",
  "Today Attendance": "Kehadiran Hari Ini",
  "Current Jobs": "Pekerjaan Berjalan",
  "Worker Load": "Beban Pekerja",
  "Team Score": "Skor Tim",
  "Training Progress": "Progres Pelatihan",
  "Present": "Hadir",
  "Late": "Terlambat",
  "Off": "Libur",
  "{n} staff": "{n} staf",
  "Average completion across all team members.": "Rata-rata penyelesaian seluruh anggota tim.",
  "Workers": "Pekerja",
  "Vehicle": "Kendaraan",
  "Score": "Skor",
  "Training": "Pelatihan",

  "Capability, assessments & training": "Kemampuan, penilaian & pelatihan",
  "Viewing as": "Lihat sebagai",
  "Owner": "Pemilik",
  "Manager": "Manajer",
  "Worker": "Pekerja",
  "Total Gaps": "Total Gap",
  "Avg Skill": "Rata-rata Keahlian",
  "Tap +/- for quick adjust": "Tekan +/- untuk atur cepat",
  "Quick adjust available (Owner)": "Atur cepat tersedia (Pemilik)",
  "Request Skill Assessment": "Ajukan Penilaian Keahlian",
  "Request Assessment": "Ajukan Penilaian",
  "Category": "Kategori",
  "Current {a} → Requested": "Saat ini {a} → Diajukan",
  "Level {n}": "Level {n}",
  "Reason / evidence (e.g. completed 10 jobs solo)": "Alasan / bukti (mis. selesaikan 10 pekerjaan sendiri)",
  "Assessment Requests": "Pengajuan Penilaian",
  "Flow: Worker → Manager → Owner": "Alur: Pekerja → Manajer → Pemilik",
  "No requests": "Tidak ada pengajuan",
  "Approve → Owner": "Setujui → Pemilik",
  "Final Approve": "Setuju Akhir",
  "Comment (optional)": "Komentar (opsional)",
  "Team Skills": "Keahlian Tim",
  "Last assessed: {d}": "Penilaian terakhir: {d}",
  "Last assessed: —": "Penilaian terakhir: —",
  "Gap": "Gap",
  "Can Teach": "Bisa Mengajar",
  "Learning": "Belajar",
  "Req": "Perlu",
  "Cur": "Kini",
  "Recommended · gap in {c}": "Disarankan · gap di {c}",
  "Assessment History": "Riwayat Penilaian",
  "Permissions": "Hak Akses",
  "Manager Review": "Tinjauan Manajer",
  "Owner Approval": "Persetujuan Pemilik",
  "Full edit · quick adjust · final approval": "Ubah penuh · atur cepat · persetujuan akhir",
  "Review requests · comment · forward to Owner": "Tinjau pengajuan · komentar · teruskan ke Pemilik",
  "View · request assessment": "Lihat · ajukan penilaian",

  "Train, learn, level up": "Latih, belajar, naik level",
  "My Learning Progress": "Progres Belajar Saya",
  "{a} of {b} marked learned": "{a} dari {b} ditandai dipelajari",
  "Videos": "Video",
  "Repair Notes": "Catatan Perbaikan",
  "SOP": "SOP",
  "Paste YouTube or Facebook link": "Tempel tautan YouTube atau Facebook",
  "YouTube": "YouTube",
  "Facebook": "Facebook",
  "Add repair note or photo": "Tambah catatan perbaikan atau foto",
  "Photo": "Foto",
  "Note": "Catatan",
  "Doc": "Dok",
  "Mark Viewed": "Tandai Dilihat",
  "Mark Learned": "Tandai Dipelajari",
  "Viewed": "Dilihat",
  "Learned": "Dipelajari",
  "by {a}": "oleh {a}",
  "Body": "Bodi",
  "Reference": "Referensi",
  "Intake": "Penerimaan",
  "Safety": "Keselamatan",
  "Delivery": "Pengiriman",
  "Dent Pulling Basics — Front Fender": "Dasar Tarik Penyok — Fender Depan",
  "Spray Gun Setup & Pressure Tuning": "Setting Spray Gun & Tekanan",
  "Live: Bumper Respray Walkthrough": "Live: Pengecatan Ulang Bumper",
  "Civic 2019 — Bumper Clip Locations": "Civic 2019 — Lokasi Klip Bumper",
  "Mixing Ratios — 2K Clear Coat": "Rasio Campuran — 2K Clear Coat",
  "Common BMW 3-series Realignment Tips": "Tips Penyetelan BMW 3-series",
  "SOP-01 Vehicle Intake Checklist": "SOP-01 Daftar Penerimaan Kendaraan",
  "SOP-02 Panel Beating Safety": "SOP-02 Keselamatan Panel Beating",
  "SOP-03 Paint Booth Operation": "SOP-03 Operasi Ruang Cat",
  "SOP-04 QC Final Inspection": "SOP-04 Pemeriksaan Akhir QC",
  "SOP-05 Customer Handover": "SOP-05 Serah Terima Pelanggan",

  "June 2026": "Juni 2026",
  "Payroll month": "Bulan gaji",
  "Total payroll": "Total gaji",
  "Paid": "Dibayar",
  "Outstanding": "Tertunggak",
  "Basic": "Pokok",
  "OT": "Lembur",
  "Bonus": "Bonus",
  "Deduction": "Potongan",
  "Net salary": "Gaji bersih",

  "Employee credit ledger": "Buku besar kredit karyawan",
  "Borrow": "Pinjam",
  "Repayment": "Pelunasan",
  "Balance": "Saldo",
  "Borrowed": "Dipinjam",
  "Repaid": "Dibayar",
  "No entries.": "Tidak ada catatan.",
  "Repaid {a} of {b}": "Dibayar {a} dari {b}",

  "Profile": "Profil",
  "Account": "Akun",
  "This month": "Bulan ini",
  "OT hrs": "Jam Lembur",
  "Advance": "Kasbon",
  "Phone": "Telepon",
  "Documents": "Dokumen",
  "Settings": "Pengaturan",
  "Preferred Language": "Bahasa Pilihan",
  "{n} files": "{n} berkas",

  "Vehicle Info": "Info Kendaraan",
  "Plate Number": "Nomor Plat",
  "Model": "Model",
  "Customer (optional)": "Pelanggan (opsional)",
  "Repair Workflow": "Alur Perbaikan",
  "Team Assignment": "Penugasan Tim",
  "Manager Notes": "Catatan Manajer",
  "Before Photos": "Foto Sebelum",
  "During Photos": "Foto Saat Pengerjaan",
  "After Photos": "Foto Setelah",
  "Pending — job not complete": "Menunggu — pekerjaan belum selesai",
  "No photos yet": "Belum ada foto",
  "{n} photos": "{n} foto",
  "{n} photo": "{n} foto",
  "Workshop Checklist": "Daftar Bengkel",
  "Parts": "Suku Cadang",
  "Labour Tracking": "Lacak Tenaga Kerja",
  "Estimated Hours": "Estimasi Jam",
  "Actual Hours": "Jam Aktual",
  "Over budget": "Lewat anggaran",
  "{n}h remaining": "{n}j tersisa",
  "Completion": "Penyelesaian",
  "Estimated": "Estimasi",
  "Actual": "Aktual",
  "Learning Integration": "Integrasi Pembelajaran",
  "Focus area for this job: ": "Fokus pekerjaan ini: ",
  "Related Videos": "Video Terkait",
  "Related SOP": "SOP Terkait",
  "Skills Integration": "Integrasi Keahlian",
  "On par": "Setara",
  "Gap {n}": "Gap {n}",
  "Suggested: ": "Disarankan: ",
  "Job Timeline": "Linimasa Pekerjaan",
  "Created": "Dibuat",
  "Updated": "Diperbarui",
  "Cost tracking": "Lacak Biaya",
  "Labour": "Tenaga Kerja",
  "Paint & Materials": "Cat & Material",
  "Estimated — not yet invoiced.": "Estimasi — belum ditagih.",
  "Job not found.": "Pekerjaan tidak ditemukan.",
  "ETA": "Estimasi Selesai",
  "Walk-in": "Walk-in",

  "Choose your language": "Pilih bahasa Anda",
  "Select your preferred language to continue.": "Pilih bahasa pilihan Anda untuk melanjutkan.",
  "Continue": "Lanjutkan",

  "Completed 12 full respray jobs solo this quarter.": "Menyelesaikan 12 pekerjaan cat ulang penuh sendiri kuartal ini.",
  "Led QC sign-off on 8 vehicles, zero rework.": "Memimpin persetujuan QC pada 8 kendaraan, tanpa pengerjaan ulang.",
  "Assisted Suresh on 6 panel replacements.": "Membantu Suresh pada 6 penggantian panel.",
  "Requested without log evidence.": "Pengajuan tanpa bukti catatan.",
  "Completed 10 paint jobs independently.": "Menyelesaikan 10 pekerjaan cat secara mandiri.",
  "Passed internal QC audit.": "Lulus audit QC internal.",
  "Completed onboarding panel module.": "Menyelesaikan modul panel orientasi.",
  "Mentor sign-off on advanced colour matching.": "Persetujuan mentor untuk pencocokan warna lanjutan.",

  "Panel Repair & Alignment Workshop": "Workshop Perbaikan & Penyetelan Panel",
  "Spray Technique & Colour Mixing": "Teknik Semprot & Pencampuran Warna",
  "Quality Control Inspection Cert": "Sertifikasi Pemeriksaan QC",
  "Standard Operating Procedures Refresher": "Penyegaran SOP",
  "Onboarding & Mentorship Programme": "Program Orientasi & Mentor",

  "Panel Alignment 101": "Dasar Penyetelan Panel 101",
  "Dent Pulling Basics": "Dasar Tarik Penyok",
  "Spray Gun Setup": "Setting Spray Gun",
  "Colour Mixing Masterclass": "Masterclass Pencampuran Warna",
  "QC Checklist Walkthrough": "Panduan Daftar QC",
  "Workshop SOP Overview": "Ringkasan SOP Bengkel",
  "Mentorship Best Practices": "Praktik Terbaik Mentor",

  "SOP-PNL-02 Panel Replacement": "SOP-PNL-02 Penggantian Panel",
  "SOP-PNT-01 Booth Prep": "SOP-PNT-01 Persiapan Ruang Cat",
  "SOP-PNT-04 Blending": "SOP-PNT-04 Penyatuan Warna",
  "SOP-QC-01 Final Inspection": "SOP-QC-01 Pemeriksaan Akhir",
  "SOP-GEN-00 Workshop Standards": "SOP-GEN-00 Standar Bengkel",
  "SOP-TRN-01 Onboarding": "SOP-TRN-01 Orientasi",

  "Shadow Suresh on next panel job": "Dampingi Suresh pada pekerjaan panel berikutnya",
  "Assist on Myvi rear quarter": "Bantu pada bagian belakang Myvi",
  "Solo respray on Vios bumper": "Cat ulang bumper Vios secara mandiri",
  "Shadow Hafiz on BMW bonnet": "Dampingi Hafiz pada kap BMW",
  "Run QC on next 3 completed jobs": "Jalankan QC pada 3 pekerjaan selesai berikutnya",
  "Document next job using SOP template": "Dokumentasikan pekerjaan berikutnya pakai templat SOP",
  "Mentor helper on 1 job this week": "Bimbing asisten pada 1 pekerjaan minggu ini",
};

const dicts: Record<Lang, Dict> = { en: {}, zh: ZH, ms: MS, id: ID };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: (en: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
};

const LangCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "dhx_lang";

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  let out = str;
  for (const k in vars) out = out.replace(`{${k}}`, String(vars[k]));
  return out;
}

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

  const tr = (en: string, vars?: Record<string, string | number>) => {
    if (lang === "en") return interpolate(en, vars);
    const dict = dicts[lang];
    const found = dict[en];
    return interpolate(found ?? en, vars);
  };

  return (
    <LangCtx.Provider value={{ lang, setLang, tr, ready }}>
      {children}
      {ready && needsChoice && <LanguageModal onChoose={setLang} />}
    </LangCtx.Provider>
  );
}

export function useT() {
  const ctx = useContext(LangCtx);
  const fallback: Ctx = {
    lang: "en",
    setLang: () => {},
    tr: (s: string, v?: Record<string, string | number>) => interpolate(s, v),
    ready: true,
  };
  const value = ctx ?? fallback;
  // Backwards-compat: provide `t(key)` that proxies to tr() so existing call sites still work.
  // Existing keys like "page.dashboard.title" map to their EN string here.
  const legacyKeyMap: Record<string, string> = {
    "common.brand": "DHX Team Ops",
    "common.viewAll": "View all",
    "common.signOut": "Sign out",
    "nav.home": "Home",
    "nav.jobs": "Jobs",
    "nav.team": "Team",
    "nav.skills": "Skills",
    "nav.learn": "Learn",
    "nav.salary": "Salary",
    "nav.advance": "Adv",
    "nav.profile": "Me",
    "page.dashboard.title": "Dashboard",
    "page.dashboard.greet": "Hi",
    "page.dashboard.todayJobs": "Today's jobs",
    "page.dashboard.recent": "Recent activity",
    "page.dashboard.activeWorkers": "Active Workers",
    "page.dashboard.todayJobsKpi": "Today's Jobs",
    "page.dashboard.outstandingSalary": "Outstanding Salary",
    "page.dashboard.employeeAdvances": "Employee Advances",
    "page.jobs.title": "Jobs",
    "page.jobs.subtitle": "{n} jobs shown",
    "page.team.title": "Team",
    "page.skills.title": "Skills",
    "page.learning.title": "Learn",
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
  };
  const t = (key: string, vars?: Record<string, string | number>) => {
    // Support legacy {count} alias
    const norm = vars && "count" in vars ? { ...vars, n: vars.count } : vars;
    const en = legacyKeyMap[key] ?? key;
    return value.tr(en, norm as Record<string, string | number> | undefined);
  };
  return { ...value, t };
}

function LanguageModal({ onChoose }: { onChoose: (l: Lang) => void }) {
  const [selected, setSelected] = useState<Lang | null>(null);
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">DHX Team Ops</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Choose your language</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          请选择您的首选语言 · Pilih bahasa anda · Pilih bahasa Anda
        </p>
        <ul className="mt-5 space-y-2">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                onClick={() => setSelected(l.code)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  selected === l.code ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <span className="text-2xl">{l.flag}</span>
                <span className="flex-1 text-sm font-medium">{l.native}</span>
                {selected === l.code && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
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

// Backwards-compat: status string translator.
export function tStatus(t: (k: string, v?: Record<string, string | number>) => string, status: string): string {
  return t(status);
}

// Tap-to-toggle component: shows translated version by default, tap to reveal original English.
export function Translatable({
  en,
  className,
  as: As = "span",
}: {
  en: string;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  const { tr, lang } = useT();
  const [showOriginal, setShowOriginal] = useState(false);
  const translated = tr(en);
  const isTranslated = lang !== "en" && translated !== en;
  if (!isTranslated) {
    return <As className={className}>{en}</As>;
  }
  return (
    <As
      className={`${className ?? ""} ${isTranslated ? "cursor-pointer underline decoration-dotted decoration-muted-foreground/30 underline-offset-4" : ""}`}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        setShowOriginal((v) => !v);
      }}
      title={showOriginal ? "Show Translation" : "Show Original"}
    >
      {showOriginal ? en : translated}
    </As>
  );
}
