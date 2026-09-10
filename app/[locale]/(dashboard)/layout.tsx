import ResponsiveShell from "@/components/layout/ResponsiveShell";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ResponsiveShell>{children}</ResponsiveShell>;
}
