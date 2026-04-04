import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      toast.success("Settings saved successfully.");
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
      <Card className="mb-6">
        <CardContent>
          <p className="py-4 text-center text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Server Settings</CardTitle>
      </CardHeader>
      <CardContent>

        {settings && !settings.isConfigured && (
          <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-800">
            <AlertDescription>Storage is not configured yet.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && <p className="mb-4 text-sm text-green-600">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Host</Label>
              <Input
                type="text"
                required
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="e.g. 192.168.1.100"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input
                type="number"
                required
                min={1}
                max={65535}
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                placeholder="22"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>User</Label>
              <Input
                type="text"
                required
                value={formData.user}
                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!settings?.hasPassword}
              />
              {settings?.hasPassword && (
                <p className="text-xs text-muted-foreground">Leave blank to keep current password.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Path</Label>
            <Input
              type="text"
              required
              value={formData.path}
              onChange={(e) => setFormData({ ...formData, path: e.target.value })}
              placeholder="/path/to/recordings"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Server Settings"}
            </Button>
            {settings?.updatedAt && (
              <span className="text-xs text-muted-foreground">
                Last updated: {new Date(settings.updatedAt).toLocaleString()}
              </span>
            )}
          </div>

        </form>
      </CardContent>
    </Card>
  );
}
