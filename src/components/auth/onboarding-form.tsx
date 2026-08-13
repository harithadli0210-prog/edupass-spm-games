"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { appPath, type Dictionary, type Locale } from "@/lib/i18n";

interface Option {
  id: string;
  name: string;
}
interface District extends Option {
  state_id: string;
}

/**
 * The eight-field profile (spec §8).
 *
 * Deliberately short. This screen stands between a student and their first
 * game, so every extra question is drop-off. The behavioural and academic
 * profiling the product actually wants comes from gameplay, not from a form.
 */
export function OnboardingForm({
  states,
  districts,
  dict,
  lang,
}: {
  states: Option[];
  districts: District[];
  dict: Dictionary;
  lang: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [stateId, setStateId] = useState("");

  const stateDistricts = useMemo(
    () => districts.filter((d) => d.state_id === stateId),
    [districts, stateId],
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: String(form.get("full_name") ?? ""),
      display_name: String(form.get("display_name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      school_name: String(form.get("school_name") ?? ""),
      state_id: String(form.get("state_id") ?? ""),
      district_id: String(form.get("district_id") ?? "") || null,
      postcode: String(form.get("postcode") ?? ""),
      consent: form.get("consent") === "on",
      guardian_consent: form.get("guardian_consent") === "on",
    };

    try {
      const res = await fetch("/api/spm/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setFieldErrors(data.issues?.fieldErrors ?? {});
        throw new Error(data.error ?? dict.onboarding.saveError);
      }

      router.push(appPath(lang));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.onboarding.saveError);
    } finally {
      setBusy(false);
    }
  };

  const err = (key: string) => fieldErrors[key]?.[0];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={dict.onboarding.fullName} htmlFor="full_name" required error={err("full_name")}
             hint={dict.onboarding.fullNameHint}>
        <Input id="full_name" name="full_name" autoComplete="name" required
               invalid={Boolean(err("full_name"))} />
      </Field>

      <Field label={dict.onboarding.displayName} htmlFor="display_name" required
             error={err("display_name")}
             hint={dict.onboarding.displayNameHint}>
        <Input id="display_name" name="display_name" maxLength={30} required
               invalid={Boolean(err("display_name"))} />
      </Field>

      <Field label={dict.onboarding.phone} htmlFor="phone" required error={err("phone")}>
        <Input id="phone" name="phone" type="tel" inputMode="tel"
               autoComplete="tel" placeholder="012-345 6789" required
               invalid={Boolean(err("phone"))} />
      </Field>

      <Field label={dict.onboarding.email} htmlFor="email" required error={err("email")}>
        <Input id="email" name="email" type="email" inputMode="email"
               autoComplete="email" required invalid={Boolean(err("email"))} />
      </Field>

      <Field label={dict.onboarding.schoolName} htmlFor="school_name" required
             error={err("school_name")}
             hint={dict.onboarding.schoolHint}>
        <Input id="school_name" name="school_name" required
               invalid={Boolean(err("school_name"))} />
      </Field>

      <Field label={dict.onboarding.state} htmlFor="state_id" required error={err("state_id")}>
        <Select id="state_id" name="state_id" required value={stateId}
                onChange={(e) => setStateId(e.target.value)}
                invalid={Boolean(err("state_id"))}>
          <option value="">{dict.onboarding.chooseState}</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </Field>

      <Field label={dict.onboarding.district} htmlFor="district_id"
             hint={stateId ? undefined : dict.onboarding.districtHint}>
        <Select id="district_id" name="district_id" disabled={!stateId}>
          <option value="">{dict.onboarding.chooseDistrict}</option>
          {stateDistricts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
      </Field>

      <Field label={dict.onboarding.postcode} htmlFor="postcode" required error={err("postcode")}>
        <Input id="postcode" name="postcode" inputMode="numeric" maxLength={5}
               placeholder="53100" required invalid={Boolean(err("postcode"))} />
      </Field>

      {/* PDPA. Participants are minors, so consent is explicit and unbundled. */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4">
        <label className="flex items-start gap-3 text-sm leading-relaxed text-body">
          <input type="checkbox" name="consent" required
                 className="mt-0.5 size-5 shrink-0 accent-[#6846d6]" />
          <span>
            {dict.onboarding.consent}
            {err("consent") && (
              <span className="mt-1 block text-xs font-semibold text-danger-ink">
                {err("consent")}
              </span>
            )}
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm leading-relaxed text-body">
          <input type="checkbox" name="guardian_consent"
                 className="mt-0.5 size-5 shrink-0 accent-[#6846d6]" />
          <span>
            {dict.onboarding.guardianConsent}
          </span>
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger-bg p-4 text-sm font-semibold text-danger-ink">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" fullWidth loading={busy}>
        {dict.onboarding.submit}
      </Button>
    </form>
  );
}
