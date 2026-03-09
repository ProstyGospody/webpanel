"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { Card } from "@/components/ui";

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: AuditLog[] }>("/api/audit?limit=200")
      .then((resp) => setItems(resp.items || []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load audit"));
  }, []);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit</h1>
          <p className="page-subtitle">Recent administrative actions across panel operations.</p>
        </div>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      <Card title="Audit Feed" subtitle="Latest 200 records.">
        <div className="overflow-x-auto">
          <table className="table">
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
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted">
                    No audit records
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.created_at)}</td>
                  <td>{item.admin_email || "system"}</td>
                  <td>{item.action}</td>
                  <td>
                    {item.entity_type}
                    {item.entity_id ? `/${item.entity_id}` : ""}
                  </td>
                  <td className="max-w-sm truncate">{item.payload_json}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
