"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPostView() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/chat/new-post", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const { postId } = await res.json();
        router.replace(`/posts/${postId}`);
      } else {
        setUploading(false);
      }
    } catch {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="font-semibold text-lg">New Post</h1>
        {!uploading && (
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        {uploading ? (
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 border-4 border-gray-200 border-t-pink rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Uploading...</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-500 mb-6">Choose an image to begin</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-pink text-white px-8 py-3 rounded-full font-medium hover:bg-pink-hover transition-colors"
            >
              Choose Image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
