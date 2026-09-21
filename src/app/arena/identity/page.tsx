import { notFound } from "next/navigation";

import { AnonymousIdentityVerification } from "../../../components/arena/AnonymousIdentityVerification";

export const dynamic = "force-dynamic";

export default function ArenaIdentityVerificationPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#07110d] px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
          PIN³ Arena · Development Verification
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Anonymous identity continuity
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-slate-300">
          This development-only check confirms that Supabase establishes the
          browser session and the trusted Next.js server resolves the same
          provider-neutral Arena identity.
        </p>
        <div className="mt-10">
          <AnonymousIdentityVerification />
        </div>
      </section>
    </main>
  );
}
