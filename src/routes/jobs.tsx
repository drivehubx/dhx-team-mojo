import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AvatarStack } from "@/components/Avatar";
import { jobs, getEmployee, type JobStatus, type Job } from "@/lib/mock-data";
import { StatusBadge } from "./index";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar, MapPin, FileText } from "lucide-react";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs — DHX Team Ops" },
      { name: "description", content: "Track workshop job progress, staff, and vehicle status." },
    ],
  }),
  component: JobsPage,
});

const filters: (JobStatus | "All")[] = ["All", "In Progress", "Pending QC", "Waiting Parts", "Completed"];

function JobsPage() {
  const [filter, setFilter] = useState<(JobStatus | "All")>("All");
  const [openJob, setOpenJob] = useState<Job | null>(null);

  const list = filter === "All" ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div>
      <AppHeader title="Jobs" subtitle={`${list.length} job${list.length !== 1 ? "s" : ""} shown`} />

      <div className="px-5 -mt-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-3 px-5">
        {list.map((job) => (
          <li key={job.id}>
            <button onClick={() => setOpenJob(job)} className="block w-full text-left rounded-2xl border border-border bg-card p-4 active:bg-secondary">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{job.plate}</p>
                  <p className="mt-0.5 text-base font-semibold truncate">{job.vehicle}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>

              <div className="mt-3 flex gap-1.5">
                {job.photos.slice(0, 3).map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover bg-secondary"
                    loading="lazy"
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <AvatarStack initialsList={job.assignedIds.map((id) => getEmployee(id).initials)} size={26} />
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${job.progress}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground w-9 text-right">{job.progress}%</span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={!!openJob} onOpenChange={(o) => !o && setOpenJob(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] overflow-y-auto">
          {openJob && (
            <>
              <SheetHeader>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">{openJob.plate}</p>
                <SheetTitle className="text-left">{openJob.vehicle}</SheetTitle>
              </SheetHeader>

              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={openJob.status} />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Started {openJob.startedAt} · Due {openJob.due}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Progress</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${openJob.progress}%` }} />
                  </div>
                  <span className="text-xs font-semibold">{openJob.progress}%</span>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Photos</p>
                <div className="grid grid-cols-3 gap-2">
                  {openJob.photos.map((src, i) => (
                    <img key={i} src={src} alt="" className="aspect-square w-full rounded-xl object-cover bg-secondary" loading="lazy" />
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Assigned staff</p>
                <ul className="space-y-2">
                  {openJob.assignedIds.map((id) => {
                    const e = getEmployee(id);
                    return (
                      <li key={id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                          {e.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{e.name}</p>
                          <p className="text-[11px] text-muted-foreground">{e.role}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-5 mb-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Notes
                </p>
                <p className="text-sm text-foreground rounded-xl bg-secondary p-3 leading-relaxed">{openJob.notes}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
