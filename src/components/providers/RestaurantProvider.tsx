import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import posthog from 'posthog-js';

interface RestaurantContextType {
  currentRestaurantId: string | null;
  setCurrentRestaurantId: (id: string | null) => void;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

interface RestaurantProviderProps {
  children: ReactNode;
}

export function RestaurantProvider({ children }: RestaurantProviderProps) {
  const [currentRestaurantId, setCurrentRestaurantIdState] = useState<string | null>(() => {
    return localStorage.getItem("currentRestaurantId");
  });

  // Efeito para garantir associação de grupo caso o ID já esteja no localStorage
  useEffect(() => {
    if (currentRestaurantId && currentRestaurantId !== 'null') {
      try {
        posthog.group('restaurant', currentRestaurantId, {
          name: `Restaurante #${currentRestaurantId}`
        });
      } catch (e) {
        console.error('📢 PostHog: Falha ao persistir associação de grupo:', e);
      }
    }
  }, [currentRestaurantId]);

  const setCurrentRestaurantId = (id: string | null) => {
    setCurrentRestaurantIdState(id);
    if (id) {
      localStorage.setItem("currentRestaurantId", id);
      try {
        posthog.group('restaurant', id, {
          name: `Restaurante #${id}`
        });
      } catch (e) {
        console.error('📢 PostHog: Falha ao associar grupo:', e);
      }
    } else {
      localStorage.removeItem("currentRestaurantId");
    }
  };

  return (
    <RestaurantContext.Provider value={{ currentRestaurantId, setCurrentRestaurantId }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
}
