import * as RD from "@radix-ui/react-dialog";
import { ArrowLeftRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Logo } from "./Logo";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-line bg-sidebar px-3 lg:hidden">
        <RD.Root open={open} onOpenChange={setOpen}>
          <RD.Trigger className="grid size-9 place-items-center rounded-md text-sidebar-ink-2 hover:text-sidebar-ink" aria-label="Open navigation">
            <Menu className="size-5" />
          </RD.Trigger>
          <RD.Portal>
            <RD.Overlay className="fixed inset-0 z-50 bg-black/50 animate-fade-in lg:hidden" />
            <RD.Content className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] shadow-modal animate-slide-in lg:hidden">
              <RD.Title className="sr-only">Navigation</RD.Title>
              <RD.Description className="sr-only">Main navigation</RD.Description>
              <RD.Close className="absolute right-3 top-4 z-10 grid size-8 place-items-center rounded-md text-sidebar-ink-2 hover:text-sidebar-ink" aria-label="Close navigation">
                <X className="size-4" />
              </RD.Close>
              <Sidebar onNavigate={() => setOpen(false)} />
            </RD.Content>
          </RD.Portal>
        </RD.Root>
        <Link to="/" aria-label="Ledgerline home">
          <Logo />
        </Link>
        <Link to="/transfers" className="grid size-9 place-items-center rounded-md text-sidebar-ink-2 hover:text-sidebar-ink" aria-label="New transfer">
          <ArrowLeftRight className="size-[18px]" />
        </Link>
      </header>

      <main id="main" className="min-w-0">
        <div key={location.pathname} className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 animate-rise sm:px-6 lg:px-10 lg:pt-9">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
