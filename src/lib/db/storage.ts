import type { DbClient } from "./client";

export async function uploadPostImage(
  client: DbClient,
  fileName: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await client.storage.from("post-images").upload(fileName, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
}

export function getPostImageUrl(client: DbClient, fileName: string): string {
  const {
    data: { publicUrl },
  } = client.storage.from("post-images").getPublicUrl(fileName);
  return publicUrl;
}
