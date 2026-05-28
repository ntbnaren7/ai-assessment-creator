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
  const { generationProgress } = useAssignmentStore();
  const [displayProgress, setDisplayProgress] = useState(0);

  // 1. Asymptotic Simulation Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        // If the backend has finished, stop simulating
        if (generationProgress >= 100) return 100;
        
        // Calculate the remaining distance to 90%
        const remaining = 90 - prev;
        
        // Crawl forward by 2% of the remaining distance (slows down over time)
        // Ensure it moves by at least 0.1% so it never completely stops
        const increment = Math.max(remaining * 0.02, 0.1);
        
        return Math.min(prev + increment, 90);
      });
    }, 200);

    return () => clearInterval(timer);
  }, [generationProgress]);

  // 2. Backend Sync (Snap to reality)
  useEffect(() => {
    // If the actual backend progress jumps ahead of our simulation, snap to it
    if (generationProgress > displayProgress) {
      setDisplayProgress(generationProgress);
    }
  }, [generationProgress, displayProgress]);

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
            style={{ width: `${displayProgress}%` }}
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
