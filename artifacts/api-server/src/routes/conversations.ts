import { Router } from "express";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { User } from "../models/User";
import { authenticate, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .populate("participants", "-password")
      .populate({ path: "lastMessage", populate: { path: "sender", select: "-password" } })
      .sort({ updatedAt: -1 });

    const withUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unread = await Message.countDocuments({
          conversationId: conv._id,
          sender: { $ne: req.userId },
          readBy: { $ne: req.userId },
          deletedFor: { $ne: req.userId },
        });
        return { ...conv.toObject(), unreadCount: unread };
      })
    );

    res.json({ conversations: withUnread });
  } catch (err) {
    req.log.error({ err }, "Get conversations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/with/:userId", authenticate, async (req: AuthRequest, res) => {
  try {
    const targetId = req.params["userId"];
    const me = await User.findById(req.userId);
    if (!me?.friends.some((f) => f.toString() === targetId)) {
      res.status(403).json({ error: "You must be friends to chat" });
      return;
    }
    let conv = await Conversation.findOne({
      participants: { $all: [req.userId, targetId], $size: 2 },
    })
      .populate("participants", "-password")
      .populate({ path: "lastMessage", populate: { path: "sender", select: "-password" } });

    if (!conv) {
      const created = await Conversation.create({ participants: [req.userId, targetId] });
      conv = await Conversation.findById(created._id).populate("participants", "-password");
    }

    res.json({ conversation: conv });
  } catch (err) {
    req.log.error({ err }, "Get conversation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
