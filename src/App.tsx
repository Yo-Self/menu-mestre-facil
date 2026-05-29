import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UpdateNotification from "./components/UpdateNotification";
import { PostHogProvider } from "./components/providers/PostHogProvider";
import { PageViewTracker } from "./components/providers/PageViewTracker";
import { ErrorBoundary } from "./components/error/ErrorBoundary";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { RestaurantProvider } from "./components/providers/RestaurantProvider";
// import { RestaurantScheduleMonitor } from "./components/RestaurantScheduleMonitor";
import AuthPage from "./pages/auth/AuthPage";
import Dashboard from "./pages/dashboard/Dashboard";
import RestaurantsPage from "./pages/dashboard/restaurants/RestaurantsPage";
import NewRestaurantPage from "./pages/dashboard/restaurants/NewRestaurantPage";
import RestaurantDetailPage from "./pages/dashboard/restaurants/RestaurantDetailPage";
import EditRestaurantPage from "./pages/dashboard/restaurants/EditRestaurantPage";
import ReportsPage from "./pages/dashboard/restaurants/ReportsPage";
import RestaurantHoursPage from "./pages/dashboard/restaurants/RestaurantHoursPage";
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
import OrdersPage from "./pages/dashboard/orders/OrdersPage";
import OrderPresentationPage from "./pages/dashboard/orders/OrderPresentationPage";
import POSDashboard from "./pages/dashboard/pos/POSDashboard";
import POSTerminal from "./pages/dashboard/pos/POSTerminal";
import POSWaiterTerminal from "./pages/dashboard/pos/POSWaiterTerminal";
import ReportsGlobalPage from "./pages/dashboard/reports/ReportsGlobalPage";
import StockPage from "./pages/dashboard/stock/StockPage";
import PhysicalMenuPage from "./pages/dashboard/physical-menu/PhysicalMenuPage";
import NotFound from "./pages/NotFound";



const queryClient = new QueryClient();

// Detecta se a aplicação está rodando dentro do Electron
const isElectron = typeof window !== "undefined" && window.navigator.userAgent.toLowerCase().includes("electron");

// Componente wrapper para escolher dinamicamente o roteador
const AppRouter = ({ children }: { children: React.ReactNode }) => {
  if (isElectron) {
    return <HashRouter>{children}</HashRouter>;
  }
  return <BrowserRouter basename="/">{children}</BrowserRouter>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UpdateNotification />
      <PostHogProvider>
        <ErrorBoundary>
          <AppRouter>
            <PageViewTracker />
            <RestaurantProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/orders/:restaurantId/presentation" element={<OrderPresentationPage />} />
                <Route path="/tv/:restaurantId" element={<OrderPresentationPage />} />
                <Route element={
                  <AuthGuard>
                    <DashboardLayout />
                  </AuthGuard>
                }>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/dashboard/restaurants" element={<RestaurantsPage />} />
                  <Route path="/dashboard/restaurants/new" element={<NewRestaurantPage />} />
                  <Route path="/dashboard/restaurants/:id" element={<RestaurantDetailPage />} />
                  <Route path="/dashboard/restaurants/:id/edit" element={<EditRestaurantPage />} />
                  <Route path="/dashboard/restaurants/:id/reports" element={<ReportsPage />} />
                  <Route path="/dashboard/restaurants/:id/hours" element={<RestaurantHoursPage />} />
                  <Route path="/dashboard/menus" element={<MenusPage />} />
                  <Route path="/dashboard/menus/new" element={<NewMenuPage />} />
                  <Route path="/dashboard/menus/:id" element={<MenuDetailPage />} />
                  <Route path="/dashboard/menus/:id/edit" element={<EditMenuPage />} />
                  <Route path="/dashboard/categories" element={<CategoriesPage />} />
                  <Route path="/dashboard/categories/new" element={<NewCategoryPage />} />
                  <Route path="/dashboard/categories/:id/edit" element={<EditCategoryPage />} />
                  <Route path="/dashboard/categories/:id/dishes" element={<CategoryDishesPage />} />
                  <Route path="/dashboard/categories/:id/order" element={<CategoryDishesOrderPage />} />
                  <Route path="/dashboard/categories/:id/preview" element={<CategoryPreviewPage />} />
                  <Route path="/dashboard/dishes" element={<DishesPage />} />
                  <Route path="/dashboard/dishes/new" element={<NewDishPage />} />
                  <Route path="/dashboard/dishes/:id/edit" element={<EditDishPage />} />
                  <Route path="/dashboard/dishes/:id/complements" element={<ManageComplementsPage />} />
                  <Route path="/dashboard/complements" element={<ComplementsPage />} />
                  <Route path="/dashboard/settings" element={<SettingsPage />} />
                  <Route path="/dashboard/waiter-call-test" element={<WaiterCallTestPage />} />
                  <Route path="/dashboard/import-menu" element={<MenuImportPage />} />
                  <Route path="/dashboard/pos" element={<POSDashboard />} />
                  <Route path="/dashboard/pos/terminal" element={<POSTerminal />} />
                  <Route path="/dashboard/pos/waiter" element={<POSWaiterTerminal />} />
                  <Route path="/dashboard/reports" element={<ReportsGlobalPage />} />
                  <Route path="/dashboard/stock" element={<StockPage />} />
                  <Route path="/dashboard/physical-menu" element={<PhysicalMenuPage />} />


                  <Route path="/orders/:restaurantId" element={<OrdersPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </RestaurantProvider>
          </AppRouter>
        </ErrorBoundary>
      </PostHogProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
