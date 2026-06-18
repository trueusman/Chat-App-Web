import { Router } from "express";
import { Message } from "../models/Message";
import { Conversation } from "../models/Conversation";
import { authenticate, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/:conversationId", authenticate, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;
    const search = ((req.query["q"] as string) || "").trim();

    const conv = await Conversation.findOne({ _id: conversationId, participants: req.userId });
    if (!conv) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const query: Record<string, unknown> = {
      conversationId,
      deletedFor: { $ne: req.userId },
    };
    if (search) query["content"] = { $regex: search, $options: "i" };

    const messages = await Message.find(query)
      .populate("sender", "-password")
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { conversationId, sender: { $ne: req.userId }, readBy: { $ne: req.userId } },
      { $addToSet: { readBy: req.userId } }
    );

    res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "Get messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { conversationId, content } = req.body as { conversationId: string; content: string };
    if (!content?.trim()) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    const conv = await Conversation.findOne({ _id: conversationId, participants: req.userId });
    if (!conv) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const message = await Message.create({
      conversationId,
      sender: req.userId,
      content: content.trim(),
      readBy: [req.userId],
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    const populated = await message.populate("sender", "-password");
    res.status(201).json({ message: populated });
  } catch (err) {
    req.log.error({ err }, "Send message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const msg = await Message.findById(req.params["id"]);
    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    await Message.findByIdAndUpdate(req.params["id"], {
      $addToSet: { deletedFor: req.userId },
    });
    res.json({ message: "Message deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
