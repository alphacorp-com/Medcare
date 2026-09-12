"use client";

import React from "react";
import { Home, Users, Hospital, Box, MoreHorizontal } from "lucide-react";

interface MobileBottomNavProps {
  onHome?: () => void;
  onPatients?: () => void;
  onAdmissions?: () => void;
  onPharmacy?: () => void;
  onMore?: () => void;
}

export function MobileBottomNav({ onHome, onPatients, onAdmissions, onPharmacy, onMore }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t flex items-center justify-around z-50">
      <button onClick={onHome} className="flex flex-col items-center text-blue-600">
        <Home className="w-6 h-6" />
        <span className="text-[11px]">Accueil</span>
      </button>
      <button onClick={onPatients} className="flex flex-col items-center text-slate-600">
        <Users className="w-6 h-6" />
        <span className="text-[11px]">Patients</span>
      </button>
      <button onClick={onAdmissions} className="flex flex-col items-center text-slate-600">
        <Hospital className="w-6 h-6" />
        <span className="text-[11px]">Admissions</span>
      </button>
      <button onClick={onPharmacy} className="flex flex-col items-center text-slate-600">
        <Box className="w-6 h-6" />
        <span className="text-[11px]">Pharmacie</span>
      </button>
      <button onClick={onMore} className="flex flex-col items-center text-slate-600">
        <MoreHorizontal className="w-6 h-6" />
        <span className="text-[11px]">Plus</span>
      </button>
    </nav>
  );
}
