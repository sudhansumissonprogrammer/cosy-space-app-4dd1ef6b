import { defineMcp } from "@lovable.dev/mcp-js";
import listStoresTool from "./tools/list-stores";
import getStoreTool from "./tools/get-store";
import listProductsTool from "./tools/list-products";

export default defineMcp({
  name: "shopbanao-mcp",
  title: "ShopBanao MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for exploring public ShopBanao storefronts. Use `list_stores` to discover shops, `get_store` for details by slug, and `list_products` to browse a shop's catalog.",
  tools: [listStoresTool, getStoreTool, listProductsTool],
});
