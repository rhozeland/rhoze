import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Dept } from "./access";
import { hasTeamAccess, type TeamRole } from "./adminRules";
import { Button } from "@/components/ui/button";

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
  const [authError, setAuthError] = useState(false);
  const activeUser = useRef<string | undefined>();

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      setDepartment(null);
      return;
    }
    // Both lookups run in parallel — they used to be sequential round-trips.
    const [{ data, error }, { data: prof, error: profileError }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("department").eq("id", uid).maybeSingle(),
    ]);
    if (error || profileError) throw error || profileError;
    if (activeUser.current !== uid) return;
    const nextRoles = (data ?? []).map((r) => r.role as AppRole);
    const nextDept = (prof?.department as Dept | null) ?? null;
    setRoles(nextRoles);
    setDepartment(nextDept);
  };


  useEffect(() => {
    let active = true;
    const fail = () => { if (active) { setAuthError(true); setLoading(false); } };
    // Set listener BEFORE getSession (required pattern)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      activeUser.current = s?.user.id;
      setAuthError(false);
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
          if (!active || activeUser.current !== s.user.id) return;
          try {
          // If a referral code was stored at signup (email-confirmation flow), consume it now.
          const pending = localStorage.getItem("pending_referral_code");
          if (pending) {
            const { error } = await supabase.rpc("consume_referral_code", { _code: pending });
            if (!error) localStorage.removeItem("pending_referral_code");
          }
          // Project codes are redeemed by Portal, which also routes to the result.
          await loadRoles(s.user.id);
          if (active && activeUser.current === s.user.id) setLoading(false);
          } catch { fail(); }
        }, 0);
      } else {
        setRoles([]);
        setDepartment(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s }, error }) => {
      if (!active) return;
      if (error) throw error;
      setSession(s);
      activeUser.current = s?.user.id;
      if (s?.user) {
        // A revoked/expired token can still sit in storage and make every
        // request 403 forever. Validate it once; if the server says the
        // session is gone, clear it locally so the sign-in screen shows.
        const { error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          // A network outage is not a revoked session. Do not destroy it.
          if (userErr.status !== 401 && userErr.status !== 403) throw userErr;
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          setSession(null);
          setRoles([]);
          setDepartment(null);
          setLoading(false);
          return;
        }
        await loadRoles(s.user.id);
        if (active) setLoading(false);
      } else {
        setLoading(false);
      }
    }).catch(fail);



    return () => { active = false; sub.subscription.unsubscribe(); };
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
      localStorage.removeItem("portal_intent");
      await supabase.auth.signOut();
    },
    refreshRoles: () => loadRoles(session?.user?.id),
  };

  return <Ctx.Provider value={value}>{authError ? (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">Account service unavailable</h1>
        <p className="text-sm text-muted-foreground">We couldn't check your account or team access. Your saved sign-in has not been removed. Please try again shortly.</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
        <Button asChild variant="outline"><a href="/">Back to website</a></Button>
      </div>
    </div>
  ) : children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}