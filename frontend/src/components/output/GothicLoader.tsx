"use client";

import { useState, useEffect } from "react";
import { useAssignmentStore } from "@/store/useAssignmentStore";

const GOTHIC_MESSAGES = [
  "Summoning the muses of academia...",
  "Sifting through the ashes of past syllabi...",
  "Forging questions in the crucible of despair...",
  "Bleeding ink onto the digital parchment...",
  "Measuring the exact weight of a passing grade...",
  "The examination is nigh."
];

export function GothicLoader() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const { generationProgress } = useAssignmentStore();

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % GOTHIC_MESSAGES.length);
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="gothic-loader-container animate-fadeIn">
      {/* Progress Bar Container */}
      <div className="gothic-progress-container">
        <div className="gothic-progress-track">
          <div 
            className="gothic-progress-fill"
            style={{ width: `${generationProgress}%` }}
          />
        </div>
      </div>

      <div className="gothic-text-carousel">
        {GOTHIC_MESSAGES.map((msg, idx) => (
          <p 
            key={idx}
            className={`gothic-loader-text ${idx === messageIndex ? "active" : ""}`}
          >
            {msg}
          </p>
        ))}
      </div>
    </div>
  );
}
