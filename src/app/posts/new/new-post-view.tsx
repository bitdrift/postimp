"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPostView() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    // Auto-trigger file picker on mount
    if (!triggered.current) {
      triggered.current = true;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    }
  }, []);

  function handleCancel() {
    if (!uploading) {
      router.back();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      // User cancelled the file picker
      handleCancel();
      return;
    }

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
        router.back();
      }
    } catch {
      router.back();
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="font-semibold text-lg">New Post</h1>
        {!uploading && (
          <button
            onClick={handleCancel}
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
      <div className="flex-1 flex items-center justify-center">
        {uploading ? (
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Uploading...</p>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-center text-gray-400"
          >
            <p className="text-sm">Tap to select a photo</p>
          </button>
        )}
      </div>
    </div>
  );
}
