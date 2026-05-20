import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./fontImports";
import "./index.css";
import { isElectronRuntime } from "@/lib/electron/bridge";

const app = <App />;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  isElectronRuntime() ? app : (
    <React.StrictMode>
      {app}
    </React.StrictMode>
  ),
);
