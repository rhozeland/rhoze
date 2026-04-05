import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        rhoze: {
          mint: "hsl(var(--rhoze-mint))",
          pink: "hsl(var(--rhoze-pink))",
          lavender: "hsl(var(--rhoze-lavender))",
          peach: "hsl(var(--rhoze-peach))",
          surface: "hsl(var(--rhoze-surface))",
          "surface-hover": "hsl(var(--rhoze-surface-hover))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "blob-drift-1": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg) scale(1)" },
          "25%": { transform: "translate(-8vw, 12vh) rotate(45deg) scale(1.08)" },
          "50%": { transform: "translate(5vw, -6vh) rotate(120deg) scale(0.95)" },
          "75%": { transform: "translate(10vw, 8vh) rotate(200deg) scale(1.05)" },
        },
        "blob-drift-2": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg) scale(1)" },
          "25%": { transform: "translate(10vw, -8vh) rotate(-60deg) scale(1.1)" },
          "50%": { transform: "translate(-6vw, 10vh) rotate(-150deg) scale(0.92)" },
          "75%": { transform: "translate(8vw, 4vh) rotate(-240deg) scale(1.06)" },
        },
        "blob-drift-3": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg) scale(1)" },
          "33%": { transform: "translate(-12vw, 6vh) rotate(80deg) scale(1.12)" },
          "66%": { transform: "translate(8vw, -10vh) rotate(190deg) scale(0.9)" },
        },
        "blob-morph": {
          "0%, 100%": { borderRadius: "40% 60% 55% 45% / 55% 40% 60% 45%" },
          "25%": { borderRadius: "55% 45% 40% 60% / 45% 55% 45% 55%" },
          "50%": { borderRadius: "45% 55% 60% 40% / 60% 45% 55% 40%" },
          "75%": { borderRadius: "60% 40% 45% 55% / 40% 60% 40% 60%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
