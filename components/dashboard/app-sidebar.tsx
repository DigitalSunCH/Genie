"use client";

import Image from "next/image";
import { Store, User } from "lucide-react";
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

// Logo component for Digital Sun
function DigitalSunLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Digital Sun"
      width={16}
      height={16}
      className={className}
    />
  );
}

const teams = [
  {
    name: "Digital Sun",
    logo: DigitalSunLogo,
    plan: "Owner",
  },
  {
    name: "Tante Tina",
    logo: Store,
    plan: "Launch Ramp",
  },
  {
    name: "Rolf",
    logo: User,
    plan: "Personal",
  },
];

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUser();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
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
