import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { discoveryPage, discoveryUrl } from "@/lib/catalogueDiscovery";

export default function CataloguePagination({ firstPageHasNext }: { firstPageHasNext: boolean }) {
  const { pathname, search } = useLocation();
  const page = discoveryPage(new URLSearchParams(search).get("page"));
  if (page === null || (page === 1 && !firstPageHasNext)) return null;
  return <nav aria-label="Product pages" className="flex items-center justify-center gap-4 py-4">
    {page > 1 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} to={discoveryUrl(pathname, page - 1)}><ArrowLeft className="mr-2 h-4 w-4" />Previous page</Link>}
    <span className="text-sm text-muted-foreground">{page}</span>
    {firstPageHasNext && <Link className={buttonVariants({ variant: "outline", size: "sm" })} to={discoveryUrl(pathname, page + 1)}>Next page<ArrowRight className="ml-2 h-4 w-4" /></Link>}
  </nav>;
}