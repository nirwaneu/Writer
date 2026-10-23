import { cn } from "@/lib/utils";

const PALETTES = [
  { bg: "#1b2a36", fg: "#efe6d2", accent: "#f2a93b", spine: "#0f1a23" },
  { bg: "#4a1f22", fg: "#f0e4cf", accent: "#d9a441", spine: "#2e1113" },
  { bg: "#1f3a2e", fg: "#eee6d2", accent: "#c9a45c", spine: "#12241b" },
  { bg: "#2b2f3a", fg: "#e9e2d4", accent: "#c98a4b", spine: "#191c24" },
  { bg: "#3a2438", fg: "#f0e5d8", accent: "#d9a86a", spine: "#241522" },
  { bg: "#5a3a1c", fg: "#f3e8d2", accent: "#1a1712", spine: "#38230f" },
];

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

export function BookCover({
  title,
  slug,
  imageSrc,
  className,
  size = "sm",
}: {
  title: string;
  slug: string;
  imageSrc?: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  const palette = PALETTES[hash(slug) % PALETTES.length];
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex select-none flex-col overflow-hidden rounded-[3px] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.75)]",
        size === "sm" ? "h-[84px] w-14" : "h-[300px] w-[200px]",
        className,
      )}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      {imageSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_35%,rgba(0,0,0,0.72)_100%)]" />
        </>
      ) : (
        <>
          <div
            className="absolute inset-y-0 left-0 w-[9%]"
            style={{
              background: `linear-gradient(90deg, ${palette.spine}, ${palette.bg})`,
              boxShadow:
                "inset -1px 0 0 rgba(0,0,0,0.35), inset 1px 0 0 rgba(255,255,255,0.08)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1px, transparent 1px, transparent 3px)",
            }}
          />
        </>
      )}
      <div
        className={cn(
          "relative flex h-full flex-col",
          size === "sm" ? "px-1.5 py-2 pl-3" : "px-4 py-5 pl-7",
          imageSrc && "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]",
        )}
      >
        <span
          className={cn("font-mono uppercase", size === "sm" ? "text-[5px] tracking-[0.14em]" : "text-[8px] tracking-[0.2em]")}
          style={{ color: imageSrc ? "#f5eedf" : palette.accent }}
        >
          A novel
        </span>
        <span
          className={cn(
            "mt-auto font-serif font-semibold leading-[1.15] tracking-[-0.01em]",
            size === "sm" ? "line-clamp-3 text-[8px]" : "line-clamp-4 text-[21px]",
          )}
        >
          {title}
        </span>
        <span
          className={cn("mt-2 block h-px", size === "sm" ? "w-4" : "w-10")}
          style={{ backgroundColor: imageSrc ? "#f5eedf" : palette.accent, opacity: 0.7 }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-inset ring-white/10" />
    </div>
  );
}
