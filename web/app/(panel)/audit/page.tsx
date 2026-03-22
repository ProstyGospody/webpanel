"use client";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { APIError, apiFetch } from "@/services/api";
import { formatDateTime } from "@/utils/format";
import { AuditLogItem } from "@/types/common";

export default function AuditPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await apiFetch<{ items: AuditLogItem[] }>("/api/audit?limit=250", { method: "GET" });
      setItems(payload.items || []);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <Stack spacing={3}>
      <PageHeader title="Audit" actions={<Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>Refresh</Button>} />
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 8, px: 2 }} spacing={1.5}>
              <CircularProgress size={28} />
              <Typography color="text.secondary">Loading audit records...</Typography>
            </Stack>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell>Payload</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{formatDateTime(item.created_at)}</TableCell>
                      <TableCell>{item.admin_email || "system"}</TableCell>
                      <TableCell>{item.action}</TableCell>
                      <TableCell>{item.entity_type}{item.entity_id ? `:${item.entity_id}` : ""}</TableCell>
                      <TableCell>
                        <Typography component="pre" variant="code" sx={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {item.payload_json || "{}"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
