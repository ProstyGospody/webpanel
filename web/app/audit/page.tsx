"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Search, X } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAction, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ items: AuditLog[] }>("/api/audit?limit=200")
      .then((resp) => {
        setItems(resp.items || []);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load audit"))
      .finally(() => setLoading(false));
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
      <PageHeader title="Audit" icon={<History />} description="Administrative activity log." meta={loading ? "Loading..." : `${filtered.length} records`} />

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
            <InputGroup className="w-full max-w-sm">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search action, admin or entity"
                aria-label="Search audit records"
              />
              {query ? (
                <InputGroupAction aria-label="Clear search" onClick={() => setQuery("")}>
                  <X className="size-3.5" />
                </InputGroupAction>
              ) : null}
            </InputGroup>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No audit records" description="No entries match the current filter." icon={History} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Time</TableHead>
                  <TableHead className="w-[200px]">Admin</TableHead>
                  <TableHead className="w-[220px]">Action</TableHead>
                  <TableHead className="w-[180px]">Entity</TableHead>
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
                    <TableCell className="max-w-[420px] truncate text-xs text-muted-foreground" title={item.payload_json}>
                      {formatPayloadPreview(item.payload_json)}
                    </TableCell>
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

function formatPayloadPreview(raw: string): string {
  const value = (raw || "").trim();
  if (!value) {
    return "-";
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    const compact = JSON.stringify(parsed);
    if (compact.length <= 120) {
      return compact;
    }
    return `${compact.slice(0, 117)}...`;
  } catch {
    if (value.length <= 120) {
      return value;
    }
    return `${value.slice(0, 117)}...`;
  }
}
