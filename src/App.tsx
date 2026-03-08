import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import StoresList from "./pages/StoresList";
import CreateStore from "./pages/CreateStore";
import ProductsList from "./pages/ProductsList";
import CreateProduct from "./pages/CreateProduct";
import EditProduct from "./pages/EditProduct";
import StorefrontLayout from "./layouts/StorefrontLayout";
import StorefrontHome from "./pages/StorefrontHome";
import ProductDetail from "./pages/ProductDetail";
import StoreOrders from "./pages/StoreOrders";
import Placeholder from "./pages/Placeholder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/store/:slug" element={<StorefrontLayout />}>
              <Route index element={<StorefrontHome />} />
              <Route path="product/:productSlug" element={<ProductDetail />} />
            </Route>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="stores" element={<StoresList />} />
              <Route path="stores/create" element={<CreateStore />} />
              <Route path="stores/:storeId/products" element={<ProductsList />} />
              <Route path="stores/:storeId/products/create" element={<CreateProduct />} />
              <Route path="stores/:storeId/products/:productId/edit" element={<EditProduct />} />
              <Route path="analytics" element={<Placeholder />} />
              <Route path="users" element={<Placeholder />} />
              <Route path="documents" element={<Placeholder />} />
              <Route path="settings" element={<Placeholder />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
