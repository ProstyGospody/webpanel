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
import { useEffect, useState } from "react";

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
  const [showSubscriptionQR, setShowSubscriptionQR] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowSubscriptionQR(false);
  }, [open, payload?.artifacts?.subscription_url]);

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
              <Stack spacing={0.75} alignItems="center" sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Connection QR</Typography>
                <Box
                  component="img"
                  alt="Connection QR"
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
              </Stack>

              <Stack spacing={0.75} alignItems="center" sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Subscription QR</Typography>
                <Box
                  sx={{
                    position: "relative",
                    width: 220,
                    height: 220,
                    cursor: subscriptionURL ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (subscriptionURL) {
                      setShowSubscriptionQR((value) => !value);
                    }
                  }}
                >
                  <Box
                    component="img"
                    alt="Subscription QR"
                    src={subscriptionQRSrc}
                    sx={(theme) => ({
                      width: "100%",
                      height: "100%",
                      borderRadius: 2,
                      bgcolor: "common.white",
                      p: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      filter: !showSubscriptionQR && subscriptionURL ? "blur(11px)" : "none",
                      transition: "filter 160ms ease",
                      pointerEvents: "none",
                      userSelect: "none",
                    })}
                  />
                  {!showSubscriptionQR && subscriptionURL ? (
                    <Stack
                      alignItems="center"
                      justifyContent="center"
                      sx={(theme) => ({
                        position: "absolute",
                        inset: 0,
                        borderRadius: 2,
                        bgcolor: theme.palette.mode === "light" ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.24)",
                        backdropFilter: "blur(1px)",
                      })}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>Tap to reveal</Typography>
                    </Stack>
                  ) : null}
                </Box>
              </Stack>
            </Stack>
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
