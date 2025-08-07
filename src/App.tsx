import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import AuthPage from "./pages/auth/AuthPage";
import Dashboard from "./pages/dashboard/Dashboard";
import RestaurantsPage from "./pages/dashboard/restaurants/RestaurantsPage";
import NewRestaurantPage from "./pages/dashboard/restaurants/NewRestaurantPage";
import RestaurantDetailPage from "./pages/dashboard/restaurants/RestaurantDetailPage";
import MenusPage from "./pages/dashboard/menus/MenusPage";
import CategoriesPage from "./pages/dashboard/categories/CategoriesPage";
import DishesPage from "./pages/dashboard/dishes/DishesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={
            <AuthGuard>
              <DashboardLayout />
            </AuthGuard>
          }>
            <Route index element={<Dashboard />} />
            <Route path="restaurants" element={<RestaurantsPage />} />
            <Route path="restaurants/new" element={<NewRestaurantPage />} />
            <Route path="restaurants/:id" element={<RestaurantDetailPage />} />
            <Route path="menus" element={<MenusPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="dishes" element={<DishesPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
