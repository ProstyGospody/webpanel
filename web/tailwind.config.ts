import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: "#f2f5f9",
          card: "#ffffff",
          border: "#d7dde6",
          text: "#1b2838",
          accent: "#0f5ca8",
          danger: "#a82020",
          success: "#0b7a42"
        },
      },
    },
  },
  plugins: [],
};

export default config;

