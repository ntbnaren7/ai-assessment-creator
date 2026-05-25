"use client";

interface CounterProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

/**
 * Plus/minus stepper counter with pill-shaped border.
 * Matches the Figma counter inputs for question count and marks.
 */
export function Counter({
  value,
  min = 1,
  max = 99,
  onChange,
}: CounterProps) {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };

  const increment = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div className="counter">
      <button
        className="counter-btn"
        type="button"
        onClick={decrement}
        disabled={value <= min}
        aria-label="Decrease"
      >
        −
      </button>
      <span className="counter-value">{value}</span>
      <button
        className="counter-btn"
        type="button"
        onClick={increment}
        disabled={value >= max}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
