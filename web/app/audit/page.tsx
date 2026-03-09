"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { Card, EmptyState, InlineMessage, PageHeader, TextField } from "@/components/ui";

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
    <div className="md-page-stack">
      <PageHeader
        title="Audit"
        subtitle="Recent administrative actions across panel operations, filtered for faster triage."
      />

      {error && <InlineMessage tone="warning">{error}</InlineMessage>}

      <Card title="Filters" subtitle="Search by action, admin, entity type or entity id." outlined>
        <TextField label="Search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type to filter audit feed" />
      </Card>

      <Card title="Audit feed" subtitle={`Latest 200 records${query ? ` · ${filtered.length} shown` : ""}.`}>
        {filtered.length === 0 ? (
          <EmptyState title="No audit records" description="No entries match the current filter." icon="history_toggle_off" />
        ) : (
          <div className="md-data-table-wrap">
            <table className="md-data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.created_at)}</td>
                    <td>{item.admin_email || "system"}</td>
                    <td>{item.action}</td>
                    <td>
                      {item.entity_type}
                      {item.entity_id ? `/${item.entity_id}` : ""}
                    </td>
                    <td style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.payload_json}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

