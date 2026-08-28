"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

interface ChangePasswordCardProps {
  t: (key: string) => string;
  tc: (key: string) => string;
}

// Self-contained: unlike the rest of the "profile" tab (name/email, saved via the tab's
// shared Save button), a password change needs the current password verified server-side
// before anything is written, so it gets its own request and its own button rather than
// riding along with handleSaveSettings.
export function ChangePasswordCard({ t, tc }: ChangePasswordCardProps) {
  const locale = useLocale();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (newPassword.length < 8) {
      setError(tc("password_min_length"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tc("password_mismatch"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || tc("save_error"));
      setMessage(t("password_changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // The password change just invalidated this session too — sign out for real
      // instead of leaving the user on a page that will start failing requests.
      setTimeout(() => {
        void signOut({ callbackUrl: `/${locale}/login` });
      }, 1800);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : tc("save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{t("change_password")}</h2>
        <p className="text-xs text-slate-500">{t("change_password_desc")}</p>
      </div>
      <div className="h-px bg-slate-100 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
            {t("current_password")}
          </Label>
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="text-sm h-10 bg-white"
          />
        </div>
        <div>
          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
            {tc("password")}
          </Label>
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="text-sm h-10 bg-white"
          />
        </div>
        <div>
          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
            {tc("confirm_password")}
          </Label>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="text-sm h-10 bg-white"
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      <Button onClick={handleSubmit} disabled={saving}>
        {saving ? tc("saving") : t("change_password")}
      </Button>
    </div>
  );
}
