import twilio from "twilio";

export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  return twilio.validateRequest(authToken, signature, url, params);
}
