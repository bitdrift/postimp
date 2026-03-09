import { log, timed, serializeError } from "@/lib/logger";

interface PublishResult {
  success: boolean;
  facebookPostId?: string;
  error?: string;
}

export async function publishToFacebook(
  pageId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string,
): Promise<PublishResult> {
  const elapsed = timed();
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: imageUrl,
        message: caption,
        access_token: pageAccessToken,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.message || "Failed to publish to Facebook",
      };
    }

    log.info({
      operation: "facebook.publish",
      message: "Post published to Facebook",
      facebookPostId: data.id,
      durationMs: elapsed(),
    });

    return {
      success: true,
      facebookPostId: data.id,
    };
  } catch (error) {
    log.error({
      operation: "facebook.publish",
      message: "Facebook publish error",
      durationMs: elapsed(),
      error: serializeError(error),
    });
    return {
      success: false,
      error: "An unexpected error occurred while publishing to Facebook.",
    };
  }
}
