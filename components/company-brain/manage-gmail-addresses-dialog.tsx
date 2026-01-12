"use client";

import * as React from "react";
import { Loader2, Mail, Trash2, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

interface GmailAddress {
  id: string;
  email: string;
  created_at: string;
}

interface ManageGmailAddressesDialogProps {
  addresses?: GmailAddress[];
  isLoading?: boolean;
  onAddressAdded?: (email: string) => void;
  onAddressRemoved?: (addressId: string) => void;
}

export function ManageGmailAddressesDialog({
  addresses = [],
  isLoading = false,
  onAddressAdded,
  onAddressRemoved,
}: ManageGmailAddressesDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const addressCount = addresses.length;

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) return;
    
    setIsAdding(true);
    try {
      onAddressAdded?.(newEmail.trim());
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
          <GmailIcon className="size-4" />
          {isLoading
            ? "Loading..."
            : `${addressCount} email${addressCount !== 1 ? "s" : ""}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connected Gmail Addresses</DialogTitle>
          <DialogDescription>
            Add email addresses to sync with your Company Brain.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Add new email input */}
          <div className="flex gap-2 mb-4">
            <Input
              type="email"
              placeholder="Enter email address..."
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
          ) : addresses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="size-12 mx-auto mb-4 opacity-50" />
              <p>No email addresses added yet.</p>
              <p className="text-xs mt-1">Enter an email address above to get started.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className="flex items-center justify-between rounded-md border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                        <Mail className="size-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{address.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Added {new Date(address.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onAddressRemoved?.(address.id)}
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

