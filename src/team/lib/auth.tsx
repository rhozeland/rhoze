import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Dept } from "./access";
import { hasTeamAccess, type TeamRole } from "./adminRules";

export type AppRole = TeamRole;

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  department: Dept | null;
  loading: boolean;
  isTeam: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [department, setDepartment] = useState<Dept | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      setDepartment(null);
      return;
    }
    // Both lookups run in parallel — they used to be sequential round-trips.
    const [{ data }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("department").eq("id", uid).maybeSingle(),
    ]);
    const nextRoles = (data ?? []).map((r) => r.role as AppRole);
    const nextDept = (prof?.department as Dept | null) ?? null;
    setRoles(nextRoles);
    setDepartment(nextDept);
  };


  useEffect(() => {
    // Set listener BEFORE getSession (required pattern)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setRoles([]);
      setDepartment(null);
      setLoading(true);
      // Tell the parent shell (homepage embeds this app in an iframe) so its
      // header swaps out of the "Sign in" state immediately.
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "rhoze:auth-changed" }, window.location.origin);
        }
      } catch {
        /* ignore */
      }
      // Defer Supabase calls to avoid deadlock inside the callback

      if (s?.user) {
        setTimeout(async () => {
          // If a referral code was stored at signup (email-confirmation flow), consume it now.
          const pending = localStorage.getItem("pending_referral_code");
          if (pending) {
            const { error } = await supabase.rpc("consume_referral_code", { _code: pending });
            if (!error) localStorage.removeItem("pending_referral_code");
          }
          // If a project code was stored during the client signup flow, redeem it now.
          const pendingProject = localStorage.getItem("pending_project_code");
          if (pendingProject) {
            const { error } = await supabase.rpc("redeem_project_code", { _code: pendingProject });
            if (!error) localStorage.removeItem("pending_project_code");
          }
          await loadRoles(s.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setRoles([]);
        setDepartment(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        // A revoked/expired token can still sit in storage and make every
        // request 403 forever. Validate it once; if the server says the
        // session is gone, clear it locally so the sign-in screen shows.
        const { error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          setSession(null);
          setRoles([]);
          setDepartment(null);
          setLoading(false);
          return;
        }
        loadRoles(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });



    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    roles,
    department,
    loading,
    isTeam: hasTeamAccess(roles),
    isAdmin: roles.includes("admin"),
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshRoles: () => loadRoles(session?.user?.id),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}