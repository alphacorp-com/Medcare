"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAppStore } from "@/lib/store/useAppStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = useAppStore((state) => state.currentUser);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!currentUser) {
      router.push("/login?callbackUrl=" + encodeURIComponent(pathname));
    }
  }, [currentUser, router, pathname]);

  if (!currentUser) {
    return null; // or a loading spinner
  }

  return (
    <>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-4">
          <div className="mx-auto w-full h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
