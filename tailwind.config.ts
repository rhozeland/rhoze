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
        "grad-drift-1": {
          "0%, 100%": { transform: "translate(0, 0) scale(1) rotate(0deg)" },
          "25%": { transform: "translate(5%, -8%) scale(1.1) rotate(3deg)" },
          "50%": { transform: "translate(-3%, 6%) scale(1.05) rotate(-2deg)" },
          "75%": { transform: "translate(7%, 4%) scale(0.95) rotate(4deg)" },
        },
        "grad-drift-2": {
          "0%, 100%": { transform: "translate(0, 0) scale(1.05) rotate(0deg)" },
          "33%": { transform: "translate(-8%, 5%) scale(1.15) rotate(-4deg)" },
          "66%": { transform: "translate(6%, -6%) scale(0.9) rotate(3deg)" },
        },
        "grad-drift-3": {
          "0%, 100%": { transform: "translate(0, 0) scale(1) rotate(0deg)" },
          "20%": { transform: "translate(10%, 3%) scale(1.2) rotate(5deg)" },
          "50%": { transform: "translate(-5%, -10%) scale(1.08) rotate(-3deg)" },
          "80%": { transform: "translate(3%, 8%) scale(0.95) rotate(2deg)" },
        },
        "grad-fade-1": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.7" },
        },
        "grad-fade-2": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.6" },
        },
        "grad-fade-3": {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "0.5" },
        },
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 6s ease-in-out infinite",
        "marquee": "marquee 60s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
