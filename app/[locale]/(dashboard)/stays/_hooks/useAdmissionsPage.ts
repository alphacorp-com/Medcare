import { useState, useEffect, useCallback } from "react";
import { StayRow, Department, Doctor, Bed, NewStayForm, EMPTY_VITALS } from "../types";

const EMPTY_FORM: NewStayForm = {
  patientId: "",
  type: "emergency",
  admissionReason: "",
  departmentId: "",
  bedId: "",
  attendingDoctorId: "",
  triageAcuity: "",
  vitals: EMPTY_VITALS,
};

export function useAdmissionsPage() {
  // Data
  const [stays, setStays] = useState<StayRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "triage">("all");

  // Form
  const [stayForm, setStayForm] = useState<NewStayForm>(EMPTY_FORM);
  const [savingStay, setSavingStay] = useState(false);
  const [stayError, setStayError] = useState<string | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchStays = useCallback(async (currentView: "all" | "triage") => {
    setLoading(true);
    setError(null);
    try {
      const url = currentView === "triage"
        ? "/api/v1/stays?type=emergency&status=in_progress&sort=acuity"
        : "/api/v1/stays";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load stays");
      setStays(json.data as StayRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stays");
      setStays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchStays(view);
    })();
  }, [fetchStays, view]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [deptRes, docRes, bedsRes] = await Promise.all([
        fetch("/api/v1/departments"),
        fetch("/api/v1/doctors"),
        fetch("/api/v1/settings/beds?status=available"),
      ]);
      const [deptJson, docJson, bedsJson] = await Promise.all([deptRes.json(), docRes.json(), bedsRes.json()]);

      if (cancelled) return;
      if (deptJson.success) setDepartments(deptJson.data as Department[]);
      if (docJson.success) setDoctors(docJson.data as Doctor[]);
      if (Array.isArray(bedsJson)) setBeds(bedsJson as Bed[]);
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  // ── Form helpers ──────────────────────────────────────────────────────────

  const updateStayForm = useCallback(
    <K extends keyof NewStayForm>(key: K, value: NewStayForm[K]) =>
      setStayForm((prev) =>
        key === "departmentId" && value !== prev.departmentId
          ? { ...prev, departmentId: value as string, bedId: "" }
          : { ...prev, [key]: value }
      ),
    []
  );

  const resetForm = useCallback(() => {
    setStayForm(EMPTY_FORM);
    setStayError(null);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSaveStay = useCallback(async (): Promise<boolean> => {
    if (savingStay || !stayForm.patientId) return false;

    setSavingStay(true);
    setStayError(null);

    try {
      const res = await fetch(`/api/v1/patients/${stayForm.patientId}/stays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: stayForm.type,
          admissionReason: stayForm.admissionReason || null,
          departmentId: stayForm.departmentId || null,
          bedId: stayForm.bedId || null,
          attendingDoctorId: stayForm.attendingDoctorId || null,
          triageAcuity: stayForm.triageAcuity || undefined,
          vitals: stayForm.vitals,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to create stay");

      await fetchStays(view);
      return true;
    } catch (e) {
      setStayError(e instanceof Error ? e.message : "Failed to create stay");
      return false;
    } finally {
      setSavingStay(false);
    }
  }, [savingStay, stayForm, fetchStays, view]);

  return {
    // Data
    stays, departments, doctors, beds, loading, error,
    view, setView,
    // Form
    stayForm, updateStayForm, resetForm,
    savingStay, stayError,
    handleSaveStay,
  };
}