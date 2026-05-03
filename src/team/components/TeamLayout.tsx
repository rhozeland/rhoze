import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  LayoutDashboard, Users, BookOpen,
  UserCircle2, Settings, Shield, UserPlus, KeyRound, LogOut,
  FolderKanban, Inbox, Package, Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/time", label: "Time & Pay", icon: Clock },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/docs", label: "Docs & Training", icon: BookOpen },
  { to: "/directory", label: "Directory", icon: UserCircle2 },
  { to: "/rewards", label: "$RHOZE Rewards", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { to: "/intake", label: "Intake", icon: Inbox },
  { to: "/catalog", label: "Catalog", icon: Package },
  { to: "/roles", label: "Roles", icon: Shield },
  { to: "/invites", label: "Invites", icon: UserPlus },
  { to: "/referral-codes", label: "Referral codes", icon: KeyRound },
];

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent",
  );
}

export default function TeamLayout() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-60 border-r border-border bg-card flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <div className="text-sm font-semibold tracking-wider uppercase">Rhozeland</div>
          <div className="text-xs text-muted-foreground">Team Portal</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Admin</div>
              {adminNav.map((n) => (
                <NavLink key={n.to} to={n.to} className={navClass}>
                  <n.icon size={16} />
                  {n.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <div className="text-xs text-muted-foreground truncate px-1">{user?.email}</div>
          <Button onClick={handleSignOut} variant="outline" size="sm" className="w-full">
            <LogOut size={14} /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
