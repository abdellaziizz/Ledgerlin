import dotenv from "dotenv";
import app from "./app.js";
dotenv.config({ path: "./config.env" });
const server = app.listen(3000, "127.0.0.1", () => {
  console.log("app is running on port 3000");
});
process.on("unhandledRejection", (err) => {
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
process.on("uncaughtException", (err) => {
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
