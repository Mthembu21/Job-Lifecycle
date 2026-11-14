import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Job Lifecycle API listening on http://localhost:${env.port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.port} is already in use. Stop the existing process or choose another port.`);
    process.exit(1);
  }
  throw error;
});
