const colors = {
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
};
function statusColor(status) {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  return colors.green;
}
function log(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const color = statusColor(res.statusCode);

    console.log(
      `${req.method} ${req.originalUrl} ` +
        `${color}${res.statusCode}${colors.reset} ` +
        `${ms.toFixed(2)} ms`,
    );
  });
  next();
}
export default log;
