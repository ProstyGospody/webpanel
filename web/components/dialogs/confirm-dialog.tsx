import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

export function ConfirmDialog({
  open,
  title,
  description,
  busy,
  confirmText,
  onConfirm,
  onClose,
  confirmColor = "error",
}: {
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
  confirmText?: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmColor?: "error" | "primary" | "secondary";
}) {
  return (
    <Dialog open={open} onClose={() => !busy && onClose()}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{description}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button color={confirmColor} variant="contained" onClick={onConfirm} disabled={busy}>
          {busy ? "Processing..." : confirmText || "Confirm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
