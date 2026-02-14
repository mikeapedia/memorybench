import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { Providers } from "@/components/providers"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "700"],
  display: "swap",
})

const dmSans = localFont({
  src: [
    {
      path: "../public/fonts/DMSans.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/DMSans.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-dm-sans",
  display: "swap",
})

const dmMono = localFont({
  src: "../public/fonts/DMMono.woff2",
  variable: "--font-dm-mono",
  weight: "400",
  style: "normal",
  display: "swap",
})


export const metadata: Metadata = {
  title: "MemoryBench",
  description: "Benchmarking Framework for Memory Layer Providers",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body className="min-h-screen bg-bg-primary font-body">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-6 min-w-0 overflow-x-hidden">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
