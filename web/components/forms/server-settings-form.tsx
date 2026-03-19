import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { Hy2Settings } from "@/domain/settings/types";

export function ServerSettingsForm({
  draft,
  rawYaml,
  onDraftChange,
}: {
  draft: Hy2Settings;
  rawYaml: string;
  onDraftChange: (next: Hy2Settings) => void;
}) {
  const acmeDomains = (draft.acme?.domains || []).join(", ");
  const obfsType = draft.obfs?.type === "salamander" ? "salamander" : "none";
  const masqueradeType = draft.masquerade?.type || "none";

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Listen"
            value={draft.listen}
            onChange={(event) => onDraftChange({ ...draft, listen: event.target.value })}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth>
            <InputLabel id="tls-mode-label">TLS Mode</InputLabel>
            <Select
              labelId="tls-mode-label"
              label="TLS Mode"
              value={draft.tlsMode || "acme"}
              onChange={(event) => onDraftChange({ ...draft, tlsMode: event.target.value, tlsEnabled: true })}
            >
              <MenuItem value="acme">ACME</MenuItem>
              <MenuItem value="tls">Manual TLS</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth>
            <InputLabel id="obfs-label">OBFS</InputLabel>
            <Select
              labelId="obfs-label"
              label="OBFS"
              value={obfsType}
              onChange={(event) => {
                if (event.target.value === "salamander") {
                  onDraftChange({ ...draft, obfs: { type: "salamander", salamander: { password: draft.obfs?.salamander?.password || "" } } });
                  return;
                }
                onDraftChange({ ...draft, obfs: undefined });
              }}
            >
              <MenuItem value="none">Disabled</MenuItem>
              <MenuItem value="salamander">Salamander</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {draft.tlsMode === "acme" ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              label="ACME Domains"
              value={acmeDomains}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  acme: {
                    domains: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                    email: draft.acme?.email || "",
                  },
                })
              }
              fullWidth
              helperText="Comma-separated domains"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="ACME Email"
              value={draft.acme?.email || ""}
              onChange={(event) => onDraftChange({ ...draft, acme: { domains: draft.acme?.domains || [], email: event.target.value } })}
              fullWidth
            />
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="TLS Cert Path"
              value={draft.tls?.cert || ""}
              onChange={(event) => onDraftChange({ ...draft, tls: { cert: event.target.value, key: draft.tls?.key || "" } })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="TLS Key Path"
              value={draft.tls?.key || ""}
              onChange={(event) => onDraftChange({ ...draft, tls: { cert: draft.tls?.cert || "", key: event.target.value } })}
              fullWidth
            />
          </Grid>
        </Grid>
      )}

      {obfsType === "salamander" ? (
        <TextField
          label="OBFS Password"
          value={draft.obfs?.salamander?.password || ""}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              obfs: { type: "salamander", salamander: { password: event.target.value } },
            })
          }
          fullWidth
        />
      ) : null}

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography>Advanced Server Options</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="masq-label">Masquerade</InputLabel>
                  <Select
                    labelId="masq-label"
                    label="Masquerade"
                    value={masqueradeType}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "none") {
                        onDraftChange({ ...draft, masquerade: undefined });
                        return;
                      }
                      onDraftChange({ ...draft, masquerade: { ...(draft.masquerade || {}), type: value } });
                    }}
                  >
                    <MenuItem value="none">Disabled</MenuItem>
                    <MenuItem value="proxy">Proxy</MenuItem>
                    <MenuItem value="file">File</MenuItem>
                    <MenuItem value="string">String</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Bandwidth Up"
                  value={draft.bandwidth?.up || ""}
                  onChange={(event) => onDraftChange({ ...draft, bandwidth: { up: event.target.value, down: draft.bandwidth?.down || "" } })}
                  fullWidth
                  placeholder="100 mbps"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Bandwidth Down"
                  value={draft.bandwidth?.down || ""}
                  onChange={(event) => onDraftChange({ ...draft, bandwidth: { up: draft.bandwidth?.up || "", down: event.target.value } })}
                  fullWidth
                  placeholder="200 mbps"
                />
              </Grid>
            </Grid>

            {masqueradeType === "proxy" ? (
              <TextField
                label="Masquerade Proxy URL"
                value={draft.masquerade?.proxy?.url || ""}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    masquerade: {
                      type: "proxy",
                      proxy: {
                        url: event.target.value,
                        rewriteHost: draft.masquerade?.proxy?.rewriteHost || false,
                        insecure: draft.masquerade?.proxy?.insecure || false,
                      },
                    },
                  })
                }
                fullWidth
              />
            ) : null}

            {masqueradeType === "file" ? (
              <TextField
                label="Masquerade File Dir"
                value={draft.masquerade?.file?.dir || ""}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    masquerade: { type: "file", file: { dir: event.target.value } },
                  })
                }
                fullWidth
              />
            ) : null}

            {masqueradeType === "string" ? (
              <TextField
                label="Masquerade String Content"
                value={draft.masquerade?.string?.content || ""}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    masquerade: {
                      type: "string",
                      string: { content: event.target.value, statusCode: draft.masquerade?.string?.statusCode || 200 },
                    },
                  })
                }
                fullWidth
                multiline
                minRows={3}
              />
            ) : null}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(draft.ignoreClientBandwidth)}
                      onChange={(event) => onDraftChange({ ...draft, ignoreClientBandwidth: event.target.checked })}
                    />
                  }
                  label="Ignore Client Bandwidth"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControlLabel
                  control={<Switch checked={Boolean(draft.disableUDP)} onChange={(event) => onDraftChange({ ...draft, disableUDP: event.target.checked })} />}
                  label="Disable UDP"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="UDP Idle Timeout"
                  value={draft.udpIdleTimeout || ""}
                  onChange={(event) => onDraftChange({ ...draft, udpIdleTimeout: event.target.value })}
                  fullWidth
                  placeholder="90s"
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControlLabel
                  control={<Switch checked={draft.quicEnabled} onChange={(event) => onDraftChange({ ...draft, quicEnabled: event.target.checked })} />}
                  label="Custom QUIC"
                />
              </Grid>
              {draft.quicEnabled ? (
                <>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="QUIC Max Idle"
                      value={draft.quic?.maxIdleTimeout || ""}
                      onChange={(event) =>
                        onDraftChange({ ...draft, quic: { ...(draft.quic || {}), maxIdleTimeout: event.target.value } })
                      }
                      fullWidth
                      placeholder="30s"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(draft.quic?.disablePathMTUDiscovery)}
                          onChange={(event) =>
                            onDraftChange({ ...draft, quic: { ...(draft.quic || {}), disablePathMTUDiscovery: event.target.checked } })
                          }
                        />
                      }
                      label="Disable Path MTU Discovery"
                    />
                  </Grid>
                </>
              ) : null}
            </Grid>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography>Advanced YAML</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            multiline
            minRows={18}
            fullWidth
            value={rawYaml}
            InputProps={{
              readOnly: true,
              sx: {
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "0.84rem",
                lineHeight: 1.45,
              },
            }}
            helperText="Generated preview"
          />
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}

