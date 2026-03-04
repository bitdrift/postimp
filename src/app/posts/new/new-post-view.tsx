"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPostView() {
  const router = useRouter();
  const photoLibraryRef = useRef<HTMLInputElement>(null);
  const takePhotoRef = useRef<HTMLInputElement>(null);
  const chooseFileRef = useRef<HTMLInputElement>(null);
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

      {/* Hidden file inputs */}
      <input
        ref={photoLibraryRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={takePhotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={chooseFileRef}
        type="file"
        accept="image/*,.heic,.heif,.webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        {uploading ? (
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Uploading...</p>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <h2 className="text-center text-lg font-semibold text-gray-900 mb-6">
              Choose an image to upload
            </h2>
            <div className="bg-white rounded-xl border overflow-hidden divide-y">
              <button
                onClick={() => photoLibraryRef.current?.click()}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 text-gray-500"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-sm text-gray-900">Photo Library</span>
              </button>
              <button
                onClick={() => takePhotoRef.current?.click()}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 text-gray-500"
                >
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-sm text-gray-900">Take Photo</span>
              </button>
              <button
                onClick={() => chooseFileRef.current?.click()}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 text-gray-500"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-sm text-gray-900">Choose File</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
