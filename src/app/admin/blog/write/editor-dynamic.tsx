"use client";

import dynamic from "next/dynamic";

const MarkdownEditor = dynamic(() => import("./markdown-editor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[300px] flex items-center justify-center text-base-content/30 text-sm">
      Loading editor...
    </div>
  ),
});

export default MarkdownEditor;
