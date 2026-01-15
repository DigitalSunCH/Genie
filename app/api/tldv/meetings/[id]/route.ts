import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteTldvMeetingRecords } from "@/lib/pinecone";

/**
 * DELETE /api/tldv/meetings/[id]
 * Delete a tldv meeting and its Pinecone records
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized - no organization selected" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get the meeting to verify ownership and get the meeting_id
    const { data: meeting, error: fetchError } = await supabaseAdmin
      .from("tldv_meetings")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (fetchError || !meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Delete from Pinecone first
    await deleteTldvMeetingRecords(orgId, meeting.meeting_id);

    // Delete from Supabase
    const { error: deleteError } = await supabaseAdmin
      .from("tldv_meetings")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete meeting" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: {
        id: meeting.id,
        meetingId: meeting.meeting_id,
        title: meeting.meeting_title,
      },
    });
  } catch (error) {
    console.error("Error deleting tldv meeting:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

