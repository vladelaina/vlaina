import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initHighlighter } from "./lib/highlighter";

// Initialize shiki highlighter
initHighlighter().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
