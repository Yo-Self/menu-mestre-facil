import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { RestaurantProvider } from "./components/providers/RestaurantProvider";
import AuthPage from "./pages/auth/AuthPage";
import Dashboard from "./pages/dashboard/Dashboard";
import RestaurantsPage from "./pages/dashboard/restaurants/RestaurantsPage";
import NewRestaurantPage from "./pages/dashboard/restaurants/NewRestaurantPage";
import RestaurantDetailPage from "./pages/dashboard/restaurants/RestaurantDetailPage";
import EditRestaurantPage from "./pages/dashboard/restaurants/EditRestaurantPage";
import MenusPage from "./pages/dashboard/menus/MenusPage";
import MenuDetailPage from "./pages/dashboard/menus/MenuDetailPage";
import EditMenuPage from "./pages/dashboard/menus/EditMenuPage";
import CategoriesPage from "./pages/dashboard/categories/CategoriesPage";
import EditCategoryPage from "./pages/dashboard/categories/EditCategoryPage";
import CategoryDishesOrderPage from "./pages/dashboard/categories/CategoryDishesOrderPage";
import CategoryPreviewPage from "./pages/dashboard/categories/CategoryPreviewPage";
import CategoryDishesPage from "./pages/dashboard/categories/CategoryDishesPage";
import DishesPage from "./pages/dashboard/dishes/DishesPage";
import NewDishPage from "./pages/dashboard/dishes/NewDishPage";
import EditDishPage from "./pages/dashboard/dishes/EditDishPage";
import ManageComplementsPage from "./pages/dashboard/dishes/ManageComplementsPage";
import ComplementsPage from "./pages/dashboard/complements/ComplementsPage";
import NewCategoryPage from "./pages/dashboard/categories/NewCategoryPage";
import NewMenuPage from "./pages/dashboard/menus/NewMenuPage";
import SettingsPage from "./pages/dashboard/settings/SettingsPage";
import WaiterCallTestPage from "./pages/dashboard/WaiterCallTestPage";
import MenuImportPage from "./pages/dashboard/MenuImportPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/">
        <RestaurantProvider>
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
            <Route path="restaurants/:id/edit" element={<EditRestaurantPage />} />
            <Route path="menus" element={<MenusPage />} />
            <Route path="menus/new" element={<NewMenuPage />} />
            <Route path="menus/:id" element={<MenuDetailPage />} />
            <Route path="menus/:id/edit" element={<EditMenuPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="categories/new" element={<NewCategoryPage />} />
            <Route path="categories/:id/edit" element={<EditCategoryPage />} />
            <Route path="categories/:id/dishes" element={<CategoryDishesPage />} />
            <Route path="categories/:id/order" element={<CategoryDishesOrderPage />} />
            <Route path="categories/:id/preview" element={<CategoryPreviewPage />} />
            <Route path="dishes" element={<DishesPage />} />
            <Route path="dishes/new" element={<NewDishPage />} />
            <Route path="dishes/:id/edit" element={<EditDishPage />} />
            <Route path="dishes/:id/complements" element={<ManageComplementsPage />} />
            <Route path="complements" element={<ComplementsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="waiter-call-test" element={<WaiterCallTestPage />} />
            <Route path="import-menu" element={<MenuImportPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RestaurantProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
