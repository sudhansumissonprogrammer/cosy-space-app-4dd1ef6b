import { useParams } from "react-router-dom";
import ProductForm from "@/components/ProductForm";

export default function EditProduct() {
  const { productId } = useParams<{ productId: string }>();
  return <ProductForm productId={productId} />;
}
