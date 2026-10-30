"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SettingsCode, SettingsList, SettingsListItem, SettingsPageHeader, SettingsPill, settingsActionButtonClass } from "@/components/settings/settings-ui";
import { useConfirm } from "@/components/providers/confirm-provider";

type Modality = { id: string; code: string; nameFr: string };
type Device = { id: string; code: string; label: string; isActive: boolean; modalityItemId: string | null; modality: Modality | null };
const EMPTY = { code: "", label: "", modalityItemId: "" };

// Imaging devices (booked by the radiology schedule) and the facility's radiology settings:
// PACS viewer link and double reading.
export default function ImagingDevicesPage() {
  const t = useTranslations("settings.imagingDevices");
  const tc = useTranslations("common");
  const confirm = useConfirm();

  const [devices, setDevices] = useState<Device[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [template, setTemplate] = useState("");
  const [secondReader, setSecondReader] = useState(false);
  const [settingsState, setSettingsState] = useState<{ saving: boolean; message: string | null; ok: boolean }>({ saving: false, message: null, ok: true });

  const errorText = (code: string | undefined) => (code && t.has(`errors.${code}`) ? t(`errors.${code}`) : code || t("save_error"));

  const fetchDevices = async () => {
    try {
      const res = await fetch("/api/v1/settings/imaging-devices");
      const json = await res.json();
      setDevices(json.data ?? []);
      setModalities(json.modalities ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchDevices();
      try {
        const res = await fetch("/api/v1/settings/radiology");
        if (res.ok) {
          const settings = await res.json();
          setTemplate(settings.pacsViewerUrlTemplate ?? "");
          setSecondReader(Boolean(settings.requireSecondReader));
        }
      } catch (err) {
        console.error("Failed to load radiology settings", err);
      }
    })();
  }, []);

  const openForm = (device: Device | null) => {
    setEditing(device);
    setForm(device ? { code: device.code, label: device.label, modalityItemId: device.modalityItemId ?? "" } : EMPTY);
    setError(null);
    setIsFormOpen(true);
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = { code: form.code, label: form.label, modalityItemId: form.modalityItemId || null };
      const res = editing
        ? await fetch(`/api/v1/settings/imaging-devices/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/v1/settings/imaging-devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(errorText(body?.error));
        return;
      }
      setIsFormOpen(false);
      await fetchDevices();
    } catch {
      setError(t("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (device: Device) => {
    await fetch(`/api/v1/settings/imaging-devices/${device.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !device.isActive }) });
    await fetchDevices();
  };

  const remove = async (device: Device) => {
    if (!(await confirm({ message: t("confirm_delete", { name: device.label }), tone: "danger" }))) return;
    const res = await fetch(`/api/v1/settings/imaging-devices/${device.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSettingsState({ saving: false, ok: false, message: errorText(body?.error) });
    }
    await fetchDevices();
  };

  const saveSettings = async () => {
    setSettingsState({ saving: true, message: null, ok: true });
    try {
      const res = await fetch("/api/v1/settings/radiology", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacsViewerUrlTemplate: template, requireSecondReader: secondReader }),
      });
      const body = await res.json().catch(() => ({}));
      setSettingsState({ saving: false, ok: res.ok, message: res.ok ? t("settings_saved") : errorText(body?.error) });
    } catch {
      setSettingsState({ saving: false, ok: false, message: t("save_error") });
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" className={cn("h-8 text-xs bg-blue-600 hover:bg-blue-700", settingsActionButtonClass)} onClick={() => openForm(null)}>
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_item")}
          </Button>
        }
      />

      {settingsState.message && !isFormOpen && (
        <p className={cn("text-xs", settingsState.ok ? "text-green-700" : "text-red-600")}>{settingsState.message}</p>
      )}

      <SettingsList isLoading={isLoading} isEmpty={devices.length === 0} emptyLabel={t("no_items")}>
        {devices.map((device) => (
          <SettingsListItem
            key={device.id}
            title={device.label}
            meta={
              <>
                <SettingsCode>{device.code}</SettingsCode>
                {device.modality && <SettingsPill>{device.modality.nameFr}</SettingsPill>}
              </>
            }
            active={{ value: device.isActive, onToggle: () => toggleActive(device) }}
            actions={[
              { label: tc("edit"), icon: Pencil, onClick: () => openForm(device) },
              { label: tc("delete"), icon: Trash2, tone: "danger", onClick: () => remove(device) },
            ]}
          />
        ))}
      </SettingsList>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t("radiology_settings")}</h3>
          <p className="text-xs text-slate-500">{t("radiology_settings_desc")}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("pacs_template")}</Label>
          <Input value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="https://pacs.example/ohif/viewer?AccessionNumber={accession}" className="font-mono text-xs" />
          <p className="text-[11px] text-slate-500">{t("pacs_template_hint")}</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={secondReader} onChange={(e) => setSecondReader(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            {t("second_reader")}
            <span className="block text-[11px] text-slate-500">{t("second_reader_hint")}</span>
          </span>
        </label>
        <Button size="sm" className="h-8 bg-slate-900 text-white hover:bg-slate-800" disabled={settingsState.saving} onClick={saveSettings}>
          {settingsState.saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {tc("save")}
        </Button>
      </section>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t("edit_item") : t("new_item")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            <div className="space-y-1">
              <Label>{t("code")}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-9 text-xs font-mono uppercase" placeholder="RX-1" />
            </div>
            <div className="space-y-1">
              <Label>{t("label")}</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="h-9 text-xs" placeholder={t("label_placeholder")} />
            </div>
            <div className="space-y-1">
              <Label>{t("modality")}</Label>
              <select
                value={form.modalityItemId}
                onChange={(e) => setForm({ ...form, modalityItemId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm"
              >
                <option value="">—</option>
                {modalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nameFr}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={isSaving} onClick={save} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
