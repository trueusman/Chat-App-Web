import mongoose, { Document, Schema } from "mongoose";

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage: mongoose.Types.ObjectId | null;
  isGroup: boolean;
  groupName?: string;
  groupImage?: string;
  admins: mongoose.Types.ObjectId[];
  createdBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, trim: true },
    groupImage: { type: String, default: "" },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<IConversation>("Conversation", ConversationSchema);
