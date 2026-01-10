"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Building2, Settings } from "lucide-react"
import { useOrganization, useOrganizationList, OrganizationProfile, CreateOrganization } from "@clerk/nextjs"
import Image from "next/image"

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

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const { organization: activeOrg } = useOrganization()
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  })
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [createOrgOpen, setCreateOrgOpen] = React.useState(false)

  // Fetch all pages of organizations
  React.useEffect(() => {
    if (userMemberships?.hasNextPage) {
      userMemberships.fetchNext()
    }
  }, [userMemberships?.hasNextPage, userMemberships?.data?.length])

  const handleOrgSwitch = async (orgId: string) => {
    if (setActive) {
      await setActive({ organization: orgId })
    }
  }

  const handleOpenSettings = async (e: React.MouseEvent, orgId: string) => {
    e.stopPropagation()
    // First switch to the organization if not already active
    if (activeOrg?.id !== orgId && setActive) {
      await setActive({ organization: orgId })
    }
    setSettingsOpen(true)
  }

  const handleCreateOrg = () => {
    setCreateOrgOpen(true)
  }

  const handleCreateOrgClose = (open: boolean) => {
    setCreateOrgOpen(open)
    // Revalidate the list when dialog closes to show new org
    if (!open && userMemberships?.revalidate) {
      userMemberships.revalidate()
    }
  }

  if (!isLoaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="animate-pulse">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted" />
            <div className="grid flex-1 gap-1">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!activeOrg) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={handleCreateOrg}
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border bg-transparent">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Create Organization</span>
              <span className="truncate text-xs text-muted-foreground">Get started</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const organizations = userMemberships?.data ?? []

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
                <div className="flex aspect-square size-8 items-center justify-center">
                  {activeOrg.imageUrl ? (
                    <Image
                      src={activeOrg.imageUrl}
                      alt={activeOrg.name}
                      width={28}
                      height={28}
                      className="size-7 rounded-md"
                    />
                  ) : (
                    <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <Building2 className="size-4" />
                    </div>
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{activeOrg.name}</span>
                  <span className="truncate text-xs capitalize">
                    {organizations.find(m => m.organization.id === activeOrg.id)?.role?.toLowerCase().replace('org:', '') || 'member'}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Organizations
              </DropdownMenuLabel>
              {organizations.map((membership) => {
                const isActive = membership.organization.id === activeOrg?.id
                return (
                  <DropdownMenuItem
                    key={membership.organization.id}
                    onClick={() => handleOrgSwitch(membership.organization.id)}
                    className={`gap-2 p-2 ${isActive ? 'bg-accent' : ''}`}
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border overflow-hidden">
                      {membership.organization.imageUrl ? (
                        <Image
                          src={membership.organization.imageUrl}
                          alt={membership.organization.name}
                          width={24}
                          height={24}
                          className="size-6 object-cover"
                        />
                      ) : (
                        <Building2 className="size-3.5 shrink-0" />
                      )}
                    </div>
                    <span className="flex-1">{membership.organization.name}</span>
                    {isActive && (
                      <button
                        onClick={(e) => handleOpenSettings(e, membership.organization.id)}
                        className="cursor-pointer flex items-center gap-1.5 px-1 py-0.5 rounded-md border border-border text-xs text-muted-foreground transition-colors"
                      >
                        <Settings className="size-3" />
                        Manage
                      </button>
                    )}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 p-2" onClick={handleCreateOrg}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">Add organization</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="min-w-250 p-0 overflow-hidden border-neutral-800 bg-neutral-950" showCloseButton={false}>
          <DialogTitle className="sr-only">Organization Settings</DialogTitle>
          <OrganizationProfile 
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
                membersPageInviteButton: "bg-white !text-black hover:bg-neutral-200",
                tableHead: "text-neutral-400",
                tableCell: "text-neutral-300",
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={createOrgOpen} onOpenChange={handleCreateOrgClose}>
        <DialogContent className="p-0 border-neutral-800 bg-transparent overflow-hidden w-auto max-w-none" showCloseButton={false}>
          <DialogTitle className="sr-only">Create Organization</DialogTitle>
          <CreateOrganization 
            routing="virtual"
            skipInvitationScreen={true}
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
                cardBox: "shadow-none bg-neutral-950 border border-neutral-800",
                headerTitle: "text-white",
                headerSubtitle: "text-neutral-400",
                formButtonPrimary: "bg-white !text-black hover:bg-neutral-200",
                formFieldInput: "bg-neutral-900 border-neutral-800 text-white",
                formFieldLabel: "text-neutral-300",
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
