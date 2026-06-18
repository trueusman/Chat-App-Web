import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { User as UserType } from "@/lib/types";

type Step = "onboard" | "auth";

export default function AuthPage() {
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("onboard");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/signup";
      const body = mode === "login" ? { email, password } : { name, email, password };
      const { token, user } = await api.post<{ token: string; user: UserType }>(path, body);
      login(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-height bg-[#0a0a1a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Glow orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <AnimatePresence mode="wait">
          {step === "onboard" ? (
            <motion.div
              key="onboard"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              {/* Diamond image collage */}
              <div className="relative w-56 h-56 mb-8">
                <div className="absolute inset-0 rotate-45 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/40 to-purple-900/40 border border-violet-500/30" />
                {/* Grid of 4 rotated squares */}
                <div className="absolute inset-0 grid grid-cols-2 gap-2 p-6 rotate-45">
                  {[
                    "from-violet-500 to-purple-700",
                    "from-blue-500 to-cyan-600",
                    "from-pink-500 to-rose-600",
                    "from-amber-500 to-orange-600",
                  ].map((grad, i) => (
                    <div
                      key={i}
                      className={`rounded-xl bg-gradient-to-br ${grad} opacity-80 flex items-center justify-center`}
                    >
                      <MessageSquare className="-rotate-45 w-5 h-5 text-white/70" />
                    </div>
                  ))}
                </div>
              </div>

              <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
                Your One-Stop<br />
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  Chat Solution
                </span>
              </h1>
              <p className="text-white/40 text-sm mb-10 leading-relaxed">
                Connect with friends, create groups,<br />and chat in real time.
              </p>

              <button
                onClick={() => { setStep("auth"); setMode("login"); }}
                className="btn-primary flex items-center justify-center gap-2 mb-3"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setStep("auth"); setMode("signup"); }}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-2xl transition-all text-sm"
              >
                Create Account
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.35 }}
            >
              {/* Logo */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl flex items-center justify-center mb-4 shadow-lg shadow-violet-500/30">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {mode === "login" ? "Welcome Back!" : "Create Account"}
                </h2>
                <p className="text-white/40 text-sm mt-1">
                  {mode === "login" ? "Sign in to continue" : "Join Chat Connect today"}
                </p>
              </div>

              {/* Tab */}
              <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 mb-6">
                {(["login", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(""); }}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                      mode === m
                        ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    {m === "login" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <AnimatePresence>
                  {mode === "signup" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <AuthInput icon={<User className="w-4 h-4" />} type="text" placeholder="Full name" value={name} onChange={setName} required />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AuthInput icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email address" value={email} onChange={setEmail} required />

                <div className="relative">
                  <AuthInput icon={<Lock className="w-4 h-4" />} type={showPass ? "text" : "password"} placeholder="Password" value={password} onChange={setPassword} required />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="pt-1">
                  <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === "login" ? "Sign In" : "Create Account"}
                  </button>
                </div>
              </form>

              <button onClick={() => setStep("onboard")}
                className="w-full mt-4 text-white/30 hover:text-white/60 text-xs transition-colors">
                ← Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AuthInput({ icon, type, placeholder, value, onChange, required }: {
  icon: React.ReactNode; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">{icon}</span>
      <input type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-2xl pl-11 pr-11 py-3.5 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all" />
    </div>
  );
}
