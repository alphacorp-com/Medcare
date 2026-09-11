"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function SetupForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, fullName, email, password, confirmPassword, clientSecret }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || "Setup failed.");
        setIsSubmitting(false);
        return;
      }
      // Hard navigation to login — a fresh page load is simplest here and
      // avoids any stale client-side auth state from before setup existed.
      window.location.href = `/${locale}/login`;
    } catch {
      setError("An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="orgName">Organization name</Label>
        <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Your full name</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
        />
        <p className="text-xs text-slate-500">At least 12 characters.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={12}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="clientSecret">Site secret</Label>
        <Input
          id="clientSecret"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          className="font-mono"
          required
        />
        <p className="text-xs text-slate-500">
          The secret you received when this site&apos;s license was activated.
        </p>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Creating account…" : "Create organization"}
      </Button>
    </form>
  );
}
