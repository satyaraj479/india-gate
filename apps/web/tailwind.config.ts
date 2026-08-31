import type { Config } from "tailwindcss";

/**
 * The brand palette is declared once, here, as HSL channel triplets in
 * `globals.css` and referenced through `hsl(var(--token))`.
 *
 * Why channel triplets rather than hex: it lets any colour take an opacity
 * modifier — `bg-gold/10`, `border-gold/20` — which this design leans on
 * heavily for the gold hairlines and glows. Hex values in CSS variables
 * cannot do that.
 *
 *   navy   #0A1128  →  hsl(226 60% 10%)
 *   gold   #D4AF37  →  hsl(46 65% 52%)
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1360px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        navy: {
          950: "hsl(var(--navy-950))",
          900: "hsl(var(--navy-900))",
          800: "hsl(var(--navy-800))",
          700: "hsl(var(--navy-700))",
          600: "hsl(var(--navy-600))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold-500))",
          400: "hsl(var(--gold-400))",
          500: "hsl(var(--gold-500))",
          600: "hsl(var(--gold-600))",
        },

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        // Menu semantics. Kept out of the neutral scale on purpose: a veg dot
        // is a regulated marking in South Asian markets, not a design choice,
        // and it must not drift when the brand palette is retuned.
        veg: "hsl(var(--veg))",
        nonveg: "hsl(var(--nonveg))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        gold: "0 0 0 1px hsl(var(--gold-500) / 0.25), 0 8px 30px -12px hsl(var(--gold-500) / 0.45)",
        lift: "0 18px 40px -24px hsl(226 60% 4% / 0.9)",
      },
      backgroundImage: {
        "gold-sheen":
          "linear-gradient(120deg, hsl(var(--gold-600)) 0%, hsl(var(--gold-400)) 45%, hsl(var(--gold-600)) 100%)",
        "navy-fade":
          "linear-gradient(180deg, hsl(var(--navy-900)) 0%, hsl(var(--navy-950)) 100%)",
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
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-500px 0" },
          "100%": { backgroundPosition: "500px 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
