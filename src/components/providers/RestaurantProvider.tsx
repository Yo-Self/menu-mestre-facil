import { createContext, useContext, useState, ReactNode } from 'react';

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

  const setCurrentRestaurantId = (id: string | null) => {
    setCurrentRestaurantIdState(id);
    if (id) {
      localStorage.setItem("currentRestaurantId", id);
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
