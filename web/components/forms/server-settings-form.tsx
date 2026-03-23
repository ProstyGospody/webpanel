import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import SettingsSuggestRoundedIcon from "@mui/icons-material/SettingsSuggestRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  Card,
  CardContent,
  Chip,
  Divider,
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
import { alpha } from "@mui/material/styles";
import { ReactNode, useEffect } from "react";

import { Hy2Settings } from "@/domain/settings/types";

function SectionTitle({
  icon,
  title,
  subtitle,
  chips,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  chips?: ReactNode;
}) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1.25}>
      <Stack direction="row" spacing={1.2} alignItems="center">
        {icon}
        <Stack spacing={0.2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>{title}</Typography>
          {subtitle ? <Typography variant="caption" color="text.secondary">{subtitle}</Typography> : null}
        </Stack>
      </Stack>
      {chips ? (
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {chips}
        </Stack>
      ) : null}
    </Stack>
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
  const tlsMode = draft.tlsMode === "tls" ? "tls" : "acme";
  const obfsType = draft.obfs?.type === "salamander" ? "salamander" : "none";
  const masqueradeType = draft.masquerade?.type || "none";

  useEffect(() => {
    if (obfsType !== "none" && masqueradeType !== "none") {
      onDraftChange({ ...draft, masquerade: undefined });
    }
  }, [draft, masqueradeType, obfsType, onDraftChange]);

  return (
    <Stack
      spacing={2}
      sx={(theme) => ({
        "& .MuiInputLabel-root": {
          color: alpha(theme.palette.text.secondary, 0.9),
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: theme.palette.primary.light,
        },
        "& .MuiOutlinedInput-root": {
          borderRadius: 1.5,
          backgroundColor: alpha(theme.palette.background.default, 0.36),
          transition: theme.transitions.create(["border-color", "box-shadow", "background-color"], {
            duration: theme.transitions.duration.shorter,
          }),
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(theme.palette.primary.main, 0.26),
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(theme.palette.primary.light, 0.56),
          },
          "&.Mui-focused": {
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.18)}`,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.primary.main,
          },
        },
        "& .MuiFormControlLabel-label": {
          fontSize: "0.86rem",
          color: theme.palette.text.secondary,
        },
        "& .MuiSwitch-track": {
          backgroundColor: alpha(theme.palette.primary.main, 0.28),
        },
        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
          backgroundColor: alpha(theme.palette.primary.main, 0.56),
        },
      })}
    >
      <Card
        variant="outlined"
        sx={(theme) => ({
          borderColor: alpha(theme.palette.primary.main, 0.24),
          backgroundColor: alpha(theme.palette.background.paper, 0.74),
        })}
      >
        <CardContent sx={{ p: { xs: 1.5, md: 2 }, "&:last-child": { pb: { xs: 1.5, md: 2 } } }}>
          <Stack spacing={2}>
            <SectionTitle
              icon={<LanRoundedIcon color="primary" />}
              title="Connection Profile"
              chips={
                <>
                  <Chip size="small" label={`TLS ${tlsMode === "acme" ? "ACME" : "Manual"}`} />
                  <Chip size="small" label={`OBFS ${obfsType === "none" ? "Off" : "Salamander"}`} />
                  <Chip size="small" label={`Masquerade ${masqueradeType === "none" ? "Off" : masqueradeType}`} />
                </>
              }
            />

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Listen"
                  value={draft.listen}
                  onChange={(event) => onDraftChange({ ...draft, listen: event.target.value.replace(/^:/, "") })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl>
                  <InputLabel id="tls-mode-label">TLS Mode</InputLabel>
                  <Select
                    labelId="tls-mode-label"
                    label="TLS Mode"
                    value={tlsMode}
                    onChange={(event) => onDraftChange({ ...draft, tlsMode: event.target.value, tlsEnabled: true })}
                  >
                    <MenuItem value="acme">ACME</MenuItem>
                    <MenuItem value="tls">Manual TLS</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl>
                  <InputLabel id="obfs-label">OBFS</InputLabel>
                  <Select
                    labelId="obfs-label"
                    label="OBFS"
                    value={obfsType}
                    onChange={(event) => {
                      if (event.target.value === "salamander") {
                        onDraftChange({
                          ...draft,
                          obfs: { type: "salamander", salamander: { password: draft.obfs?.salamander?.password || "" } },
                          masquerade: undefined,
                        });
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
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl>
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
                      onDraftChange({ ...draft, obfs: undefined, masquerade: { ...(draft.masquerade || {}), type: value } });
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

            <Divider sx={(theme) => ({ borderColor: alpha(theme.palette.primary.main, 0.16) })} />

            {tlsMode === "acme" ? (
              <Grid container spacing={1.5}>
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
                    helperText="Comma-separated domains"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="ACME Email"
                    value={draft.acme?.email || ""}
                    onChange={(event) => onDraftChange({ ...draft, acme: { domains: draft.acme?.domains || [], email: event.target.value } })}
                  />
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="TLS Cert Path"
                    value={draft.tls?.cert || ""}
                    onChange={(event) => onDraftChange({ ...draft, tls: { cert: event.target.value, key: draft.tls?.key || "" } })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="TLS Key Path"
                    value={draft.tls?.key || ""}
                    onChange={(event) => onDraftChange({ ...draft, tls: { cert: draft.tls?.cert || "", key: event.target.value } })}
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
              />
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card
        variant="outlined"
        sx={(theme) => ({
          borderColor: alpha(theme.palette.primary.main, 0.2),
          backgroundColor: alpha(theme.palette.background.paper, 0.72),
        })}
      >
        <CardContent sx={{ p: { xs: 1.5, md: 2 }, "&:last-child": { pb: { xs: 1.5, md: 2 } } }}>
          <Stack spacing={1.5}>
            <SectionTitle
              icon={<SettingsSuggestRoundedIcon color="primary" />}
              title="Runtime Defaults"
            />

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack
                  spacing={1.2}
                  sx={(theme) => ({
                    p: 1.4,
                    borderRadius: 1.5,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    backgroundColor: alpha(theme.palette.background.default, 0.34),
                  })}
                >
                  <Typography variant="subtitle2" color="text.secondary">Client Defaults</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(draft.clientTLSInsecure)}
                        onChange={(event) => onDraftChange({ ...draft, clientTLSInsecure: event.target.checked })}
                      />
                    }
                    label="TLS Insecure"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(draft.ignoreClientBandwidth)}
                        onChange={(event) => onDraftChange({ ...draft, ignoreClientBandwidth: event.target.checked })}
                      />
                    }
                    label="Ignore Client Bandwidth"
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Stack
                  spacing={1.2}
                  sx={(theme) => ({
                    p: 1.4,
                    borderRadius: 1.5,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    backgroundColor: alpha(theme.palette.background.default, 0.34),
                  })}
                >
                  <Typography variant="subtitle2" color="text.secondary">Bandwidth</Typography>
                  <Grid container spacing={1.2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Bandwidth Up"
                        value={draft.bandwidth?.up || ""}
                        onChange={(event) =>
                          onDraftChange({
                            ...draft,
                            bandwidth: {
                              up: event.target.value,
                              down: draft.bandwidth?.down || "",
                            },
                          })
                        }
                        placeholder="100 mbps"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Bandwidth Down"
                        value={draft.bandwidth?.down || ""}
                        onChange={(event) =>
                          onDraftChange({
                            ...draft,
                            bandwidth: {
                              up: draft.bandwidth?.up || "",
                              down: event.target.value,
                            },
                          })
                        }
                        placeholder="200 mbps"
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack
                  spacing={1.2}
                  sx={(theme) => ({
                    p: 1.4,
                    borderRadius: 1.5,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    backgroundColor: alpha(theme.palette.background.default, 0.34),
                  })}
                >
                  <Typography variant="subtitle2" color="text.secondary">Transport</Typography>
                  <Grid container spacing={1.2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(draft.disableUDP)}
                            onChange={(event) => onDraftChange({ ...draft, disableUDP: event.target.checked })}
                          />
                        }
                        label="Disable UDP"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(draft.speedTest)}
                            onChange={(event) => onDraftChange({ ...draft, speedTest: event.target.checked })}
                          />
                        }
                        label="Speed Test"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label="UDP Idle Timeout"
                        value={draft.udpIdleTimeout || ""}
                        onChange={(event) => onDraftChange({ ...draft, udpIdleTimeout: event.target.value })}
                        placeholder="90s"
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {masqueradeType !== "none" ? (
        <Card
          variant="outlined"
          sx={(theme) => ({
            borderColor: alpha(theme.palette.primary.main, 0.2),
            backgroundColor: alpha(theme.palette.background.paper, 0.72),
          })}
        >
          <CardContent sx={{ p: { xs: 1.5, md: 2 }, "&:last-child": { pb: { xs: 1.5, md: 2 } } }}>
            <Stack spacing={1.5}>
              <SectionTitle
                icon={<SecurityRoundedIcon color="primary" />}
                title="Masquerade Details"
                subtitle="Type-specific options for the active masquerade mode"
              />

              {masqueradeType === "proxy" ? (
                <Stack spacing={1.2}>
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
                  />
                  <Grid container spacing={1.2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(draft.masquerade?.proxy?.rewriteHost)}
                            onChange={(event) =>
                              onDraftChange({
                                ...draft,
                                masquerade: {
                                  type: "proxy",
                                  proxy: {
                                    url: draft.masquerade?.proxy?.url || "",
                                    rewriteHost: event.target.checked,
                                    insecure: draft.masquerade?.proxy?.insecure || false,
                                  },
                                },
                              })
                            }
                          />
                        }
                        label="Rewrite Host Header"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(draft.masquerade?.proxy?.insecure)}
                            onChange={(event) =>
                              onDraftChange({
                                ...draft,
                                masquerade: {
                                  type: "proxy",
                                  proxy: {
                                    url: draft.masquerade?.proxy?.url || "",
                                    rewriteHost: draft.masquerade?.proxy?.rewriteHost || false,
                                    insecure: event.target.checked,
                                  },
                                },
                              })
                            }
                          />
                        }
                        label="Allow Insecure TLS"
                      />
                    </Grid>
                  </Grid>
                </Stack>
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
                />
              ) : null}

              {masqueradeType === "string" ? (
                <Grid container spacing={1.2}>
                  <Grid size={{ xs: 12, md: 9 }}>
                    <TextField
                      label="Masquerade String Content"
                      value={draft.masquerade?.string?.content || ""}
                      onChange={(event) =>
                        onDraftChange({
                          ...draft,
                          masquerade: {
                            type: "string",
                            string: {
                              content: event.target.value,
                              statusCode: draft.masquerade?.string?.statusCode || 200,
                            },
                          },
                        })
                      }
                      multiline
                      minRows={3}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      label="Status Code"
                      type="number"
                      value={draft.masquerade?.string?.statusCode ?? 200}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        onDraftChange({
                          ...draft,
                          masquerade: {
                            type: "string",
                            string: {
                              content: draft.masquerade?.string?.content || "",
                              statusCode: Number.isFinite(parsed) ? parsed : 200,
                            },
                          },
                        });
                      }}
                      inputProps={{ min: 100, max: 599 }}
                    />
                  </Grid>
                </Grid>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card
        variant="outlined"
        sx={(theme) => ({
          borderColor: alpha(theme.palette.primary.main, 0.2),
          backgroundColor: alpha(theme.palette.background.paper, 0.72),
        })}
      >
        <CardContent sx={{ p: { xs: 1.5, md: 2 }, "&:last-child": { pb: { xs: 1.5, md: 2 } } }}>
          <Stack spacing={1.5}>
            <SectionTitle
              icon={<TuneRoundedIcon color="primary" />}
              title="QUIC Tuning"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={draft.quicEnabled}
                  onChange={(event) => onDraftChange({ ...draft, quicEnabled: event.target.checked })}
                />
              }
              label="Enable Custom QUIC"
            />

            {draft.quicEnabled ? (
              <Grid container spacing={1.2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="QUIC Max Idle"
                    value={draft.quic?.maxIdleTimeout || ""}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        quic: {
                          ...(draft.quic || {}),
                          maxIdleTimeout: event.target.value,
                        },
                      })
                    }
                    placeholder="30s"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(draft.quic?.disablePathMTUDiscovery)}
                        onChange={(event) =>
                          onDraftChange({
                            ...draft,
                            quic: {
                              ...(draft.quic || {}),
                              disablePathMTUDiscovery: event.target.checked,
                            },
                          })
                        }
                      />
                    }
                    label="Disable Path MTU Discovery"
                  />
                </Grid>
              </Grid>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card
        variant="outlined"
        sx={(theme) => ({
          borderColor: alpha(theme.palette.primary.main, 0.2),
          backgroundColor: alpha(theme.palette.background.paper, 0.72),
        })}
      >
        <CardContent sx={{ p: { xs: 1.5, md: 2 }, "&:last-child": { pb: { xs: 1.5, md: 2 } } }}>
          <Stack spacing={1.5}>
            <SectionTitle
              icon={<CodeRoundedIcon color="primary" />}
              title="Generated YAML"
            />

            <TextField
              multiline
              minRows={16}
              value={rawYaml}
              InputProps={{
                readOnly: true,
                sx: (theme) => ({
                  ...theme.typography.code,
                  lineHeight: 1.52,
                }),
              }}
              helperText="Generated preview"
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
