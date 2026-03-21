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
  const subscriptionURL = artifacts?.subscription_url || "";
  const qrSrc = currentClient ? `${qrURL(currentClient.id, 380)}&v=${encodeURIComponent(shareURI)}` : "";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{currentClient?.username || "Client"}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1.5}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading connection artifacts...</Typography>
          </Stack>
        ) : artifacts && currentClient ? (
          <Stack spacing={2} alignItems="center">
            <Box
              component="img"
              alt="Hysteria QR"
              src={qrSrc}
              sx={(theme) => ({
                width: 240,
                height: 240,
                borderRadius: 2,
                bgcolor: "common.white",
                p: 1,
                border: `1px solid ${theme.palette.divider}`,
              })}
            />
            <Stack spacing={1} sx={{ width: "100%" }}>
              <Button variant="outlined" fullWidth startIcon={<ContentCopyRoundedIcon />} onClick={() => onCopy(shareURI)} disabled={!shareURI}>
                Copy Connection Link
              </Button>
              <Button variant="outlined" fullWidth startIcon={<ContentCopyRoundedIcon />} onClick={() => onCopy(subscriptionURL)} disabled={!subscriptionURL}>
                Copy Subscription URL
              </Button>
            </Stack>
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
