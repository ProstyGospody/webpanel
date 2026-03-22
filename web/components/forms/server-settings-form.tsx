import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

import { Hy2Settings } from "@/domain/settings/types";

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        borderColor: alpha(theme.palette.primary.main, 0.28),
        backgroundImage: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.background.paper, 0.84)} 45%, ${alpha(theme.palette.background.default, 0.36)} 100%)`,
      })}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1">{title}</Typography>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </Box>
        {children}
      </Stack>
    </Paper>
  );
}

function AdvancedGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        p: 1.5,
        borderRadius: 2,
        borderColor: alpha(theme.palette.divider, 0.95),
        backgroundColor: alpha(theme.palette.background.default, 0.28),
      })}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Box>
        {children}
      </Stack>
    </Paper>
  );
}

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
  const tlsLabel = draft.tlsMode === "acme" ? "ACME" : "Manual TLS";
  const listenPort = (draft.listen || "443").replace(/^:/, "");

  return (
    <Stack
      spacing={2}
      sx={(theme) => ({
        width: "100%",
        maxWidth: 1280,
        mx: "auto",
        "& .MuiOutlinedInput-root": {
          backgroundColor: "transparent",
        },
        "& .MuiAccordion-root": {
          backgroundColor: "transparent",
          borderColor: theme.palette.divider,
        },
      })}
    >
      <SettingsSection
        title="Core Parameters"
        description="Network entry point and transport profile for the server."
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip size="small" variant="outlined" label={`Port ${listenPort}`} />
          <Chip size="small" variant="outlined" label={`TLS ${tlsLabel}`} />
          <Chip size="small" variant="outlined" label={`OBFS ${obfsType === "salamander" ? "Salamander" : "Disabled"}`} />
        </Stack>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Listen"
              value={draft.listen}
              onChange={(event) => onDraftChange({ ...draft, listen: event.target.value.replace(/^:/, "") })}
              helperText="Port only, without ':' (example: 443)"
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
      </SettingsSection>

      <SettingsSection
        title={draft.tlsMode === "acme" ? "TLS and ACME" : "TLS Certificates"}
        description={
          draft.tlsMode === "acme"
            ? "Automatic certificate issuance and renewal."
            : "Manual certificate files on the server host."
        }
      >
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
      </SettingsSection>

      {obfsType === "salamander" ? (
        <SettingsSection
          title="OBFS Password"
          description="Shared secret for Salamander traffic obfuscation."
        >
          <TextField
            label="OBFS Password"
            value={draft.obfs?.salamander?.password || ""}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                obfs: { type: "salamander", salamander: { password: event.target.value } },
              })
            }
            helperText="Use a long random value to reduce fingerprinting risk."
            fullWidth
          />
        </SettingsSection>
      ) : null}

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Stack spacing={0.25}>
            <Typography>Advanced Server Options</Typography>
            <Typography variant="caption" color="text.secondary">Bandwidth, transport, masquerade and QUIC tuning.</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <AdvancedGroup
              title="Client Defaults"
              description="Flags inherited by generated client profiles."
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(draft.clientTLSInsecure)}
                        onChange={(event) => onDraftChange({ ...draft, clientTLSInsecure: event.target.checked })}
                      />
                    }
                    label="TLS Insecure"
                  />
                </Grid>
              </Grid>
            </AdvancedGroup>

            <AdvancedGroup
              title="Bandwidth"
              description="Server-side limits and client override behavior."
            >
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
            </AdvancedGroup>

            <AdvancedGroup
              title="Transport"
              description="UDP, speed-test endpoint and masquerade behavior."
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControlLabel
                    control={<Switch checked={Boolean(draft.disableUDP)} onChange={(event) => onDraftChange({ ...draft, disableUDP: event.target.checked })} />}
                    label="Disable UDP"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControlLabel
                    control={<Switch checked={Boolean(draft.speedTest)} onChange={(event) => onDraftChange({ ...draft, speedTest: event.target.checked })} />}
                    label="Speed Test"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="UDP Idle Timeout"
                    value={draft.udpIdleTimeout || ""}
                    onChange={(event) => onDraftChange({ ...draft, udpIdleTimeout: event.target.value })}
                    fullWidth
                    placeholder="90s"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
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
            </AdvancedGroup>

            <AdvancedGroup
              title="QUIC"
              description="Optional custom QUIC transport tuning."
            >
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
            </AdvancedGroup>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Stack spacing={0.25}>
            <Typography>Advanced YAML</Typography>
            <Typography variant="caption" color="text.secondary">Read-only generated preview of the final config.</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            multiline
            minRows={18}
            fullWidth
            value={rawYaml}
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
  );
}
