"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, UserCircle2, ArrowRight, ShieldCheck, Mail, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Pre-defined personas matching the seed script for easy testing
const DEMO_PERSONAS = [
  { id: "admin", role: "System Administrator", email: "admin@hospital.com", fullName: "Jane Admin" },
  { id: "doctor", role: "Lead Physician", email: "doctor@hospital.com", fullName: "Dr. Gregory House" },
  { id: "nurse", role: "Head Nurse", email: "nurse@hospital.com", fullName: "Carla Espinosa" },
  { id: "pharm", role: "Pharmacist", email: "pharmacy@hospital.com", fullName: "John Mortar" },
  { id: "lab", role: "Lab Technician", email: "lab@hospital.com", fullName: "Sarah Microscope" },
  { id: "bill", role: "Billing Manager", email: "billing@hospital.com", fullName: "Amanda Ledger" },
  { id: "hr", role: "HR Director", email: "hr@hospital.com", fullName: "David Resources" },
];

export default function LoginPage() {
  const t = useTranslations('login');
  const commonT = useTranslations('common');
  
  const [email, setEmail] = useState(DEMO_PERSONAS[0].email);
  const [password, setPassword] = useState("password123");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);
    
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
        setIsLoggingIn(false);
      } else if (res?.ok) {
        // Force full page reload to sync NextAuth session with all server and client components properly
        window.location.href = "/";
      } else {
        setIsLoggingIn(false);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex justify-center p-4 py-8 overflow-y-auto">
      <div className="max-w-5xl w-full my-auto grid md:grid-cols-2 gap-8 items-stretch overflow-hidden rounded-2xl shadow-xl bg-white border border-slate-100">
        
        {/* Left Side - Brand & Information */}
        <div className="bg-slate-900 text-white p-10 flex flex-col justify-between hidden md:flex relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="absolute left-0 right-0 top-0 -mt-20 h-96 w-full bg-blue-600/20 blur-3xl rounded-full"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                <div className="w-5 h-5 border-[2.5px] border-white rounded-full"></div>
              </div>
              <span className="text-white font-bold tracking-tight text-2xl truncate">
                {commonT('app_name')}
              </span>
            </div>
            
            <div className="mt-16 space-y-6">
              <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
                {t('welcome')} <br />
                <span className="text-blue-400">{t('workspace')}</span>
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                {t('description')}
              </p>
            </div>
          </div>
          
          <div className="relative z-10 border border-slate-700 bg-slate-800/50 p-4 rounded-xl mt-12 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <ShieldCheck className="w-8 h-8 text-blue-400 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-white">{t('secure_sandbox')}</h4>
                <p className="text-xs text-slate-400 mt-1">{t('secure_sandbox_desc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('sign_in')}</h2>
            <p className="text-sm text-slate-500 mt-1">{t('credentials')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    id="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-slate-50 border-slate-200 text-slate-900 font-medium" 
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('password')}</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 bg-slate-50 border-slate-200 text-slate-900 font-medium tracking-widest" 
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all group"
            >
              {isLoggingIn ? t('authenticating') : t('access_system')}
              {!isLoggingIn && <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{t('personas')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 pb-2">
              {DEMO_PERSONAS.map((mock) => (
                <button
                  key={mock.id}
                  type="button"
                  onClick={() => {
                    setEmail(mock.email);
                    setPassword("password123");
                  }}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    email === mock.email 
                      ? "bg-blue-50 border-blue-200 ring-1 ring-blue-500 shadow-sm" 
                      : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex w-full justify-between items-center">
                    <span className={cn(
                      "text-sm font-semibold truncate",
                      email === mock.email ? "text-blue-900" : "text-slate-700"
                    )}>
                      {mock.role}
                    </span>
                  </div>
                  <span className={cn(
                    "text-xs truncate w-full mt-0.5",
                    email === mock.email ? "text-blue-600" : "text-slate-500"
                  )}>
                    {mock.fullName}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
