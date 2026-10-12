import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RoleManager from "./RoleManager";
import Invites from "./Invites";
import ReferralCodes from "./ReferralCodes";
import RoleSettings, { SectionAccessMatrix } from "./RoleSettings";
import HirePanel from "../components/HirePanel";
import PayrollSetup from "../components/PayrollSetup";
import BenefitsAdmin from "../components/BenefitsAdmin";
import ProjectStories from "./ProjectStories";
import Leaderboard from "./Leaderboard";
import { useAuth } from "../lib/auth";

export default function TeamAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <p role="alert">Admin access required.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Admin portal</h1>
      </div>
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="hire">Hire</TabsTrigger>
          <TabsTrigger value="roles">Team roles</TabsTrigger>
          <TabsTrigger value="stories">Project stories</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard points</TabsTrigger>
          <TabsTrigger value="pay">Pay details</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="role-settings">Roles Settings</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="referral-codes">Referral codes</TabsTrigger>
        </TabsList>
        <TabsContent value="hire"><HirePanel /></TabsContent>
        <TabsContent value="roles"><RoleManager /></TabsContent>
        <TabsContent value="stories"><ProjectStories /></TabsContent>
        <TabsContent value="leaderboard"><Leaderboard /></TabsContent>
        <TabsContent value="pay"><PayrollSetup /></TabsContent>
        <TabsContent value="benefits"><BenefitsAdmin /></TabsContent>
        <TabsContent value="invites"><Invites /></TabsContent>
        <TabsContent value="referral-codes"><ReferralCodes /></TabsContent>
        <TabsContent value="role-settings" className="space-y-4">
          <SectionAccessMatrix />
          <RoleSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
