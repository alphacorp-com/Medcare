import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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
