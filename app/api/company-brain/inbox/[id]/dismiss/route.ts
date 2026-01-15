import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/company-brain/inbox/[id]/dismiss
 * Dismiss an inbox item (mark as not relevant)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get the inbox item
    const { data: item, error: itemError } = await supabaseAdmin
      .from("inbox_items")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Inbox item not found" },
        { status: 404 }
      );
    }

    if (item.status !== "pending") {
      return NextResponse.json(
        { error: "Item has already been processed" },
        { status: 400 }
      );
    }

    // Update inbox item status
    await supabaseAdmin
      .from("inbox_items")
      .update({
        status: "dismissed",
        processed_at: new Date().toISOString(),
        processed_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // If it's a topic, update the topic status too
    if (item.type === "topic" && item.topic_id) {
      await supabaseAdmin
        .from("inbox_topics")
        .update({
          status: "dismissed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.topic_id);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error dismissing inbox item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

