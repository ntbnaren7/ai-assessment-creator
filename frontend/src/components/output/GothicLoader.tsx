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
      // Start fade out
      setFade(false);
      
      // Wait for fade out to complete, then change message and fade back in
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % GOTHIC_MESSAGES.length);
        setFade(true);
      }, 500); // 500ms matches the CSS transition duration
      
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="gothic-loader-container animate-fadeIn px-6 text-center w-full max-w-lg mx-auto">
      {/* Progress Bar Container */}
      <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 mb-6 overflow-hidden relative">
        <div 
          className="bg-white h-1.5 rounded-full transition-all duration-500 ease-out absolute top-0 left-0"
          style={{ width: `${generationProgress}%` }}
        />
        {/* Glow effect on the progress bar */}
        <div 
          className="bg-white h-1.5 rounded-full transition-all duration-500 ease-out absolute top-0 left-0 blur-sm opacity-50"
          style={{ width: `${generationProgress}%` }}
        />
      </div>

      <p 
        className="gothic-loader-text text-sm md:text-base leading-relaxed" 
        style={{ 
          opacity: fade ? 1 : 0, 
          transition: "opacity 0.5s ease-in-out" 
        }}
      >
        {GOTHIC_MESSAGES[messageIndex]}
      </p>
    </div>
  );
}
