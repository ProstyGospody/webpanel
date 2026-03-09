"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { Card, EmptyState, InlineMessage, PageHeader, TextField } from "@/components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch<{ items: AuditLog[] }>("/api/audit?limit=200")
      .then((resp) => setItems(resp.items || []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load audit"));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((item) => {
      return (
        item.action.toLowerCase().includes(q) ||
        (item.admin_email || "").toLowerCase().includes(q) ||
        item.entity_type.toLowerCase().includes(q) ||
        (item.entity_id || "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit"
        subtitle="Recent administrative actions across panel operations, filtered for faster triage."
      />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <Card title="Filters" subtitle="Search by action, admin, entity type or entity id." outlined>
        <TextField
          label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type to filter audit feed"
        />
      </Card>

      <Card title="Audit feed" subtitle={`Latest 200 records${query ? ` Р’В· ${filtered.length} shown` : ""}.`}>
        {filtered.length === 0 ? (
          <EmptyState title="No audit records" description="No entries match the current filter." icon="history_toggle_off" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                  <TableCell>{item.admin_email || "system"}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>
                    {item.entity_type}
                    {item.entity_id ? `/${item.entity_id}` : ""}
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate font-mono text-xs">{item.payload_json}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

