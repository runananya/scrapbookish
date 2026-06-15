import { Caveat, Kalam, Permanent_Marker, Shadows_Into_Light } from "next/font/google";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-caveat",
});

const kalam = Kalam({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-kalam",
});

const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-permanent-marker",
});

const shadowsIntoLight = Shadows_Into_Light({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-shadows-into-light",
});

export const metadata = {
  title: "Scrapbook — your places, your friends, your scrapbook",
  description: "A social scrapbook for places you've been, want to go, and want to share with friends.",
};

export default function RootLayout({ children }) {
  const fontVars = `${caveat.variable} ${kalam.variable} ${permanentMarker.variable} ${shadowsIntoLight.variable}`;
  return (
    <html lang="en" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
