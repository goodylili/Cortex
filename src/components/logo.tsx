const PETAL = "M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z";
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

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
          : "#0A0A0A";

  return (
    <svg
      viewBox="0 0 120 120"
      fill={fill}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="9" />
      {ANGLES.map((a) => (
        <path key={a} d={PETAL} transform={`rotate(${a} 60 60)`} />
      ))}
    </svg>
  );
}
