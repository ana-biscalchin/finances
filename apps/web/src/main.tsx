import "@mantine/core/styles.css";

import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { SessionProvider } from "./app/session/SessionProvider";
import { theme } from "./theme";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <SessionProvider><App /></SessionProvider>
    </MantineProvider>
  </StrictMode>
);
