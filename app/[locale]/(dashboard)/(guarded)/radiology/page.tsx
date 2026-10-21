import { getServerSession } from "next-auth/next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { authOptions } from "@/lib/auth";
import { hasModulePermission } from "@/lib/permissions";
import { listExams } from "@/lib/exams/exam-list";
import { examQueryKeys, INITIAL_EXAM_LIST_PARAMS } from "@/lib/exams/query-keys";
import { RadiologyPageClient } from "./_components/RadiologyPageClient";

// Server shell of the radiology worklist: the first page (no filter, no search) is loaded
// here with the same function and permission as GET /api/v1/radiology, and handed to the
// client cache under the key the page reads — the list shows up with the HTML instead of
// after a client-side request. Everything after that (filters, paging, refresh) goes
// through the API. Without the permission nothing is prefetched; the client page shows
// its restricted-access message as before.
export default async function RadiologyPage() {
  const queryClient = new QueryClient();
  const session = await getServerSession(authOptions);

  if (session?.user && hasModulePermission(session, "MODULE_RADIOLOGY", "read")) {
    const { filter, search, page, pageSize } = INITIAL_EXAM_LIST_PARAMS;
    try {
      const result = await listExams({
        tenantId: session.user.tenantId,
        domain: "radiology",
        filter: null,
        search: null,
        pagination: { page, pageSize, skip: (page - 1) * pageSize, take: pageSize },
      });
      // JSON round-trip: the cached value is exactly what the API would have returned.
      queryClient.setQueryData(
        examQueryKeys.list("radiology", { filter, search, page, pageSize }),
        JSON.parse(JSON.stringify(result))
      );
    } catch (error) {
      // The client loads it itself if the prefetch fails.
      console.error("[radiology page prefetch]", error);
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RadiologyPageClient />
    </HydrationBoundary>
  );
}
