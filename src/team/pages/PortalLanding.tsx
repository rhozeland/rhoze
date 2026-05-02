import { Link } from "react-router-dom";
import { Users, UserCircle2 } from "lucide-react";

/**
 * Unified portal entry — two cards: Client Portal vs Team Access.
 * Reached via the "Portal" link in the site footer at /team.html#/portal.
 */
export default function PortalLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Rhozeland</div>
          <h1 className="text-3xl font-semibold">Portal</h1>
          <p className="text-sm text-muted-foreground">Choose how you'd like to sign in.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            to="/client"
            className="group rounded-2xl border border-border bg-card p-6 hover:border-foreground/40 transition-colors"
          >
            <UserCircle2 className="mb-3 h-6 w-6 text-muted-foreground group-hover:text-foreground" />
            <h2 className="text-lg font-medium">Client Portal</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Track your project, view your estimate, and use your credits. Sign in with the email
              you paid with and your project code.
            </p>
          </Link>
          <Link
            to="/login"
            className="group rounded-2xl border border-border bg-card p-6 hover:border-foreground/40 transition-colors"
          >
            <Users className="mb-3 h-6 w-6 text-muted-foreground group-hover:text-foreground" />
            <h2 className="text-lg font-medium">Team Access</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Staff sign-in for the Rhozeland operations dashboard. Requires a team role.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}