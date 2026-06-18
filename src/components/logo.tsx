const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const BRAND = "#0A0A0A";

export function Logo({
  variant = "color",
  className,
}: {
  variant?: "black" | "color" | "white" | "current";
  className?: string;
}) {
  const fill =
    variant === "current"
      ? "currentColor"
      : variant === "white"
        ? "#FFFFFF"
        : variant === "black"
          ? "#000000"
          : BRAND;

  return (
    <svg
      viewBox="0 0 120 120"
      fill={fill}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="13" />
      {ANGLES.map((a) => (
        <g key={a} transform={`rotate(${a} 60 60)`}>
          <rect x="51.5" y="19" width="6.5" height="25" rx="3.25" />
          <rect x="62" y="19" width="6.5" height="25" rx="3.25" />
        </g>
      ))}
    </svg>
  );
}
