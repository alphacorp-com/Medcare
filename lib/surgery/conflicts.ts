// Re-exported from the shared scheduling engine — surgery and appointment booking
// both need "is this resource already busy around this time", so the logic lives in
// one place (lib/scheduling/conflicts.ts) instead of being duplicated per module.
export {
  findSurgeryConflicts,
  type SurgeryConflictCheck,
  type SurgeryConflict,
} from "@/lib/scheduling/conflicts";
