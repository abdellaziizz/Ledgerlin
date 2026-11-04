import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });
import app from "./app.js";

const server = app.listen(process.env.PORT || 3000, "127.0.0.1", () => {
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
