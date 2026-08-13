import { supabaseAdmin } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata = { title: "Your details" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { data: states } = await supabaseAdmin()
    .from("states")
    .select("id, name")
    .order("name");

  const { data: districts } = await supabaseAdmin()
    .from("districts")
    .select("id, name, state_id")
    .order("name");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-2">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Your details</h1>
        <p className="mt-2 text-sm text-muted">
          Eight quick fields, then you can play. We need these to place you on the
          school and state leaderboards.
        </p>
      </header>

      <OnboardingForm states={states ?? []} districts={districts ?? []} />
    </div>
  );
}
