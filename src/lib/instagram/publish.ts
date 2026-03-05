interface PublishResult {
  success: boolean;
  instagramPostId?: string;
  error?: string;
}

export async function publishToInstagram(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
): Promise<PublishResult> {
  try {
    // Step 1: Create media container
    const containerResponse = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    });

    const containerData = await containerResponse.json();

    if (containerData.error) {
      return {
        success: false,
        error: containerData.error.message || "Failed to create media container",
      };
    }

    const containerId = containerData.id;

    // Step 2: Poll container status until FINISHED
    let status = "IN_PROGRESS";
    let attempts = 0;
    const maxAttempts = 30;

    while (status === "IN_PROGRESS" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`,
      );
      const statusData = await statusResponse.json();
      status = statusData.status_code;

      if (status === "ERROR") {
        return {
          success: false,
          error: "Instagram rejected the media. Please try a different image.",
        };
      }
    }

    if (status !== "FINISHED") {
      return {
        success: false,
        error: "Media processing timed out. Please try again.",
      };
    }

    // Step 3: Publish the container
    const publishResponse = await fetch(
      `https://graph.instagram.com/v21.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      },
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      return {
        success: false,
        error: publishData.error.message || "Failed to publish post",
      };
    }

    return {
      success: true,
      instagramPostId: publishData.id,
    };
  } catch (error) {
    console.error("Instagram publish error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while publishing.",
    };
  }
}
