import { defineMcp, auth } from "@lovable.dev/mcp-js";
import listStoresTool from "./tools/list-stores";
import getStoreTool from "./tools/get-store";
import listProductsTool from "./tools/list-products";

const SUPABASE_URL = "https://dqepeywgftbpxeeqfuwt.supabase.co";

export default defineMcp({
  name: "shopbanao-mcp",
  title: "ShopBanao MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for exploring public ShopBanao storefronts. Use `list_stores` to discover shops, `get_store` for details by slug, and `list_products` to browse a shop's catalog.",
  // Require a verified OAuth bearer token (issued by our own auth server) before
  // any tool can be invoked — the server is no longer anonymously callable.
  auth: auth.oauth.issuer({
    issuer: `${SUPABASE_URL}/auth/v1`,
    resource: `${SUPABASE_URL}/functions/v1/mcp`,
    resourceName: "ShopBanao MCP",
    acceptedAudiences: ["authenticated"],
  }),
  tools: [listStoresTool, getStoreTool, listProductsTool],
});
