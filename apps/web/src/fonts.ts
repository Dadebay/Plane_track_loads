import localFont from "next/font/local";

/**
 * Gilroy — brand typeface, self-hosted via next/font/local (no external
 * request, no layout shift, automatic font-display/preload).
 */
export const gilroy = localFont({
  src: [
    { path: "./fonts/Gilroy-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Gilroy-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Gilroy-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Gilroy-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-gilroy",
  display: "swap",
});
