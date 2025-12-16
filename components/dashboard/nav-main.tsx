"use client";

import { ChartNoAxesColumn, Brain, CheckSquare, Calendar, Map } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Dashboard",
    icon: ChartNoAxesColumn,
    url: "/dashboard",
  },
  {
    title: "Company Brain",
    icon: Brain,
    url: "/company-brain",
  },
  {
    title: "Tasks",
    icon: CheckSquare,
    url: "/tasks",
  },
  {
    title: "Kalender",
    icon: Calendar,
    url: "/kalender",
  },
  {
    title: "Roadmap",
    icon: Map,
    url: "/roadmap",
  },
];

export function NavMain() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive(item.url)}
              >
                <Link href={item.url}>
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

