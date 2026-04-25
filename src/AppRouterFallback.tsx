/**
 * Fallback wrapper used by LandingApp when the user navigates away from `/`.
 * Re-exports the full App so it's pulled into a single lazy chunk on demand.
 *
 * Why a separate file: importing App.tsx directly from LandingApp would
 * make Vite hoist all of App.tsx's static imports (QueryClient, BrowserRouter,
 * 30+ lazy refs) into the landing critical-path chunk — defeating the point.
 * This indirection guarantees a clean code-split boundary.
 */
import App from "./App";
export default App;
