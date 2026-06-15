import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { jobs as seedJobs, type Job } from "./mock-data";

const STORAGE_KEY = "dhx:jobs:v2";

type Ctx = {
  jobs: Job[];
  hydrated: boolean;
  getJob: (id: string) => Job | undefined;
  addJob: (data: Omit<Job, "id" | "photos" | "startedAt" | "due" | "progress" | "status"> & Partial<Job>) => Job;
  updateJob: (id: string, patch: Partial<Job> | ((j: Job) => Partial<Job>)) => void;
};

const JobsContext = createContext<Ctx | null>(null);

function todayLabel(): string {
  const d = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}`;
}

function dueLabel(daysFromNow = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}`;
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(seedJobs);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Job[];
        if (Array.isArray(parsed) && parsed.length > 0) setJobs(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch {}
  }, [jobs, hydrated]);

  const getJob = useCallback((id: string) => jobs.find((j) => j.id === id), [jobs]);

  const addJob: Ctx["addJob"] = useCallback((data) => {
    const id = `j${Date.now().toString(36)}`;
    const newJob: Job = {
      id,
      plate: data.plate ?? "",
      vehicle: data.vehicle ?? "",
      status: data.status ?? "In Progress",
      progress: data.progress ?? 5,
      assignedIds: data.assignedIds ?? [],
      photos: data.photos ?? [],
      notes: data.notes ?? "",
      startedAt: data.startedAt ?? todayLabel(),
      due: data.due ?? dueLabel(3),
      ...(data.customerName ? { customerName: data.customerName } : {}),
      ...(data.customerPhone ? { customerPhone: data.customerPhone } : {}),
    } as Job;
    setJobs((prev) => [newJob, ...prev]);
    return newJob;
  }, []);

  const updateJob: Ctx["updateJob"] = useCallback((id, patch) => {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== id) return j;
        const p = typeof patch === "function" ? patch(j) : patch;
        return { ...j, ...p };
      }),
    );
  }, []);

  const value = useMemo<Ctx>(() => ({ jobs, hydrated, getJob, addJob, updateJob }), [jobs, hydrated, getJob, addJob, updateJob]);
  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): Ctx {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used within JobsProvider");
  return ctx;
}
