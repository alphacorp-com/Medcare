"use client";

import React, { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import { useAppStore } from "@/lib/store/useAppStore";
import { signOut } from "next-auth/react";

export default function StandardMobileTemplate({
  title,
  subtitle,
  actions,
  children,
  showSearchSlot = true,
  noRoundedContainer = false,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  showSearchSlot?: boolean;
  noRoundedContainer?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useAppStore((s) => s.currentUser);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 flex flex-col overflow-x-hidden">
      <MobileHeader onMenuToggle={() => setMenuOpen(true)} onProfileToggle={() => setProfileOpen(true)} />

      <div className="h-16" />

      <main className="flex-1 px-2 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-full min-w-0">
          <div className={
            `w-full max-w-full min-w-0 bg-white ${noRoundedContainer ? "p-0 min-h-[60vh] overflow-visible" : "rounded-2xl shadow-sm p-3 min-h-[60vh] overflow-hidden"} flex flex-col`
          }>
            <div className="mb-3 min-w-0 text-center">
              <div className="text-base font-semibold text-slate-900 truncate">{title}</div>
              {subtitle && <div className="text-[12px] text-slate-500 truncate">{subtitle}</div>}
            </div>

            {actions && <div className="mb-3">{actions}</div>}

            {showSearchSlot && (
              <div className="mb-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400">Rechercher …</div>
              </div>
            )}

            <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
          </div>
        </div>
      </main>

      <MobileBottomNav
        onHome={() => router.push("/")}
        onPatients={() => router.push("/patients")}
        onAdmissions={() => router.push("/stays")}
        onPharmacy={() => router.push("/pharmacy")}
        onMore={() => setMoreOpen(true)}
      />

      {/* Menu drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-60">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 shadow-xl overflow-auto border-r">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold">Services</div>
              <button className="text-sm text-slate-500" onClick={() => setMenuOpen(false)}>Fermer</button>
            </div>
            <nav className="flex flex-col gap-2 text-sm">
              {(() => {
                const makeClass = (path: string) =>
                  `rounded-md px-2 py-2 flex items-center gap-3 hover:bg-slate-100 ${
                    pathname && (path === "/" ? pathname === "/" : pathname.startsWith(path))
                      ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                      : "text-slate-700"
                  }`;

                return (
                  <>
                    <Link href="/" className={makeClass("/")}>Tableau de bord</Link>
                    <Link href="/patients" className={makeClass("/patients")}>Patients</Link>
                    <Link href="/appointments" className={makeClass("/appointments")}>Rendez-vous</Link>
                    <Link href="/stays" className={makeClass("/stays")}>Admissions</Link>
                    <Link href="/pharmacy" className={makeClass("/pharmacy")}>Pharmacie</Link>
                    <Link href="/settings" className={makeClass("/settings")}>Paramètres</Link>
                  </>
                );
              })()}
            </nav>
          </aside>
        </div>
      )}

      {/* More bottom sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-60 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">Plus d&apos;options</div>
              <button className="text-slate-600" onClick={() => setMoreOpen(false)}>Fermer</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Link href="/reports" className="text-center p-3 bg-white border border-slate-100 rounded shadow-sm hover:shadow-md">Rapports</Link>
              <Link href="/messages" className="text-center p-3 bg-white border border-slate-100 rounded shadow-sm hover:shadow-md">Messages</Link>
              <button onClick={() => router.push('/settings')} className="text-center p-3 bg-white border border-slate-100 rounded shadow-sm hover:shadow-md">Paramètres</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile sheet */}
      {profileOpen && (
        <div className="fixed inset-0 z-70 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProfileOpen(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Profil</div>
                <div className="text-sm text-slate-500">Compte connecté</div>
              </div>
              <button className="text-slate-600" onClick={() => setProfileOpen(false)}>Fermer</button>
            </div>
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">{currentUser?.fullName ?? "-"}</div>
                <div className="text-slate-500 text-xs">{currentUser?.email ?? "-"}</div>
                <div className="text-slate-500 text-xs">{currentUser?.role ?? "-"}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setProfileOpen(false); router.push('/settings'); }} className="flex-1 bg-slate-100 p-2 rounded">Voir le profil</button>
                <button onClick={async () => { await signOut({ callbackUrl: '/login' }); }} className="flex-1 bg-red-600 text-white p-2 rounded">Se déconnecter</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
