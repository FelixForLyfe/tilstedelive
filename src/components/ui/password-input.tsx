import { useState, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Adgangskode-felt med "hold inde for at se"-knap.
 * - Mus: hold venstre museknap nede for at vise
 * - Touch: hold fingeren nede for at vise
 * - Tastatur: aktivér knappen for at toggle synlighed
 */
export function PasswordInput({ className, ...props }: Props) {
  const [vis, setVis] = useState(false);
  const heldRef = useRef(false);

  const start = (e: React.SyntheticEvent) => {
    e.preventDefault();
    heldRef.current = true;
    setVis(true);
  };
  const end = () => {
    if (heldRef.current) {
      heldRef.current = false;
      setVis(false);
    }
  };

  return (
    <div className="relative">
      <input
        {...props}
        type={vis ? "text" : "password"}
        className={cn(
          "w-full rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm focus:border-ring focus:outline-none",
          className,
        )}
      />
      <button
        type="button"
        aria-label={vis ? "Skjul adgangskode" : "Hold for at se adgangskode"}
        onMouseDown={start}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchEnd={end}
        onTouchCancel={end}
        onClick={(e) => {
          // Hvis fokus via tastatur (ikke held), så toggle
          if (!heldRef.current) setVis((v) => !v);
          e.preventDefault();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition hover:text-foreground active:bg-muted/50"
        tabIndex={-1}
      >
        {vis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
