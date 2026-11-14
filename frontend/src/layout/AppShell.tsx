import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowDownUp, Briefcase, CalendarCheck, ExternalLink, LayoutDashboard, LogOut, Moon, Sun } from "lucide-react";
import { canEditForecast } from "../auth/permissions";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useThemeMode } from "../theme/ThemeProvider";
import { ROLE_LABELS } from "../constants";
import { IconButton, Logo, cn } from "../components/ui";

const NAV_ITEM =
  "group flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium transition-colors";
const NAV_IDLE =
  "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";
const NAV_ACTIVE =
  "border-yellow bg-yellow-soft text-gray-900 dark:bg-yellow/10 dark:text-yellow";

function NavItem({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => cn(NAV_ITEM, isActive ? NAV_ACTIVE : NAV_IDLE)}>
      <Icon className="size-5 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b-[3px] border-yellow bg-white px-4 shadow-sm sm:px-6 dark:bg-gray-900">
        <Logo className="h-6 sm:h-7" />
        <span aria-hidden className="hidden h-7 w-px bg-gray-200 sm:block dark:bg-gray-700" />
        <span className="flex-1 truncate text-base font-semibold tracking-tight text-gray-800 sm:text-lg dark:text-gray-100">
          Job Lifecycle Management
        </span>
        <IconButton label={`Switch to ${mode === "light" ? "dark" : "light"} mode`} onClick={toggleMode}>
          {mode === "light" ? <Moon /> : <Sun />}
        </IconButton>
        {user && (
          <>
            <div className="ml-1 hidden items-center gap-2.5 sm:flex" title={`${user.name} (${ROLE_LABELS[user.role] ?? user.role})`}>
              <span className="flex size-8 items-center justify-center rounded-full bg-yellow text-sm font-bold text-gray-900">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden flex-col leading-tight md:flex">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</span>
                {/* Role accounts are named after the role ("Component Planner") — don't repeat it. */}
                {(ROLE_LABELS[user.role] ?? user.role) !== user.name && (
                  <span className="text-xs text-gray-500 dark:text-gray-300">{ROLE_LABELS[user.role] ?? user.role}</span>
                )}
              </span>
            </div>
            <IconButton
              label="Log out"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut />
            </IconButton>
          </>
        )}
      </header>

      <aside className="fixed top-16 bottom-0 left-0 z-30 hidden w-56 flex-col border-r border-gray-200 bg-white px-3 py-4 md:flex dark:border-gray-800 dark:bg-gray-900">
        <nav className="flex flex-col gap-1">
          {user?.role !== "STOREMAN" && <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />}
          <NavItem to="/jobs" icon={Briefcase} label="Jobs" />
          {canEditForecast(user?.role) && <NavItem to="/forecast" icon={CalendarCheck} label="Forecast" />}
          {user?.role !== "SUPERVISOR" && <NavItem to="/admin/data" icon={ArrowDownUp} label="Import / Export" />}
          <a href="/board" target="_blank" rel="noopener noreferrer" className={cn(NAV_ITEM, NAV_IDLE)}>
            <ExternalLink className="size-5 shrink-0" />
            <span className="truncate">TV Board</span>
          </a>
        </nav>
      </aside>

      {/* Mobile nav: the sidebar collapses into a scrollable tab strip. */}
      <nav className="fixed inset-x-0 top-16 z-30 flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 md:hidden dark:border-gray-800 dark:bg-gray-900">
        {user?.role !== "STOREMAN" && <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />}
        <NavItem to="/jobs" icon={Briefcase} label="Jobs" />
        {canEditForecast(user?.role) && <NavItem to="/forecast" icon={CalendarCheck} label="Forecast" />}
        {user?.role !== "SUPERVISOR" && <NavItem to="/admin/data" icon={ArrowDownUp} label="Import / Export" />}
      </nav>

      <main className="px-4 pt-32 pb-10 sm:px-6 md:ml-56 md:pt-24">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
