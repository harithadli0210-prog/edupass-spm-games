"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/lib/flags";

const CATEGORY_LABEL: Record<string, string> = {
  MODE: "Game modes",
  COMPETITION: "Competition",
  CONTENT: "Content",
  GENERAL: "General",
};

/**
 * The switchboard.
 *
 * Each flag has two controls, because "off" has two meanings while a product is
 * still being built:
 *
 *   Live   — students can see and use it
 *   Admin  — you can still reach it while it is off for students
 *
 * A mode that is Live-off but Admin-on is the working state for Missions and
 * Boss: reachable on the real site, with real data, invisible to everyone else.
 */
export function FlagSwitchboard({ initial }: { initial: FeatureFlag[] }) {
  const router = useRouter();
  const [flags, setFlags] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (
    key: string,
    field: "enabled" | "visible_to_admin",
    value: boolean,
  ) => {
    setBusy(`${key}:${field}`);
    setError(null);

    // Optimistic: a switch that lags behind the finger feels broken.
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, [field]: value } : f)),
    );

    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update the switch.");
      setFlags(data.flags as FeatureFlag[]);
      router.refresh();
    } catch (e) {
      setFlags(initial); // roll back to the last known server state
      setError(e instanceof Error ? e.message : "Could not update the switch.");
    } finally {
      setBusy(null);
    }
  };

  const groups = Object.entries(
    flags.reduce<Record<string, FeatureFlag[]>>((acc, flag) => {
      (acc[flag.category] ??= []).push(flag);
      return acc;
    }, {}),
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger-bg p-4 text-sm font-semibold text-danger-ink">
          {error}
        </div>
      )}

      {groups.map(([category, items]) => (
        <section key={category}>
          <h2 className="mb-3 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            {CATEGORY_LABEL[category] ?? category}
          </h2>

          <div className="flex flex-col gap-2">
            {items.map((flag) => (
              <div
                key={flag.key}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white p-4"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-semibold text-ink">
                      {flag.label}
                    </h3>
                    {!flag.enabled && flag.visible_to_admin && (
                      <span className="rounded-full bg-warning-bg px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-warning-ink">
                        Admin only
                      </span>
                    )}
                  </div>
                  {flag.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {flag.description}
                    </p>
                  )}
                  <code className="mt-1 inline-block text-[10px] text-faint">
                    {flag.key}
                  </code>
                </div>

                <div className="flex items-center gap-5">
                  <Switch
                    label="Live"
                    checked={flag.enabled}
                    busy={busy === `${flag.key}:enabled`}
                    onChange={(v) => void toggle(flag.key, "enabled", v)}
                  />
                  <Switch
                    label="Admin"
                    icon={flag.visible_to_admin ? <Eye size={13} /> : <EyeOff size={13} />}
                    checked={flag.visible_to_admin}
                    busy={busy === `${flag.key}:visible_to_admin`}
                    onChange={(v) => void toggle(flag.key, "visible_to_admin", v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Switch({
  label,
  checked,
  busy,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  busy?: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer select-none flex-col items-center gap-1.5">
      <span className="flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
        {icon}
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60",
          checked ? "bg-success" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </label>
  );
}
