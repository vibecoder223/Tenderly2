import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#00872F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#FCFCF9",
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: "Arial, sans-serif",
          }}
        >
          P
        </span>
      </div>
    ),
    size
  );
}
