import type { Envelope, ReconcileResult } from "@/types/api";
import { request } from "./client";

/**
 * POST /admin/reconcile (auditor only): checks every cached balance against the sum of its
 * entries and that every transfer nets to zero. Pass accountId to check one account.
 */
export async function reconcile(accountId?: string): Promise<ReconcileResult> {
  const res = await request<Envelope<ReconcileResult>>("/admin/reconcile", {
    method: "POST",
    body: accountId ? { account_id: accountId } : {},
  });
  return res.body.data;
}
