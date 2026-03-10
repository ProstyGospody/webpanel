"use client";

import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { TextField } from "@/components/app/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        description="Administrative activity feed for operations, account lifecycle actions, and runtime control events."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Audit feed</CardTitle>
            <CardDescription>
              Latest 200 records{query ? ` • ${filtered.length} shown` : ""}.
            </CardDescription>
          </div>
          <div className="w-full max-w-sm">
            <TextField
              className="w-full"
              label="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Action, admin, entity or id"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState title="No audit records" description="No entries match the current filter." icon={History} />
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
                    <TableCell className="max-w-[420px] truncate font-mono text-xs">{item.payload_json}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


