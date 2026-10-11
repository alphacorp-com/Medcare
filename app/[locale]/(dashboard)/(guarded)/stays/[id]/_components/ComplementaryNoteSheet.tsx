"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { FilePlus2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// A signed note added after the consultation note — typically once exam results come
// back (interpretation, change of treatment), or whenever the doctor needs to add to the record.
export function ComplementaryNoteSheet({
  open,
  onOpenChange,
  patientId,
  stayId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  stayId: string;
  onDone: () => void;
}) {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const { data: session } = useSession();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!session?.user?.id || !content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/patients/${patientId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "complementary_note",
          stayId,
          authorId: session.user.id,
          title: title.trim() || null,
          content: content.trim(),
          isSigned: true,
          signedAt: new Date().toISOString(),
          signedBy: session.user.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t("error_save"));
      toast.success(t("complementary_note_saved"));
      setTitle("");
      setContent("");
      onOpenChange(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-blue-600" /> {t("complementary_note")}
          </SheetTitle>
          <SheetDescription className="text-xs">{t("complementary_note_desc")}</SheetDescription>
        </SheetHeader>

        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("complementary_note_title_placeholder")}
            className="text-sm bg-white"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("complementary_note_placeholder")}
            className="min-h-[260px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
          />
        </div>

        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-9" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button className="text-xs h-9 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving || !content.trim()}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
            {t("sign_complementary_note")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
