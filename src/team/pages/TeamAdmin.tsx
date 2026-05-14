import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RoleManager from "./RoleManager";
import Invites from "./Invites";
import ReferralCodes from "./ReferralCodes";
import RoleSettings from "./RoleSettings";

export default function TeamAdmin() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Team Members</h1>
        <p className="text-sm text-muted-foreground">Manage roles, invitations, and referral codes.</p>
      </div>
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="role-settings">Roles Settings</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="referral-codes">Referral codes</TabsTrigger>
        </TabsList>
        <TabsContent value="roles"><RoleManager /></TabsContent>
        <TabsContent value="invites"><Invites /></TabsContent>
        <TabsContent value="referral-codes"><ReferralCodes /></TabsContent>
        <TabsContent value="role-settings"><RoleSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
