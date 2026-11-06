/**
 * POST /admin/reconcile (auditor only) exists in routes/adminRoutes.js but is not usable yet:
 *
 * TODO: Not implemented yet - backend reconcile is unfinished. adminRoutes.js calls
 * `adminController.reconcile`, but adminController.js default-exports the function itself,
 * so the route handler is undefined (Express throws "argument handler must be a function"
 * when app.js loads). The controller also reads req.params.id on a route without :id,
 * references an undefined `id`, and never responds when drift is found.
 * Once it works, add `reconcile()` here using `request()` from ./client.
 */
export {};
