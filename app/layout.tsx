import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
