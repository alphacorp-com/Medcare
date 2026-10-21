import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appointmentConflictsAt, availabilityIssueAt, DEFAULT_CONFLICT_WINDOW_MINUTES } from "@/lib/scheduling/conflicts";

const at = (iso: string) => new Date(iso);
const candidate = (id: string, iso: string) => ({ id, scheduledAt: at(iso), patient: { firstName: "Ada", lastName: "N" } });

describe("appointmentConflictsAt", () => {
  const booked = [candidate("a", "2026-11-02T09:00:00"), candidate("b", "2026-11-09T09:00:00")];

  it("flags appointments within the conflict window", () => {
    const conflicts = appointmentConflictsAt(booked, at("2026-11-02T10:00:00"), 30);
    assert.deepEqual(conflicts.map((c) => c.appointmentId), ["a"]);
    assert.equal(conflicts[0].patientName, "Ada N");
  });

  it("ignores appointments outside the window", () => {
    const outside = new Date(at("2026-11-02T09:00:00").getTime() + (DEFAULT_CONFLICT_WINDOW_MINUTES + 1) * 60_000);
    assert.deepEqual(appointmentConflictsAt(booked, outside, 30), []);
  });

  it("widens the window for long appointments", () => {
    const threeHoursLater = at("2026-11-02T12:00:00");
    assert.deepEqual(appointmentConflictsAt(booked, threeHoursLater, 30), []);
    assert.deepEqual(appointmentConflictsAt(booked, threeHoursLater, 200).map((c) => c.appointmentId), ["a"]);
  });

  it("checks each occurrence of a series against the same loaded list", () => {
    const series = [at("2026-11-02T09:15:00"), at("2026-11-09T14:00:00"), at("2026-11-16T09:00:00")];
    assert.deepEqual(series.map((d) => appointmentConflictsAt(booked, d, 30).length), [1, 0, 0]);
  });
});

describe("availabilityIssueAt", () => {
  // 2026-11-02 is a Monday (weekday 1).
  const windows = [{ weekday: 1, startTime: "08:00", endTime: "12:00" }];

  it("accepts anything when no availability is configured", () => {
    assert.equal(availabilityIssueAt([], at("2026-11-04T03:00:00")), null);
  });

  it("accepts a time inside a window, end excluded", () => {
    assert.equal(availabilityIssueAt(windows, at("2026-11-02T08:00:00")), null);
    assert.equal(availabilityIssueAt(windows, at("2026-11-02T11:59:00")), null);
    assert.ok(availabilityIssueAt(windows, at("2026-11-02T12:00:00")));
  });

  it("rejects a day without any window", () => {
    assert.match(availabilityIssueAt(windows, at("2026-11-03T09:00:00")) ?? "", /day of the week/);
  });
});
