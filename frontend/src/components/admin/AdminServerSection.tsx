import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../../api";

interface PublicSettings {
  host: string;
  port: number;
  user: string;
  path: string;
  hasPassword: boolean;
  isConfigured: boolean;
  updatedAt: string | null;
}

interface SettingsFormData {
  host: string;
  port: string;
  user: string;
  path: string;
  password: string;
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

export default function AdminServerSection() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SettingsFormData>({
    host: "",
    port: "22",
    user: "",
    path: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/settings");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data: PublicSettings = await res.json();
      setSettings(data);
      setFormData({
        host: data.host,
        port: String(data.port),
        user: data.user,
        path: data.path,
        password: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const body: Record<string, string | number> = {
        host: formData.host,
        port: parseInt(formData.port, 10),
        user: formData.user,
        path: formData.path,
      };
      if (formData.password) {
        body.password = formData.password;
      }

      const res = await apiFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const respBody = await res.json().catch(() => ({}));
        throw new Error((respBody as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setSuccess("Settings saved successfully.");
      setFormData((prev) => ({ ...prev, password: "" }));
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "1rem" }}>
          Loading settings...
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Server Settings</h3>

      {settings && !settings.isConfigured && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            background: "#FFF8E1",
            border: "1px solid #FFE082",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            color: "#7B6B00",
          }}
        >
          Storage is not configured yet.
        </div>
      )}

      {error && (
        <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0 0 1rem" }}>
          {error}
        </p>
      )}

      {success && (
        <p style={{ color: "var(--color-success, #2e7d32)", fontSize: "0.85rem", margin: "0 0 1rem" }}>
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Host</label>
            <input
              type="text"
              required
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              style={inputStyle}
              placeholder="e.g. 192.168.1.100"
            />
          </div>
          <div>
            <label style={labelStyle}>Port</label>
            <input
              type="number"
              required
              min={1}
              max={65535}
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              style={inputStyle}
              placeholder="22"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <label style={labelStyle}>User</label>
            <input
              type="text"
              required
              value={formData.user}
              onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={inputStyle}
              required={!settings?.hasPassword}
            />
            {settings?.hasPassword && (
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                Leave password blank to keep the current password.
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Path</label>
          <input
            type="text"
            required
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            style={inputStyle}
            placeholder="/path/to/recordings"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              ...primaryBtnStyle,
              padding: "0.6rem 1.5rem",
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Saving..." : "Save Server Settings"}
          </button>
          {settings?.updatedAt && (
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Last updated: {new Date(settings.updatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
