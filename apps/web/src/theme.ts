import { createTheme, type MantineColorsTuple } from "@mantine/core";

const customColors: Record<string, MantineColorsTuple> = {
  navy: ["#f0f4ff", "#dce5f8", "#b9c9ec", "#91a9df", "#708dd4", "#5b7bce", "#315bb7", "#264b9b", "#1c3d80", "#102b60"],
  turquoise: ["#e6fcf9", "#c3f5ee", "#92e9df", "#5bdccf", "#32d2c2", "#1bcdbc", "#00b7a5", "#009485", "#00776b", "#005d53"],
  emerald: ["#ebfbee", "#d3f9d8", "#a8edb4", "#7de08f", "#58d675", "#3fce62", "#2ab34f", "#1e913f", "#147332", "#085523"],
  olive: ["#f6f8e8", "#e9edc8", "#d4dc9b", "#becb69", "#abba42", "#9dad2c", "#82931f", "#687617", "#535e10", "#404907"],
  amber: ["#fff8e1", "#ffedb3", "#ffdf80", "#ffd14d", "#ffc529", "#ffbd12", "#e3a400", "#b88300", "#926700", "#704d00"],
  coral: ["#fff0ed", "#ffddd6", "#ffb8ab", "#ff907d", "#fd7058", "#f95c42", "#df422a", "#bb3421", "#98291a", "#7d1e12"],
  burgundy: ["#faeef2", "#efd8e0", "#dcb0bf", "#c9849d", "#ba5f80", "#b1486e", "#9b3059", "#812548", "#691d3a", "#55132d"],
  plum: ["#f8eff8", "#ecd9ec", "#d9b3d9", "#c58ac5", "#b568b5", "#aa50aa", "#943b94", "#7a2f7a", "#642564", "#501950"],
  brown: ["#f8f1ec", "#eaded5", "#d6bcaa", "#c0977b", "#ae7857", "#a16440", "#8b4e31", "#733e27", "#5e321f", "#4c2718"],
  slate: ["#f1f3f5", "#dfe3e7", "#bec6ce", "#9ba8b3", "#7d8d9b", "#697b8b", "#536575", "#42515f", "#35424e", "#26323d"]
};

export const theme = createTheme({
  colors: customColors,
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  headings: {
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  }
});
