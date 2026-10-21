import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnreadMessagesCount } from "@/lib/messaging/conversation-summaries";

// GET /api/v1/conversations/unread-count — total unread messages of the current user, for
// the navigation badge. One aggregate query: the badge used to load (and re-load every
// 15 s) the whole conversation list just to sum its counters.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ count: await getUnreadMessagesCount(session.user.id) });
  } catch (error) {
    console.error("[GET /api/v1/conversations/unread-count]", error);
    return NextResponse.json({ error: "Failed to count unread messages" }, { status: 500 });
  }
}
