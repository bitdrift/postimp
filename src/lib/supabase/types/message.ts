export type MessageDirection = "inbound" | "outbound";
export type MessageChannel = "sms" | "web";

export interface Message {
  id: string;
  profile_id: string | null;
  phone: string | null;
  direction: MessageDirection;
  body: string | null;
  media_url: string | null;
  twilio_sid: string | null;
  channel: MessageChannel;
  post_id: string | null;
  created_at: string;
}
