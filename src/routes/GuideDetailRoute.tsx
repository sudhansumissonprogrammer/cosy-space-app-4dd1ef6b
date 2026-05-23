import { HelmetProvider } from "react-helmet-async";
import GuideDetail from "@/pages/GuideDetail";

export default function GuideDetailRoute() {
  return (
    <HelmetProvider>
      <GuideDetail />
    </HelmetProvider>
  );
}
