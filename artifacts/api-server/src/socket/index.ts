import { Server, Socket } from "socket.io";
import { User } from "../models/User";
import { FriendRequest } from "../models/FriendRequest";
import { Message } from "../models/Message";
import { Conversation } from "../models/Conversation";
import { verifySocketToken } from "../middleware/auth";
import { logger } from "../lib/logger";

const onlineUsers = new Map<string, string>(); // userId -> socketId

export function initSocket(io: Server): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;
    if (!token) return next(new Error("No token"));
    const userId = verifySocketToken(token);
    if (!userId) return next(new Error("Invalid token"));
    (socket as Socket & { userId: string }).userId = userId;
    next();
  });

  io.on("connection", async (socket) => {
    const userId = (socket as Socket & { userId: string }).userId;
    onlineUsers.set(userId, socket.id);
    logger.info({ userId }, "Socket connected");

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
    } catch {}

    socket.broadcast.emit("user-online", { userId });

    socket.on("send-friend-request", async ({ toUserId }: { toUserId: string }) => {
      try {
        const existing = await FriendRequest.findOne({
          $or: [
            { sender: userId, receiver: toUserId },
            { sender: toUserId, receiver: userId },
          ],
        });
        if (existing) return;

        const me = await User.findById(userId);
        if (me?.friends.some((f) => f.toString() === toUserId)) return;

        const request = await FriendRequest.create({ sender: userId, receiver: toUserId });
        const populated = await request.populate(["sender", "receiver"]);

        const receiverSocketId = onlineUsers.get(toUserId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("incoming-friend-request", { request: populated });
        }
        socket.emit("friend-request-sent", { request: populated });
      } catch (err) {
        logger.error({ err }, "send-friend-request error");
      }
    });

    socket.on("accept-friend-request", async ({ requestId }: { requestId: string }) => {
      try {
        const request = await FriendRequest.findById(requestId);
        if (!request || request.receiver.toString() !== userId) return;
        if (request.status !== "pending") return;

        request.status = "accepted";
        await request.save();

        await User.findByIdAndUpdate(userId, { $addToSet: { friends: request.sender } });
        await User.findByIdAndUpdate(request.sender, { $addToSet: { friends: userId } });

        let conversation = await Conversation.findOne({
          participants: { $all: [userId, request.sender.toString()], $size: 2 },
        });
        if (!conversation) {
          conversation = await Conversation.create({ participants: [userId, request.sender] });
        }

        const populated = await request.populate(["sender", "receiver"]);
        const senderSocketId = onlineUsers.get(request.sender.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit("friend-request-accepted", { request: populated, conversation });
        }
        socket.emit("friend-request-accepted", { request: populated, conversation });
      } catch (err) {
        logger.error({ err }, "accept-friend-request error");
      }
    });

    socket.on("decline-friend-request", async ({ requestId }: { requestId: string }) => {
      try {
        const request = await FriendRequest.findById(requestId);
        if (!request || request.receiver.toString() !== userId) return;
        request.status = "declined";
        await request.save();

        const senderSocketId = onlineUsers.get(request.sender.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit("friend-request-declined", { requestId });
        }
        socket.emit("friend-request-declined", { requestId });
      } catch (err) {
        logger.error({ err }, "decline-friend-request error");
      }
    });

    socket.on("cancel-friend-request", async ({ requestId }: { requestId: string }) => {
      try {
        const request = await FriendRequest.findById(requestId);
        if (!request || request.sender.toString() !== userId) return;
        const receiverId = request.receiver.toString();
        await request.deleteOne();

        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("friend-request-cancelled", { requestId });
        }
        socket.emit("friend-request-cancelled", { requestId });
      } catch (err) {
        logger.error({ err }, "cancel-friend-request error");
      }
    });

    socket.on("send-message", async ({ conversationId, content }: { conversationId: string; content: string }) => {
      try {
        if (!content?.trim()) return;
        const conv = await Conversation.findOne({ _id: conversationId, participants: userId });
        if (!conv) return;

        const message = await Message.create({
          conversationId,
          sender: userId,
          content: content.trim(),
          readBy: [userId],
        });
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        const populated = await message.populate("sender", "-password");

        for (const participantId of conv.participants) {
          const pid = participantId.toString();
          const targetSocketId = onlineUsers.get(pid);
          if (targetSocketId) {
            io.to(targetSocketId).emit("receive-message", { message: populated });
          }
        }

        const unreadCounts: Record<string, number> = {};
        for (const participantId of conv.participants) {
          const pid = participantId.toString();
          if (pid !== userId) {
            unreadCounts[pid] = await Message.countDocuments({
              conversationId,
              sender: { $ne: pid },
              readBy: { $ne: pid },
              deletedFor: { $ne: pid },
            });
            const targetSocketId = onlineUsers.get(pid);
            if (targetSocketId) {
              io.to(targetSocketId).emit("unread-count-update", {
                conversationId,
                unreadCount: unreadCounts[pid],
              });
            }
          }
        }
      } catch (err) {
        logger.error({ err }, "send-message error");
      }
    });

    socket.on("typing-start", ({ conversationId }: { conversationId: string }) => {
      socket.broadcast.emit("typing-start", { conversationId, userId });
    });

    socket.on("typing-stop", ({ conversationId }: { conversationId: string }) => {
      socket.broadcast.emit("typing-stop", { conversationId, userId });
    });

    socket.on("mark-read", async ({ conversationId }: { conversationId: string }) => {
      try {
        await Message.updateMany(
          { conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
      } catch {}
    });

    socket.on("disconnect", async () => {
      onlineUsers.delete(userId);
      try {
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
      } catch {}
      socket.broadcast.emit("user-offline", { userId });
      logger.info({ userId }, "Socket disconnected");
    });
  });
}
