"use client";

import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ServerSettingsForm } from "@/components/forms/server-settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { normalizeSettingsDraft, toSettingsDraft } from "@/domain/settings/adapters";
import { applyHysteriaSettings, getHysteriaSettings, saveHysteriaSettings, validateHysteriaSettings } from "@/domain/settings/services";
import { Hy2ConfigValidation, Hy2Settings } from "@/domain/settings/types";
import { APIError } from "@/services/api";

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyDialog, setApplyDialog] = useState(false);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState("");

  const [configPath, setConfigPath] = useState("");
  const [rawYaml, setRawYaml] = useState("");
  const [draft, setDraft] = useState<Hy2Settings>(toSettingsDraft({ listen: ":443", tlsEnabled: true, tlsMode: "acme", quicEnabled: false } as Hy2Settings));
  const [validation, setValidation] = useState<Hy2ConfigValidation | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await getHysteriaSettings();
      setConfigPath(payload.path || "");
      setRawYaml(payload.raw_yaml || "");
      setDraft(toSettingsDraft(payload.settings));
      setValidation(payload.config_validation || null);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load server settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function validateDraft() {
    setBusy(true);
    setError("");
    try {
      const payload = await validateHysteriaSettings(normalizeSettingsDraft(draft));
      setDraft(toSettingsDraft(payload.settings));
      setRawYaml(payload.raw_yaml || rawYaml);
      setValidation(payload.config_validation || null);
      setSnack(payload.config_validation.valid ? "Configuration is valid" : "Validation returned issues");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setError("");
    try {
      const payload = await saveHysteriaSettings(normalizeSettingsDraft(draft));
      setDraft(toSettingsDraft(payload.settings));
      setRawYaml(payload.raw_yaml || rawYaml);
      setValidation(payload.config_validation || null);
      setSnack(payload.backup_path ? `Saved. Backup: ${payload.backup_path}` : "Settings saved");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyConfig() {
    setApplying(true);
    setError("");
    try {
      await applyHysteriaSettings();
      setApplyDialog(false);
      setSnack("Hysteria restarted");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }} spacing={2}>
        <CircularProgress />
        <Typography color="text.secondary">Loading server settings...</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Server"
        subtitle={`Config path: ${configPath || "-"}`}
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void load()} disabled={busy || applying}>Reload</Button>
            <Button variant="outlined" startIcon={<FactCheckRoundedIcon />} onClick={() => void validateDraft()} disabled={busy || applying}>Validate</Button>
            <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => void saveDraft()} disabled={busy || applying}>Save</Button>
            <Button color="secondary" variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => setApplyDialog(true)} disabled={busy || applying}>Apply</Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {validation?.errors?.length ? <Alert severity="error">{validation.errors.join(" | ")}</Alert> : null}
      {validation?.warnings?.length ? <Alert severity="warning">{validation.warnings.join(" | ")}</Alert> : null}

      <Card>
        <CardContent>
          <ServerSettingsForm draft={draft} rawYaml={rawYaml} onDraftChange={setDraft} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={applyDialog}
        title="Apply configuration"
        description="Restart hysteria-server with the current saved settings?"
        busy={applying}
        confirmColor="secondary"
        confirmText="Apply & Restart"
        onClose={() => setApplyDialog(false)}
        onConfirm={() => void applyConfig()}
      />

      <Snackbar open={Boolean(snack)} autoHideDuration={2800} onClose={() => setSnack("")} message={snack} />
    </Stack>
  );
}

