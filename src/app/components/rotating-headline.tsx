"use client";

import { useState, useEffect, useCallback } from "react";

const headlines = [
  "Send a photo. Get a perfect post.",
  "Your AI social media manager.",
  "Instagram on autopilot.",
  "Post like a pro. Without the work.",
  "From photo to post in seconds.",
  "AI-powered posts that sound like you.",
  "Social media that manages itself.",
  "One photo. One tap. Done.",
  "Captions that write themselves.",
  "Your brand voice, on autopilot.",
  "Skip the agency. Keep the quality.",
  "Pro posts without the pro price.",
  "AI that gets your brand.",
  "Effortless Instagram, every time.",
  "The social media manager that never sleeps.",
  "Send it. Approve it. Post it.",
  "Scroll-stopping posts, zero effort.",
  "Your shortcut to great content.",
  "Post more. Stress less.",
  "AI captions. Your voice. One tap.",
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

type Phase = "thinking" | "typing" | "display" | "erasing";

export default function RotatingHeadline() {
  const [queue, setQueue] = useState<string[]>(() => shuffleArray(headlines));
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<Phase>("thinking");

  const currentHeadline = queue[index];

  // Reshuffle when we've gone through all headlines
  const advance = useCallback(() => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= queue.length) {
        setQueue(shuffleArray(headlines));
        return 0;
      }
      return next;
    });
  }, [queue.length]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "thinking") {
      // Show thinking dots for a beat
      timeout = setTimeout(() => setPhase("typing"), 800 + Math.random() * 600);
    } else if (phase === "typing") {
      if (displayed.length < currentHeadline.length) {
        // Type next character
        const delay = 30 + Math.random() * 40;
        timeout = setTimeout(() => {
          setDisplayed(currentHeadline.slice(0, displayed.length + 1));
        }, delay);
      } else {
        // Done typing — hold for a moment
        timeout = setTimeout(() => setPhase("display"), 2000);
      }
    } else if (phase === "display") {
      timeout = setTimeout(() => setPhase("erasing"), 100);
    } else if (phase === "erasing") {
      if (displayed.length > 0) {
        timeout = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1));
        }, 15);
      } else {
        // Done erasing — move to next headline
        advance();
        setPhase("thinking");
      }
    }

    return () => clearTimeout(timeout);
  }, [phase, displayed, currentHeadline, advance]);

  return (
    <span className="inline">
      {phase === "thinking" ? (
        <span className="inline-flex items-center gap-1 translate-y-[-4px]">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary"
              style={{
                animation: "headline-dot 1.4s infinite ease-in-out both",
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
          <style>{`
            @keyframes headline-dot {
              0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </span>
      ) : (
        <>
          {displayed}
          <span
            className="inline-block w-[3px] h-[0.85em] bg-primary ml-0.5 translate-y-[2px]"
            style={{
              animation: phase === "display" ? "blink 0.6s step-end infinite" : "none",
            }}
          />
          <style>{`
            @keyframes blink {
              50% { opacity: 0; }
            }
          `}</style>
        </>
      )}
    </span>
  );
}
