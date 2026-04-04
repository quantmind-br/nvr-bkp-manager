import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth";
import { apiFetch } from "../../api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SafeUser {
  id: number;
  username: string;
  role: "admin" | "viewer";
  created_at: string;
  updated_at: string;
}

interface UserFormData {
  username: string;
  password: string;
  role: "admin" | "viewer";
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

export default function AdminUsersSection() {
  const { user: currentUser, logout } = useAuth();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ username: "", password: "", role: "viewer" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/users");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data: SafeUser[] = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function openCreateForm() {
    setEditingUserId(null);
    setDeletingUserId(null);
    setFormData({ username: "", password: "", role: "viewer" });
    setFormError(null);
    setShowCreateForm(true);
  }

  function openEditForm(u: SafeUser) {
    setShowCreateForm(false);
    setDeletingUserId(null);
    setFormData({ username: u.username, password: "", role: u.role });
    setFormError(null);
    setEditingUserId(u.id);
  }

  function cancelForm() {
    setShowCreateForm(false);
    setEditingUserId(null);
    setFormError(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          role: formData.role,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setShowCreateForm(false);
      setFormData({ username: "", password: "", role: "viewer" });
      await fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: FormEvent, userId: number) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        username: formData.username,
        role: formData.role,
      };
      if (formData.password) {
        body.password = formData.password;
      }

      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const respBody = await res.json().catch(() => ({}));
        throw new Error((respBody as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { user: SafeUser; forceRelogin: boolean };

      setEditingUserId(null);
      setFormData({ username: "", password: "", role: "viewer" });

      if (data.forceRelogin) {
        alert("Your credentials were updated. Please log in again.");
        logout();
        return;
      }

      await fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(userId: number) {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setDeletingUserId(null);
      await fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setSubmitting(false);
    }
  }

  const adminCount = users.filter((u) => u.role === "admin").length;

  function isLastAdmin(u: SafeUser): boolean {
    return u.role === "admin" && adminCount <= 1;
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Users</CardTitle>
        {!showCreateForm && (
          <Button onClick={openCreateForm} size="sm">
            Create User
          </Button>
        )}
      </CardHeader>
      <CardContent>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {showCreateForm && (
          <div className="mb-4 rounded-md border border-border bg-muted/30 p-4">
            <h4 className="mb-3 text-sm font-semibold">New User</h4>
            <form onSubmit={handleCreate}>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-username">Username</Label>
                  <Input
                    id="create-username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-password">Password</Label>
                  <Input
                    id="create-password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value as "admin" | "viewer" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">viewer</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formError && (
                <Alert variant="destructive" className="mb-2">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Creating..." : "Create User"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {loading && (
          <p className="p-4 text-center text-sm text-muted-foreground">Loading users...</p>
        )}

        {!loading && users.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-44">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  {editingUserId === u.id ? (
                    <TableCell colSpan={5}>
                      <form onSubmit={(e) => handleEdit(e, u.id)}>
                        <div className="mb-3 grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-username-${u.id}`}>Username</Label>
                            <Input
                              id={`edit-username-${u.id}`}
                              type="text"
                              required
                              value={formData.username}
                              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-password-${u.id}`}>Password</Label>
                            <Input
                              id={`edit-password-${u.id}`}
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              placeholder="Leave blank to keep current"
                            />
                            <span className="text-xs text-muted-foreground">
                              Leave blank to keep current password
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Role</Label>
                            <Select
                              value={formData.role}
                              onValueChange={(value) => setFormData({ ...formData, role: value as "admin" | "viewer" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">viewer</SelectItem>
                                <SelectItem value="admin">admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {formError && (
                          <Alert variant="destructive" className="mb-2">
                            <AlertDescription>{formError}</AlertDescription>
                          </Alert>
                        )}
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={submitting}>
                            {submitting ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={cancelForm}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(u.updated_at)}</TableCell>
                      <TableCell>
                        {deletingUserId === u.id ? (
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-destructive">Are you sure?</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleDelete(u.id)}
                              disabled={submitting}
                            >
                              {submitting ? "Deleting..." : "Confirm Delete"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setDeletingUserId(null)}
                            >
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openEditForm(u)}
                              disabled={isLastAdmin(u)}
                              title={isLastAdmin(u) ? "Cannot edit the last admin user" : "Edit user"}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 border-destructive text-xs text-destructive"
                              onClick={() => {
                                setDeletingUserId(u.id);
                                setFormError(null);
                              }}
                              disabled={currentUser?.id === u.id || isLastAdmin(u)}
                              title={
                                currentUser?.id === u.id
                                  ? "Cannot delete your own account"
                                  : isLastAdmin(u)
                                    ? "Cannot delete the last admin user"
                                    : "Delete user"
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && users.length === 0 && !error && (
          <p className="p-4 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </CardContent>
    </Card>
  );
}
