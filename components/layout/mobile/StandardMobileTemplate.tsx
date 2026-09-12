"use client";

import React, { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { Link, useRouter } from "@/i18n/routing";
import { useAppStore } from "@/lib/store/useAppStore";
import { signOut } from "next-auth/react";

export default function StandardMobileTemplate({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 flex flex-col overflow-x-hidden">
      <MobileHeader onMenuToggle={() => setMenuOpen(true)} onProfileToggle={() => setProfileOpen(true)} />

      <div className="h-16" />

      <main className="flex-1 px-2 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-full min-w-0">
          <div className="w-full max-w-full min-w-0 bg-white rounded-2xl shadow-sm p-3 min-h-[60vh] flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 mb-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 text-center">
                <div className="text-base font-semibold text-slate-900 truncate">{title}</div>
                {subtitle && <div className="text-[12px] text-slate-500 truncate">{subtitle}</div>}
              </div>
            </div>

            {actions && <div className="mb-3 overflow-x-auto overflow-y-hidden">{actions}</div>}

            <div className="mb-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400">Rechercher …</div>
            </div>

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
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 shadow-xl overflow-auto">
            <button className="mb-4 text-sm text-slate-600" onClick={() => setMenuOpen(false)}>Fermer</button>
            <nav className="flex flex-col gap-2">
              <Link href="/">Tableau de bord</Link>
              <Link href="/patients">Patients</Link>
              <Link href="/appointments">Rendez-vous</Link>
              <Link href="/stays">Admissions</Link>
              <Link href="/pharmacy">Pharmacie</Link>
              <Link href="/settings">Paramètres</Link>
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
              <Link href="/reports" className="text-center p-3 bg-slate-50 rounded">Rapports</Link>
              <Link href="/messages" className="text-center p-3 bg-slate-50 rounded">Messages</Link>
              <button onClick={() => router.push('/settings')} className="text-center p-3 bg-slate-50 rounded">Paramètres</button>
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
