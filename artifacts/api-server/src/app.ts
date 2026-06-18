import express, { type Express, type Request, type Response, type NextFunction } from "express";
import path from "path";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));

app.use("/api", router);

app.get(/^\/(?!api|socket\.io).*/, (_req: Request, res: Response, _next: NextFunction) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
