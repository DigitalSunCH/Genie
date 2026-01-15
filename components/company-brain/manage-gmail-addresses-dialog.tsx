"use client";

import * as React from "react";
import Image from "next/image";
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
        <Button variant="outline" size="sm" className="rounded-full">
          <Image src="/gmail.png" alt="Gmail" width={16} height={16} />
          {isLoading
            ? "Loading..."
            : `${addressCount} Email${addressCount !== 1 ? "s" : ""}`}
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
                      <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                        <Image src="/gmail.png" alt="Gmail" width={16} height={16} />
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

