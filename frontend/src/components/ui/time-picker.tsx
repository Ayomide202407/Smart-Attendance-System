import { useEffect, useMemo, useRef, useState } from "react";

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  start?: string;
  end?: string;
  stepMinutes?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function toMinutes(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map((v) => Number(v));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function fromMinutes(total: number) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function format12h(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map((v) => Number(v));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return "--:--";
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export default function TimePicker({
  value,
  onChange,
  start = "06:00",
  end = "22:00",
  stepMinutes = 30,
  disabled,
  placeholder = "Select time",
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const options = useMemo(() => {
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);
    const out: string[] = [];
    for (let t = startMin; t <= endMin; t += stepMinutes) {
      out.push(fromMinutes(t));
    }
    return out;
  }, [start, end, stepMinutes]);

  const display = value ? format12h(value) : placeholder;

  return (
    <div ref={rootRef} className={`relative ${className || ""}`}>
      <button
        type="button"
        className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
          disabled ? "bg-muted/50 text-muted-foreground" : "bg-white hover:bg-muted/30"
        }`}
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{display}</span>
      </button>
      {open && !disabled && (
        <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto rounded-xl border bg-white shadow-large">
          {options.map((opt) => {
            const active = opt === value;
            return (
              <button
                key={opt}
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${
                  active ? "bg-muted/50 font-semibold" : ""
                }`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {format12h(opt)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
