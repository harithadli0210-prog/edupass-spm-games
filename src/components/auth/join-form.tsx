"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MailCheck, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
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
  emailCodeSupported = false,
}: {
  dict: Dictionary;
  enabled?: { phone: boolean; email: boolean };
  /**
   * True only when custom SMTP is configured and the email template carries
   * {{ .Token }}. Until then Supabase sends a link and no code exists, so
   * asking for one is asking for something that will never arrive.
   */
  emailCodeSupported?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const lang = localeFromPath(usePathname());
  const next = params.get("next") ?? appPath(lang);

  const both = enabled.phone && enabled.email;
  const [method, setMethod] = useState<Method>(enabled.phone ? "phone" : "email");
  const [step, setStep] = useState<"identify" | "code" | "sent">("identify");
  const [resent, setResent] = useState(false);
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
        options: {
          shouldCreateUser: true,
          // Supabase's default template sends a link and cannot be edited
          // without custom SMTP, so the link has to land somewhere that works.
          emailRedirectTo: `${window.location.origin}${appPath(lang, "/callback")}?next=${encodeURIComponent(next)}`,
        },
      });
      setBusy(false);
      if (otpError) return setError(otpError.message);
    }

    // With no code in the email, the only honest next screen is "go and open
    // the link" — not a box for a code that does not exist.
    setStep(method === "email" && !emailCodeSupported ? "sent" : "code");
  };

  const verifyCode = async (token: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);

    const { error: verifyError } = await supabaseBrowser().auth.verifyOtp(
      method === "phone"
        ? { phone, token, type: "sms" }
        : { email, token, type: "email" },
    );
    setBusy(false);

    if (verifyError) {
      setCode("");
      return setError(dict.auth.badCode);
    }

    router.push(next);
    router.refresh();
  };

  const verify = (event: React.FormEvent) => {
    event.preventDefault();
    void verifyCode(code);
  };

  /* ---- Step 2a: link sent, nothing to type ------------------------------ */
  if (step === "sent") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-lg bg-success-bg text-success">
          <MailCheck size={28} strokeWidth={2} />
        </span>

        <div>
          <h2 className="font-display text-lg font-bold text-ink">
            {dict.auth.checkInbox}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {t(dict.auth.checkInboxBody, { email })}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          {dict.auth.checkInboxHint}
        </p>

        {error && (
          <p className="text-xs font-semibold text-danger-ink">{error}</p>
        )}

        <Button
          variant="outline"
          fullWidth
          loading={busy}
          onClick={(e) => {
            setResent(true);
            void sendCode(e as unknown as React.FormEvent);
          }}
        >
          {resent && !busy ? dict.auth.sentAgain : dict.auth.sendAgain}
        </Button>

        <button
          type="button"
          onClick={() => {
            setStep("identify");
            setResent(false);
            setError(null);
          }}
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-brand-500"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          {dict.auth.useAnotherEmail}
        </button>
      </div>
    );
  }

  /* ---- Step 2b: the code ------------------------------------------------ */
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
          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (error) setError(null);
            }}
            // Six digits in means there is nothing left to decide, so submit
            // rather than making the student reach for the button.
            onComplete={(full) => void verifyCode(full)}
            invalid={Boolean(error)}
            disabled={busy}
            autoFocus
            label={dict.auth.verificationCode}
          />
        </Field>

        <Button type="submit" fullWidth loading={busy} disabled={code.length < 6}>
          {dict.auth.verifyContinue}
        </Button>

        {method === "email" && (
          <p className="text-center text-xs leading-relaxed text-muted">
            {dict.auth.orClickLink}
          </p>
        )}

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
          hint={
            emailCodeSupported ? dict.auth.emailHint : dict.auth.emailHintLink
          }
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
        {method === "email" && !emailCodeSupported
          ? dict.auth.sendLink
          : dict.auth.sendCode}
      </Button>
    </form>
  );
}
