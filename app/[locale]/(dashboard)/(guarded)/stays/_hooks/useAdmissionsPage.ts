import { useState, useEffect, useCallback } from "react";
import { StayRow, Department, Doctor, Bed, NewStayForm, EMPTY_VITALS } from "../types";
import { DEFAULT_PAGE_SIZE } from "@/components/shared/pagination-bar";

export type StayFilters = { status: string; type: string };
const EMPTY_FILTERS: StayFilters = { status: "", type: "" };

const EMPTY_FORM: NewStayForm = {
  patientId: "",
  type: "emergency",
  admissionReason: "",
  departmentId: "",
  bedId: "",
  attendingDoctorId: "",
  triageAcuity: "",
  medicalActCode: "",
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
  const [view, setViewState] = useState<"all" | "triage">("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFiltersState] = useState<StayFilters>(EMPTY_FILTERS);

  // Form
  const [stayForm, setStayForm] = useState<NewStayForm>(EMPTY_FORM);
  const [savingStay, setSavingStay] = useState(false);
  const [stayError, setStayError] = useState<string | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchStays = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/v1/stays", window.location.origin);
      if (view === "triage") {
        url.searchParams.set("type", "emergency");
        url.searchParams.set("status", "in_progress");
        url.searchParams.set("sort", "acuity");
      } else {
        if (filters.status) url.searchParams.set("status", filters.status);
        if (filters.type) url.searchParams.set("type", filters.type);
      }
      if (search) url.searchParams.set("q", search);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(pageSize));
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load stays");
      setStays(json.data as StayRow[]);
      setTotal(json.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stays");
      setStays([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [view, filters, search, page, pageSize]);

  useEffect(() => {
    (async () => {
      await fetchStays();
    })();
  }, [fetchStays]);

  // Debounced search; any change of search, filter, view or page size restarts at page 1.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const setView = useCallback((next: "all" | "triage") => {
    setViewState(next);
    setPage(1);
  }, []);
  const setFilters = useCallback((next: StayFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

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
          medicalActCode: stayForm.medicalActCode || undefined,
          vitals: stayForm.vitals,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to create stay");

      // Newest admission first: back to page 1 so the one just created is on top.
      if (page === 1) await fetchStays();
      else setPage(1);
      return true;
    } catch (e) {
      setStayError(e instanceof Error ? e.message : "Failed to create stay");
      return false;
    } finally {
      setSavingStay(false);
    }
  }, [savingStay, stayForm, fetchStays, page]);

  return {
    // Data
    stays, departments, doctors, beds, loading, error,
    view, setView,
    total, page, setPage, pageSize, setPageSize,
    searchInput, setSearchInput, filters, setFilters,
    // Form
    stayForm, updateStayForm, resetForm,
    savingStay, stayError,
    handleSaveStay,
  };
}