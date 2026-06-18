import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { connectDB } from "./db";
import { initSocket } from "./socket";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/socket.io",
});

initSocket(io);

connectDB().then(() => {
  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
});
