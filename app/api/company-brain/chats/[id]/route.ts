import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/company-brain/chats/[id] - Get chat with messages
export async function GET(
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

    // Get chat
    const { data: chat, error: chatError } = await supabaseAdmin
      .from("company_brain_chats")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (chatError || !chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      );
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("company_brain_messages")
      .select("*")
      .eq("chat_id", id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ chat, messages });
  } catch (error) {
    console.error("Error in GET /api/company-brain/chats/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/company-brain/chats/[id] - Update chat title
export async function PATCH(
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
    const body = await request.json();

    const { data: chat, error } = await supabaseAdmin
      .from("company_brain_chats")
      .update({ 
        title: body.title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) {
      console.error("Error updating chat:", error);
      return NextResponse.json(
        { error: "Failed to update chat" },
        { status: 500 }
      );
    }

    return NextResponse.json({ chat });
  } catch (error) {
    console.error("Error in PATCH /api/company-brain/chats/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/company-brain/chats/[id] - Delete chat
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

    const { error } = await supabaseAdmin
      .from("company_brain_chats")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      console.error("Error deleting chat:", error);
      return NextResponse.json(
        { error: "Failed to delete chat" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/company-brain/chats/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

