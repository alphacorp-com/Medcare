"use client";

import React, { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { Link, useRouter } from "@/i18n/routing";
import { useAppStore } from "@/lib/store/useAppStore";
import { signOut } from "next-auth/react";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const currentUser = useAppStore((state) => state.currentUser);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 flex flex-col overflow-x-hidden">
      <MobileHeader onMenuToggle={() => setMenuOpen(true)} onProfileToggle={() => setProfileOpen(true)} />

      <div className="h-16" />

      <main className="flex-1 px-3 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-full min-w-0">
          <div className="w-full max-w-full min-w-0 bg-white rounded-2xl shadow-sm p-3 min-h-[60vh] flex flex-col overflow-hidden">
            {children}
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

      {menuOpen && (
        <div className="fixed inset-0 z-60">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 shadow-xl overflow-auto">
            <button className="mb-4 text-sm text-slate-600" onClick={() => setMenuOpen(false)}>
              Fermer
            </button>
            <nav className="flex flex-col gap-2 text-sm text-slate-700">
              <Link href="/" className="rounded-md px-2 py-2 hover:bg-slate-100">Tableau de bord</Link>
              <Link href="/patients" className="rounded-md px-2 py-2 hover:bg-slate-100">Patients</Link>
              <Link href="/stays" className="rounded-md px-2 py-2 hover:bg-slate-100">Admissions</Link>
              <Link href="/pharmacy" className="rounded-md px-2 py-2 hover:bg-slate-100">Pharmacie</Link>
              <Link href="/laboratory" className="rounded-md px-2 py-2 hover:bg-slate-100">Laboratoire</Link>
              <Link href="/surgery" className="rounded-md px-2 py-2 hover:bg-slate-100">Chirurgie</Link>
              <Link href="/radiology" className="rounded-md px-2 py-2 hover:bg-slate-100">Radiologie</Link>
              <Link href="/planning" className="rounded-md px-2 py-2 hover:bg-slate-100">Planning</Link>
              <Link href="/messages" className="rounded-md px-2 py-2 hover:bg-slate-100">Messages</Link>
              <Link href="/settings" className="rounded-md px-2 py-2 hover:bg-slate-100">Paramètres</Link>
            </nav>
          </aside>
        </div>
      )}

      {moreOpen && (
        <div className="fixed inset-0 z-60 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">Plus d&apos;options</div>
              <button className="text-slate-600" onClick={() => setMoreOpen(false)}>
                Fermer
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Link href="/reports" className="rounded-lg bg-slate-50 p-3 text-center">Rapports</Link>
              <Link href="/messages" className="rounded-lg bg-slate-50 p-3 text-center">Messages</Link>
              <button onClick={() => { setMoreOpen(false); router.push("/settings"); }} className="rounded-lg bg-slate-50 p-3 text-center">
                Paramètres
              </button>
            </div>
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="fixed inset-0 z-70 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProfileOpen(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Profil</div>
                <div className="text-sm text-slate-500">Compte connecté</div>
              </div>
              <button className="text-slate-600" onClick={() => setProfileOpen(false)}>
                Fermer
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="font-medium text-slate-900">{currentUser?.fullName ?? "Utilisateur"}</div>
                <div className="text-xs text-slate-500">{currentUser?.email ?? "Aucun email"}</div>
                <div className="text-xs text-slate-500">{currentUser?.role ?? "Rôle non défini"}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/settings");
                  }}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Voir le profil
                </button>
                <button
                  onClick={async () => {
                    setProfileOpen(false);
                    await signOut({ callbackUrl: "/login" });
                  }}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
