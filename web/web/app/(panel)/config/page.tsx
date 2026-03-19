"use client";

import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { APIError, apiFetch } from "@/lib/api";
import { HysteriaSettingsResponse, Hy2ConfigValidation, Hy2Settings } from "@/lib/types";

type ConfigValidateResponse = {
  content: string;
  validation: Hy2ConfigValidation;
  settings: Hy2Settings;
  raw_only_paths?: string[];
};

type ConfigSaveResponse = {
  ok: boolean;
  path: string;
  backup_path?: string;
  validation: Hy2ConfigValidation;
  content: string;
};

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState("");

  const [configPath, setConfigPath] = useState("");
  const [rawYaml, setRawYaml] = useState("");
  const [settings, setSettings] = useState<Hy2Settings | null>(null);
  const [validation, setValidation] = useState<Hy2ConfigValidation | null>(null);
  const [rawOnlyPaths, setRawOnlyPaths] = useState<string[]>([]);
  const [applyDialog, setApplyDialog] = useState(false);

  const listenAddress = useMemo(() => settings?.listen || "-", [settings]);
  const tlsMode = useMemo(() => settings?.tlsMode || "-", [settings]);
  const obfsType = useMemo(() => settings?.obfs?.type || "disabled", [settings]);
  const masqueradeType = useMemo(() => settings?.masquerade?.type || "none", [settings]);

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await apiFetch<HysteriaSettingsResponse>("/api/hysteria/settings", { method: "GET" });
      setConfigPath(payload.path || "");
      setRawYaml(payload.raw_yaml || "");
      setSettings(payload.settings || null);
      setValidation(payload.config_validation || null);
      setRawOnlyPaths(payload.raw_only_paths || []);
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Failed to load configuration";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function validateConfig() {
    setBusy(true);
    setError("");
    try {
      const payload = await apiFetch<ConfigValidateResponse>("/api/hysteria/config/validate", {
        method: "POST",
        body: JSON.stringify({ content: rawYaml }),
      });
      setRawYaml(payload.content || rawYaml);
      setSettings(payload.settings || null);
      setValidation(payload.validation || null);
      setRawOnlyPaths(payload.raw_only_paths || []);
      setSnack(payload.validation.valid ? "Configuration is valid" : "Validation returned issues");
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Validation failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig() {
    setBusy(true);
    setError("");
    try {
      const payload = await apiFetch<ConfigSaveResponse>("/api/hysteria/config", {
        method: "PUT",
        body: JSON.stringify({ content: rawYaml }),
      });
      setRawYaml(payload.content || rawYaml);
      setValidation(payload.validation || null);
      setSnack(payload.backup_path ? `Config saved. Backup: ${payload.backup_path}` : "Config saved");
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Save failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function applyConfig() {
    setApplying(true);
    setError("");
    try {
      await apiFetch<{ ok: boolean }>("/api/hysteria/config/apply", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setApplyDialog(false);
      setSnack("Hysteria service restarted with current config");
      await load();
    } catch (err) {
      const message = err instanceof APIError ? err.message : "Apply failed";
      setError(message);
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }} spacing={2}>
        <CircularProgress />
        <Typography color="text.secondary">Loading server configuration...</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Server Configuration"
        subtitle="Manage Hysteria 2 runtime YAML. Managed user credentials are injected automatically during validate/save/apply."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void load()} disabled={busy || applying}>
              Reload
            </Button>
            <Button variant="outlined" startIcon={<FactCheckRoundedIcon />} onClick={() => void validateConfig()} disabled={busy || applying}>
              Validate
            </Button>
            <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => void saveConfig()} disabled={busy || applying}>
              Save
            </Button>
            <Button color="secondary" variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => setApplyDialog(true)} disabled={busy || applying}>
              Apply
            </Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={1.25}>
                <Typography variant="h5">Runtime Summary</Typography>
                <Divider />
                <SummaryItem label="Config Path" value={configPath || "-"} mono />
                <SummaryItem label="Listen" value={listenAddress} mono />
                <SummaryItem label="TLS Mode" value={tlsMode} />
                <SummaryItem label="Obfuscation" value={obfsType} />
                <SummaryItem label="Masquerade" value={masqueradeType} />

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    color={validation?.valid ? "success" : "warning"}
                    icon={validation?.valid ? <CheckCircleRoundedIcon /> : <ErrorOutlineRoundedIcon />}
                    label={validation?.valid ? "Valid" : "Needs Attention"}
                  />
                  {rawOnlyPaths.length > 0 ? <Chip label={`${rawOnlyPaths.length} raw-only paths`} variant="outlined" /> : null}
                </Stack>

                {validation?.errors?.length ? (
                  <Alert severity="error">
                    <Stack>
                      {validation.errors.map((item) => (
                        <Typography key={item} variant="body2">
                          {item}
                        </Typography>
                      ))}
                    </Stack>
                  </Alert>
                ) : null}

                {validation?.warnings?.length ? (
                  <Alert severity="warning">
                    <Stack>
                      {validation.warnings.map((item) => (
                        <Typography key={item} variant="body2">
                          {item}
                        </Typography>
                      ))}
                    </Stack>
                  </Alert>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h5">Raw YAML Editor</Typography>
                <Typography variant="body2" color="text.secondary">
                  This editor is authoritative for advanced transport/tls/masquerade settings. During save/apply, user auth is synchronized from the managed client list.
                </Typography>
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
        <DialogContent>
          <Typography>
            This action restarts <strong>hysteria-server</strong> with the current saved configuration. Continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialog(false)} disabled={applying}>
            Cancel
          </Button>
          <Button variant="contained" color="secondary" onClick={() => void applyConfig()} disabled={applying}>
            {applying ? "Applying..." : "Apply & Restart"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snack)} autoHideDuration={2800} onClose={() => setSnack("")} message={snack} />
    </Stack>
  );
}

function SummaryItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack spacing={0.2}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={
          mono
            ? {
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                wordBreak: "break-all",
              }
            : undefined
        }
      >
        {value}
      </Typography>
    </Stack>
  );
}
