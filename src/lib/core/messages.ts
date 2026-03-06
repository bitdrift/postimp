import type { MessageChannel } from "@/lib/db/messages";

const templates = {
  noDraftPrompt: {
    sms: "Send me a photo with a description and I'll create an Instagram post for you!",
    web: "Send a photo with a description to create a post.",
  },
  onboardingIncomplete: {
    sms: `Please complete your onboarding first! Visit your account at ${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
    web: "Please complete your onboarding first!",
  },
  imageDownloadError: {
    sms: "Sorry, I couldn't download your image. Please try sending it again.",
    web: "Sorry, I couldn't process your image. Please try again.",
  },
  imageUploadError: {
    sms: "Sorry, there was an error uploading your image. Please try again.",
    web: "Sorry, there was an error uploading your image. Please try again.",
  },
  profileError: {
    sms: "Error loading your profile. Please try again.",
    web: "Error loading your profile. Please try again.",
  },
  genericError: {
    sms: "Sorry, something went wrong creating your post. Please try again.",
    web: "Sorry, something went wrong. Please try again.",
  },
} as const;

export function msgStr(key: keyof typeof templates, channel: MessageChannel): string {
  return templates[key][channel] as string;
}

export function formatCaptionMessage(
  caption: string,
  previewUrl: string,
  channel: MessageChannel,
): string {
  if (channel === "sms") {
    const truncated = caption.length > 300 ? caption.substring(0, 297) + "..." : caption;
    return `${truncated}\n\nPreview: ${previewUrl}`;
  }
  return `CAPTION_START\n${caption}\nCAPTION_END\nPREVIEW:${previewUrl}`;
}
