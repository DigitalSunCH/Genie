"use client";

import * as React from "react";
import { Loader2, Users } from "lucide-react";
import { useOrganization, useUser } from "@clerk/nextjs";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Share {
  id: string;
  chat_id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  permission: "edit";
  shared_by: string;
  created_at: string;
}

interface ShareChatDialogProps {
  chatId: string;
  chatTitle: string;
  createdBy: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Permission = "none" | "edit";

export function ShareChatDialog({
  chatId,
  chatTitle,
  createdBy,
  open,
  onOpenChange,
}: ShareChatDialogProps) {
  const { user: currentUser } = useUser();
  const { memberships } = useOrganization({
    memberships: {
      infinite: true,
    },
  });

  const [shares, setShares] = React.useState<Share[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [permissions, setPermissions] = React.useState<Record<string, Permission>>({});

  // Get organization members (excluding current user)
  const orgMembers = React.useMemo(() => {
    if (!memberships?.data || !currentUser) return [];
    return memberships.data
      .filter((m) => m.publicUserData.userId !== currentUser.id)
      .map((m) => ({
        id: m.id,
        userId: m.publicUserData.userId || "",
        firstName: m.publicUserData.firstName,
        lastName: m.publicUserData.lastName,
        imageUrl: m.publicUserData.imageUrl,
        identifier: m.publicUserData.identifier,
      }));
  }, [memberships?.data, currentUser]);

  // Fetch shares when dialog opens
  React.useEffect(() => {
    if (open && chatId) {
      fetchShares();
    }
  }, [open, chatId]);

  // Initialize permissions from shares
  React.useEffect(() => {
    const newPermissions: Record<string, Permission> = {};
    
    // Set all members to "none" initially
    orgMembers.forEach((member) => {
      newPermissions[member.userId] = "none";
    });
    
    // Set permissions from existing shares
    shares.forEach((share) => {
      newPermissions[share.user_id] = share.permission;
    });
    
    setPermissions(newPermissions);
  }, [orgMembers, shares]);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/company-brain/chats/${chatId}/shares`);
      const data = await response.json();
      if (response.ok) {
        setShares(data.shares || []);
      }
    } catch (error) {
      console.error("Failed to fetch shares:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = (userId: string, permission: Permission) => {
    setPermissions((prev) => ({
      ...prev,
      [userId]: permission,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Process each member's permission
      for (const member of orgMembers) {
        const currentPermission = permissions[member.userId];
        const existingShare = shares.find((s) => s.user_id === member.userId);

        if (currentPermission === "none" && existingShare) {
          // Remove share
          await fetch(
            `/api/company-brain/chats/${chatId}/shares?userId=${member.userId}`,
            { method: "DELETE" }
          );
        } else if (currentPermission !== "none") {
          // Add or update share
          await fetch(`/api/company-brain/chats/${chatId}/shares`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetUserId: member.userId,
              userEmail: member.identifier,
              userName: `${member.firstName || ""} ${member.lastName || ""}`.trim(),
              permission: currentPermission,
            }),
          });
        }
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save shares:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getMemberName = (member: { firstName: string | null; lastName: string | null; identifier: string }) => {
    const firstName = member.firstName || "";
    const lastName = member.lastName || "";
    return `${firstName} ${lastName}`.trim() || member.identifier;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Share Chat
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{chatTitle}</p>
        </DialogHeader>

        <ScrollArea className="max-h-[350px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : orgMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No other members in this organization
            </p>
          ) : (
            <div className="space-y-3">
              {orgMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="size-9 flex-shrink-0">
                      <AvatarImage src={member.imageUrl} />
                      <AvatarFallback className="text-xs">
                        {getInitials(getMemberName(member))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getMemberName(member)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.identifier}
                      </p>
                    </div>
                  </div>
                  {member.userId === createdBy ? (
                    <span className="text-sm text-muted-foreground flex-shrink-0 w-28 text-right">
                      Creator
                    </span>
                  ) : (
                    <Select
                      value={permissions[member.userId] || "none"}
                      onValueChange={(v) => handlePermissionChange(member.userId, v as Permission)}
                    >
                      <SelectTrigger className="w-28 flex-shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No access</SelectItem>
                        <SelectItem value="edit">Can edit</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
