import { Router } from "express";
import { User } from "../models/User";
import { generateToken, authenticate, type AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const user = await User.create({ name: name.trim(), email, password });
    const token = generateToken(user.id as string);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        bio: user.bio,
        statusMessage: user.statusMessage,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Signup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const token = generateToken(user.id as string);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        bio: user.bio,
        statusMessage: user.statusMessage,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
