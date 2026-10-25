"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Confirmation of an action, in place of window.confirm: styled like the app, readable on a
// phone, and able to show a summary of what is about to happen. The caller owns the state:
// `open` / `onOpenChange`, and `pending` while the action runs (the dialog then cannot be
// dismissed, so the action is neither repeated nor abandoned halfway on screen).
//
// onConfirm may be async; the dialog does NOT close by itself — the caller closes it (or
// navigates away) once the action succeeded, and keeps it open on failure to let the user retry.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending = false,
  tone = "default",
  icon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  // Summary shown between the description and the buttons.
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  // "danger" for an action that cannot be undone or that releases something.
  tone?: "default" | "danger";
  icon?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            {icon && (
              <div
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border",
                  tone === "danger" ? "bg-red-50 border-red-100 text-red-600" : "bg-blue-50 border-blue-100 text-blue-600"
                )}
              >
                {icon}
              </div>
            )}
            <div className="space-y-1.5 min-w-0">
              <DialogTitle className="text-base font-semibold leading-snug">{title}</DialogTitle>
              {description && <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            disabled={pending}
            onClick={() => void onConfirm()}
            className={cn(tone === "danger" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white")}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
