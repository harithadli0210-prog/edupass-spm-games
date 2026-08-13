"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabaseBrowser } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/validation";
import { appPath, localeFromPath, t, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Method = "phone" | "email";

/**
 * Sign-in, by phone OTP or email OTP.
 *
 * Both exist because they trade off differently:
 *
 *   Phone — students check SMS far more reliably than email, and a verified
 *           number is the strongest duplicate-account guard the competition
 *           has. But every message costs money through an SMS provider, and at
 *           national scale that is a five-figure line item.
 *
 *   Email — free, needs no external provider, and lets development proceed
 *           before any SMS contract exists. Weaker as a duplicate guard, since
 *           one person can hold several addresses.
 *
 * Either way the profile still collects a phone number, so the unique index on
 * student_profiles.phone_e164 keeps working. It is simply unverified when the
 * student signed in by email.
 *
 * Which methods appear is driven by feature flags, so phone can stay off while
 * there is no SMS provider and switch on the day there is.
 */
export function JoinForm({
  dict,
  enabled = { phone: true, email: true },
}: {
  dict: Dictionary;
  enabled?: { phone: boolean; email: boolean };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const lang = localeFromPath(usePathname());
  const next = params.get("next") ?? appPath(lang);

  const both = enabled.phone && enabled.email;
  const [method, setMethod] = useState<Method>(enabled.phone ? "phone" : "email");
  const [step, setStep] = useState<"identify" | "code">("identify");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (method === "phone") {
      const normalized = normalizePhone(phone);
      if (!normalized) return setError(dict.auth.badPhone);

      setBusy(true);
      const { error: otpError } = await supabaseBrowser().auth.signInWithOtp({
        phone: normalized,
      });
      setBusy(false);
      if (otpError) return setError(otpError.message);
      setPhone(normalized);
    } else {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return setError(dict.auth.badEmail);
      }

      setBusy(true);
      const { error: otpError } = await supabaseBrowser().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      setBusy(false);
      if (otpError) return setError(otpError.message);
    }

    setStep("code");
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const { error: verifyError } = await supabaseBrowser().auth.verifyOtp(
      method === "phone"
        ? { phone, token: code, type: "sms" }
        : { email, token: code, type: "email" },
    );
    setBusy(false);

    if (verifyError) return setError(dict.auth.badCode);

    router.push(next);
    router.refresh();
  };

  /* ---- Step 2: the code ------------------------------------------------- */
  if (step === "code") {
    return (
      <form onSubmit={verify} className="flex flex-col gap-4">
        <Field
          label={dict.auth.verificationCode}
          htmlFor="code"
          hint={
            method === "phone"
              ? t(dict.auth.sentTo, { phone })
              : t(dict.auth.sentToEmail, { email })
          }
          error={error ?? undefined}
        >
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            invalid={Boolean(error)}
            autoFocus
          />
        </Field>

        <Button type="submit" fullWidth loading={busy} disabled={code.length < 4}>
          {dict.auth.verifyContinue}
        </Button>

        <button
          type="button"
          onClick={() => {
            setStep("identify");
            setCode("");
            setError(null);
          }}
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-brand-500"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          {dict.auth.differentNumber}
        </button>
      </form>
    );
  }

  /* ---- Step 1: who are you ---------------------------------------------- */
  return (
    <form onSubmit={sendCode} className="flex flex-col gap-4">
      {both && (
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["phone", "email"] as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                setError(null);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 font-display text-xs font-bold transition-colors duration-150",
                method === m
                  ? "bg-white text-brand-600 shadow-soft"
                  : "text-muted hover:text-brand-600",
              )}
            >
              {m === "phone" ? <Smartphone size={14} /> : <Mail size={14} />}
              {m === "phone" ? dict.onboarding.phone : dict.auth.emailLabel}
            </button>
          ))}
        </div>
      )}

      {method === "phone" ? (
        <Field
          label={dict.auth.mobileNumber}
          htmlFor="phone"
          hint={dict.auth.mobileHint}
          error={error ?? undefined}
          required
        >
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="012-345 6789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            invalid={Boolean(error)}
            autoFocus
          />
        </Field>
      ) : (
        <Field
          label={dict.auth.emailLabel}
          htmlFor="email"
          hint={dict.auth.emailHint}
          error={error ?? undefined}
          required
        >
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nama@contoh.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(error)}
            autoFocus
          />
        </Field>
      )}

      <Button
        type="submit"
        fullWidth
        loading={busy}
        disabled={method === "phone" ? phone.length < 9 : email.length < 5}
      >
        {dict.auth.sendCode}
      </Button>
    </form>
  );
}
