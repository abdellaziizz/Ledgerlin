import { reconcile as runReconcile } from "../services/reconcileService.js";

// POST /admin/reconcile — auditor only. Optional body { account_id } to check one account.
const reconcile = async (req, res) => {
  const accountId = req.body?.account_id ?? null;
  const result = await runReconcile({ actorId: req.user.id, accountId });
  res.status(200).json({ status: "success", data: result });
};

export default { reconcile };
