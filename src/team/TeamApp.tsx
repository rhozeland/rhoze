import { Routes, Route, Navigate } from "react-router-dom";
import TeamLogin from "./pages/TeamLogin";
import TeamLayout from "./components/TeamLayout";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Docs from "./pages/Docs";
import Directory from "./pages/Directory";
import Settings from "./pages/Settings";
import RoleManager from "./pages/RoleManager";
import Invites from "./pages/Invites";
import ReferralCodes from "./pages/ReferralCodes";
import Rewards from "./pages/Rewards";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Catalog from "./pages/Catalog";
import Intake from "./pages/Intake";
import TimeAndPay from "./pages/TimeAndPay";
import ClientPortal from "./pages/ClientPortal";
import ClientAccess from "./pages/ClientAccess";
import PortalLanding from "./pages/PortalLanding";
import ClientLayout from "./components/ClientLayout";
import ClientHome from "./pages/ClientHome";
import ClientProfile from "./pages/ClientProfile";
import { useAuth } from "./lib/auth";

function RequireTeam({ children }: { children: React.ReactNode }) {
  const { loading, session, isTeam } = useAuth();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!isTeam)
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <h1 className="text-2xl font-semibold">No team access</h1>
        <p className="text-sm text-muted-foreground">
          Your account is signed in but has no team role. Ask an admin to assign you the
          <code className="mx-1 rounded bg-muted px-1">employee</code> or
          <code className="mx-1 rounded bg-muted px-1">admin</code> role.
        </p>
      </div>
    );
  return <>{children}</>;
}

function RequireClient({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/client" replace />;
  return <>{children}</>;
}

export default function TeamApp() {
  return (
    <Routes>
      <Route path="/login" element={<TeamLogin />} />
      {/* Unified portal entry — two cards (Client Portal / Team Access) */}
      <Route path="/portal" element={<PortalLanding />} />
      {/* Client-facing entry — sign up / sign in / redeem project code. No referral required. */}
      <Route path="/client" element={<ClientAccess />} />
      {/* Client-facing portal — wrapped in ClientLayout so signed-in clients
          stay inside the client surface and never land in team pages. */}
      <Route
        element={
          <RequireClient>
            <ClientLayout />
          </RequireClient>
        }
      >
        <Route path="/client/home" element={<ClientHome />} />
        <Route path="/client/profile" element={<ClientProfile />} />
        <Route path="/portal/:id" element={<ClientPortal />} />
      </Route>
      <Route
        path="/"
        element={
          <RequireTeam>
            <TeamLayout />
          </RequireTeam>
        }
      >
        <Route index element={<Dashboard />} />
        {/* Priorities merged into Dashboard; legacy URL redirects */}
        <Route path="priorities" element={<Navigate to="/" replace />} />
        <Route path="crm" element={<CRM />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="intake" element={<Intake />} />
        <Route path="time" element={<TimeAndPay />} />
        {/* Legacy URLs */}
        <Route path="timesheets" element={<Navigate to="/time" replace />} />
        <Route path="payroll" element={<Navigate to="/time" replace />} />
        <Route path="docs" element={<Docs />} />
        <Route path="directory" element={<Directory />} />
        <Route path="settings" element={<Settings />} />
        <Route path="roles" element={<RoleManager />} />
        <Route path="invites" element={<Invites />} />
        <Route path="referral-codes" element={<ReferralCodes />} />
        <Route path="rewards" element={<Rewards />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
