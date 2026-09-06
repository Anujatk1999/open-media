import { ShotLibraryPage } from "./calibration/ShotLibraryPage";

/**
 * Shell for library.html — a pure visual browse/search/filter gallery over
 * the generated single-character shot set. "Preview"/"Add to Scene" open the
 * live 3D Shot Composer (a separate page, /composer) in a new tab rather than
 * routing to a second viewport here.
 */
export function LibraryPage() {
  return <ShotLibraryPage />;
}
