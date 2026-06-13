export type Role = "Owner" | "Painter" | "Body Repair Technician" | "Helper";

export type Employee = {
  id: string;
  name: string;
  role: Role;
  phone: string;
  initials: string;
  active: boolean;
};

export type JobStatus = "In Progress" | "Pending QC" | "Completed" | "Waiting Parts";

export type Job = {
  id: string;
  plate: string;
  vehicle: string;
  status: JobStatus;
  progress: number;
  assignedIds: string[];
  photos: string[];
  notes: string;
  startedAt: string;
  due: string;
};

export type Salary = {
  employeeId: string;
  basic: number;
  ot: number;
  bonus: number;
  deduction: number;
  paid: boolean;
};

export type AdvanceEntry = {
  id: string;
  employeeId: string;
  type: "borrow" | "repayment";
  amount: number;
  date: string;
  reason?: string;
};

export const employees: Employee[] = [
  { id: "e1", name: "Ron Tan", role: "Owner", phone: "+60 12 345 6789", initials: "RT", active: true },
  { id: "e2", name: "Hafiz Rahman", role: "Painter", phone: "+60 13 222 4411", initials: "HR", active: true },
  { id: "e3", name: "Aiman Yusof", role: "Painter", phone: "+60 17 882 3322", initials: "AY", active: true },
  { id: "e4", name: "Suresh Kumar", role: "Body Repair Technician", phone: "+60 11 988 7766", initials: "SK", active: true },
  { id: "e5", name: "Daniel Lim", role: "Body Repair Technician", phone: "+60 16 552 9911", initials: "DL", active: false },
  { id: "e6", name: "Rizal Anuar", role: "Helper", phone: "+60 19 663 1122", initials: "RA", active: true },
];

const carPhoto = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=600&q=70`;

export const jobs: Job[] = [
  {
    id: "j1",
    plate: "WXY 1234",
    vehicle: "Honda Civic 2019",
    status: "In Progress",
    progress: 65,
    assignedIds: ["e2", "e4"],
    photos: [
      carPhoto("1503376780353-7e6692767b70"),
      carPhoto("1542362567-b07e54358753"),
      carPhoto("1493238792000-8113da705763"),
    ],
    notes: "Front bumper respray + minor dent repair on right fender.",
    startedAt: "12 Jun",
    due: "15 Jun",
  },
  {
    id: "j2",
    plate: "VAB 8821",
    vehicle: "Toyota Vios 2021",
    status: "Pending QC",
    progress: 92,
    assignedIds: ["e3", "e6"],
    photos: [
      carPhoto("1494976388531-d1058494cdd8"),
      carPhoto("1552519507-da3b142c6e3d"),
      carPhoto("1583121274602-3e2820c69888"),
    ],
    notes: "Full polish + scratch removal on doors.",
    startedAt: "11 Jun",
    due: "13 Jun",
  },
  {
    id: "j3",
    plate: "JKL 4421",
    vehicle: "Perodua Myvi 2018",
    status: "Waiting Parts",
    progress: 30,
    assignedIds: ["e4"],
    photos: [
      carPhoto("1605559424843-9e4c228bf1c2"),
      carPhoto("1492144534655-ae79c964c9d7"),
    ],
    notes: "Rear quarter panel replacement, waiting OEM part.",
    startedAt: "10 Jun",
    due: "18 Jun",
  },
  {
    id: "j4",
    plate: "BMW 9090",
    vehicle: "BMW 320i 2020",
    status: "In Progress",
    progress: 45,
    assignedIds: ["e2", "e3", "e6"],
    photos: [
      carPhoto("1555215695-3004980ad54e"),
      carPhoto("1503376780353-7e6692767b70"),
    ],
    notes: "Accident repair — front-left, bonnet realignment.",
    startedAt: "09 Jun",
    due: "20 Jun",
  },
  {
    id: "j5",
    plate: "PNG 2210",
    vehicle: "Proton X70 2022",
    status: "Completed",
    progress: 100,
    assignedIds: ["e4", "e6"],
    photos: [carPhoto("1542362567-b07e54358753")],
    notes: "Delivered. Side mirror replacement + paint touch up.",
    startedAt: "05 Jun",
    due: "08 Jun",
  },
  {
    id: "j6",
    plate: "MEX 7788",
    vehicle: "Mazda CX-5 2020",
    status: "In Progress",
    progress: 20,
    assignedIds: ["e3"],
    photos: [carPhoto("1494976388531-d1058494cdd8")],
    notes: "Door dent removal, repaint left side.",
    startedAt: "13 Jun",
    due: "17 Jun",
  },
];

export const salaries: Salary[] = [
  { employeeId: "e2", basic: 2800, ot: 420, bonus: 150, deduction: 50, paid: false },
  { employeeId: "e3", basic: 2800, ot: 280, bonus: 100, deduction: 0, paid: false },
  { employeeId: "e4", basic: 3200, ot: 550, bonus: 200, deduction: 80, paid: true },
  { employeeId: "e5", basic: 3200, ot: 0, bonus: 0, deduction: 0, paid: false },
  { employeeId: "e6", basic: 1800, ot: 220, bonus: 50, deduction: 0, paid: false },
];

export const advances: AdvanceEntry[] = [
  { id: "a1", employeeId: "e2", type: "borrow", amount: 500, date: "01 Jun", reason: "Family expenses" },
  { id: "a2", employeeId: "e2", type: "repayment", amount: 150, date: "10 Jun" },
  { id: "a3", employeeId: "e3", type: "borrow", amount: 300, date: "03 Jun", reason: "Medical" },
  { id: "a4", employeeId: "e4", type: "borrow", amount: 800, date: "28 May", reason: "Motorbike repair" },
  { id: "a5", employeeId: "e4", type: "repayment", amount: 200, date: "08 Jun" },
  { id: "a6", employeeId: "e4", type: "repayment", amount: 200, date: "12 Jun" },
  { id: "a7", employeeId: "e6", type: "borrow", amount: 250, date: "05 Jun", reason: "Rent top-up" },
];

export const currentUser = employees[0]; // Owner

export const fmtMYR = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const getEmployee = (id: string) => employees.find((e) => e.id === id)!;

export const netSalary = (s: Salary) => s.basic + s.ot + s.bonus - s.deduction;

export const advanceBalance = (employeeId: string) => {
  const items = advances.filter((a) => a.employeeId === employeeId);
  const borrow = items.filter((a) => a.type === "borrow").reduce((s, a) => s + a.amount, 0);
  const repay = items.filter((a) => a.type === "repayment").reduce((s, a) => s + a.amount, 0);
  return { borrow, repay, balance: borrow - repay };
};

export const totals = {
  activeWorkers: employees.filter((e) => e.active && e.role !== "Owner").length,
  todayJobs: jobs.filter((j) => j.status !== "Completed").length,
  outstandingSalary: salaries.filter((s) => !s.paid).reduce((sum, s) => sum + netSalary(s), 0),
  totalAdvances: employees.reduce((sum, e) => sum + advanceBalance(e.id).balance, 0),
};
