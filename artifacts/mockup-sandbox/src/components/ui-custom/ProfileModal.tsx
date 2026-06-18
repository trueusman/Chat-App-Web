import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Save, Lock, Loader2, CheckCircle, Link, Upload, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

type ImageTab = "upload" | "url";

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage ?? "");
  const [profileImage, setProfileImage] = useState(user?.profileImage ?? "");
  const [imageTab, setImageTab] = useState<ImageTab>("upload");
  const [urlInput, setUrlInput] = useState(user?.profileImage?.startsWith("http") ? user.profileImage : "");
  const [imageError, setImageError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);
  const [error, setError] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myId = user?._id || user?.id || "";
  const colors = ["from-purple-500 to-blue-500", "from-pink-500 to-red-500", "from-green-500 to-teal-500", "from-orange-500 to-yellow-500"];
  const color = colors[myId.charCodeAt(0) % colors.length] ?? colors[0];

  // Convert file to base64
  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error("Image must be under 2MB"));
        return;
      }
      if (!file.type.startsWith("image/")) {
        reject(new Error("File must be an image"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(file: File) {
    setImageError("");
    try {
      const base64 = await readFileAsBase64(file);
      setProfileImage(base64);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Failed to load image");
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }

  function applyUrl() {
    setImageError("");
    const url = urlInput.trim();
    if (!url) { setProfileImage(""); return; }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setImageError("URL must start with http:// or https://");
      return;
    }
    setProfileImage(url);
  }

  function removeImage() {
    setProfileImage("");
    setUrlInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveProfile() {
    setError("");
    setSaving(true);
    try {
      const { user: updated } = await api.put<{ user: User }>("/users/profile", {
        name, bio, statusMessage, profileImage,
      });
      updateUser(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPwdError("");
    setChangingPwd(true);
    try {
      await api.put("/users/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPwdSaved(true);
      setTimeout(() => setPwdSaved(false), 2000);
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setChangingPwd(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="relative h-24 bg-gradient-to-br from-purple-600 to-blue-600">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/20 hover:bg-black/40 rounded-lg flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Avatar preview */}
          <div className="absolute -bottom-9 left-6">
            <div className="relative group">
              <div
                className={`w-18 h-18 w-[72px] h-[72px] rounded-full border-4 border-slate-900 shadow-xl overflow-hidden bg-gradient-to-br ${color} flex items-center justify-center text-2xl font-bold text-white`}
              >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={() => { setProfileImage(""); setImageError("Could not load image"); }}
                  />
                ) : (
                  <span>{name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {/* Camera overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
              {/* Remove button */}
              {profileImage && (
                <button
                  onClick={removeImage}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="pt-14 px-6 pb-6 space-y-5 max-h-[72vh] overflow-y-auto">
          <div>
            <h2 className="text-white text-lg font-semibold">Edit Profile</h2>
            <p className="text-slate-400 text-xs">{user?.email}</p>
          </div>

          {/* ---- Profile Image Section ---- */}
          <div className="space-y-2">
            <label className="text-slate-400 text-xs font-medium block">Profile Photo</label>

            {/* Tab switcher */}
            <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
              {([
                { key: "upload", icon: <Upload className="w-3.5 h-3.5" />, label: "Upload File" },
                { key: "url",    icon: <Link    className="w-3.5 h-3.5" />, label: "Image URL"  },
              ] as const).map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => { setImageTab(key); setImageError(""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    imageTab === key ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {imageTab === "upload" ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleInputChange}
                  />

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 cursor-pointer transition-all ${
                      dragging
                        ? "border-purple-400 bg-purple-500/10"
                        : "border-slate-600 hover:border-purple-500 hover:bg-slate-800"
                    }`}
                  >
                    {profileImage && !profileImage.startsWith("http") ? (
                      <>
                        <img src={profileImage} alt="preview" className="w-14 h-14 rounded-full object-cover border-2 border-purple-500" />
                        <p className="text-green-400 text-xs font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Image selected — click to change
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                          <Upload className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-white text-sm font-medium">Drop image here or click to browse</p>
                          <p className="text-slate-500 text-xs mt-0.5">JPG, PNG, GIF, WebP — max 2MB</p>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="url"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applyUrl(); }}
                      placeholder="https://example.com/avatar.jpg"
                      className="input-field flex-1"
                    />
                    <button
                      onClick={applyUrl}
                      className="px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
                    >
                      Apply
                    </button>
                  </div>

                  {/* URL preview */}
                  {profileImage?.startsWith("http") && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-3 bg-slate-800 rounded-xl p-3"
                    >
                      <img
                        src={profileImage}
                        alt="preview"
                        className="w-12 h-12 rounded-full object-cover border-2 border-purple-500 flex-shrink-0"
                        onError={() => { setProfileImage(""); setImageError("Could not load image from URL"); }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-green-400 text-xs font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Preview looks good!
                        </p>
                        <p className="text-slate-500 text-xs truncate mt-0.5">{profileImage}</p>
                      </div>
                      <button onClick={removeImage} className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {imageError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {imageError}
              </p>
            )}
          </div>

          {/* ---- Profile fields ---- */}
          <Field label="Display Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </Field>

          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="input-field resize-none"
              placeholder="Tell people about yourself..."
            />
          </Field>

          <Field label="Status Message">
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              className="input-field"
            />
          </Field>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : profileSaved ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {profileSaved ? "Saved!" : "Save Profile"}
          </button>

          {/* ---- Change Password ---- */}
          <div className="border-t border-slate-700 pt-4 space-y-3">
            <p className="text-white font-medium text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" /> Change Password
            </p>

            <Field label="Current Password">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field"
              />
            </Field>

            <Field label="New Password">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
              />
            </Field>

            {pwdError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {pwdError}
              </p>
            )}

            <button
              onClick={changePassword}
              disabled={changingPwd || !currentPassword || !newPassword}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all disabled:opacity-60"
            >
              {changingPwd ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : pwdSaved ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {pwdSaved ? "Password Updated!" : "Update Password"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-slate-400 text-xs font-medium mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
