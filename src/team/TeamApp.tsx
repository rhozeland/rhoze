import { Routes, Route, Navigate } from "react-router-dom";
import TeamLogin from "./pages/TeamLogin";
import TeamLayout from "./components/TeamLayout";
import Dashboard from "./pages/Dashboard";
import Priorities from "./pages/Priorities";
import CRM from "./pages/CRM";
import Marketing from "./pages/Marketing";
import Docs from "./pages/Docs";
import Payroll from "./pages/Payroll";
import Directory from "./pages/Directory";
import Settings from "./pages/Settings";
import RoleManager from "./pages/RoleManager";
import Invites from "./pages/Invites";
import ReferralCodes from "./pages/ReferralCodes";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Catalog from "./pages/Catalog";
import Intake from "./pages/Intake";
import Timesheets from "./pages/Timesheets";
import ClientPortal from "./pages/ClientPortal";
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

export default function TeamApp() {
  return (
    <Routes>
      <Route path="/login" element={<TeamLogin />} />
      {/* Client-facing portal — accessible to any signed-in user; RLS gates project access */}
      <Route path="/portal/:id" element={<ClientPortal />} />
      <Route
        path="/"
        element={
          <RequireTeam>
            <TeamLayout />
          </RequireTeam>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="priorities" element={<Priorities />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="crm" element={<CRM />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="intake" element={<Intake />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="docs" element={<Docs />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="directory" element={<Directory />} />
        <Route path="settings" element={<Settings />} />
        <Route path="roles" element={<RoleManager />} />
        <Route path="invites" element={<Invites />} />
        <Route path="referral-codes" element={<ReferralCodes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
