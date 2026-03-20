import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { HysteriaClient, HysteriaUserPayload } from "@/domain/clients/types";
import { qrURL } from "@/domain/clients/services";

export function ClientArtifactsDialog({
  open,
  client,
  payload,
  loading,
  onClose,
  onCopy,
}: {
  open: boolean;
  client: HysteriaClient | null;
  payload: HysteriaUserPayload | null;
  loading: boolean;
  onClose: () => void;
  onCopy: (value: string) => void;
}) {
  const artifacts = payload?.artifacts || null;
  const currentClient = payload?.user || client;
  const shareURI = artifacts?.uri_hy2 || artifacts?.uri || "";
  const qrSrc = currentClient ? `${qrURL(currentClient.id, 380)}&v=${encodeURIComponent(shareURI)}` : "";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{currentClient?.username || "Client"}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading connection artifacts...</Typography>
          </Stack>
        ) : artifacts && currentClient ? (
          <Stack spacing={1.5}>
            <Paper variant="outlined" sx={{ p: 1.25, display: "grid", placeItems: "center", bgcolor: "common.white" }}>
              <Box component="img" alt="Hysteria QR" src={qrSrc} sx={{ width: 250, maxWidth: "100%", aspectRatio: "1 / 1" }} />
            </Paper>
            <Typography variant="body2" color="text.secondary">
              Share URI
            </Typography>
            <Paper variant="outlined" sx={{ p: 1.1, bgcolor: "background.default" }}>
              <Typography
                sx={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: "0.74rem",
                  lineHeight: 1.45,
                  wordBreak: "break-all",
                }}
              >
                {shareURI || "-"}
              </Typography>
            </Paper>
            <Button variant="outlined" fullWidth startIcon={<ContentCopyRoundedIcon />} onClick={() => onCopy(shareURI)} disabled={!shareURI}>
              Copy Link
            </Button>
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
