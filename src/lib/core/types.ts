import type { MessageChannel } from "@/lib/db/messages";

export type DeliverFn = (reply: string, postId?: string) => Promise<void>;

export interface MessageContext {
  profileId: string;
  body: string;
  mediaUrl: string | null;
  channel: MessageChannel;
  imageBuffer?: ArrayBuffer;
  contentType?: string;
  postId?: string;
}
