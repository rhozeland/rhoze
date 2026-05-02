import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight client-portal chrome. Deliberately separate from the team
 * sidebar (no Time & Pay / CRM / Catalog). Keeps a signed-in client from
 * accidentally landing in operational team pages — every link inside the
 * client portal stays inside `/client` and `/portal/:id`.
 */
export default function ClientLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/client");
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors",
      isActive
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
    );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/client" className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rhozeland</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium">Client portal</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/client" end className={linkCls}>
              <FolderOpen size={12} /> Projects
            </NavLink>
            <NavLink to="/client/profile" className={linkCls}>
              <UserCircle2 size={12} /> Profile
            </NavLink>
            <Button onClick={handleSignOut} variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <LogOut size={12} /> Sign out
            </Button>
          </nav>
        </div>
        {user?.email && (
          <div className="max-w-3xl mx-auto px-6 pb-2 text-[11px] text-muted-foreground">
            Signed in as {user.email}
          </div>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}