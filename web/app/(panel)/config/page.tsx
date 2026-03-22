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
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ServerSettingsForm } from "@/components/forms/server-settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { normalizeSettingsDraft, toSettingsDraft } from "@/domain/settings/adapters";
import { applyHysteriaSettings, getHysteriaSettings, saveHysteriaSettings, validateHysteriaSettings } from "@/domain/settings/services";
import { Hy2ConfigValidation, Hy2Settings } from "@/domain/settings/types";
import { APIError } from "@/services/api";

function extractValidationError(err: unknown, fallback: string): string {
  if (!(err instanceof APIError)) {
    return fallback;
  }

  const details = err.details;
  if (!details || typeof details !== "object") {
    return err.message;
  }

  const maybeErrors = (details as { errors?: unknown }).errors;
  if (Array.isArray(maybeErrors)) {
    const errors = maybeErrors.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (errors.length > 0) {
      return `${err.message}: ${errors.join(" | ")}`;
    }
  }
  return err.message;
}

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyDialog, setApplyDialog] = useState(false);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState("");

  const [rawYaml, setRawYaml] = useState("");
  const [draft, setDraft] = useState<Hy2Settings>(toSettingsDraft({ listen: ":443", tlsEnabled: true, tlsMode: "acme", quicEnabled: false } as Hy2Settings));
  const [validation, setValidation] = useState<Hy2ConfigValidation | null>(null);
  const outlinedActionButtonSx = (theme: Theme) => ({
    height: 42,
    px: 2.1,
    borderRadius: 999,
    borderColor: alpha(theme.palette.primary.main, 0.34),
    backgroundColor: alpha(theme.palette.primary.main, 0.07),
    color: theme.palette.text.primary,
    fontWeight: 700,
    "&:hover": {
      borderColor: alpha(theme.palette.primary.main, 0.48),
      backgroundColor: alpha(theme.palette.primary.main, 0.14),
    },
  });
  const saveIconButtonSx = (theme: Theme) => ({
    width: 42,
    height: 42,
    borderRadius: 999,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.34)}`,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    flexShrink: 0,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  });
  const applyIconButtonSx = (theme: Theme) => ({
    width: 42,
    height: 42,
    borderRadius: 999,
    border: `1px solid ${alpha(theme.palette.secondary.main, 0.34)}`,
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
    flexShrink: 0,
    "&:hover": {
      backgroundColor: theme.palette.secondary.dark,
    },
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await getHysteriaSettings();
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
      setError(extractValidationError(err, "Validation failed"));
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
      setError(extractValidationError(err, "Save failed"));
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
      setError(extractValidationError(err, "Apply failed"));
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
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => void load()}
              disabled={busy || applying}
              sx={outlinedActionButtonSx}
            >
              Reload
            </Button>
            <Button
              variant="outlined"
              startIcon={<FactCheckRoundedIcon />}
              onClick={() => void validateDraft()}
              disabled={busy || applying}
              sx={outlinedActionButtonSx}
            >
              Validate
            </Button>
            <Tooltip title="Save">
              <span>
                <IconButton aria-label="Save" onClick={() => void saveDraft()} disabled={busy || applying} sx={saveIconButtonSx}>
                  <SaveRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Apply">
              <span>
                <IconButton aria-label="Apply" onClick={() => setApplyDialog(true)} disabled={busy || applying} sx={applyIconButtonSx}>
                  <PlayArrowRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
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
