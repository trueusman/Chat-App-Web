import { Router } from "express";
import { User } from "../models/User";
import { authenticate, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const search = ((req.query["q"] as string) || "").trim();
    const filter: Record<string, unknown> = { _id: { $ne: req.userId } };
    if (search) filter["name"] = { $regex: search, $options: "i" };
    const users = await User.find(filter).select("-password").sort({ name: 1 });
    res.json({ users });
  } catch (err) {
    req.log.error({ err }, "Get users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.params["id"]).select("-password");
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Get user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, bio, statusMessage, profileImage } = req.body as Record<string, string>;
    const update: Record<string, string> = {};
    if (name?.trim()) update["name"] = name.trim();
    if (bio !== undefined) update["bio"] = bio;
    if (statusMessage !== undefined) update["statusMessage"] = statusMessage;
    if (profileImage !== undefined) update["profileImage"] = profileImage;
    const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select("-password");
    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Update profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/password", authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body as Record<string, string>;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Both passwords are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    req.log.error({ err }, "Update password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
