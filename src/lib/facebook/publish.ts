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

    return {
      success: true,
      facebookPostId: data.id,
    };
  } catch (error) {
    console.error("Facebook publish error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while publishing to Facebook.",
    };
  }
}
