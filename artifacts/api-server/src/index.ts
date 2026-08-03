import app from "./app";
import { logger } from "./lib/logger";

// 1. Export the app for Vercel Serverless Functions
export default app;

// 2. Only start the server if running locally (not on Vercel)
if (!process.env.VERCEL) {
  const rawPort = process.env.PORT || "3000";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, () => {
    logger.info({ port }, "Server listening locally");
  });
}
