import type { MessageChannel } from "@/lib/db/messages";

const templates = {
  draftCaption: {
    sms: (caption: string, url: string) =>
      `Here's your draft caption:\n\n${caption}\n\nPreview: ${url}\n\nReply APPROVE to publish, send feedback to revise, or CANCEL to discard.`,
    web: (caption: string, url: string) =>
      `Here's your draft caption:\n\nCAPTION_START\n${caption}\nCAPTION_END\nPREVIEW:${url}`,
  },
  revisionAck: {
    sms: "Got it! Working on a revision...",
    web: "Working on a revision...",
  },
  revisedCaption: {
    sms: (caption: string, url: string) =>
      `Revised caption:\n\n${caption}\n\nPreview: ${url}\n\nReply APPROVE to publish, send more feedback, or CANCEL.`,
    web: (caption: string, url: string) =>
      `Revised caption:\n\nCAPTION_START\n${caption}\nCAPTION_END\nPREVIEW:${url}`,
  },
  publishStarted: {
    sms: "Publishing to Instagram... this may take a moment.",
    web: "Publishing to Instagram...",
  },
  publishSuccess: {
    sms: "Your post is live on Instagram! 🎉",
    web: "Your post is live on Instagram! 🎉",
  },
  publishFailed: {
    sms: (error: string) =>
      `Publishing failed: ${error}\n\nYou can try again by replying APPROVE, or CANCEL to discard.`,
    web: (error: string) => `Publishing failed: ${error}`,
  },
  draftCancelled: {
    sms: "Draft cancelled. Send a new photo whenever you're ready!",
    web: "Draft cancelled.",
  },
  noDraftPrompt: {
    sms: "Send me a photo with a description and I'll create an Instagram post for you! 📸",
    web: "Send a photo with a description to create a post.",
  },
  help: {
    sms:
      "Post Imp Help:\n" +
      "📸 Send a photo + description to create a post\n" +
      "✅ Reply APPROVE to publish your draft\n" +
      "✏️ Reply with feedback to revise\n" +
      "📝 Reply CAPTION: your text to set exact caption\n" +
      "❌ Reply CANCEL to discard draft\n\n" +
      "For support, visit https://postimp.com or email support@postimp.com. " +
      "To opt out, reply STOP.",
    web:
      "Post Imp Help:\n" +
      "📸 Send a photo + description to create a post\n" +
      "✅ Tap approve to publish your draft\n" +
      "✏️ Send feedback to revise\n" +
      "❌ Tap cancel to discard draft",
  },
  onboardingIncomplete: {
    sms: `Please complete your onboarding first! Visit your account at ${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
    web: "Please complete your onboarding first!",
  },
  noInstagram: {
    sms: `You need to connect your Instagram account first! Visit: ${process.env.NEXT_PUBLIC_APP_URL}/account`,
    web: "Connect your Instagram account to publish posts.",
  },
  instagramExpired: {
    sms: `Your Instagram connection has expired. Please reconnect: ${process.env.NEXT_PUBLIC_APP_URL}/account`,
    web: "Your Instagram connection has expired. Please reconnect.",
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
  reviseError: {
    sms: "Sorry, something went wrong revising your caption. Please try again.",
    web: "Sorry, something went wrong revising your caption. Please try again.",
  },
  captionSet: {
    sms: (url: string) =>
      `Caption updated! Preview: ${url}\n\nReply APPROVE to publish, send more feedback, or CANCEL.`,
    web: "Caption updated.",
  },
} as const;

export function msg(
  key: keyof typeof templates,
  channel: MessageChannel,
): string | ((...args: string[]) => string) {
  return templates[key][channel] as string | ((...args: string[]) => string);
}

export function msgStr(key: keyof typeof templates, channel: MessageChannel): string {
  return templates[key][channel] as string;
}

export function msgFn1(
  key: keyof typeof templates,
  channel: MessageChannel,
): (arg: string) => string {
  return templates[key][channel] as (arg: string) => string;
}

export function msgFn2(
  key: keyof typeof templates,
  channel: MessageChannel,
): (a: string, b: string) => string {
  return templates[key][channel] as (a: string, b: string) => string;
}
