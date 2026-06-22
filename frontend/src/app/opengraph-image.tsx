import { ImageResponse } from "next/og";

export const alt = "Cortex";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// The cortex mark, drawn with satori-native divs + CSS rotation rather than an
// <img> of cortex-mark.svg: @vercel/og's rasterizer can't load that SVG (it uses
// fill="currentColor", which has no color context standalone), so an <img> render
// fails with "svgload_buffer: SVG rendering failed". Geometry mirrors the source
// SVG's 120-unit viewBox scaled x2.5 to a 300px box (circle r13; 8 spokes of two
// rounded bars at 45deg steps).
const MARK = "#0A0A0A";
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const BAR = {
  position: "absolute" as const,
  top: 47.5,
  width: 16.25,
  height: 62.5,
  borderRadius: 8.125,
  background: MARK,
};

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 300,
            height: 300,
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 117.5,
              top: 117.5,
              width: 65,
              height: 65,
              borderRadius: "50%",
              background: MARK,
            }}
          />
          {ANGLES.map((angle) => (
            <div
              key={angle}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 300,
                height: 300,
                display: "flex",
                transform: `rotate(${angle}deg)`,
              }}
            >
              <div style={{ ...BAR, left: 128.75 }} />
              <div style={{ ...BAR, left: 155 }} />
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
