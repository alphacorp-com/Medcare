import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { checkOnPremLicenseGuard } from "@/lib/onprem-license/guard";

export default async function DashboardLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // Enforce the on-prem license: once blocked (no license, or expired past its
    // grace period), every dashboard page redirects to the on-prem license tab in
    // Settings so the admin can activate/renew — except routes already under
    // /settings, to avoid redirecting that page back to itself in a loop.
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "";
    const isSettingsRoute = pathname === `/${locale}/settings` || pathname.startsWith(`/${locale}/settings/`);

    if (!isSettingsRoute) {
        const guard = await checkOnPremLicenseGuard();
        if (guard.blocked) {
            redirect(`/${locale}/settings?tab=onprem_license`);
        }
    }

    return (
        <div className="flex w-full h-full overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 bg-slate-100 relative">
                <Header />
                <main className="flex-1 p-4 overflow-auto min-h-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
