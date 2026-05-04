import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  LayoutDashboard, Users, BookOpen,
  UserCircle2, Shield, LogOut,
  FolderKanban, Inbox, Package, Clock,
  Sparkles, ExternalLink, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReactNode } from "react";

const nav = [
  { to: "/directory", label: "Directory", icon: UserCircle2 },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/time", label: "Time & Pay", icon: Clock },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/docs", label: "Docs & Training", icon: BookOpen },
];

const adminNav = [
  { to: "/team-admin", label: "Team Members", icon: Shield },
  { to: "/intake", label: "Intake", icon: Inbox },
  { to: "/catalog", label: "Catalog", icon: Package },
  { to: "/rewards", label: "$RHOZE Rewards", icon: Sparkles },
];

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent",
  );
}

function collapsedNavClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center justify-center h-9 w-9 mx-auto rounded-md transition-colors",
    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent",
  );
}

function CollapsedTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function TeamLayout() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("team-sidebar-collapsed") === "1";
  });
  useEffect(() => {
    localStorage.setItem("team-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-nav", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, display_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const accountLabel = (() => {
    const name = (profile?.display_name || user?.email || "").trim();
    if (!name) return "Account";
    const first = name.split(/[\s@]/)[0];
    return `${first}'s Account`;
  })();
  const initials = (profile?.display_name || user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <TooltipProvider delayDuration={0}>
    <div className="min-h-screen bg-background text-foreground flex">
      <aside
        className={cn(
          "border-r border-border bg-card flex flex-col transition-[width] duration-200",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <div
          className={cn(
            "border-b border-border flex items-center",
            collapsed ? "px-2 py-3 justify-center" : "px-5 py-5 justify-between",
          )}
        >
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold tracking-wider uppercase">Rhozeland</div>
              <div className="text-xs text-muted-foreground">Team Portal</div>
            </div>
          )}
          <Button
            onClick={() => setCollapsed((c) => !c)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </Button>
        </div>
        <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
          {(() => {
            const settingsLink = (
              <NavLink to="/settings" className={collapsed ? collapsedNavClass : navClass}>
                <Avatar className="h-5 w-5">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                {!collapsed && accountLabel}
              </NavLink>
            );
            return collapsed ? <CollapsedTip label={accountLabel}>{settingsLink}</CollapsedTip> : settingsLink;
          })()}
          {nav.map((n) => {
            const link = (
              <NavLink to={n.to} end={n.end} className={collapsed ? collapsedNavClass : navClass}>
                <n.icon size={16} />
                {!collapsed && n.label}
              </NavLink>
            );
            return collapsed ? (
              <CollapsedTip key={n.to} label={n.label}>{link}</CollapsedTip>
            ) : (
              <span key={n.to}>{link}</span>
            );
          })}
          {isAdmin && (
            <>
              {!collapsed && (
                <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Admin</div>
              )}
              {collapsed && <div className="my-2 mx-auto w-6 border-t border-border" />}
              {adminNav.map((n) => {
                const link = (
                  <NavLink to={n.to} className={collapsed ? collapsedNavClass : navClass}>
                    <n.icon size={16} />
                    {!collapsed && n.label}
                  </NavLink>
                );
                return collapsed ? (
                  <CollapsedTip key={n.to} label={n.label}>{link}</CollapsedTip>
                ) : (
                  <span key={n.to}>{link}</span>
                );
              })}
            </>
          )}
        </nav>
        <div className={cn("border-t border-border space-y-2", collapsed ? "p-2" : "p-3")}>
          {!collapsed && (
            <>
              <div className="text-xs text-muted-foreground truncate px-1">{user?.email}</div>
              <a
                href="https://www.rhozeland.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-1"
              >
                <ExternalLink size={12} /> Rhozeland.com
              </a>
            </>
          )}
          {collapsed ? (
            <CollapsedTip label="Sign out">
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="icon"
                className="h-9 w-9 mx-auto"
                aria-label="Sign out"
              >
                <LogOut size={14} />
              </Button>
            </CollapsedTip>
          ) : (
            <Button onClick={handleSignOut} variant="outline" size="sm" className="w-full">
              <LogOut size={14} /> Sign out
            </Button>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}
