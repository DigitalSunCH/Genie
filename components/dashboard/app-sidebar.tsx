"use client";

import { Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { TeamSwitcher } from "./team-switcher";

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUser();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <Suspense fallback={null}>
          <NavMain />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.fullName || user?.firstName || "User",
            email: user?.primaryEmailAddress?.emailAddress || "",
            avatar: user?.imageUrl || "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
