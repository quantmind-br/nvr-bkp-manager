import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth";
import { apiFetch } from "../../api";

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

const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "1.5rem",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  marginBottom: "1.5rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  marginBottom: "0.25rem",
  color: "var(--color-text)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  fontSize: "0.9rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "0.6rem",
  fontSize: "0.9rem",
  cursor: "pointer",
};

function actionBtn(color: string): React.CSSProperties {
  return {
    background: "none",
    border: `1px solid ${color}`,
    color,
    borderRadius: "var(--radius-sm)",
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    whiteSpace: "nowrap",
  };
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
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Users</h3>
        {!showCreateForm && (
          <button onClick={openCreateForm} style={primaryBtnStyle}>
            Create User
          </button>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0 0 1rem" }}>
          {error}
        </p>
      )}

      {showCreateForm && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg-subtle)",
          }}
        >
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>New User</h4>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={labelStyle}>Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "viewer" })}
                  style={inputStyle}
                >
                  <option value="viewer">viewer</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            {formError && (
              <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
                {formError}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                disabled={submitting}
                style={{ ...primaryBtnStyle, padding: "0.4rem 1rem", opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Creating..." : "Create User"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                style={{ ...actionBtn("var(--color-text-muted)"), padding: "0.4rem 1rem" }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "1rem" }}>
          Loading users...
        </p>
      )}

      {!loading && users.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>Username</th>
                <th style={{ padding: "0.5rem" }}>Role</th>
                <th style={{ padding: "0.5rem" }}>Created</th>
                <th style={{ padding: "0.5rem" }}>Updated</th>
                <th style={{ padding: "0.5rem", width: "180px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                  {editingUserId === u.id ? (
                    <td colSpan={5} style={{ padding: "0.5rem" }}>
                      <form onSubmit={(e) => handleEdit(e, u.id)}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                          <div>
                            <label style={labelStyle}>Username</label>
                            <input
                              type="text"
                              required
                              value={formData.username}
                              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Password</label>
                            <input
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              placeholder="Leave blank to keep current"
                              style={inputStyle}
                            />
                            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                              Leave blank to keep current password
                            </span>
                          </div>
                          <div>
                            <label style={labelStyle}>Role</label>
                            <select
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "viewer" })}
                              style={inputStyle}
                            >
                              <option value="viewer">viewer</option>
                              <option value="admin">admin</option>
                            </select>
                          </div>
                        </div>
                        {formError && (
                          <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
                            {formError}
                          </p>
                        )}
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="submit"
                            disabled={submitting}
                            style={{ ...primaryBtnStyle, padding: "0.4rem 1rem", opacity: submitting ? 0.7 : 1 }}
                          >
                            {submitting ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelForm}
                            style={{ ...actionBtn("var(--color-text-muted)"), padding: "0.4rem 1rem" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: "0.5rem", fontWeight: 500 }}>{u.username}</td>
                      <td style={{ padding: "0.5rem" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            background: u.role === "admin" ? "var(--color-primary)" : "var(--color-bg-subtle)",
                            color: u.role === "admin" ? "#fff" : "var(--color-text)",
                            border: u.role === "admin" ? "none" : "1px solid var(--color-border)",
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                        {formatDate(u.created_at)}
                      </td>
                      <td style={{ padding: "0.5rem", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                        {formatDate(u.updated_at)}
                      </td>
                      <td style={{ padding: "0.5rem", display: "flex", gap: "4px" }}>
                        {deletingUserId === u.id ? (
                          <span style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "0.8rem" }}>
                            <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>Are you sure?</span>
                            <button
                              onClick={() => handleDelete(u.id)}
                              disabled={submitting}
                              style={{
                                ...actionBtn("var(--color-danger)"),
                                opacity: submitting ? 0.6 : 1,
                              }}
                            >
                              {submitting ? "Deleting..." : "Confirm Delete"}
                            </button>
                            <button
                              onClick={() => setDeletingUserId(null)}
                              style={actionBtn("var(--color-text-muted)")}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => openEditForm(u)}
                              disabled={isLastAdmin(u)}
                              style={{
                                ...actionBtn("var(--color-primary)"),
                                opacity: isLastAdmin(u) ? 0.4 : 1,
                                cursor: isLastAdmin(u) ? "not-allowed" : "pointer",
                              }}
                              title={isLastAdmin(u) ? "Cannot edit the last admin user" : "Edit user"}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setDeletingUserId(u.id); setFormError(null); }}
                              disabled={currentUser?.id === u.id || isLastAdmin(u)}
                              style={{
                                ...actionBtn("var(--color-danger)"),
                                opacity: currentUser?.id === u.id || isLastAdmin(u) ? 0.4 : 1,
                                cursor: currentUser?.id === u.id || isLastAdmin(u) ? "not-allowed" : "pointer",
                              }}
                              title={
                                currentUser?.id === u.id
                                  ? "Cannot delete your own account"
                                  : isLastAdmin(u)
                                    ? "Cannot delete the last admin user"
                                    : "Delete user"
                              }
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && users.length === 0 && !error && (
        <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "1rem" }}>
          No users found.
        </p>
      )}
    </div>
  );
}
