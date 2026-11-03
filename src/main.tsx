import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppUpdatesProvider } from "./appUpdates";
import { AppErrorProvider } from "./AppErrorProvider";
import { DESKTOP_PLATFORM } from "./platform/runtimePlatform";
import "./styles.css";

document.documentElement.dataset.platform = DESKTOP_PLATFORM;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppUpdatesProvider>
      <AppErrorProvider>
        <App />
      </AppErrorProvider>
    </AppUpdatesProvider>
  </React.StrictMode>,
);
