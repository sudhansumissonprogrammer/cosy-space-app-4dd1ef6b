import { Navigate, useOutletContext } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function StorefrontSignup() {
  const store = useOutletContext<StoreData>();
  return <Navigate to={storefrontPath(store.slug, "login")} replace />;
}
