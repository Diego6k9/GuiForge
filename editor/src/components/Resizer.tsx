import { useRef } from 'react';

interface ResizerProps {
  /** Current width of the panel this handle resizes, in px. */
  width: number;
  min: number;
  max: number;
  /** A left-hand panel grows to the right, a right-hand panel grows to the left. */
  side: 'left' | 'right';
  onChange: (width: number) => void;
  label: string;
  className: string;
}

/** Vertical handle between two islands. Drag with the mouse, or step with the arrow keys (Shift for bigger steps). */
export function Resizer({ width, min, max, side, onChange, label, className }: ResizerProps) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const sign = side === 'left' ? 1 : -1;
  const clamp = (value: number) => Math.min(max, Math.max(min, Math.round(value)));

  const end = () => {
    drag.current = null;
    document.body.style.userSelect = '';
  };

  return (
    <div
      className={`resizer ${className}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, width };
        document.body.style.userSelect = 'none';
      }}
      onPointerMove={(e) => {
        if (drag.current) onChange(clamp(drag.current.width + sign * (e.clientX - drag.current.x)));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 48 : 16;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const direction = e.key === 'ArrowRight' ? 1 : -1;
          onChange(clamp(width + direction * sign * step));
        }
      }}
    />
  );
}
