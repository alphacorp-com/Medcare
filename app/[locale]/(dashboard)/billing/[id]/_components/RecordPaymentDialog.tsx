"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PaymentMethod } from "../../types";

const METHODS: PaymentMethod[] = ["cash", "card", "insurance", "bank_transfer", "mobile_money_orange", "mobile_money_mtn"];
const MOBILE_MONEY_METHODS: PaymentMethod[] = ["mobile_money_orange", "mobile_money_mtn"];
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 120000;

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  outstanding,
  currency,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  outstanding: number;
  currency: string;
  onSaved: () => void;
}) {
  const t = useTranslations("billing");
  const tc = useTranslations("common");

  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(String(outstanding));
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reference, setReference] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<"pending" | "successful" | "failed" | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const startPolling = (paymentId: string) => {
    setPendingPaymentId(paymentId);
    setPollStatus("pending");
    const startedAt = Date.now();

    pollTimer.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        return;
      }
      try {
        const res = await fetch(`/api/v1/billing/payments/${paymentId}/status`);
        const payment = await res.json();
        if (payment.status === "successful") {
          setPollStatus("successful");
          if (pollTimer.current) clearInterval(pollTimer.current);
          onSaved();
        } else if (payment.status === "failed") {
          setPollStatus("failed");
          if (pollTimer.current) clearInterval(pollTimer.current);
        }
      } catch {
        // keep polling; transient network errors shouldn't abort the wait
      }
    }, POLL_INTERVAL_MS);
  };

  const handleSubmit = async () => {
    setError(null);
    const amountNumber = Number(amount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError(t("payment_amount_invalid"));
      return;
    }
    if (MOBILE_MONEY_METHODS.includes(method) && !phoneNumber.trim()) {
      setError(t("phone_number_required"));
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/billing/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          amount: amountNumber,
          phoneNumber: MOBILE_MONEY_METHODS.includes(method) ? phoneNumber.trim() : undefined,
          reference: reference || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || t("payment_error"));
        return;
      }

      if (!MOBILE_MONEY_METHODS.includes(method)) {
        onSaved();
        onOpenChange(false);
        return;
      }

      if (payload.redirectUrl) {
        window.open(payload.redirectUrl, "_blank", "noopener,noreferrer");
      }
      startPolling(payload.id);
    } catch {
      setError(t("payment_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("record_payment")}</DialogTitle>
        </DialogHeader>

        {pendingPaymentId ? (
          <div className="py-6 text-center space-y-3">
            {pollStatus === "successful" ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
                <p className="text-sm font-semibold text-green-700">{t("payment_successful")}</p>
              </>
            ) : pollStatus === "failed" ? (
              <>
                <XCircle className="h-10 w-10 text-red-500 mx-auto" />
                <p className="text-sm font-semibold text-red-700">{t("payment_failed")}</p>
              </>
            ) : (
              <>
                <Loader2 className="h-10 w-10 text-blue-500 mx-auto animate-spin" />
                <p className="text-sm font-semibold text-slate-700">{t("payment_waiting_confirmation")}</p>
                <p className="text-xs text-slate-500">{t("payment_waiting_desc")}</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

            <div className="space-y-1">
              <Label>{t("payment_method")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`border rounded p-2 text-xs font-semibold text-left ${
                      method === m ? "border-blue-400 ring-1 ring-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    {t(`method_${m}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("amount")} ({currency})</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 text-xs" />
            </div>

            {MOBILE_MONEY_METHODS.includes(method) && (
              <div className="space-y-1">
                <Label>{t("phone_number")}</Label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+237 6XX XXX XXX"
                  className="h-9 text-xs"
                />
              </div>
            )}

            {!MOBILE_MONEY_METHODS.includes(method) && (
              <div className="space-y-1">
                <Label>{t("reference_optional")}</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 text-xs" />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {pendingPaymentId ? tc("close") : t("close")}
          </Button>
          {!pendingPaymentId && (
            <Button disabled={isSaving} onClick={handleSubmit} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("record_payment")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
