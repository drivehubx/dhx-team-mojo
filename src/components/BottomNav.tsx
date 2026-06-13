import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Wrench, Wallet, HandCoins, User, Users, GraduationCap, Award } from "lucide-react";
import { useT } from "@/lib/i18n";

const tabs = [
  { to: "/", key: "nav.home", icon: LayoutDashboard },
  { to: "/jobs", key: "nav.jobs", icon: Wrench },
  { to: "/team", key: "nav.team", icon: Users },
  { to: "/skills", key: "nav.skills", icon: Award },
  { to: "/learning", key: "nav.learn", icon: GraduationCap },
  { to: "/salary", key: "nav.salary", icon: Wallet },
  { to: "/advance", key: "nav.advance", icon: HandCoins },
  { to: "/profile", key: "nav.profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useT();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-8">
        {tabs.map(({ to, key, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "stroke-[2.5]" : ""}`} />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
