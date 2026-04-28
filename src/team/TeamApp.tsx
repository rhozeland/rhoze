import { Routes, Route, Navigate } from "react-router-dom";
import TeamLogin from "./pages/TeamLogin";
import TeamLayout from "./components/TeamLayout";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Deals from "./pages/Deals";
import Activities from "./pages/Activities";
import Docs from "./pages/Docs";
import Messages from "./pages/Messages";
import Payroll from "./pages/Payroll";
import RoleManager from "./pages/RoleManager";
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
      <Route
        path="/"
        element={
          <RequireTeam>
            <TeamLayout />
          </RequireTeam>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="deals" element={<Deals />} />
        <Route path="activities" element={<Activities />} />
        <Route path="docs" element={<Docs />} />
        <Route path="messages" element={<Messages />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="roles" element={<RoleManager />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}