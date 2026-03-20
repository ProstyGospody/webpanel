import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useEffect, useState } from "react";

import { defaultsSummary, formFromClient, type ClientFormValues } from "@/domain/clients/adapters";
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
  const [values, setValues] = useState<ClientFormValues>(formFromClient(client));
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(formFromClient(client));
    setAdvanced(mode === "edit");
  }, [client, mode, open]);

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
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip size="small" variant="outlined" label={mode === "create" ? "New client" : "Edit mode"} />
              <Chip size="small" variant="outlined" label={`Inherited: ${defaultsSummary(defaults)}`} />
            </Stack>

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

            <Accordion expanded={advanced} onChange={(_, expanded) => setAdvanced(expanded)}>
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                <Typography>Advanced Overrides</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    label="Auth Secret (optional)"
                    value={values.authSecret}
                    onChange={(event) => setValues((prev) => ({ ...prev, authSecret: event.target.value }))}
                    fullWidth
                    helperText={mode === "create" ? "Leave empty to auto-generate" : "Leave empty to keep current secret"}
                  />

                  <TextField
                    label="Override SNI"
                    value={values.overrideSni}
                    onChange={(event) => setValues((prev) => ({ ...prev, overrideSni: event.target.value }))}
                    fullWidth
                    placeholder="cdn.example.com"
                  />

                  <FormControl fullWidth>
                    <InputLabel id="insecure-label">TLS Insecure</InputLabel>
                    <Select
                      labelId="insecure-label"
                      value={values.overrideInsecure}
                      label="TLS Insecure"
                      onChange={(event) => setValues((prev) => ({ ...prev, overrideInsecure: event.target.value as ClientFormValues["overrideInsecure"] }))}
                    >
                      <MenuItem value="inherit">Inherit</MenuItem>
                      <MenuItem value="true">Force true</MenuItem>
                      <MenuItem value="false">Force false</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label="Override Pin SHA256"
                    value={values.overridePin}
                    onChange={(event) => setValues((prev) => ({ ...prev, overridePin: event.target.value }))}
                    fullWidth
                  />

                  <FormControl fullWidth>
                    <InputLabel id="obfs-label">OBFS</InputLabel>
                    <Select
                      labelId="obfs-label"
                      value={values.overrideObfs}
                      label="OBFS"
                      onChange={(event) => setValues((prev) => ({ ...prev, overrideObfs: event.target.value as ClientFormValues["overrideObfs"] }))}
                    >
                      <MenuItem value="inherit">Inherit</MenuItem>
                      <MenuItem value="salamander">Salamander</MenuItem>
                    </Select>
                  </FormControl>

                  {values.overrideObfs === "salamander" ? (
                    <TextField
                      label="OBFS Password"
                      value={values.overrideObfsPassword}
                      onChange={(event) => setValues((prev) => ({ ...prev, overrideObfsPassword: event.target.value }))}
                      fullWidth
                    />
                  ) : null}
                </Stack>
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
