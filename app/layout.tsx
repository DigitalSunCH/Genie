import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Genie",
  description: "Your intelligent workspace",
};

const clerkAppearance = {
  variables: {
    colorBackground: "#0a0a0a",
    colorInputBackground: "#171717",
    colorInputText: "#fafafa",
    colorText: "#fafafa",
    colorTextSecondary: "#a3a3a3",
    colorPrimary: "#fafafa",
    colorTextOnPrimaryBackground: "#000000",
    colorDanger: "#ef4444",
    colorSuccess: "#22c55e",
    colorWarning: "#f59e0b",
    colorNeutral: "#a3a3a3",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-instrument-sans)",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none bg-neutral-950 border border-neutral-800",
    headerTitle: "text-white",
    headerSubtitle: "text-neutral-400",
    formButtonPrimary: "bg-white !text-black hover:bg-neutral-200",
    formFieldInput: "bg-neutral-900 border-neutral-800 text-white",
    formFieldLabel: "text-neutral-300",
    footerActionLink: "text-white hover:text-neutral-300",
    identityPreviewText: "text-white",
    identityPreviewEditButton: "text-neutral-400 hover:text-white",
    formFieldAction: "text-neutral-400 hover:text-white",
    otpCodeFieldInput: "bg-neutral-900 border-neutral-800 text-white",
    dividerLine: "bg-neutral-800",
    dividerText: "text-neutral-500",
    socialButtonsBlockButton: "bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800",
    socialButtonsBlockButtonText: "text-white",
    formFieldInputShowPasswordButton: "text-neutral-400 hover:text-white",
    alert: "bg-neutral-900 border-neutral-800",
    alertText: "text-neutral-300",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="de" className="dark" suppressHydrationWarning>
        <body
          className={`${instrumentSans.variable} ${instrumentSerif.variable} antialiased`}
          suppressHydrationWarning
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
