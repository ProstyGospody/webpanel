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
  const shareQRSrc = currentClient ? `${qrURL(currentClient.id, 360, "access")}&v=${encodeURIComponent(shareURI)}` : "";
  const subscriptionQRSrc = currentClient ? `${qrURL(currentClient.id, 360, "subscription")}&v=${encodeURIComponent(subscriptionURL)}` : "";

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
          <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ width: "100%" }} justifyContent="center">
              <Stack spacing={1} alignItems="center" sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Configuration QR</Typography>
                <Box
                  component="img"
                  alt="Configuration QR"
                  src={shareQRSrc}
                  sx={(theme) => ({
                    width: 220,
                    height: 220,
                    borderRadius: 2,
                    bgcolor: "common.white",
                    p: 1,
                    border: `1px solid ${theme.palette.divider}`,
                  })}
                />
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={() => onCopy(shareURI)}
                  disabled={!shareURI}
                  sx={{ maxWidth: 220 }}
                >
                  Copy Config Link
                </Button>
              </Stack>

              <Stack spacing={1} alignItems="center" sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Subscription QR</Typography>
                <Box
                  component="img"
                  alt="Subscription QR"
                  src={subscriptionQRSrc}
                  sx={(theme) => ({
                    width: 220,
                    height: 220,
                    borderRadius: 2,
                    bgcolor: "common.white",
                    p: 1,
                    border: `1px solid ${theme.palette.divider}`,
                  })}
                />
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={() => onCopy(subscriptionURL)}
                  disabled={!subscriptionURL}
                  sx={{ maxWidth: 220 }}
                >
                  Copy Subscription URL
                </Button>
              </Stack>
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
