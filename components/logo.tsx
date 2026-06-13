import React from "react";

// Cortex mark — radial burst. Transparent background; color is driven by the
// `variant` prop so it works on light and dark surfaces.
const PETAL = "M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z";
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const Logo = ({
  variant = "color",
}: {
  variant?: "black" | "color" | "white";
}) => {
  const fill =
    variant === "white" ? "#FFFFFF" : variant === "black" ? "#000000" : "#0A0A0A";

  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 120 120"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="9" />
      {ANGLES.map((a) => (
        <path key={a} d={PETAL} transform={`rotate(${a} 60 60)`} />
      ))}
    </svg>
  );
};

export default Logo;
