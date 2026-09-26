"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Plus, Pencil, Trash2, Upload,
  BedDouble, HeartPulse, Baby, Users, Siren, Scissors, Ban, Stethoscope,
} from "lucide-react";
import { CsvImportDialog } from "./csv-import-dialog";
import {
  SettingsCode, SettingsList, SettingsListItem, SettingsPageHeader, SettingsSwatch, settingsActionButtonClass,
} from "./settings-ui";
import { cn } from "@/lib/utils";

const ICON_OPTIONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BedDouble, HeartPulse, Baby, Users, Siren, Scissors, Ban, Stethoscope,
};

type ReferenceCatalogItem = {
  id: string;
  code: string;
  nameFr: string;
  nameEn: string | null;
  color: string | null;
  icon: string | null;
  group: string | null;
  order: number;
  isActive: boolean;
};

export function ReferenceCatalogPage({
  catalogType,
  translationNamespace,
  showColor = false,
  showIcon = false,
  showGroup = false,
  allowCsvImport = false,
}: {
  catalogType: string;
  translationNamespace: string;
  showColor?: boolean;
  showIcon?: boolean;
  showGroup?: boolean;
  allowCsvImport?: boolean;
}) {
  const t = useTranslations(translationNamespace);
  const tc = useTranslations("common");
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [items, setItems] = useState<ReferenceCatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferenceCatalogItem | null>(null);

  const [code, setCode] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [color, setColor] = useState("#1565c0");
  const [icon, setIcon] = useState("");
  const [group, setGroup] = useState("");
  const [order, setOrder] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = `/api/v1/settings/reference-data/${catalogType}`;

  const fetchItems = async () => {
    try {
      const res = await fetch(baseUrl);
      const json = await res.json();
      setItems(Array.isArray(json) ? json : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchItems();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogType]);

  const openCreate = () => {
    setEditingItem(null);
    setCode("");
    setNameFr("");
    setNameEn("");
    setColor("#1565c0");
    setIcon("");
    setGroup("");
    setOrder("0");
    setError(null);
    setIsFormOpen(true);
  };

  const openEdit = (item: ReferenceCatalogItem) => {
    setEditingItem(item);
    setCode(item.code);
    setNameFr(item.nameFr);
    setNameEn(item.nameEn ?? "");
    setColor(item.color ?? "#1565c0");
    setIcon(item.icon ?? "");
    setGroup(item.group ?? "");
    setOrder(String(item.order));
    setError(null);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !nameFr.trim()) {
      setError(t("required_fields"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        code: code.trim(),
        nameFr: nameFr.trim(),
        nameEn: nameEn.trim() || undefined,
        color: showColor ? color : undefined,
        icon: showIcon ? icon : undefined,
        group: showGroup ? group.trim() || undefined : undefined,
        order: Number(order) || 0,
      };
      const res = editingItem
        ? await fetch(`${baseUrl}/${editingItem.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || t("save_error"));
        return;
      }
      setIsFormOpen(false);
      fetchItems();
    } catch {
      setError(t("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (item: ReferenceCatalogItem) => {
    await fetch(`${baseUrl}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    fetchItems();
  };

  const handleDelete = async (item: ReferenceCatalogItem) => {
    if (!window.confirm(t("confirm_delete", { name: item.nameFr }))) return;
    await fetch(`${baseUrl}/${item.id}`, { method: "DELETE" });
    fetchItems();
  };

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.nameFr.toLowerCase().includes(q) || item.code.toLowerCase().includes(q) || (item.nameEn ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <SettingsPageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            {allowCsvImport && (
              <Button size="sm" variant="outline" className={cn("h-8 text-xs", settingsActionButtonClass)} onClick={() => setIsImportOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-2" /> {tc("import_csv")}
              </Button>
            )}
            <Button size="sm" className={cn("h-8 text-xs bg-blue-600 hover:bg-blue-700", settingsActionButtonClass)} onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_item")}
            </Button>
          </>
        }
      />

      <SettingsList
        toolbar={
          <Input
            type="search"
            placeholder={tc("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 md:h-8 text-sm md:text-xs bg-white border-slate-200 md:max-w-sm"
          />
        }
        isLoading={isLoading}
        isEmpty={filtered.length === 0}
        emptyLabel={t("no_items")}
      >
        {filtered.map((item) => (
          <SettingsListItem
            key={item.id}
            leading={<SettingsSwatch color={item.color} icon={item.icon ? ICON_OPTIONS[item.icon] : null} />}
            title={item.nameFr}
            meta={
              <>
                {item.nameEn && <span>{item.nameEn}</span>}
                {item.group && <span>({item.group})</span>}
                <SettingsCode>{item.code}</SettingsCode>
              </>
            }
            active={{ value: item.isActive, onToggle: () => toggleActive(item) }}
            actions={[
              { label: tc("edit"), icon: Pencil, onClick: () => openEdit(item) },
              { label: tc("delete"), icon: Trash2, tone: "danger", onClick: () => handleDelete(item) },
            ]}
          />
        ))}
      </SettingsList>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? t("edit_item") : t("new_item")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{t("code")}</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} className="h-9 text-xs font-mono uppercase" />
              </div>
              <div className="space-y-1">
                <Label>{t("order")}</Label>
                <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("name_fr")}</Label>
              <Input value={nameFr} onChange={(e) => setNameFr(e.target.value)} className="h-9 text-xs" />
            </div>

            <div className="space-y-1">
              <Label>{t("name_en")}</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-9 text-xs" />
            </div>

            {showGroup && (
              <div className="space-y-1">
                <Label>{t("group")}</Label>
                <Input value={group} onChange={(e) => setGroup(e.target.value)} className="h-9 text-xs" />
              </div>
            )}

            {showColor && (
              <div className="space-y-1">
                <Label>{t("color")}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 rounded border border-slate-200" />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-9 text-xs font-mono" />
                </div>
              </div>
            )}

            {showIcon && (
              <div className="space-y-1">
                <Label>{t("icon")}</Label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                >
                  <option value="">—</option>
                  {Object.keys(ICON_OPTIONS).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={isSaving} onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {allowCsvImport && (
        <CsvImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          importUrl={baseUrl + "/import"}
          expectedColumns={["code", "nameFr", "nameEn", "color", "icon", "group"]}
          onImported={fetchItems}
        />
      )}
    </div>
  );
}
