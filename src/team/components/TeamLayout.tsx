import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  ClipboardList,
  BookOpen,
  MessageSquare,
  DollarSign,
  Shield,
  UserPlus,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/deals", label: "Deals", icon: TrendingUp },
  { to: "/activities", label: "Activities", icon: ClipboardList },
  { to: "/docs", label: "Docs & Training", icon: BookOpen },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/payroll", label: "Payroll", icon: DollarSign },
];

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
        <nav className="flex-1 p-3 space-y-1 text-sm">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )
              }
            >
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
            <NavLink
              to="/roles"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )
              }
            >
              <Shield size={16} />
              Roles
            </NavLink>
            <NavLink
              to="/invites"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )
              }
            >
              <UserPlus size={16} />
              Invites
            </NavLink>
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