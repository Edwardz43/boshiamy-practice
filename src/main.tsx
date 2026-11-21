import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { initThemeFromStorage, ThemeProvider } from "./theme";
import "./index.css";

initThemeFromStorage();
registerSW({ immediate: true });

const el = document.getElementById("root");
if (!el) throw new Error("root missing");
createRoot(el).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
