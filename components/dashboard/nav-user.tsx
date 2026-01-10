"use client"

import * as React from "react"
import {
  ChevronsUpDown,
  LogOut,
  Settings,
} from "lucide-react"
import { useClerk, UserProfile } from "@clerk/nextjs"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const { signOut } = useClerk()
  const initials = getInitials(user.name || "U")
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="min-w-250 p-0 overflow-hidden border-neutral-800 bg-neutral-950" showCloseButton={false}>
          <DialogTitle className="sr-only">User Settings</DialogTitle>
          <UserProfile 
            routing="virtual"
            appearance={{
              variables: {
                colorBackground: "#0a0a0a",
                colorInputBackground: "#171717",
                colorInputText: "#fafafa",
                colorText: "#fafafa",
                colorTextSecondary: "#a3a3a3",
                colorPrimary: "#fafafa",
                colorTextOnPrimaryBackground: "#000000",
                colorDanger: "#ef4444",
                colorSuccess: "#22c55e",
                colorWarning: "#f59e0b",
                colorNeutral: "#a3a3a3",
                borderRadius: "0.5rem",
              },
              elements: {
                rootBox: "w-full",
                cardBox: "shadow-none w-full bg-neutral-950",
                navbar: "hidden",
                pageScrollBox: "p-0",
                headerTitle: "text-white",
                headerSubtitle: "text-neutral-400",
                formButtonPrimary: "bg-white !text-black hover:bg-neutral-200",
                formFieldInput: "bg-neutral-900 border-neutral-800 text-white",
                formFieldLabel: "text-neutral-300",
                profileSectionTitleText: "text-white",
                profileSectionContent: "text-neutral-300",
                accordionTriggerButton: "text-white",
                badge: "bg-neutral-800 text-neutral-300",
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
