/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4f46e5",
        success: "#16a34a",
        danger: "#dc2626",
        warning: "#d97706",
      },
      borderRadius: { lg: "8px" },
    },
  },
  corePlugins: { preflight: false },
  plugins: [],
};
