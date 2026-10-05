import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0f172a", 700: "#1e293b" },
        ocean: { DEFAULT: "#0284c7", 600: "#0369a1", 50: "#f0f9ff", 100: "#e0f2fe" },
        ok: { DEFAULT: "#10b981", 600: "#059669", 50: "#ecfdf5" },
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
