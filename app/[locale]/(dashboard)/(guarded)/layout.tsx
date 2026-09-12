import { redirect } from "next/navigation";
import { checkOnPremLicenseGuard } from "@/lib/onprem-license/guard";

// Enforces the on-prem license: once blocked (no license, or expired past its
// grace period), every page under this route group redirects to the on-prem
// license tab in Settings so the admin can activate/renew. Settings itself
// lives in the sibling (dashboard) group, outside this layout, so it's never
// wrapped by this guard — no pathname sniffing needed, Settings simply isn't
// part of the tree this layout applies to.
export default async function GuardedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const guard = await checkOnPremLicenseGuard();
  if (guard.blocked) {
    redirect(`/${locale}/settings?tab=onprem_license`);
  }

  return children;
}
