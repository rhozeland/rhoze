import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RoleManager from "./RoleManager";
import Invites from "./Invites";
import ReferralCodes from "./ReferralCodes";
import RoleSettings, { SectionAccessMatrix } from "./RoleSettings";
import HirePanel from "../components/HirePanel";
import PayrollSetup from "../components/PayrollSetup";
import BenefitsAdmin from "../components/BenefitsAdmin";

export default function TeamAdmin() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">People</h1>
        <p className="text-sm text-muted-foreground">
          Hire new team members, set their role, pay details and benefits, and manage the roster — all in one place.
        </p>
      </div>
      <Tabs defaultValue="hire" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="hire">Hire</TabsTrigger>
          <TabsTrigger value="roles">Roster</TabsTrigger>
          <TabsTrigger value="pay">Pay details</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="role-settings">Roles Settings</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="referral-codes">Referral codes</TabsTrigger>
        </TabsList>
        <TabsContent value="hire"><HirePanel /></TabsContent>
        <TabsContent value="roles"><RoleManager /></TabsContent>
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
