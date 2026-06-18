import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import friendsRouter from "./friends";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/friends", friendsRouter);
router.use("/conversations", conversationsRouter);
router.use("/messages", messagesRouter);

export default router;
