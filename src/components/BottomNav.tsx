import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Wrench, Wallet, HandCoins, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Wrench },
  { to: "/salary", label: "Salary", icon: Wallet },
  { to: "/advance", label: "Advance", icon: HandCoins },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
