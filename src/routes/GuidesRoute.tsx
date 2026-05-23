import { HelmetProvider } from "react-helmet-async";
import Guides from "@/pages/Guides";

export default function GuidesRoute() {
  return (
    <HelmetProvider>
      <Guides />
    </HelmetProvider>
  );
}
