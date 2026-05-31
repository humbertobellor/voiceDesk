import type { Metadata } from 'next'
import { Inter_Tight, JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

/**
 * Inter Tight — UI font for all dashboard chrome: nav, buttons, form labels,
 * table cells. Corresponds to --font-ui / font-ui Tailwind class.
 */
const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter-tight',
})

/**
 * JetBrains Mono — monospace for phone numbers, call durations, numeric data.
 * Sidesteps the Bogart trial digit watermark issue.
 * Corresponds to --font-mono / font-mono Tailwind class.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
})

/**
 * Bogart — Indian Type Foundry editorial-classical serif.
 * Trial files: digits (U+0030-0039) replaced by watermark glyphs; use
 * font-mono (JetBrains Mono) for all numeric display.
 * Corresponds to --font-display / --font-body / font-display / font-body.
 *
 * NOTE: 18 font-face entries cover all weight/style combinations present in
 * the trial package. Only weights 400 and 600 are actively applied in
 * component classes this phase.
 */
const bogart = localFont({
  src: [
    { path: '../fonts/bogart/Bogart-Thin-trial.ttf',           weight: '100', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Thin-Italic-trial.ttf',    weight: '100', style: 'italic' },
    { path: '../fonts/bogart/Bogart-Extralight-trial.ttf',     weight: '200', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Extralight-Italic-trial.ttf', weight: '200', style: 'italic' },
    { path: '../fonts/bogart/Bogart-Light-trial.ttf',          weight: '300', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Light-Italic-trial.ttf',   weight: '300', style: 'italic' },
    { path: '../fonts/bogart/Bogart-Regular-trial.ttf',        weight: '400', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Italic-trial.ttf',         weight: '400', style: 'italic' },
    { path: '../fonts/bogart/Bogart-Medium-trial.ttf',         weight: '500', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Medium-Italic-trial.ttf',  weight: '500', style: 'italic' },
    { path: '../fonts/bogart/Bogart-Semibold-trial.ttf',       weight: '600', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Semibold-Italic-trial.ttf', weight: '600', style: 'italic' },
    { path: '../fonts/bogart/Bogart-Bold-trial.ttf',           weight: '700', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Bold-Italic-trial.ttf',    weight: '700', style: 'italic' },
    { path: '../fonts/bogart/Bogart-Extrabold-trial.ttf',      weight: '800', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Extrabold-Italic-trial.ttf', weight: '800', style: 'italic' },
    { path: '../fonts/bogart/Bogart-Black-trial.ttf',          weight: '900', style: 'normal' },
    { path: '../fonts/bogart/Bogart-Black-Italic-trial.ttf',   weight: '900', style: 'italic' },
  ],
  variable: '--font-bogart',
})

export const metadata: Metadata = {
  title: 'VoiceDesk',
  description: '24/7 AI phone receptionist for HVAC, plumbing, and electrical contractors',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bogart.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-ui antialiased bg-bg text-fg-1">
        {children}
      </body>
    </html>
  )
}
