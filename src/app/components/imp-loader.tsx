"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface ImpLoaderProps {
  message?: string;
  size?: number;
}

export default function ImpLoader({ message, size = 120 }: ImpLoaderProps) {
  return (
    <div className="flex flex-col items-center">
      <DotLottieReact src="/post_imp.lottie" autoplay loop style={{ width: size }} />
      {message && <p className="text-base-content/50 text-sm mt-2">{message}</p>}
    </div>
  );
}
