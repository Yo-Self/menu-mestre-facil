import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useRestaurant } from "@/components/providers/RestaurantProvider";
import { usePrinting as useAppPrinting } from "@/hooks/usePrinting";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, 
  Settings, 
  Eye, 
  ArrowLeft, 
  Sparkles, 
  Check, 
  Maximize, 
  Minimize, 
  Palette,
  EyeOff
} from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  image_url: string;
  address?: string;
  cuisine_type?: string;
}

interface Category {
  id: string;
  name: string;
  position: number;
}

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string;
  is_available: boolean;
  category_id: string | null;
  dish_categories: {
    category_id: string;
  }[];
}

interface Menu {
  id: string;
  name: string;
  is_active: boolean;
}

const ACCENT_COLORS = [
  { name: "Burgundy/Vinho", hex: "#7f1d1d" },
  { name: "Gold/Ouro", hex: "#b45309" },
  { name: "Emerald/Esmeralda", hex: "#065f46" },
  { name: "Navy/Marinho", hex: "#1e3a8a" },
  { name: "Charcoal/Grafite", hex: "#1f2937" },
  { name: "Rose/Rosa Seco", hex: "#9d174d" }
];

export default function PhysicalMenuPage() {
  const { currentRestaurantId } = useRestaurant();
  const { printHtml } = useAppPrinting();
  const { toast } = useToast();

  // Query States
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [printingStatus, setPrintingStatus] = useState(false);

  // Customization States
  const [selectedTemplate, setSelectedTemplate] = useState<"classic" | "minimalist" | "rustique" | "tropical" | "bold" | "thermal" | "gallery" | "gourmet">("classic");
  const [fontSize, setFontSize] = useState<number>(14);
  const [spacing, setSpacing] = useState<"compact" | "normal" | "spacious">("normal");
  const [accentColor, setAccentColor] = useState<string>("#7f1d1d");
  const [title, setTitle] = useState<string>("");
  const [subtitle, setSubtitle] = useState<string>("Sabores Únicos, Momentos Especiais");
  const [footer, setFooter] = useState<string>("Obrigado pela preferência! Taxa de serviço opcional de 10%.");
  
  // Toggles
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showImages, setShowImages] = useState(false);
  const [showBorders, setShowBorders] = useState(true);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [showWatermark, setShowWatermark] = useState(false);
  
  // Local active items filtered out
  const [hiddenDishes, setHiddenDishes] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  // Fetch initial restaurant list
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name, image_url, address, cuisine_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        
        setRestaurants(data || []);
        
        if (currentRestaurantId) {
          setSelectedRestaurantId(currentRestaurantId);
        } else if (data && data.length > 0) {
          setSelectedRestaurantId(data[0].id);
        }
      } catch (error: any) {
        toast({
          title: "Erro ao buscar restaurantes",
          description: error.message,
          variant: "destructive"
        });
      }
    };

    fetchRestaurants();
  }, [currentRestaurantId]);

  // Fetch categories, dishes, and menus when restaurant changes
  useEffect(() => {
    if (!selectedRestaurantId) return;
    
    const fetchRestaurantData = async () => {
      setLoading(true);
      try {
        setHiddenDishes(new Set());
        setHiddenCategories(new Set());

        const { data: catData, error: catError } = await supabase
          .from("categories")
          .select("id, name, position")
          .eq("restaurant_id", selectedRestaurantId)
          .order("position", { ascending: true });

        if (catError) throw catError;
        setCategories(catData || []);

        const { data: dishData, error: dishError } = await supabase
          .from("dishes")
          .select(`
            id,
            name,
            description,
            price,
            image_url,
            is_available,
            category_id,
            dish_categories (
              category_id
            )
          `)
          .eq("restaurant_id", selectedRestaurantId);

        if (dishError) throw dishError;
        setDishes(dishData as unknown as Dish[] || []);

        const { data: menuData, error: menuError } = await supabase
          .from("menus")
          .select("id, name, is_active")
          .eq("restaurant_id", selectedRestaurantId);

        if (menuError) throw menuError;
        setMenus(menuData || []);

      } catch (error: any) {
        toast({
          title: "Erro ao buscar dados do restaurante",
          description: error.message,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurantData();
  }, [selectedRestaurantId]);

  // Active Restaurant Object
  const selectedRestaurant = useMemo(() => {
    return restaurants.find(r => r.id === selectedRestaurantId);
  }, [restaurants, selectedRestaurantId]);

  // Sync title when restaurant changes
  useEffect(() => {
    if (selectedRestaurant) {
      setTitle(selectedRestaurant.name.toUpperCase());
    }
  }, [selectedRestaurant]);

  // Smart template effect: gallery & gourmet templates force images and watermarks on
  useEffect(() => {
    if (selectedTemplate === "gallery" || selectedTemplate === "gourmet") {
      setShowImages(true);
      setShowWatermark(true);
    }
  }, [selectedTemplate]);

  // Group dishes by category
  const categorizedData = useMemo(() => {
    const map: { [catId: string]: Dish[] } = {};
    
    categories.forEach(cat => {
      map[cat.id] = [];
    });
    
    const OTHER_CAT_ID = "other";
    map[OTHER_CAT_ID] = [];

    dishes.forEach(dish => {
      if (onlyAvailable && !dish.is_available) return;
      if (hiddenDishes.has(dish.id)) return;

      let added = false;

      if (dish.dish_categories && dish.dish_categories.length > 0) {
        dish.dish_categories.forEach(dc => {
          if (map[dc.category_id]) {
            map[dc.category_id].push(dish);
            added = true;
          }
        });
      } 
      
      if (!added && dish.category_id && map[dish.category_id]) {
        map[dish.category_id].push(dish);
        added = true;
      }

      if (!added) {
        map[OTHER_CAT_ID].push(dish);
      }
    });

    const list = categories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        position: cat.position,
        dishes: map[cat.id] || []
      }))
      .filter(c => c.dishes.length > 0 && !hiddenCategories.has(c.id));

    if (map[OTHER_CAT_ID].length > 0 && !hiddenCategories.has(OTHER_CAT_ID)) {
      list.push({
        id: OTHER_CAT_ID,
        name: "Outros",
        position: 9999,
        dishes: map[OTHER_CAT_ID]
      });
    }

    return list;
  }, [categories, dishes, onlyAvailable, hiddenDishes, hiddenCategories]);

  // Toggle visibility handlers
  const toggleDishVisibility = (dishId: string) => {
    setHiddenDishes(prev => {
      const next = new Set(prev);
      if (next.has(dishId)) {
        next.delete(dishId);
      } else {
        next.add(dishId);
      }
      return next;
    });
  };

  const toggleCategoryVisibility = (catId: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  // Compile full HTML + CSS document string for printing
  const generatePrintableHtml = () => {
    const restName = selectedRestaurant?.name || "Restaurante";
    const logoUrl = selectedRestaurant?.image_url || "";
    const printTitle = title || restName;
    
    // Spacing classes mapping
    const paddingVal = spacing === "compact" ? "4px" : spacing === "spacious" ? "12px" : "8px";
    const marginVal = spacing === "compact" ? "6px" : spacing === "spacious" ? "18px" : "12px";

    // Build the structural HTML for categories and dishes
    const itemsHtml = categorizedData.map(cat => `
      <div class="category-block">
        <h2 class="category-title">${cat.name.toUpperCase()}</h2>
        <div class="dishes-grid">
          ${cat.dishes.map(dish => `
            <div class="dish-item">
              <div class="dish-header">
                ${showImages && dish.image_url ? `
                  <img class="dish-img" src="${dish.image_url}" alt="${dish.name}" />
                ` : ""}
                <div class="dish-text-wrapper">
                  <div class="dish-title-row">
                    <span class="dish-name">${dish.name}</span>
                    <span class="dish-leader"></span>
                    ${showPrices ? `<span class="dish-price">R$ ${dish.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>` : ""}
                  </div>
                  ${showDescriptions && dish.description ? `<p class="dish-description">${dish.description}</p>` : ""}
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    // Background logo watermark definition
    const watermarkCss = showWatermark && logoUrl ? `
      .menu-container {
        position: relative;
      }
      .menu-container::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-10deg);
        width: 380px;
        height: 380px;
        background-image: url('${logoUrl}');
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        opacity: 0.05;
        pointer-events: none;
        z-index: 0;
      }
    ` : "";

    // Templates styles definition
    let templateStyles = "";

    if (selectedTemplate === "classic") {
      templateStyles = `
        body { font-family: 'Playfair Display', Georgia, serif; color: #1c1917; background-color: #fafaf9; }
        .menu-container { border: 2px double ${accentColor}; padding: 30px; margin: 15px; border-radius: 4px; box-shadow: inset 0 0 0 4px #fafaf9, inset 0 0 0 6px ${accentColor}; }
        .restaurant-title { font-weight: 700; font-size: 32px; color: ${accentColor}; letter-spacing: 2px; }
        .menu-subtitle { font-style: italic; font-size: 16px; color: #57534e; margin-bottom: 20px; font-family: 'Georgia', serif; }
        .category-title { border-bottom: 1px solid ${accentColor}; padding-bottom: 4px; font-weight: 700; font-size: 20px; color: ${accentColor}; margin-top: ${marginVal}; margin-bottom: 12px; text-align: center; font-family: 'Playfair Display', serif; letter-spacing: 1px; }
        .dish-item { margin-bottom: ${paddingVal}; padding-bottom: ${paddingVal}; page-break-inside: avoid; }
        .dish-name { font-weight: 700; font-size: ${fontSize}px; color: #1c1917; font-family: 'Playfair Display', serif; }
        .dish-price { font-weight: 700; font-size: ${fontSize}px; color: ${accentColor}; }
        .dish-leader { flex-grow: 1; border-bottom: 1px dotted #a8a29e; margin: 0 8px; position: relative; bottom: 4px; }
        .dish-description { font-style: italic; font-size: ${fontSize - 2}px; color: #57534e; margin-top: 2px; font-family: 'Georgia', serif; }
        .menu-footer { border-top: 1px solid #e7e5e4; padding-top: 15px; font-size: 13px; color: #78716c; font-style: italic; font-family: 'Georgia', serif; }
      `;
    } else if (selectedTemplate === "minimalist") {
      templateStyles = `
        body { font-family: 'Inter', sans-serif; color: #0f172a; background-color: #ffffff; }
        .menu-container { padding: 40px 20px; max-width: 800px; margin: auto; }
        .restaurant-title { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 36px; text-transform: uppercase; letter-spacing: 3px; color: #0f172a; }
        .menu-subtitle { font-family: 'Inter', sans-serif; font-weight: 400; font-size: 14px; text-transform: uppercase; color: #64748b; margin-bottom: 30px; letter-spacing: 1px; }
        .category-title { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 16px; text-transform: uppercase; color: #0f172a; border-left: 4px solid ${accentColor}; padding-left: 10px; margin-top: ${marginVal}; margin-bottom: 15px; letter-spacing: 1px; }
        .dish-item { margin-bottom: ${paddingVal}; page-break-inside: avoid; }
        .dish-name { font-weight: 600; font-size: ${fontSize}px; color: #0f172a; }
        .dish-price { font-weight: 700; font-size: ${fontSize}px; color: ${accentColor}; }
        .dish-leader { display: none; }
        .dish-title-row { display: flex; justify-content: space-between; align-items: baseline; }
        .dish-description { font-size: ${fontSize - 2}px; color: #475569; margin-top: 4px; line-height: 1.5; font-weight: 400; }
        .menu-footer { border-top: 2px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
      `;
    } else if (selectedTemplate === "rustique") {
      templateStyles = `
        body { font-family: 'Merriweather', serif; color: #3b2314; background-color: #fdfaf7; }
        .menu-container { border: 3px solid #d4c5b9; padding: 25px; margin: 10px; border-radius: 8px; }
        .restaurant-title { font-weight: 700; font-size: 30px; color: #3b2314; text-transform: capitalize; }
        .menu-subtitle { font-style: italic; font-size: 15px; color: #705846; margin-bottom: 25px; }
        .category-title { font-weight: 700; font-size: 18px; color: #705846; margin-top: ${marginVal}; margin-bottom: 12px; text-align: center; border-top: 1px solid #d4c5b9; border-bottom: 1px solid #d4c5b9; padding: 6px 0; letter-spacing: 0.5px; }
        .dish-item { margin-bottom: ${paddingVal}; page-break-inside: avoid; }
        .dish-name { font-weight: 700; font-size: ${fontSize}px; color: #3b2314; }
        .dish-price { font-weight: 700; font-size: ${fontSize}px; color: ${accentColor}; font-family: 'Courier New', monospace; }
        .dish-leader { flex-grow: 1; border-bottom: 1px dashed #d4c5b9; margin: 0 6px; position: relative; bottom: 3px; }
        .dish-description { font-size: ${fontSize - 2}px; color: #5c4839; margin-top: 3px; font-style: normal; line-height: 1.4; }
        .menu-footer { border-top: 1px dashed #d4c5b9; padding-top: 15px; font-size: 13px; color: #8c7662; text-align: center; }
      `;
    } else if (selectedTemplate === "tropical") {
      templateStyles = `
        body { font-family: 'Outfit', 'Poppins', sans-serif; color: #1e293b; background-color: #fafaf9; }
        .menu-container { padding: 35px 25px; }
        .restaurant-title { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 34px; color: ${accentColor}; }
        .menu-subtitle { font-size: 15px; color: #475569; margin-bottom: 25px; font-weight: 500; }
        .category-title { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 18px; color: #ffffff; background: linear-gradient(135deg, ${accentColor}, #0ea5e9); padding: 8px 16px; border-radius: 30px; margin-top: ${marginVal}; margin-bottom: 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .dishes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        @media print { .dishes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; } }
        .dish-item { background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 12px; margin-bottom: 0px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); page-break-inside: avoid; }
        .dish-name { font-weight: 700; font-size: ${fontSize}px; color: #1e293b; }
        .dish-price { font-weight: 700; font-size: ${fontSize}px; color: #0284c7; }
        .dish-leader { display: none; }
        .dish-title-row { display: flex; justify-content: space-between; align-items: baseline; }
        .dish-description { font-size: ${fontSize - 2}px; color: #64748b; margin-top: 4px; line-height: 1.4; font-weight: 400; }
        .menu-footer { grid-column: span 2; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; }
      `;
    } else if (selectedTemplate === "bold") {
      templateStyles = `
        body { font-family: 'Roboto', sans-serif; color: #000000; background-color: #ffffff; }
        .menu-container { border: 4px solid #000000; padding: 30px; margin: 10px; }
        .restaurant-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 40px; text-transform: uppercase; color: #000000; text-align: center; border-bottom: 8px solid #000000; padding-bottom: 10px; }
        .menu-subtitle { font-family: 'Oswald', sans-serif; font-weight: 500; font-size: 16px; text-transform: uppercase; color: #000000; text-align: center; margin-top: 10px; margin-bottom: 25px; letter-spacing: 2px; }
        .category-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 20px; text-transform: uppercase; color: #ffffff; background-color: #000000; padding: 6px 12px; margin-top: ${marginVal}; margin-bottom: 15px; letter-spacing: 1px; }
        .dish-item { margin-bottom: ${paddingVal}; page-break-inside: avoid; border-bottom: 1px solid #e5e7eb; padding-bottom: ${paddingVal}; }
        .dish-item:last-child { border-bottom: none; }
        .dish-name { font-weight: 700; font-size: ${fontSize}px; color: #000000; text-transform: uppercase; }
        .dish-price { font-weight: 700; font-size: ${fontSize}px; color: #000000; border: 2px solid #000000; padding: 1px 6px; border-radius: 2px; }
        .dish-leader { display: none; }
        .dish-title-row { display: flex; justify-content: space-between; align-items: center; }
        .dish-description { font-size: ${fontSize - 1}px; color: #4b5563; margin-top: 6px; line-height: 1.4; font-weight: 400; }
        .menu-footer { border-top: 4px solid #000000; padding-top: 15px; font-size: 13px; color: #000000; font-weight: 700; text-transform: uppercase; text-align: center; }
      `;
    } else if (selectedTemplate === "thermal") {
      templateStyles = `
        body { font-family: 'Courier New', Courier, monospace; color: #000000; background-color: #ffffff; font-size: 13px; width: 300px; padding: 10px 5px; }
        .menu-container { width: 100%; }
        .restaurant-title { font-weight: 700; font-size: 16px; text-transform: uppercase; text-align: center; margin-bottom: 2px; }
        .menu-subtitle { font-size: 11px; text-align: center; margin-bottom: 10px; text-transform: uppercase; border-bottom: 1px dashed #000; padding-bottom: 8px; }
        .category-title { font-weight: 700; font-size: 13px; text-transform: uppercase; text-align: center; margin-top: 12px; margin-bottom: 6px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; }
        .dish-item { margin-bottom: 6px; page-break-inside: avoid; }
        .dish-title-row { display: flex; justify-content: space-between; align-items: baseline; }
        .dish-name { font-weight: 700; font-size: 13px; text-transform: uppercase; }
        .dish-price { font-weight: 700; font-size: 13px; }
        .dish-leader { flex-grow: 1; border-bottom: 1px dotted #000; margin: 0 4px; position: relative; bottom: 3px; }
        .dish-description { font-size: 11px; color: #333333; margin-top: 1px; padding-left: 5px; font-style: italic; }
        .menu-footer { border-top: 1px dashed #000; padding-top: 8px; font-size: 11px; text-align: center; margin-top: 15px; font-style: italic; }
      `;
    } else if (selectedTemplate === "gallery") {
      templateStyles = `
        body { font-family: 'Outfit', sans-serif; color: #1e293b; background-color: #fafafa; }
        .menu-container { padding: 30px; position: relative; }
        .restaurant-title { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 34px; color: ${accentColor}; text-transform: uppercase; }
        .menu-subtitle { font-size: 15px; color: #64748b; margin-bottom: 25px; font-weight: 500; text-transform: uppercase; }
        .category-title { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 18px; color: ${accentColor}; text-align: center; border-bottom: 2px solid ${accentColor}; padding-bottom: 5px; margin-top: ${marginVal}; margin-bottom: 18px; letter-spacing: 1px; text-transform: uppercase; }
        .dishes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media print { .dishes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; } }
        .dish-item { background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); page-break-inside: avoid; }
        .dish-header { display: flex; flex-direction: column; align-items: stretch; width: 100%; gap: 0px; }
        .dish-img { width: 100% !important; height: 130px !important; object-fit: cover; border-radius: 0px !important; border: none !important; border-bottom: 1px solid #e2e8f0 !important; }
        .dish-text-wrapper { padding: 12px; }
        .dish-title-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .dish-name { font-weight: 700; font-size: ${fontSize}px; color: #1e293b; }
        .dish-price { font-weight: 700; font-size: ${fontSize}px; color: ${accentColor}; }
        .dish-leader { display: none; }
        .dish-description { font-size: ${fontSize - 2}px; color: #64748b; line-height: 1.4; font-weight: 400; margin-top: 4px; }
        .menu-footer { grid-column: span 2; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 13px; color: #94a3b8; }
      `;
    } else if (selectedTemplate === "gourmet") {
      templateStyles = `
        body { font-family: 'Playfair Display', serif; color: #1a0f0a; background-color: #fdfbfa; }
        .menu-container { border: 1px solid #e5d5c5; padding: 40px; margin: 15px; border-radius: 2px; position: relative; }
        .restaurant-title { font-weight: 700; font-size: 34px; color: ${accentColor}; letter-spacing: 1px; }
        .menu-subtitle { font-style: italic; font-size: 15px; color: #8a7566; margin-bottom: 25px; font-family: 'Playfair Display', serif; }
        .category-title { font-weight: 700; font-size: 19px; color: ${accentColor}; margin-top: ${marginVal}; margin-bottom: 16px; text-align: center; border-bottom: 1px solid #e5d5c5; padding-bottom: 6px; font-style: italic; }
        .dish-item { margin-bottom: ${paddingVal}; page-break-inside: avoid; border-bottom: 1px dashed #f0e6dc; padding-bottom: ${paddingVal}; }
        .dish-item:last-child { border-bottom: none; }
        .dish-header { display: flex; gap: 15px; align-items: center; }
        .dish-img { width: 65px !important; height: 65px !important; border-radius: 50% !important; object-fit: cover; border: 2px solid ${accentColor} !important; flex-shrink: 0; }
        .dish-text-wrapper { flex-grow: 1; }
        .dish-title-row { display: flex; justify-content: space-between; align-items: baseline; }
        .dish-name { font-weight: 700; font-size: ${fontSize}px; color: #1a0f0a; }
        .dish-price { font-weight: 700; font-size: ${fontSize}px; color: ${accentColor}; font-family: 'Merriweather', serif; }
        .dish-leader { flex-grow: 1; border-bottom: 1px dotted #e5d5c5; margin: 0 8px; position: relative; bottom: 4px; }
        .dish-description { font-size: ${fontSize - 2}px; color: #705846; margin-top: 3px; font-family: 'Merriweather', serif; font-style: italic; }
        .menu-footer { border-top: 1px solid #e5d5c5; padding-top: 20px; font-size: 12px; color: #8a7566; font-style: italic; }
      `;
    }

    // Wrap in standard print page structure
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${restName} - Cardápio</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Montserrat:wght@700&family=Merriweather:ital,wght@0,700;1,400&family=Poppins:wght@700&family=Oswald:wght@700&family=Inter:wght@400;500;600;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            background: #ffffff; 
            margin: 0; 
            padding: 0; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
          
          .menu-container {
            display: flex;
            flex-direction: column;
            min-height: 100%;
          }
          
          .menu-header {
            text-align: center;
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            z-index: 10;
          }
          
          .logo-wrapper {
            margin-bottom: 10px;
          }
          
          .logo-img {
            max-width: 70px;
            max-height: 70px;
            object-fit: contain;
          }
          
          .restaurant-title {
            margin-bottom: 4px;
          }
          
          .menu-content {
            flex-grow: 1;
            position: relative;
            z-index: 10;
          }
          
          .category-block {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          
          .dish-title-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
          }
          
          .dish-header {
            display: flex;
            gap: 10px;
            align-items: start;
          }
          
          .dish-text-wrapper {
            flex-grow: 1;
          }
          
          .dish-img {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 6px;
            flex-shrink: 0;
            border: 1px solid #e2e8f0;
          }
          
          .menu-footer {
            margin-top: auto;
            text-align: center;
            padding-top: 15px;
            position: relative;
            z-index: 10;
          }

          /* Media Print styles to control physical dimensions */
          @media print {
            html, body {
              background: #ffffff;
            }
            ${selectedTemplate === "thermal" ? `
              @page {
                size: auto;
                margin: 0;
              }
              body {
                width: 80mm;
              }
            ` : `
              @page {
                size: A4;
                margin: 15mm;
              }
            `}
          }
          
          /* Custom styles injected based on selected template */
          ${templateStyles}
          ${watermarkCss}
        </style>
      </head>
      <body>
        <div class="menu-container">
          <div class="menu-header">
            ${showImages && logoUrl && selectedTemplate !== "thermal" ? `
              <div class="logo-wrapper">
                <img class="logo-img" src="${logoUrl}" alt="Logo" />
              </div>
            ` : ""}
            <h1 class="restaurant-title">${printTitle}</h1>
            ${subtitle ? `<p class="menu-subtitle">${subtitle}</p>` : ""}
          </div>
          
          <div class="menu-content">
            ${itemsHtml || `<div style="text-align:center; padding: 50px; color: #777;">Nenhum produto cadastrado ou selecionado.</div>`}
          </div>
          
          ${footer ? `
            <div class="menu-footer">
              <p>${footer}</p>
            </div>
          ` : ""}
        </div>
      </body>
      </html>
    `;
  };

  // Perform standard browser/desktop system print
  const handlePrint = async () => {
    setPrintingStatus(true);
    try {
      const htmlContent = generatePrintableHtml();
      
      let res;
      if (selectedTemplate === "thermal") {
        res = await printHtml(htmlContent, {
          silent: false
        });
      } else {
        res = await printHtml(htmlContent);
      }

      if (res && !res.success) {
        toast({
          title: "Erro ao gerar impressão",
          description: res.error || "Ocorreu um problema ao disparar a impressão.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Impressão iniciada",
          description: "O documento de menu foi enviado para o assistente de impressão."
        });
      }
    } catch (e: any) {
      toast({
        title: "Falha na impressão",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setPrintingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary flex items-center gap-2">
            <Printer className="h-8 w-8 text-primary" />
            Menu Físico
          </h1>
          <p className="text-muted-foreground">
            Gere menus elegantes para impressão A4/PDF ou cupons térmicos compactos.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Início
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Customization Center */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border/60 shadow-lg backdrop-blur-sm bg-background/95">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-primary" />
                1. Seleção e Dados
              </CardTitle>
              <CardDescription>
                Escolha o restaurante e a fonte de dados do menu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Restaurant select */}
              <div className="space-y-2">
                <Label htmlFor="restaurant-select">Restaurante</Label>
                <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                  <SelectTrigger id="restaurant-select">
                    <SelectValue placeholder="Selecione um restaurante" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Menu filter select */}
              <div className="space-y-2">
                <Label htmlFor="menu-source">Cardápio Digital (Opcional)</Label>
                <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
                  <SelectTrigger id="menu-source">
                    <SelectValue placeholder="Todos os itens ativos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pratos e categorias</SelectItem>
                    {menus.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.is_active ? "(Ativo)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Only Available toggle */}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label htmlFor="only-available">Apenas Pratos Disponíveis</Label>
                  <p className="text-xs text-muted-foreground">Ocultar pratos marcados como indisponíveis.</p>
                </div>
                <Switch 
                  id="only-available" 
                  checked={onlyAvailable} 
                  onCheckedChange={setOnlyAvailable}
                />
              </div>
            </CardContent>
          </Card>

          {/* Template Choices Card */}
          <Card className="border-border/60 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                2. Escolher Template
              </CardTitle>
              <CardDescription>
                Selecione o estilo visual que mais se adapta ao restaurante.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {/* Classic */}
                <button
                  onClick={() => setSelectedTemplate("classic")}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-all hover:bg-muted/30 ${
                    selectedTemplate === "classic" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-bold font-heading text-sm text-primary flex items-center justify-between w-full">
                    Clássico
                    {selectedTemplate === "classic" && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Playfair Display serif, luxo tradicional, pontilhados.</span>
                </button>

                {/* Minimalist */}
                <button
                  onClick={() => setSelectedTemplate("minimalist")}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-all hover:bg-muted/30 ${
                    selectedTemplate === "minimalist" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-bold font-heading text-sm text-primary flex items-center justify-between w-full">
                    Minimalista
                    {selectedTemplate === "minimalist" && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Fontes limpas, alto contraste, moderno, clean.</span>
                </button>

                {/* Rustique */}
                <button
                  onClick={() => setSelectedTemplate("rustique")}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-all hover:bg-muted/30 ${
                    selectedTemplate === "rustique" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-bold font-heading text-sm text-primary flex items-center justify-between w-full">
                    Rústico
                    {selectedTemplate === "rustique" && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Merriweather cozy, marrom terroso, acolhedor.</span>
                </button>

                {/* Tropical */}
                <button
                  onClick={() => setSelectedTemplate("tropical")}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-all hover:bg-muted/30 ${
                    selectedTemplate === "tropical" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-bold font-heading text-sm text-primary flex items-center justify-between w-full">
                    Tropical
                    {selectedTemplate === "tropical" && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Visual alegre, 2 colunas, tags de destaque coloridas.</span>
                </button>

                {/* Bold */}
                <button
                  onClick={() => setSelectedTemplate("bold")}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-all hover:bg-muted/30 ${
                    selectedTemplate === "bold" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-bold font-heading text-sm text-primary flex items-center justify-between w-full">
                    Urbano / Bold
                    {selectedTemplate === "bold" && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Estilo industrial, Oswald condensado, preto e branco forte.</span>
                </button>

                {/* Gallery [NEW] */}
                <button
                  onClick={() => setSelectedTemplate("gallery")}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-all hover:bg-muted/30 ${
                    selectedTemplate === "gallery" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-bold font-heading text-sm text-primary flex items-center justify-between w-full">
                    Galeria Gourmet ⭐
                    {selectedTemplate === "gallery" && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Grid com fotos grandes do prato e marca d'água no fundo.</span>
                </button>

                {/* Gourmet [NEW] */}
                <button
                  onClick={() => setSelectedTemplate("gourmet")}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-all hover:bg-muted/30 ${
                    selectedTemplate === "gourmet" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-bold font-heading text-sm text-primary flex items-center justify-between w-full">
                    Elegante Gourmet ⭐
                    {selectedTemplate === "gourmet" && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Fotos circulares premium, alta gastronomia com marca d'água.</span>
                </button>

                {/* Thermal */}
                <button
                  onClick={() => setSelectedTemplate("thermal")}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-all hover:bg-muted/30 ${
                    selectedTemplate === "thermal" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-bold font-heading text-sm text-primary flex items-center justify-between w-full">
                    Térmica (Bobina)
                    {selectedTemplate === "thermal" && <Check className="h-4 w-4" />}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Otimizado para rolo contínuo de cupom (58mm/80mm).</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Style Details Customize Card */}
          <Card className="border-border/60 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" />
                3. Detalhes de Customização
              </CardTitle>
              <CardDescription>
                Ajuste os textos, tamanhos e visualizações de pratos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title & subtitle inputs */}
              <div className="space-y-2">
                <Label htmlFor="menu-title">Título do Cardápio</Label>
                <Input 
                  id="menu-title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="EX: CARDÁPIO, ALMOÇO, SABORES..." 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="menu-subtitle">Subtítulo</Label>
                <Input 
                  id="menu-subtitle" 
                  value={subtitle} 
                  onChange={(e) => setSubtitle(e.target.value)} 
                  placeholder="Sabores únicos, momentos especiais" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="menu-footer">Rodapé</Label>
                <Textarea 
                  id="menu-footer" 
                  value={footer} 
                  onChange={(e) => setFooter(e.target.value)} 
                  placeholder="Obrigado pela preferência!" 
                  rows={2}
                />
              </div>

              {/* Accent Color picker */}
              {selectedTemplate !== "thermal" && selectedTemplate !== "bold" && (
                <div className="space-y-2">
                  <Label>Cor de Destaque</Label>
                  <div className="flex gap-2 flex-wrap">
                    {ACCENT_COLORS.map(c => (
                      <button
                        key={c.hex}
                        onClick={() => setAccentColor(c.hex)}
                        className={`h-7 w-7 rounded-full border-2 relative transition-all ${
                          accentColor === c.hex ? "border-foreground scale-110 shadow" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {accentColor === c.hex && (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">✓</span>
                        )}
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-1">
                      <input 
                        type="color" 
                        value={accentColor} 
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-7 h-7 rounded border border-input cursor-pointer" 
                      />
                      <span className="text-xs text-muted-foreground">Custom</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Font size slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="font-size">Tamanho da Fonte (Pratos)</Label>
                  <span className="text-xs text-muted-foreground font-mono">{fontSize}px</span>
                </div>
                <div className="flex items-center gap-4">
                  <Minimize className="h-4 w-4 text-muted-foreground" />
                  <Slider 
                    id="font-size" 
                    min={10} 
                    max={24} 
                    step={1} 
                    value={[fontSize]} 
                    onValueChange={(val) => setFontSize(val[0])} 
                    className="flex-grow"
                  />
                  <Maximize className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Spacing selectors */}
              <div className="space-y-2">
                <Label>Espaçamento Vertical</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["compact", "normal", "spacious"] as const).map(s => (
                    <Button
                      key={s}
                      type="button"
                      variant={spacing === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSpacing(s)}
                      className="capitalize"
                    >
                      {s === "compact" ? "Compacto" : s === "normal" ? "Normal" : "Espaçoso"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2 border-t">
                {/* Descriptions */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-desc" className="cursor-pointer">Exibir Descrições</Label>
                  <Switch id="show-desc" checked={showDescriptions} onCheckedChange={setShowDescriptions} />
                </div>

                {/* Prices */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-prices" className="cursor-pointer">Exibir Preços</Label>
                  <Switch id="show-prices" checked={showPrices} onCheckedChange={setShowPrices} />
                </div>

                {/* Watermark toggle */}
                {selectedTemplate !== "thermal" && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-watermark" className="cursor-pointer">Exibir Logotipo no Fundo (Marca D'água)</Label>
                    <Switch id="show-watermark" checked={showWatermark} onCheckedChange={setShowWatermark} />
                  </div>
                )}

                {/* Images toggle */}
                {selectedTemplate !== "thermal" && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-images" className="cursor-pointer">Exibir Imagens dos Pratos</Label>
                    <Switch id="show-images" checked={showImages} onCheckedChange={setShowImages} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Exclusion Lists */}
          <Card className="border-border/60 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <EyeOff className="h-5 w-5 text-muted-foreground" />
                Filtrar Pratos Omitidos
              </CardTitle>
              <CardDescription>
                Você pode desmarcar categorias ou pratos específicos clicando no ícone ao lado de cada item na prévia para que eles não sejam impressos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hiddenCategories.size > 0 || hiddenDishes.size > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Omitidos: {hiddenCategories.size} cat. / {hiddenDishes.size} prato(s)
                    </span>
                    <Button 
                      variant="ghost" 
                      size="xs" 
                      className="h-auto p-0 font-bold text-primary hover:text-primary/80"
                      onClick={() => {
                        setHiddenCategories(new Set());
                        setHiddenDishes(new Set());
                      }}
                    >
                      Restaurar Todos
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {Array.from(hiddenCategories).map(catId => {
                      const name = catId === "other" ? "Outros" : categories.find(c => c.id === catId)?.name || catId;
                      return (
                        <Badge key={catId} variant="secondary" className="gap-1 text-xs">
                          Cat: {name}
                          <button onClick={() => toggleCategoryVisibility(catId)} className="font-bold text-destructive hover:scale-110 ml-0.5">×</button>
                        </Badge>
                      );
                    })}
                    {Array.from(hiddenDishes).map(dishId => {
                      const name = dishes.find(d => d.id === dishId)?.name || dishId;
                      return (
                        <Badge key={dishId} variant="secondary" className="gap-1 text-xs">
                          Prato: {name}
                          <button onClick={() => toggleDishVisibility(dishId)} className="font-bold text-destructive hover:scale-110 ml-0.5">×</button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  Nenhum item omitido do cardápio final.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Printable Live Preview Area */}
        <div className="lg:col-span-7 space-y-4 sticky top-[80px]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Prévia de Impressão ({selectedTemplate === "thermal" ? "Térmica 80mm" : "Página A4"})
            </h3>
            
            {/* Main Action buttons */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={handlePrint} 
                disabled={printingStatus || loading || categorizedData.length === 0}
                className="shadow-md"
              >
                <Printer className="h-4 w-4 mr-2" />
                {printingStatus ? "Imprimindo..." : selectedTemplate === "thermal" ? "Imprimir Térmica" : "Imprimir / PDF"}
              </Button>
            </div>
          </div>

          {/* Interactive Live Sheet Container */}
          <div className="w-full flex justify-center overflow-x-auto bg-muted/40 p-4 sm:p-6 rounded-2xl border border-border/60 shadow-inner">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-3 w-[600px] h-[800px] bg-background rounded-md shadow-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">Carregando categorias e pratos...</p>
              </div>
            ) : categorizedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center w-[600px] h-[800px] bg-background rounded-md shadow-lg px-8">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <EyeOff className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-lg">Nenhum prato disponível</h4>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Não encontramos pratos ativos para este restaurante ou todos foram omitidos da impressão. Tente desativar a opção "Apenas pratos disponíveis" ou restaurar os itens omitidos.
                </p>
              </div>
            ) : (
              // Styled template wrapper to represent exact CSS on screen
              <div 
                id="menu-sheet-preview"
                className={`transition-all duration-300 rounded shadow-2xl relative overflow-hidden ${
                  selectedTemplate === "thermal" 
                    ? "w-[300px] bg-white border border-gray-300 text-black py-6 px-4" 
                    : "w-full max-w-[620px] aspect-[1/1.414] bg-white border border-gray-300 text-black p-8 sm:p-10"
                }`}
                style={{ 
                  fontFamily: 
                    selectedTemplate === "classic" || selectedTemplate === "gourmet" ? "'Playfair Display', Georgia, serif" :
                    selectedTemplate === "minimalist" ? "'Inter', sans-serif" :
                    selectedTemplate === "rustique" ? "'Merriweather', serif" :
                    selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "'Outfit', sans-serif" :
                    selectedTemplate === "bold" ? "'Roboto', sans-serif" :
                    "'Courier New', Courier, monospace",
                  backgroundColor: 
                    selectedTemplate === "classic" ? "#fafaf9" :
                    selectedTemplate === "rustique" ? "#fdfaf7" :
                    selectedTemplate === "gourmet" ? "#fdfbfa" :
                    selectedTemplate === "gallery" ? "#fafafa" :
                    "#ffffff",
                  color: "#000000"
                }}
              >
                {/* Standard template borders styling */}
                {showBorders && selectedTemplate === "classic" && (
                  <div className="absolute inset-2 pointer-events-none rounded border border-stone-800" style={{ borderColor: accentColor, borderStyle: 'double', borderWidth: '3px', zIndex: 1 }} />
                )}
                {showBorders && selectedTemplate === "rustique" && (
                  <div className="absolute inset-2 pointer-events-none rounded border border-amber-800/20" style={{ borderStyle: 'solid', borderWidth: '2px', zIndex: 1 }} />
                )}
                {showBorders && selectedTemplate === "bold" && (
                  <div className="absolute inset-1.5 pointer-events-none border-2 border-black" style={{ zIndex: 1 }} />
                )}
                {showBorders && selectedTemplate === "gourmet" && (
                  <div className="absolute inset-3 pointer-events-none rounded border border-stone-200" style={{ borderStyle: 'solid', borderWidth: '1px', zIndex: 1 }} />
                )}

                {/* Centered Watermark image styled directly on live sheet */}
                {showWatermark && selectedRestaurant?.image_url && selectedTemplate !== "thermal" && (
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 opacity-[0.05] pointer-events-none bg-center bg-no-repeat bg-contain"
                    style={{ 
                      backgroundImage: `url(${selectedRestaurant.image_url})`,
                      transform: 'translate(-50%, -50%) rotate(-10deg)',
                      zIndex: 0
                    }} 
                  />
                )}

                <div className="flex flex-col h-full pointer-events-auto relative z-10">
                  {/* Logo + Title Header */}
                  <div className="text-center mb-6 flex flex-col items-center">
                    {showImages && selectedRestaurant?.image_url && selectedTemplate !== "thermal" && (
                      <img 
                        src={selectedRestaurant.image_url} 
                        alt="Logo" 
                        className="h-14 w-14 rounded-full object-cover border border-stone-200 shadow-sm mb-2" 
                      />
                    )}
                    <h2 
                      className={`font-bold transition-all ${
                        selectedTemplate === "classic" || selectedTemplate === "gourmet" ? "text-2xl italic tracking-wide" :
                        selectedTemplate === "minimalist" ? "text-3xl uppercase tracking-widest font-black" :
                        selectedTemplate === "rustique" ? "text-2xl font-serif" :
                        selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "text-2xl font-black text-primary" :
                        selectedTemplate === "bold" ? "text-3xl uppercase font-extrabold border-b-4 border-black pb-2 w-full" :
                        "text-sm tracking-wide"
                      }`}
                      style={{ 
                        color: (selectedTemplate === "classic" || selectedTemplate === "tropical" || selectedTemplate === "gallery" || selectedTemplate === "gourmet") ? accentColor : "#000"
                      }}
                    >
                      {title || selectedRestaurant?.name || "Restaurante"}
                    </h2>
                    {subtitle && (
                      <p 
                        className={`text-xs mt-1 transition-all ${
                          selectedTemplate === "classic" || selectedTemplate === "gourmet" ? "italic text-stone-500 font-serif" :
                          selectedTemplate === "minimalist" ? "uppercase tracking-wider text-slate-500 font-medium" :
                          selectedTemplate === "rustique" ? "italic text-amber-900/60" :
                          selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "font-semibold text-sky-700" :
                          selectedTemplate === "bold" ? "uppercase tracking-widest text-black font-semibold mt-2" :
                          "text-[10px] tracking-wide"
                        }`}
                        style={{
                          borderBottom: selectedTemplate === "thermal" ? "1px dashed #000" : "none",
                          paddingBottom: selectedTemplate === "thermal" ? "6px" : "0",
                          width: selectedTemplate === "thermal" ? "100%" : "auto"
                        }}
                      >
                        {subtitle}
                      </p>
                    )}
                  </div>

                  {/* Dynamic Category Blocks */}
                  <div 
                    className={`flex-grow ${
                      (selectedTemplate === "tropical" || selectedTemplate === "gallery") && categorizedData.length > 0
                        ? "grid grid-cols-1 sm:grid-cols-2 gap-4" 
                        : "space-y-5"
                    }`}
                  >
                    {categorizedData.map(cat => (
                      <div 
                        key={cat.id} 
                        className={`category-wrapper ${
                          selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "col-span-1" : ""
                        }`}
                      >
                        <div className="flex justify-between items-center group mb-2.5">
                          <h4 
                            className={`font-bold transition-all flex-grow ${
                              selectedTemplate === "classic" || selectedTemplate === "gourmet" ? "text-sm text-center border-b-2 border-stone-800 pb-1 italic font-serif" :
                              selectedTemplate === "minimalist" ? "text-xs border-l-4 pl-2 text-left tracking-wider uppercase" :
                              selectedTemplate === "rustique" ? "text-sm text-center border-y border-amber-900/10 py-1" :
                              selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "text-xs font-bold text-white bg-sky-700 px-3 py-1.5 rounded-full" :
                              selectedTemplate === "bold" ? "text-sm text-white bg-black px-2.5 py-1 tracking-wide uppercase font-semibold" :
                              "text-xs uppercase text-center border-y border-dashed border-black py-1"
                            }`}
                            style={{ 
                              borderColor: (selectedTemplate === "classic" || selectedTemplate === "minimalist" || selectedTemplate === "gourmet") ? accentColor : undefined,
                              borderLeftColor: selectedTemplate === "minimalist" ? accentColor : undefined,
                              background: (selectedTemplate === "tropical" || selectedTemplate === "gallery") ? `linear-gradient(135deg, ${accentColor}, #38bdf8)` : selectedTemplate === "bold" ? "#000" : undefined
                            }}
                          >
                            {cat.name}
                          </h4>
                          {/* Quick omit hover button */}
                          <button
                            onClick={() => toggleCategoryVisibility(cat.id)}
                            className="hidden group-hover:block ml-2 text-destructive hover:scale-115 transition-transform"
                            title="Omitir categoria"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Dish items lists */}
                        <div className={`${selectedTemplate === "gallery" ? "grid grid-cols-1 gap-4" : "space-y-3"}`}>
                          {cat.dishes.map(dish => (
                            <div 
                              key={dish.id} 
                              className={`group relative transition-all ${
                                selectedTemplate === "gallery" 
                                  ? "flex flex-col rounded-xl overflow-hidden border border-slate-200/80 bg-white shadow-sm" 
                                  : "flex gap-2.5 items-start"
                              } ${
                                selectedTemplate === "tropical" ? "bg-stone-50/50 border border-slate-100 p-2.5 rounded-lg" : ""
                              } ${
                                selectedTemplate === "bold" ? "border-b border-stone-100 pb-2" : ""
                              } ${
                                selectedTemplate === "gourmet" ? "border-b border-dashed border-stone-100 pb-3" : ""
                              }`}
                              style={{
                                paddingBottom: selectedTemplate === "gallery" ? "0px" : spacing === "compact" ? "2px" : spacing === "spacious" ? "8px" : "4px"
                              }}
                            >
                              {/* Gallery template image: occupies top width of card */}
                              {showImages && dish.image_url && selectedTemplate === "gallery" && (
                                <img 
                                  src={dish.image_url} 
                                  alt={dish.name} 
                                  className="w-full h-24 object-cover flex-shrink-0 border-b border-slate-100" 
                                />
                              )}

                              {/* Standard / Gourmet template circular thumbnail image */}
                              {showImages && dish.image_url && selectedTemplate !== "thermal" && selectedTemplate !== "gallery" && (
                                <img 
                                  src={dish.image_url} 
                                  alt={dish.name} 
                                  className={`flex-shrink-0 object-cover border shadow-sm ${
                                    selectedTemplate === "gourmet" 
                                      ? "h-11 w-11 rounded-full border-2" 
                                      : "h-10 w-10 rounded border-stone-200/80"
                                  }`} 
                                  style={{ borderColor: selectedTemplate === "gourmet" ? accentColor : undefined }}
                                />
                              )}
                              
                              <div className={`flex-grow ${selectedTemplate === "gallery" ? "p-3 w-full" : "w-auto"}`}>
                                <div className="flex justify-between items-baseline gap-1">
                                  <span 
                                    className={`font-semibold ${
                                      selectedTemplate === "classic" || selectedTemplate === "gourmet" ? "font-serif text-stone-900" :
                                      selectedTemplate === "minimalist" ? "font-semibold text-slate-900" :
                                      selectedTemplate === "rustique" ? "text-amber-950 font-serif" :
                                      selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "font-bold text-slate-800" :
                                      selectedTemplate === "bold" ? "font-bold uppercase" :
                                      "text-xs font-mono uppercase"
                                    }`}
                                    style={{ fontSize: `${fontSize - (selectedTemplate === "thermal" ? 2 : 0)}px` }}
                                  >
                                    {dish.name}
                                  </span>
                                  {selectedTemplate !== "minimalist" && selectedTemplate !== "tropical" && selectedTemplate !== "bold" && selectedTemplate !== "gallery" && (
                                    <span className={`flex-grow border-b border-dotted ${selectedTemplate === "thermal" ? "border-black" : "border-stone-300"} mx-1 relative -bottom-1.5`} />
                                  )}
                                  {showPrices && (
                                    <span 
                                      className={`font-bold shrink-0 ${
                                        selectedTemplate === "classic" || selectedTemplate === "gourmet" ? "font-serif" :
                                        selectedTemplate === "minimalist" ? "font-semibold" :
                                        selectedTemplate === "rustique" ? "font-mono" :
                                        selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "text-sky-700 font-semibold" :
                                        selectedTemplate === "bold" ? "border-2 border-black px-1.5 py-0.5 rounded text-xs" :
                                        "text-xs font-mono"
                                      }`}
                                      style={{ 
                                        color: (selectedTemplate === "classic" || selectedTemplate === "minimalist" || selectedTemplate === "gallery" || selectedTemplate === "gourmet") ? accentColor : undefined,
                                        fontSize: `${fontSize - (selectedTemplate === "thermal" ? 2 : 0)}px`
                                      }}
                                    >
                                      R$ {dish.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </div>
                                {showDescriptions && dish.description && (
                                  <p 
                                    className={`mt-1 font-normal leading-relaxed tracking-normal ${
                                      selectedTemplate === "classic" || selectedTemplate === "gourmet" ? "italic text-stone-500 font-serif" :
                                      selectedTemplate === "minimalist" ? "text-slate-500" :
                                      selectedTemplate === "rustique" ? "text-amber-900/60 font-serif" :
                                      selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "text-slate-500 font-medium" :
                                      selectedTemplate === "bold" ? "text-stone-600" :
                                      "text-[10px] text-stone-800 font-mono italic"
                                    }`}
                                    style={{ fontSize: `${fontSize - (selectedTemplate === "thermal" ? 3 : 2)}px` }}
                                  >
                                    {dish.description}
                                  </p>
                                )}
                              </div>
                              {/* Quick omit dish hover button */}
                              <button
                                onClick={() => toggleDishVisibility(dish.id)}
                                className={`hidden group-hover:block shrink-0 text-destructive hover:scale-115 transition-transform ${
                                  selectedTemplate === "gallery" ? "absolute top-2 right-2 bg-white/90 shadow p-1 rounded-full z-20" : "self-center ml-2"
                                }`}
                                title="Omitir prato"
                              >
                                <EyeOff className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Subtitle Footer */}
                  {footer && (
                    <div 
                      className={`text-center transition-all ${
                        selectedTemplate === "classic" || selectedTemplate === "gourmet" ? "border-t border-stone-200 pt-3 text-stone-500 font-serif text-[11px]" :
                        selectedTemplate === "minimalist" ? "border-t-2 border-slate-100 pt-4 text-slate-400 text-[10px] tracking-wider uppercase font-semibold" :
                        selectedTemplate === "rustique" ? "border-t border-dashed border-amber-900/20 pt-3 text-amber-900/40 font-serif text-[11px]" :
                        selectedTemplate === "tropical" || selectedTemplate === "gallery" ? "border-t border-slate-100 pt-4 text-slate-400 text-xs font-semibold" :
                        selectedTemplate === "bold" ? "border-t-4 border-black pt-3 font-extrabold uppercase text-[11px]" :
                        "border-t border-dashed border-black pt-3 text-[10px] font-mono"
                      }`}
                    >
                      {footer}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
