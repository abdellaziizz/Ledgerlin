import { KeyRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { useAuth, useSession } from "@/contexts/AuthContext";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";

function Row({ label, description, children }: { label: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {description && <div className="mt-0.5 text-[12.5px] text-ink-3">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const session = useSession();
  const { logout } = useAuth();
  const { preference, setPreference } = useTheme();

  return (
    <>
      <PageHeader title="Settings" description="Your profile, session and preferences." />
      <div className="flex max-w-3xl flex-col gap-5">
        <Panel>
          <PanelHeader title="Profile" />
          <div className="divide-y divide-line border-t border-line">
            <Row label="Email">
              <span className="text-[13px] text-ink">{session.email}</span>
            </Row>
            <Row label="User ID">
              <span className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-2">
                {session.userId}
                <CopyButton value={session.userId} label="Copy user id" />
              </span>
            </Row>
            {/* TODO: Not implemented yet - no endpoint to change email or profile details (GET /auth/me is read-only). */}
            <Row label="Role" description={session.role === "auditor" ? "Can read every account and run reconciliation." : "Can open wallets and move money between them."}>
              <Badge tone={session.role === "auditor" ? "info" : "neutral"}>
                <span className="capitalize">{session.role}</span>
              </Badge>
            </Row>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Security" />
          <div className="divide-y divide-line border-t border-line">
            <Row label="Password" description="Changing your password isn't available yet.">
              {/* TODO: Not implemented yet - no change-password endpoint in the backend. */}
              <Button size="sm" disabled>
                <KeyRound className="size-3.5" /> Change password
              </Button>
            </Row>
            <Row
              label="Current session"
              description={
                <>
                  Signed in {formatDateTime(new Date(session.issuedAt).toISOString())} · expires{" "}
                  {formatDateTime(new Date(session.expiresAt).toISOString())}
                </>
              }
            >
              <Button size="sm" variant="danger" onClick={() => logout()}>
                <LogOut className="size-3.5" /> Sign out
              </Button>
            </Row>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Appearance" />
          <div className="border-t border-line px-5 py-4">
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 sm:max-w-sm">
              {themes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={preference === value}
                  onClick={() => setPreference(value)}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-medium transition-colors",
                    preference === value
                      ? "border-accent bg-accent-soft text-ink shadow-[0_0_0_1px_var(--accent)]"
                      : "border-line-strong text-ink-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </div>
        </Panel>

      </div>

    </>
  );
}
