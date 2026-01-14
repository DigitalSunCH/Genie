import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET - Get all shares for a chat
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  const { id: chatId } = await params;

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First verify the chat belongs to the current organization
  // Chats can only be shared within the same organization
  const { data: chat } = await supabaseAdmin
    .from("company_brain_chats")
    .select("*")
    .eq("id", chatId)
    .eq("organization_id", orgId)
    .single();

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Verify user has access (owner or shared with)
  const isOwner = chat.created_by === userId;
  if (!isOwner) {
    const { data: share } = await supabaseAdmin
      .from("company_brain_chat_shares")
      .select("*")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .single();

    if (!share) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Get all shares for this chat
  const { data: shares, error } = await supabaseAdmin
    .from("company_brain_chat_shares")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shares });
}

// POST - Add a share
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  const { id: chatId } = await params;

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { targetUserId, userEmail, userName, permission = "view" } = body;

  if (!targetUserId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  // Verify user owns this chat
  const { data: chat } = await supabaseAdmin
    .from("company_brain_chats")
    .select("*")
    .eq("id", chatId)
    .eq("organization_id", orgId)
    .eq("created_by", userId)
    .single();

  if (!chat) {
    return NextResponse.json(
      { error: "Chat not found or you don't have permission to share" },
      { status: 404 }
    );
  }

  // Don't allow sharing with yourself
  if (targetUserId === userId) {
    return NextResponse.json(
      { error: "You cannot share with yourself" },
      { status: 400 }
    );
  }

  // Add the share
  const { data: share, error } = await supabaseAdmin
    .from("company_brain_chat_shares")
    .upsert(
      {
        chat_id: chatId,
        user_id: targetUserId,
        user_email: userEmail,
        user_name: userName,
        permission,
        shared_by: userId,
      },
      { onConflict: "chat_id,user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ share });
}

// DELETE - Remove a share
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  const { id: chatId } = await params;

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shareUserId = searchParams.get("userId");

  if (!shareUserId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  // Verify user owns this chat
  const { data: chat } = await supabaseAdmin
    .from("company_brain_chats")
    .select("*")
    .eq("id", chatId)
    .eq("organization_id", orgId)
    .eq("created_by", userId)
    .single();

  if (!chat) {
    return NextResponse.json(
      { error: "Chat not found or you don't have permission" },
      { status: 404 }
    );
  }

  // Remove the share
  const { error } = await supabaseAdmin
    .from("company_brain_chat_shares")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", shareUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

