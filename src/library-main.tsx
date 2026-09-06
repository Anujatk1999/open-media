import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LibraryPage } from "./modules/library/LibraryPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LibraryPage />
  </StrictMode>
);
