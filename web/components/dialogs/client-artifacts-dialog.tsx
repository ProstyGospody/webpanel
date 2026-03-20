import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { HysteriaClient, HysteriaUserPayload } from "@/domain/clients/types";
import { qrURL } from "@/domain/clients/services";

export function ClientArtifactsDialog({
  open,
  tab,
  client,
  payload,
  loading,
  onClose,
  onCopy,
  onDownload,
}: {
  open: boolean;
  tab: "qr" | "details";
  client: HysteriaClient | null;
  payload: HysteriaUserPayload | null;
  loading: boolean;
  onClose: () => void;
  onCopy: (value: string) => void;
  onDownload: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"qr" | "details">(tab);

  useEffect(() => {
    if (open) {
      setActiveTab(tab);
    }
  }, [open, tab]);

  const artifacts = payload?.artifacts || null;
  const currentClient = payload?.user || client;
  const shareURI = artifacts?.uri_hy2 || artifacts?.uri || "";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{currentClient?.username || "Client"}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading connection artifacts...</Typography>
          </Stack>
        ) : artifacts && currentClient ? (
          <Stack spacing={2}>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
              <Tab label="QR" value="qr" />
              <Tab label="Details" value="details" />
            </Tabs>

            {activeTab === "qr" ? (
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
                  <TextField label="Hysteria URI" value={shareURI} fullWidth InputProps={{ readOnly: true }} />
                  <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => onCopy(shareURI)}>Copy URI</Button>
                </Stack>
                <Box
                  component="img"
                  alt="Hysteria QR"
                  src={qrURL(currentClient.id, 380)}
                  sx={{ width: 260, height: 260, borderRadius: 2, bgcolor: "common.white", p: 1, alignSelf: "center" }}
                />
                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => onCopy(artifacts.client_config)}>Copy Config</Button>
                  <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={onDownload}>Download YAML</Button>
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Effective Client Params</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {artifacts.client_params.server}:{artifacts.client_params.port} | SNI: {artifacts.client_params.sni || "-"} | Insecure: {artifacts.client_params.insecure ? "yes" : "no"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    OBFS: {artifacts.client_params.obfsType || "none"} {artifacts.client_params.obfsPassword ? "(password set)" : ""}
                  </Typography>
                </Stack>

                <Divider />

                <Stack spacing={1}>
                  <Typography variant="subtitle2">Inherited Server Defaults</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {artifacts.server_defaults.server}:{artifacts.server_defaults.port} | SNI: {artifacts.server_defaults.sni || "-"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    TLS mode: {artifacts.server_options.tls_mode || "-"} | OBFS: {artifacts.server_options.obfs_type || "none"} | MASQ: {artifacts.server_options.masquerade_type || "none"}
                  </Typography>
                </Stack>

                <Divider />

                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
                  <TextField label="Hysteria URI" value={shareURI} fullWidth InputProps={{ readOnly: true }} />
                  <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => onCopy(shareURI)}>Copy URI</Button>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" startIcon={<QrCode2RoundedIcon />} onClick={() => setActiveTab("qr")}>Show QR</Button>
                  <Button variant="contained" startIcon={<DownloadRoundedIcon />} onClick={onDownload}>Export YAML</Button>
                </Stack>
              </Stack>
            )}
          </Stack>
        ) : (
          <Alert severity="warning">No active artifacts for this client.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
