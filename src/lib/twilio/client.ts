import twilio from "twilio";
import { log, timed, maskPhone } from "@/lib/logger";

let _client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (!_client) {
    _client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  }
  return _client;
}

export const twilioClient = {
  get messages() {
    return getClient().messages;
  },
};

export async function sendSms(to: string, body: string) {
  const elapsed = timed();
  const result = await getClient().messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  });
  log.info({
    operation: "twilio.sendSms",
    message: "SMS sent",
    phone: maskPhone(to),
    durationMs: elapsed(),
  });
  return result;
}
