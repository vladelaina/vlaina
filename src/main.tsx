import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./fontImports";
import "./index.css";
import { isElectronRuntime } from "@/lib/electron/bridge";

const app = <App />;
const rootElement = document.getElementById("root") ?? document.body.appendChild(
  Object.assign(document.createElement("div"), { id: "root" })
);

ReactDOM.createRoot(rootElement).render(
  isElectronRuntime() ? app : (
    <React.StrictMode>
      {app}
    </React.StrictMode>
  ),
);
