import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  title: 'Big Brother AI — Реалити-шоу с ИИ',
  description: 'Наблюдай за ИИ-агентами, которые живут, общаются, конфликтуют и влюбляются в виртуальном доме. Big Brother is watching.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={`${geistMono.variable} font-mono antialiased bg-gray-950 text-white`}>
        {children}
      </body>
    </html>
  )
}
