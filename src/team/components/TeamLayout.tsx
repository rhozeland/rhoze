import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  LayoutDashboard, Users, BookOpen,
  UserCircle2, Shield, LogOut, Calendar,
  FolderKanban, Inbox, Package, Clock,
  Sparkles, ExternalLink, PanelLeftClose, PanelLeftOpen, MessageSquare, Trophy, Menu, X, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccentPicker } from "@/components/AccentPicker";
import rhozelandLogo from "@/assets/rhozeland-logo.webp";

const nav = [
  { to: "/directory", label: "Directory", icon: Calendar },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/time", label: "Time & Pay", icon: Clock },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/docs", label: "Docs & Training", icon: BookOpen },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/live-editor", label: "Live Editor", icon: Radio },
];

const adminNav = [
  { to: "/team-admin", label: "Team Members", icon: Shield },
  { to: "/intake", label: "Intake", icon: Inbox },
  { to: "/requests", label: "Credit requests", icon: MessageSquare },
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

export default function TeamLayout() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("team-sidebar-collapsed") === "1";
  });
  // Mobile drawer is separate state — sidebar collapse only applies on md+.
  const [mobileOpen, setMobileOpen] = useState(false);
  // Close the drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
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
    <div className="min-h-screen bg-background text-foreground md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-foreground hover:bg-accent"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <img src={rhozelandLogo} alt="" className="h-6 w-6 object-contain" />
          <span className="text-xs font-semibold tracking-wider uppercase">Rhozeland</span>
        </div>
        <NavLink
          to="/settings"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md"
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
        className={cn(
          "border-r border-border bg-card flex flex-col transition-transform duration-200",
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
            collapsed ? "px-2 py-3 justify-center" : "px-5 py-5 justify-between",
          )}
        >
          {!collapsed && (
            <NavLink
              to="/settings"
              className="flex items-center gap-2 group"
              title="My Profile"
            >
              <img
                src={rhozelandLogo}
                alt="Rhozeland"
                className="h-8 w-8 object-contain shrink-0"
              />
              <div>
                <div className="text-sm font-semibold tracking-wider uppercase group-hover:text-primary transition-colors">Rhozeland</div>
                <div className="text-xs text-muted-foreground">Team Portal</div>
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
              className="h-8 w-8 shrink-0 md:hidden"
              aria-label="Close menu"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
        <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
          <NavLink to="/settings" className={collapsed ? collapsedNavClass : navClass} title={collapsed ? accountLabel : undefined}>
            <Avatar className="h-5 w-5">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && accountLabel}
          </NavLink>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={collapsed ? collapsedNavClass : navClass} title={collapsed ? n.label : undefined}>
              <n.icon size={16} />
              {!collapsed && n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              {!collapsed && (
                <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Admin</div>
              )}
              {collapsed && <div className="my-2 mx-auto w-6 border-t border-border" />}
              {adminNav.map((n) => (
                <NavLink key={n.to} to={n.to} className={collapsed ? collapsedNavClass : navClass} title={collapsed ? n.label : undefined}>
                  <n.icon size={16} />
                  {!collapsed && n.label}
                </NavLink>
              ))}
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
          <ThemeToggle collapsed={collapsed} />
          <AccentPicker collapsed={collapsed} />
          <Button
            onClick={handleSignOut}
            variant="outline"
            size={collapsed ? "icon" : "sm"}
            className={collapsed ? "h-9 w-9 mx-auto" : "w-full"}
            aria-label="Sign out"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={14} /> {!collapsed && "Sign out"}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
