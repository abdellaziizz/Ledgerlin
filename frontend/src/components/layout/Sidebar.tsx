import { ArrowLeftRight, LayoutGrid, LogOut, Scale, ScrollText, Settings, Wallet } from "lucide-react";
import { NavLink } from "react-router";
import { useAuth, useSession } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { initials } from "@/utils/format";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const primary = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { to: "/statements", label: "Statements", icon: ScrollText },
];

function NavItem({ to, label, icon: Icon, end, trailing, onNavigate }: {
  to: string;
  label: string;
  icon: typeof Wallet;
  end?: boolean;
  trailing?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] font-medium transition-colors",
          isActive ? "bg-sidebar-2 text-sidebar-ink" : "text-sidebar-ink-2 hover:bg-sidebar-2/60 hover:text-sidebar-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-[#34C08F] transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
            aria-hidden
          />
          <Icon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="flex-1">{label}</span>
          {trailing}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  const session = useSession();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-ink">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
        {primary.map((item) => (
          <NavItem key={item.to} {...item} onNavigate={onNavigate} />
        ))}

        <div className="mt-6 mb-1.5 px-3 text-2xs font-medium uppercase tracking-[0.08em] text-sidebar-ink-2/70">Ledger tools</div>
        <NavItem
          to="/audit"
          label="Reconciliation"
          icon={Scale}
          onNavigate={onNavigate}
          trailing={<span className="rounded bg-sidebar-2 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-ink-2">Soon</span>}
        />
        <NavItem to="/settings" label="Settings" icon={Settings} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-sidebar-line p-3">
        <div className="mb-3 flex items-center justify-between px-2">
          <span className="text-2xs text-sidebar-ink-2">Appearance</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-2 text-[11px] font-semibold text-sidebar-ink">
            {initials(session.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-sidebar-ink" title={session.email}>
              {session.email}
            </div>
            <div className="text-2xs text-sidebar-ink-2">Signed in</div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="grid size-8 place-items-center rounded-md text-sidebar-ink-2 transition-colors hover:bg-sidebar-2 hover:text-sidebar-ink"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
