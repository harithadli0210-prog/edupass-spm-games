"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { supabaseBrowser } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/validation";

/**
 * Phone OTP sign-in.
 *
 * Chosen over email for this audience: most Malaysian students check SMS far
 * more reliably than email, and a verified phone number doubles as the
 * duplicate-account guard the competition needs.
 */
export function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/spm-games";

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Enter a Malaysian mobile number, e.g. 012-345 6789.");
      return;
    }

    setBusy(true);
    const { error: otpError } = await supabaseBrowser().auth.signInWithOtp({
      phone: normalized,
    });
    setBusy(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }
    setPhone(normalized);
    setStep("code");
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const { error: verifyError } = await supabaseBrowser().auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    setBusy(false);

    if (verifyError) {
      setError("That code didn't work. Check it and try again.");
      return;
    }

    router.push(next);
    router.refresh();
  };

  if (step === "code") {
    return (
      <form onSubmit={verify} className="flex flex-col gap-4">
        <Field
          label="Verification code"
          htmlFor="code"
          hint={`Sent to ${phone}`}
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
          Verify and continue
        </Button>

        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError(null);
          }}
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-brand-500"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="flex flex-col gap-4">
      <Field
        label="Mobile number"
        htmlFor="phone"
        hint="We'll text you a 6-digit code."
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

      <Button type="submit" fullWidth loading={busy} disabled={phone.length < 9}>
        Send code
      </Button>
    </form>
  );
}
