import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface InboxItemResponse {
  id: string;
  type: "topic" | "meeting";
  title: string;
  summary: string | null;
  sourceData: Record<string, unknown>;
  status: string;
  topicId: string | null;
  meetingId: string | null;
  tldvUrl: string | null;
  createdAt: string;
}

/**
 * GET /api/company-brain/inbox
 * List pending inbox items for the organization
 */
export async function GET() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const { data: items, error } = await supabaseAdmin
      .from("inbox_items")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch inbox items" },
        { status: 500 }
      );
    }

    const response: InboxItemResponse[] = items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      summary: item.summary,
      sourceData: item.source_data || {},
      status: item.status,
      topicId: item.topic_id,
      meetingId: item.meeting_id,
      tldvUrl: item.tldv_url,
      createdAt: item.created_at,
    }));

    return NextResponse.json({ items: response, count: response.length });
  } catch (error) {
    console.error("Error fetching inbox items:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

