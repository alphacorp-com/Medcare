"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/useAppStore";
import { useUsersStore } from "@/lib/store/useUsersStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, UserCircle2, ArrowRight, ShieldCheck, Mail, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const users = useUsersStore((state) => state.users);
  const logActivity = useUsersStore((state) => state.logActivity);
  
  const [selectedMock, setSelectedMock] = useState(users[0]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const router = useRouter();
  const { setUser, setActiveModules } = useAppStore();

  useEffect(() => {
    if (users.length > 0 && !selectedMock) {
      setSelectedMock(users[0]);
    }
  }, [users, selectedMock]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMock) return;

    setIsLoggingIn(true);
    
    // Simulate network delay
    setTimeout(() => {
      setUser({
        id: selectedMock.id,
        fullName: selectedMock.fullName,
        email: selectedMock.email,
        role: selectedMock.role,
      });
      setActiveModules(selectedMock.modules);
      logActivity(selectedMock.id, 'Login', 'Logged in via mock auth form');
      router.push("/");
    }, 600);
  };

  if (!selectedMock) return null;

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-8 items-stretch overflow-hidden rounded-2xl shadow-xl bg-white border border-slate-100">
        
        {/* Left Side - Brand & Information */}
        <div className="bg-slate-900 text-white p-10 flex flex-col justify-between hidden md:flex relative overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="absolute left-0 right-0 top-0 -mt-20 h-96 w-full bg-blue-600/20 blur-3xl rounded-full"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                <div className="w-5 h-5 border-[2.5px] border-white rounded-full"></div>
              </div>
              <span className="text-white font-bold tracking-tight text-2xl truncate">
                Medcare
              </span>
            </div>
            
            <div className="mt-16 space-y-6">
              <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
                Welcome to your <br />
                <span className="text-blue-400">Integrated Workspace</span>
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                Access your clinical and administrative tools securely. 
                This sandbox environment uses Role-Based Access Control to selectively load UI modules based on authenticated scopes.
              </p>
            </div>
          </div>
          
          <div className="relative z-10 border border-slate-700 bg-slate-800/50 p-4 rounded-xl mt-12 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <ShieldCheck className="w-8 h-8 text-blue-400 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-white">Secure Sandbox</h4>
                <p className="text-xs text-slate-400 mt-1">Select a mock persona from the list to experience the platform from different departmental perspectives.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h2>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to access the system.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    id="email" 
                    type="email" 
                    value={selectedMock.email}
                    readOnly
                    className="pl-10 h-12 bg-slate-50 border-slate-200 text-slate-900 font-medium" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    id="password" 
                    type="password" 
                    value="••••••••••••"
                    readOnly
                    className="pl-10 h-12 bg-slate-50 border-slate-200 text-slate-900 font-medium tracking-widest" 
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all group"
            >
              {isLoggingIn ? "Authenticating..." : "Access System"}
              {!isLoggingIn && <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Quick Test Personas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 pb-2">
              {users.map((mock) => (
                <button
                  key={mock.id}
                  type="button"
                  onClick={() => setSelectedMock(mock)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    selectedMock.id === mock.id 
                      ? "bg-blue-50 border-blue-200 ring-1 ring-blue-500 shadow-sm" 
                      : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50",
                    mock.status === 'inactive' && "opacity-50 grayscale"
                  )}
                >
                  <div className="flex w-full justify-between items-center">
                    <span className={cn(
                      "text-sm font-semibold truncate",
                      selectedMock.id === mock.id ? "text-blue-900" : "text-slate-700"
                    )}>
                      {mock.role}
                    </span>
                    {mock.status === 'inactive' && (
                      <span className="text-[9px] uppercase font-bold text-red-600 bg-red-100 px-1 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs truncate w-full mt-0.5",
                    selectedMock.id === mock.id ? "text-blue-600" : "text-slate-500"
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
