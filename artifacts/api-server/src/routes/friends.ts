import { Router } from "express";
import { User } from "../models/User";
import { FriendRequest } from "../models/FriendRequest";
import { Conversation } from "../models/Conversation";
import { authenticate, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).populate("friends", "-password");
    res.json({ friends: user?.friends ?? [] });
  } catch (err) {
    req.log.error({ err }, "Get friends error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/requests", authenticate, async (req: AuthRequest, res) => {
  try {
    const sent = await FriendRequest.find({ sender: req.userId, status: "pending" }).populate("receiver", "-password");
    const received = await FriendRequest.find({ receiver: req.userId, status: "pending" }).populate("sender", "-password");
    res.json({ sent, received });
  } catch (err) {
    req.log.error({ err }, "Get requests error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/request/:userId", authenticate, async (req: AuthRequest, res) => {
  try {
    const targetId = req.params["userId"];
    if (targetId === req.userId) {
      res.status(400).json({ error: "Cannot send a friend request to yourself" });
      return;
    }
    const target = await User.findById(targetId);
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const me = await User.findById(req.userId);
    if (me?.friends.some((f) => f.toString() === targetId)) {
      res.status(400).json({ error: "Already friends" });
      return;
    }
    const existing = await FriendRequest.findOne({
      $or: [
        { sender: req.userId, receiver: targetId },
        { sender: targetId, receiver: req.userId },
      ],
    });
    if (existing) {
      res.status(409).json({ error: "A friend request already exists between you" });
      return;
    }
    const request = await FriendRequest.create({ sender: req.userId, receiver: targetId });
    const populated = await request.populate(["sender", "receiver"]);
    res.status(201).json({ request: populated });
  } catch (err) {
    req.log.error({ err }, "Send request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/accept/:requestId", authenticate, async (req: AuthRequest, res) => {
  try {
    const request = await FriendRequest.findById(req.params["requestId"]);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (request.receiver.toString() !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    if (request.status !== "pending") {
      res.status(400).json({ error: "Request already handled" });
      return;
    }
    request.status = "accepted";
    await request.save();

    await User.findByIdAndUpdate(req.userId, { $addToSet: { friends: request.sender } });
    await User.findByIdAndUpdate(request.sender, { $addToSet: { friends: req.userId } });

    let conversation = await Conversation.findOne({
      participants: { $all: [req.userId, request.sender.toString()], $size: 2 },
    });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.userId, request.sender] });
    }

    const populated = await request.populate(["sender", "receiver"]);
    res.json({ request: populated, conversation });
  } catch (err) {
    req.log.error({ err }, "Accept request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/decline/:requestId", authenticate, async (req: AuthRequest, res) => {
  try {
    const request = await FriendRequest.findById(req.params["requestId"]);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (request.receiver.toString() !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    request.status = "declined";
    await request.save();
    res.json({ request });
  } catch (err) {
    req.log.error({ err }, "Decline request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cancel/:requestId", authenticate, async (req: AuthRequest, res) => {
  try {
    const request = await FriendRequest.findById(req.params["requestId"]);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (request.sender.toString() !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    await request.deleteOne();
    res.json({ message: "Request cancelled" });
  } catch (err) {
    req.log.error({ err }, "Cancel request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:userId", authenticate, async (req: AuthRequest, res) => {
  try {
    const targetId = req.params["userId"];
    await User.findByIdAndUpdate(req.userId, { $pull: { friends: targetId } });
    await User.findByIdAndUpdate(targetId, { $pull: { friends: req.userId } });
    await FriendRequest.deleteMany({
      $or: [
        { sender: req.userId, receiver: targetId },
        { sender: targetId, receiver: req.userId },
      ],
    });
    res.json({ message: "Friend removed" });
  } catch (err) {
    req.log.error({ err }, "Remove friend error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
