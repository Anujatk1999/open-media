import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelpPage } from "./modules/help/HelpPage";
import "./app/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelpPage />
  </StrictMode>
);
