import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// Per-conversation figures for a user's inbox, computed in ONE query instead of one
// `message.count` per conversation (N+1) plus a nested `messages: { take: 1 }` include.
// Both correlated subqueries use the (conversation_id, created_at) index on messages.
//
// Raw SQL because Prisma can't express "count where created_at > this row's lastReadAt"
// across many rows. Every value is a bound parameter (Prisma.sql), never interpolated text.

const PREVIEW_LENGTH = 160;

export interface ConversationSummary {
  conversationId: string;
  unreadCount: number;
  lastMessagePreview: string | null;
}

export async function getConversationSummaries(userId: string): Promise<Map<string, ConversationSummary>> {
  const rows = await prisma.$queryRaw<ConversationSummary[]>(Prisma.sql`
    SELECT
      cp.conversation_id::text AS "conversationId",
      (
        SELECT COUNT(*)::int
        FROM "tenant_template"."messages" m
        WHERE m.conversation_id = cp.conversation_id
          AND m.sender_id <> cp.user_id
          AND m.created_at > COALESCE(cp.last_read_at, 'epoch'::timestamptz)
      ) AS "unreadCount",
      (
        SELECT LEFT(m.body, ${PREVIEW_LENGTH})
        FROM "tenant_template"."messages" m
        WHERE m.conversation_id = cp.conversation_id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS "lastMessagePreview"
    FROM "tenant_template"."conversation_participants" cp
    WHERE cp.user_id = ${userId}::uuid
  `);
  return new Map(rows.map((row) => [row.conversationId, row]));
}

// Total unread messages across the user's conversations — what the navigation badge
// needs, without loading the conversation list at all.
export async function getUnreadMessagesCount(userId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "tenant_template"."messages" m
    JOIN "tenant_template"."conversation_participants" cp
      ON cp.conversation_id = m.conversation_id AND cp.user_id = ${userId}::uuid
    WHERE m.sender_id <> cp.user_id
      AND m.created_at > COALESCE(cp.last_read_at, 'epoch'::timestamptz)
  `);
  return row?.count ?? 0;
}
