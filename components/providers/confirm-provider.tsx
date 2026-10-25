"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

// Replaces window.confirm everywhere with the app's own dialog, keeping the same call shape:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ message: t("confirm_delete", { name }), tone: "danger" }))) return;
//
// One dialog is mounted for the whole app (RootLayout). Resolves true on confirmation and
// false when dismissed (Cancel, Escape, click outside). The promise resolves as the dialog
// closes: the action that follows runs and reports its own progress/errors (toast, mutation
// state), like it did after window.confirm.

export type ConfirmOptions = {
  // The question, shown as the dialog's title.
  message: string;
  // Optional detail under the question.
  description?: string;
  // "danger": deletion or another action that cannot be undone (red button).
  tone?: "default" | "danger";
  // Defaults to "Confirm".
  confirmLabel?: string;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const tc = useTranslations("common");
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback<Confirm>((next) => {
    // A second request while one is open dismisses the first (never left unresolved).
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(next);
    });
  }, []);

  const tone = options?.tone ?? "default";
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={options !== null}
        onOpenChange={(open) => !open && settle(false)}
        title={options?.message ?? ""}
        description={options?.description}
        confirmLabel={options?.confirmLabel ?? tc("confirm")}
        cancelLabel={tc("cancel")}
        onConfirm={() => settle(true)}
        tone={tone}
        icon={tone === "danger" ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider> (RootLayout).");
  return confirm;
}
