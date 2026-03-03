import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

export const twilioClient = twilio(accountSid, authToken);

export async function sendSms(to: string, body: string) {
  return twilioClient.messages.create({
    body,
    from: fromNumber,
    to,
  });
}
