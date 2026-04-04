import AdminUsersSection from "./AdminUsersSection";
import AdminServerSection from "./AdminServerSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPanel() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Administration</h2>
      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="server">Server</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <AdminUsersSection />
        </TabsContent>
        <TabsContent value="server">
          <AdminServerSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
