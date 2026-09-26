import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { connectDB } from "./db";
import { initSocket } from "./socket";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

const httpServer = createServer(app);
const allowedOrigin = process.env["FRONTEND_URL"] || "http://localhost:5173";

const io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"], credentials: true },
  path: "/socket.io",
});

initSocket(io);

connectDB().then(() => {
  httpServer.listen(port, () => logger.info({ port }, "Server listening"));
}).catch((err) => {
  logger.error({ err }, "Database connection failed");
  process.exit(1);
});
