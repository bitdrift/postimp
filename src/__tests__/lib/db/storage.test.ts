import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { uploadPostImage, getPostImageUrl } from "@/lib/db/storage";

const db = createDbClient();

describe("storage", () => {
  const uploadedFiles: string[] = [];

  afterEach(async () => {
    // Clean up uploaded files
    if (uploadedFiles.length > 0) {
      await db.storage.from("post-images").remove(uploadedFiles);
      uploadedFiles.length = 0;
    }
  });

  describe("uploadPostImage", () => {
    it("uploads a file without error", async () => {
      const fileName = `test/${Date.now()}.jpg`;
      const buffer = new ArrayBuffer(8);
      uploadedFiles.push(fileName);

      await expect(uploadPostImage(db, fileName, buffer, "image/jpeg")).resolves.toBeUndefined();
    });

    it("throws on duplicate upload (upsert=false)", async () => {
      const fileName = `test/${Date.now()}-dup.jpg`;
      const buffer = new ArrayBuffer(8);
      uploadedFiles.push(fileName);

      await uploadPostImage(db, fileName, buffer, "image/jpeg");

      await expect(uploadPostImage(db, fileName, buffer, "image/jpeg")).rejects.toThrow();
    });
  });

  describe("getPostImageUrl", () => {
    it("returns a public URL string", () => {
      const url = getPostImageUrl(db, "test/image.jpg");
      expect(typeof url).toBe("string");
      expect(url).toContain("post-images");
      expect(url).toContain("test/image.jpg");
    });
  });
});
