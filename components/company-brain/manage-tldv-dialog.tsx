"use client";

import * as React from "react";
import { Loader2, Video, Trash2, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

function TldvIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
    </svg>
  );
}

interface TldvEmail {
  id: string;
  email: string;
  created_at: string;
}

interface ManageTldvDialogProps {
  emails?: TldvEmail[];
  isLoading?: boolean;
  onEmailAdded?: (email: string) => void;
  onEmailRemoved?: (emailId: string) => void;
}

export function ManageTldvDialog({
  emails = [],
  isLoading = false,
  onEmailAdded,
  onEmailRemoved,
}: ManageTldvDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const emailCount = emails.length;

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) return;

    setIsAdding(true);
    try {
      onEmailAdded?.(newEmail.trim());
      setNewEmail("");
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full font-bold">
          <TldvIcon className="size-4" />
          {isLoading
            ? "Loading..."
            : `${emailCount} meeting${emailCount !== 1 ? "s" : ""}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>TLDV Meeting Recordings</DialogTitle>
          <DialogDescription>
            Add email addresses to capture meeting recordings from TLDV.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Add new email input */}
          <div className="flex gap-2 mb-4">
            <Input
              type="email"
              placeholder="Enter participant email..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAdding}
            />
            <Button
              size="sm"
              onClick={handleAddEmail}
              disabled={!newEmail.trim() || !newEmail.includes("@") || isAdding}
            >
              {isAdding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="size-12 mx-auto mb-4 opacity-50" />
              <p>No email addresses added yet.</p>
              <p className="text-xs mt-1">
                Add email addresses of meeting participants to capture their TLDV
                recordings.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-center justify-between rounded-md border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                        <Video className="size-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{email.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Added {new Date(email.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEmailRemoved?.(email.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

