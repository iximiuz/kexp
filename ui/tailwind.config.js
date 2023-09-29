import daisyui from "daisyui";
import defaultTheme from "tailwindcss/defaultTheme";

module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'media', // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        "status-waiting": "#ccc",
        "status-starting": "rgb(149, 251, 149)",
        "status-not-ready": "rgb(253, 224, 71)",
        "status-ready": "rgb(34, 197, 94)",
        "status-terminated-ok": "#a1dea1",
        "status-terminated-ko": "#e36561",
      },
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
      transitionProperty: {
        height: "height",
      },
    },
    // flex: {
    //   '1': '1 1 0%',
    //   auto: '1 1 auto',
    //   initial: '0 1 auto',
    //   none: 'none',
    //   '4': '4 4 0%',
    // }
  },
  variants: {
    extend: {
      cursor: ['disabled'],
      opacity: ['disabled'],
      text: ['disabled'],
    },
  },
  plugins: [
    daisyui,
  ],
  daisyui: {
    themes: [
        {
          cmyk: {
            ...require("daisyui/src/theming/themes")["[data-theme=cmyk]"],
            "base-200": "rgb(250, 250, 249)",
            "base-300": "rgb(245, 245, 244)",
          },
        },
      ],
    rtl: false,
  },
}
