"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Search } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      <PageHeader title="Audit" icon={<History />} description="Administrative activity log." meta={`${filtered.length} records`} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Audit feed</CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search action, admin or entity"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
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

