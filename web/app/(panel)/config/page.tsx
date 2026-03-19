"use client";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { APIError, apiFetch } from "@/lib/api";
import { HysteriaSettingsResponse, Hy2ConfigValidation, Hy2Settings } from "@/lib/types";

type ConfigValidateResponse = { content: string; validation: Hy2ConfigValidation; settings: Hy2Settings; raw_only_paths?: string[] };
type ConfigSaveResponse = { ok: boolean; path: string; backup_path?: string; validation: Hy2ConfigValidation; content: string };

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState("");

  const [configPath, setConfigPath] = useState("");
  const [rawYaml, setRawYaml] = useState("");
  const [validation, setValidation] = useState<Hy2ConfigValidation | null>(null);
  const [applyDialog, setApplyDialog] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await apiFetch<HysteriaSettingsResponse>("/api/hysteria/settings", { method: "GET" });
      setConfigPath(payload.path || "");
      setRawYaml(payload.raw_yaml || "");
      setValidation(payload.config_validation || null);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function validateConfig() {
    setBusy(true);
    try {
      const payload = await apiFetch<ConfigValidateResponse>("/api/hysteria/config/validate", { method: "POST", body: JSON.stringify({ content: rawYaml }) });
      setRawYaml(payload.content || rawYaml);
      setValidation(payload.validation || null);
      setSnack(payload.validation.valid ? "Configuration is valid" : "Validation returned issues");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig() {
    setBusy(true);
    try {
      const payload = await apiFetch<ConfigSaveResponse>("/api/hysteria/config", { method: "PUT", body: JSON.stringify({ content: rawYaml }) });
      setRawYaml(payload.content || rawYaml);
      setValidation(payload.validation || null);
      setSnack(payload.backup_path ? `Saved. Backup: ${payload.backup_path}` : "Config saved");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyConfig() {
    setApplying(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/hysteria/config/apply", { method: "POST", body: JSON.stringify({}) });
      setApplyDialog(false);
      setSnack("Hysteria service restarted");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }} spacing={2}><CircularProgress /><Typography color="text.secondary">Loading server configuration...</Typography></Stack>;
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Server Configuration"
        subtitle="Manage Hysteria 2 runtime YAML. Managed auth is injected automatically."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void load()} disabled={busy || applying}>Reload</Button>
            <Button variant="outlined" startIcon={<FactCheckRoundedIcon />} onClick={() => void validateConfig()} disabled={busy || applying}>Validate</Button>
            <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => void saveConfig()} disabled={busy || applying}>Save</Button>
            <Button color="secondary" variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => setApplyDialog(true)} disabled={busy || applying}>Apply</Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {validation?.errors?.length ? <Alert severity="error">{validation.errors.join(" | ")}</Alert> : null}
      {validation?.warnings?.length ? <Alert severity="warning">{validation.warnings.join(" | ")}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h6">Raw YAML Editor</Typography>
                <Typography variant="body2" color="text.secondary">Path: {configPath || "-"}</Typography>
                <TextField
                  multiline
                  minRows={24}
                  fullWidth
                  value={rawYaml}
                  onChange={(event) => setRawYaml(event.target.value)}
                  InputProps={{
                    sx: {
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                      fontSize: "0.86rem",
                      lineHeight: 1.45,
                    },
                  }}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={applyDialog} onClose={() => !applying && setApplyDialog(false)}>
        <DialogTitle>Apply Hysteria configuration</DialogTitle>
        <DialogContent><Typography>Restart <strong>hysteria-server</strong> with current saved configuration?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialog(false)} disabled={applying}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={() => void applyConfig()} disabled={applying}>{applying ? "Applying..." : "Apply & Restart"}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snack)} autoHideDuration={2800} onClose={() => setSnack("")} message={snack} />
    </Stack>
  );
}
