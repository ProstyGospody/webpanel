import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { buildClientConfigPreview, defaultsSummary, formFromClient, type ClientFormValues } from "@/domain/clients/adapters";
import { HysteriaClient, HysteriaClientDefaults } from "@/domain/clients/types";

export function ClientFormDialog({
  open,
  mode,
  busy,
  client,
  defaults,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  busy: boolean;
  client: HysteriaClient | null;
  defaults: HysteriaClientDefaults | null;
  error?: string;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ClientFormValues>(formFromClient(client, defaults));
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    setValues(formFromClient(client, defaults));
    setPreviewOpen(true);
  }, [client, defaults, mode, open]);

  const previewConfig = useMemo(() => {
    return buildClientConfigPreview(values, defaults, mode, client);
  }, [values, defaults, mode, client]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "create" ? "Create Client" : "Edit Client"}</DialogTitle>
      <Box component="form" onSubmit={submit}>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">Inherited: {defaultsSummary(defaults)}</Typography>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Client ID"
              value={values.username}
              onChange={(event) => setValues((prev) => ({ ...prev, username: event.target.value }))}
              required
              fullWidth
            />

            <TextField
              label="Note"
              value={values.note}
              onChange={(event) => setValues((prev) => ({ ...prev, note: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />

            <TextField
              label="Auth Secret (optional)"
              value={values.authSecret}
              onChange={(event) => setValues((prev) => ({ ...prev, authSecret: event.target.value }))}
              fullWidth
              helperText={mode === "create" ? "Leave empty to auto-generate" : "Leave empty to keep current secret"}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={values.insecure}
                  onChange={(_, checked) => setValues((prev) => ({ ...prev, insecure: checked }))}
                />
              }
              label="TLS Insecure"
            />

            <Accordion expanded={previewOpen} onChange={(_, expanded) => setPreviewOpen(expanded)}>
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                <Typography>Advanced YAML</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  multiline
                  minRows={12}
                  fullWidth
                  value={previewConfig}
                  InputProps={{
                    readOnly: true,
                    sx: (theme) => ({
                      ...theme.typography.code,
                      lineHeight: 1.5,
                    }),
                  }}
                  helperText="Generated preview"
                />
              </AccordionDetails>
            </Accordion>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
