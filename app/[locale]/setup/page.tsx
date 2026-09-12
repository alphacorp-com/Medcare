import Link from "next/link";
import prisma from "@/lib/prisma";
import { SetupForm } from "./SetupForm";

// Must never be statically prerendered — the whole point of this page is a
// fresh tenantUser.count() check on every request, so a build-time-cached
// version would keep showing "create account" forever even after setup ran.
export const dynamic = "force-dynamic";

export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const existing = await prisma.tenantUser.count();

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        {existing > 0 ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900">Setup already completed</h1>
            <p className="mt-1 text-sm text-slate-500">
              An administrator account already exists on this install. Sign in from the login page instead.
            </p>
            <Link
              href={`/${locale}/login`}
              className="mt-6 block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900">Set up your organization</h1>
            <p className="mt-1 text-sm text-slate-500">
              This one-time setup creates your organization and its first administrator account. You&apos;ll need
              the site secret you received when this install was activated.
            </p>
            <div className="mt-6">
              <SetupForm locale={locale} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
