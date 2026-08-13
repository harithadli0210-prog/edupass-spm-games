import { getFlags } from "@/lib/flags";
import { FlagSwitchboard } from "@/components/admin/flag-switchboard";

export const metadata = { title: "Switches" };
export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const flags = await getFlags();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Switches</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Turn parts of the product on and off without a deploy. Changes take
          effect within about 15 seconds for everyone.
        </p>
      </div>

      <div className="rounded-lg border-l-[3px] border-brand-500 bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-ink">
          How the two switches differ
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-ink">Live</strong> — students can see and use
            the feature.
          </li>
          <li>
            <strong className="text-ink">Admin</strong> — you can still reach it
            while Live is off.
          </li>
        </ul>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">
          Live off + Admin on is the working state for anything under
          construction: it runs on the real site against real data, and no
          student can see it. That is how Subject Missions and Weekly Boss are
          set up right now.
        </p>
      </div>

      <FlagSwitchboard initial={flags} />
    </div>
  );
}
