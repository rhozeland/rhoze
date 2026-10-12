import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  LayoutDashboard, Users, BookOpen,
  UserCircle2, Shield, LogOut, Calendar,
  FolderKanban, Inbox, Package, Clock,
  Sparkles, ExternalLink, PanelLeftClose, PanelLeftOpen, MessageSquare, Trophy, Menu, X, Radio, Newspaper, Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccentPicker } from "@/components/AccentPicker";
import { canAccessSection, loadSectionAccess } from "../lib/access";

const nav = [
  { to: "/directory", label: "Directory", icon: Calendar },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/time", label: "Time & Pay", icon: Clock },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/docs", label: "Docs & Training", icon: BookOpen },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/live-editor", label: "Live Editor", icon: Radio },
  { to: "/newsroom", label: "Newsroom", icon: Newspaper },
];

const adminNav = [
  { to: "/team-admin", label: "Admin portal", icon: Shield },
  { to: "/intake", label: "Intake", icon: Inbox },
  { to: "/requests", label: "Credit requests", icon: MessageSquare },
  { to: "/catalog", label: "Catalog", icon: Package },
  { to: "/rewards", label: "$RHOZE Rewards", icon: Sparkles },
  { to: "/invest", label: "Investor pledges", icon: Rocket },
  { to: "/payouts", label: "Payouts", icon: Package },
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

export default function TeamLayout() {
  const { user, isAdmin, department, roles, signOut } = useAuth();
  const accessMap = loadSectionAccess();
  const visibleNav = nav.filter((n) => (n.to === "/leaderboard" && roles.includes("marketing")) || canAccessSection(n.to, { isAdmin, department }, accessMap));
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("team-sidebar-collapsed") === "1";
  });
  // Mobile drawer is separate state — sidebar collapse only applies on md+.
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarCollapsed = collapsed && !mobileOpen;
  // Close the drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);
  useEffect(() => {
    localStorage.setItem("team-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-nav", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, display_name")
        .eq("id", user.id)
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

  // Embedded mode: the portal is rendered inside the main site's inline section
  // viewer. Drop the sidebar shell entirely and present every section as a
  // compact tab strip + bounded panel so it reads as one unified dashboard.
  const embedded = (() => {
    if (typeof window === "undefined") return false;
    try {
      if (new URLSearchParams(window.location.search).get("embed") === "1") return true;
      return window.self !== window.top;
    } catch {
      return true; // cross-origin frame access throws — we're embedded
    }
  })();

  if (embedded) {
    const tabs = [...visibleNav, ...(isAdmin ? adminNav : [])];
    return (
      <div className="bg-background text-foreground">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
                )
              }
              title={accountLabel}
            >
              <Avatar className="h-4 w-4">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline">Account</span>
            </NavLink>
            <span className="shrink-0 h-4 w-px bg-border" />
            {tabs.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={(n as { end?: boolean }).end}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
                  )
                }
              >
                <n.icon size={13} />
                {n.label}
              </NavLink>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="max-h-[72vh] overflow-y-auto p-3 sm:p-5">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-layout min-h-screen bg-background text-foreground md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <Button
          type="button" variant="ghost" size="icon"
          aria-expanded={mobileOpen} aria-controls="team-sidebar"
          onClick={() => setMobileOpen(true)}
          aria-label="Open team menu"
          className="h-11 w-11 inline-flex items-center justify-center rounded-md text-foreground hover:bg-accent"
        >
          <Menu size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Team portal</span>
        </div>
        <NavLink
          to="/settings"
          className="h-11 w-11 inline-flex items-center justify-center rounded-md"
          aria-label="My account"
        >
          <Avatar className="h-7 w-7">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </NavLink>
      </header>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        id="team-sidebar" aria-label="Team navigation"
        className={cn(
          "team-sidebar border-r border-border bg-card flex flex-col transition-transform duration-200",
          // Mobile: off-canvas drawer
          "fixed inset-y-0 left-0 z-50 w-64 md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Desktop width — respects the collapse toggle
          collapsed ? "md:w-14" : "md:w-60",
        )}
      >
        <div
          className={cn(
            "border-b border-border flex items-center",
            sidebarCollapsed ? "px-2 py-3 justify-center" : "px-5 py-5 justify-between",
          )}
        >
          {!sidebarCollapsed && (
            <NavLink
              to="/settings"
              className="flex items-center gap-2 group"
              title="My Profile"
            >
              <div>
                <div className="text-sm font-semibold group-hover:text-primary transition-colors">Team portal</div>
                <div className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Workspace"}</div>
              </div>
            </NavLink>
          )}
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setCollapsed((c) => !c)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hidden md:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </Button>
            <Button
              onClick={() => setMobileOpen(false)}
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 md:hidden"
              aria-label="Close team menu"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
        <nav onClick={() => setMobileOpen(false)} className={cn("flex-1 space-y-1 overflow-y-auto", sidebarCollapsed ? "p-2" : "p-3")}>
          <NavLink to="/settings" className={sidebarCollapsed ? collapsedNavClass : navClass} title={sidebarCollapsed ? accountLabel : undefined}>
            <Avatar className="h-5 w-5">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && accountLabel}
          </NavLink>
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={sidebarCollapsed ? collapsedNavClass : navClass} title={sidebarCollapsed ? n.label : undefined}>
              <n.icon size={16} />
              {!sidebarCollapsed && n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Admin</div>
              )}
              {sidebarCollapsed && <div className="my-2 mx-auto w-6 border-t border-border" />}
              {adminNav.map((n) => (
                <NavLink key={n.to} to={n.to} className={sidebarCollapsed ? collapsedNavClass : navClass} title={sidebarCollapsed ? n.label : undefined}>
                  <n.icon size={16} />
                  {!sidebarCollapsed && n.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className={cn("border-t border-border space-y-2", sidebarCollapsed ? "p-2" : "p-3")}>
          {!sidebarCollapsed && (
            <>
              <div className="text-xs text-muted-foreground truncate px-1">{user?.email}</div>
              <a
                href="/"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-1"
              >
                <ExternalLink size={12} /> Back to website
              </a>
            </>
          )}
          <ThemeToggle collapsed={sidebarCollapsed} />
          <AccentPicker collapsed={sidebarCollapsed} />
          <Button
            onClick={handleSignOut}
            variant="outline"
            size={sidebarCollapsed ? "icon" : "sm"}
            className={sidebarCollapsed ? "h-9 w-9 mx-auto" : "w-full"}
            aria-label="Sign out"
            title={sidebarCollapsed ? "Sign out" : undefined}
          >
            <LogOut size={14} /> {!sidebarCollapsed && "Sign out"}
          </Button>
        </div>
      </aside>
      <main className="team-content flex-1 overflow-auto min-w-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
