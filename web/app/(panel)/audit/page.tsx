"use client";

import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState, LoadingState } from "@/components/ui/state-message";
import { APIError, apiFetch } from "@/services/api";
import { AuditLogItem } from "@/types/common";
import { formatDateTime } from "@/utils/format";

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

  useEffect(() => {
    void load();
  }, [load]);

  const latest = useMemo(() => (items.length ? formatDateTime(items[0].created_at) : "-"), [items]);

  return (
    <Stack spacing={2.25}>
      <PageHeader
        title="Audit Trail"
        subtitle="Chronological record of administrative actions"
        actions={
          <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip variant="outlined" label={`Records: ${items.length}`} />
        <Chip variant="outlined" label={`Latest: ${latest}`} />
      </Stack>

      <SectionCard title="Audit Records" subtitle="Most recent events first with full payload context">
        {loading ? (
          <LoadingState message="Loading audit records..." minHeight={320} />
        ) : items.length === 0 ? (
          <EmptyState title="No audit entries" description="Operations will appear here as actions are performed." />
        ) : (
          <TableContainer>
            <Table size="small">
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
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{item.action}</Typography>
                    </TableCell>
                    <TableCell>
                      {item.entity_type}
                      {item.entity_id ? `:${item.entity_id}` : ""}
                    </TableCell>
                    <TableCell>
                      <Typography
                        component="pre"
                        sx={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                          fontSize: "0.72rem",
                          maxWidth: 520,
                        }}
                      >
                        {item.payload_json || "{}"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </Stack>
  );
}
