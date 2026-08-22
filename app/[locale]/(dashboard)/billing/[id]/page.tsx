"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Plus, CreditCard, Pencil, Printer } from "lucide-react";
import { RecordPaymentDialog } from "./_components/RecordPaymentDialog";
import { AddLineDialog } from "./_components/AddLineDialog";
import { EditLineDialog } from "./_components/EditLineDialog";
import { InvoiceDetail, InvoiceLine, Payment } from "../types";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import { usePdfBranding } from "@/components/templates/usePdfBranding";
import type { PdfInvoiceData, PdfReceiptData } from "@/components/templates/types";

export default function InvoiceDetailPage() {
  const t = useTranslations("billing");
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAddLineOpen, setIsAddLineOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<InvoiceLine | null>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<Payment | null>(null);
  const { facility: pdfFacility, settings: pdfSettings } = usePdfBranding();

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/v1/billing/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load invoice");
      setInvoice(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchInvoice();
    })();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-sm">{error || t("invoice_not_found")}</div>
      </div>
    );
  }

  const subtotal = Number(invoice.subtotal);
  const insuranceAmount = Number(invoice.insuranceAmount);
  const patientAmount = Number(invoice.patientAmount);
  const paidAmount = Number(invoice.paidAmount);
  const outstanding = Math.max(0, patientAmount - paidAmount);
  const refundDue = Math.max(0, paidAmount - patientAmount);
  const hasInsuranceDiscount = insuranceAmount > 0;
  const canPay = invoice.status !== "paid" && invoice.status !== "cancelled" && outstanding > 0;
  const canAddLine = invoice.status !== "paid" && invoice.status !== "cancelled";

  const pdfInvoiceData: PdfInvoiceData = {
    number: invoice.id.slice(0, 8).toUpperCase(),
    date: format(new Date(invoice.createdAt), "PPP"),
    patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
    patientIpp: invoice.patient.ipp,
    status: t(invoice.status),
    items: invoice.lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      amount: Number(line.amount),
    })),
    subtotal,
    total: subtotal,
    insuranceAmount,
    patientAmount,
    paidAmount,
    refundDue,
  };

  const buildReceiptData = (payment: Payment): PdfReceiptData => ({
    receiptNumber: payment.id.slice(0, 8).toUpperCase(),
    date: format(new Date(payment.initiatedAt), "PPP"),
    patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
    patientIpp: invoice.patient.ipp,
    invoiceNumber: invoice.id.slice(0, 8).toUpperCase(),
    method: t(`method_${payment.method}`),
    amount: Number(payment.amount),
    currency: payment.currency,
    // The balance shown is the invoice's current outstanding balance, not a historical
    // snapshot as of this specific payment — payments aren't stored with a running total.
    balanceAfter: outstanding,
    isPaidInFull: invoice.status === "paid",
  });

  const statusBadgeClass = cn(
    "px-2.5 py-0.5 text-[10px] rounded-full uppercase font-bold tracking-wider ring-1",
    invoice.status === "paid" ? "bg-green-100 text-green-700 ring-green-200" :
    invoice.status === "partially_paid" ? "bg-yellow-100 text-yellow-700 ring-yellow-200" :
    invoice.status === "cancelled" ? "bg-slate-100 text-slate-500 ring-slate-200" :
    "bg-blue-100 text-blue-700 ring-blue-200"
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/billing" className="p-2 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 text-slate-500 transition-all active:scale-95">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {invoice.patient.firstName} {invoice.patient.lastName}
              </h1>
              <span className={statusBadgeClass}>{t(invoice.status)}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
              <span className="font-mono">IPP: {invoice.patient.ipp}</span>
              <span className="text-slate-300">|</span>
              <span>{invoice.stay ? `${t("stay")}: ${invoice.stay.stayNumber}` : t("outpatient")}</span>
              <span className="text-slate-300">|</span>
              <span>{format(new Date(invoice.createdAt), "PPP")}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsInvoicePreviewOpen(true)}>
            <Printer className="h-3.5 w-3.5 mr-2" /> {t("print_invoice")}
          </Button>
          {canAddLine && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsAddLineOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-2" /> {t("add_line")}
            </Button>
          )}
          {canPay && (
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => setIsPaymentOpen(true)}>
              <CreditCard className="h-3.5 w-3.5 mr-2" /> {t("record_payment")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {t("line_items")}
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{t("description")}</th>
                  <th className="px-4 py-2 text-right">{t("quantity")}</th>
                  <th className="px-4 py-2 text-right">{t("unit_price")}</th>
                  <th className="px-4 py-2 text-right">{t("total")}</th>
                  {canAddLine && <th className="px-4 py-2 w-8" />}
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="group">
                    <td className="px-4 py-2 text-slate-800">{line.description}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(line.quantity)}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(line.unitPrice).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{Number(line.amount).toLocaleString()}</td>
                    {canAddLine && (
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setEditingLine(line)}
                          className="text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={t("edit_line")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {invoice.lines.length === 0 && (
                  <tr>
                    <td colSpan={canAddLine ? 5 : 4} className="text-center py-6 text-slate-400 italic text-xs">{t("no_lines")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {t("payment_history")}
            </div>
            <div className="divide-y divide-slate-100">
              {invoice.payments.map((payment) => (
                <div key={payment.id} className="px-4 py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">{t(`method_${payment.method}`)}</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      {format(new Date(payment.initiatedAt), "PPP p")}
                      {payment.providerReference && <span className="ml-2 font-mono">{payment.providerReference}</span>}
                    </div>
                    {payment.failureReason && <div className="text-red-500 text-[10px] mt-0.5">{payment.failureReason}</div>}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="font-mono font-semibold">{Number(payment.amount).toLocaleString()} {payment.currency}</div>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] uppercase font-bold",
                          payment.status === "successful" ? "bg-green-100 text-green-700" :
                          payment.status === "failed" ? "bg-red-100 text-red-700" :
                          payment.status === "cancelled" ? "bg-slate-100 text-slate-500" :
                          "bg-yellow-100 text-yellow-700"
                        )}
                      >
                        {t(`payment_status_${payment.status}`)}
                      </span>
                    </div>
                    {payment.status === "successful" && (
                      <button
                        onClick={() => setReceiptPreview(payment)}
                        className="text-slate-300 hover:text-blue-600 transition-colors"
                        title={t("print_receipt")}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {invoice.payments.length === 0 && (
                <div className="text-center py-6 text-slate-400 italic text-xs">{t("no_payments")}</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded border border-slate-200 shadow-sm p-4 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t("summary")}</div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">{t("subtotal")}</span>
              <span className="font-mono text-slate-800">{subtotal.toLocaleString()} {invoice.currency}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">{t("insurance_amount")}</span>
              <span className="font-mono text-slate-800">{insuranceAmount.toLocaleString()} {invoice.currency}</span>
            </div>
            <div className="text-[10px]">
              <span className={hasInsuranceDiscount ? "text-green-600 font-semibold" : "text-slate-400 italic"}>
                {hasInsuranceDiscount ? t("insurance_discount_applied") : t("no_insurance_discount")}
              </span>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-slate-100">
              <span className="text-slate-500">{t("patient_amount")}</span>
              <span className="font-mono text-slate-800">{patientAmount.toLocaleString()} {invoice.currency}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">{t("paid")}</span>
              <span className="font-mono text-green-700">{paidAmount.toLocaleString()} {invoice.currency}</span>
            </div>
            {refundDue > 0 ? (
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-green-200 bg-green-50 -mx-4 px-4 py-2">
                <span className="text-green-800">{t("refund_due")}</span>
                <span className="text-green-800">{refundDue.toLocaleString()} {invoice.currency}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200">
                <span className="text-slate-900">{t("outstanding_balance")}</span>
                <span className="text-blue-700">{outstanding.toLocaleString()} {invoice.currency}</span>
              </div>
            )}
          </div>
          {invoice.notes && (
            <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t("notes")}</div>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      <RecordPaymentDialog
        key={`${invoice.id}-${isPaymentOpen}`}
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        invoiceId={invoice.id}
        outstanding={outstanding}
        currency={invoice.currency}
        onSaved={fetchInvoice}
      />
      <AddLineDialog open={isAddLineOpen} onOpenChange={setIsAddLineOpen} invoiceId={invoice.id} onSaved={fetchInvoice} />
      <EditLineDialog
        key={editingLine?.id ?? "none"}
        open={Boolean(editingLine)}
        onOpenChange={(open) => !open && setEditingLine(null)}
        invoiceId={invoice.id}
        line={editingLine}
        onSaved={fetchInvoice}
      />

      <PDFPreviewModal
        isOpen={isInvoicePreviewOpen}
        onClose={() => setIsInvoicePreviewOpen(false)}
        templateId="invoices"
        data={{ invoice: pdfInvoiceData }}
        facility={pdfFacility}
        settings={pdfSettings}
      />
      <PDFPreviewModal
        isOpen={Boolean(receiptPreview)}
        onClose={() => setReceiptPreview(null)}
        templateId="receipts"
        data={receiptPreview ? buildReceiptData(receiptPreview) : undefined}
        facility={pdfFacility}
        settings={pdfSettings}
      />
    </div>
  );
}
