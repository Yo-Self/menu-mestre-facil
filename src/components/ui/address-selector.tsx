import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';

interface AddressData {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface AddressSelectorProps {
  value: AddressData;
  onChange: (addressData: AddressData) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function AddressSelector({
  value,
  onChange,
  label = "Endereço do Restaurante",
  placeholder = "Digite o endereço do restaurante...",
  required = false,
  disabled = false
}: AddressSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [autocomplete, setAutocomplete] = useState<any>(null);

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsGoogleMapsLoaded(true);
      initializeAutocomplete();
      return;
    }

    // Load Google Maps API if not already loaded
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setIsGoogleMapsLoaded(true);
      initializeAutocomplete();
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const initializeAutocomplete = () => {
    if (!window.google || !window.google.maps || !window.google.maps.places || !inputRef.current) {
      return;
    }

    try {
      const autocompleteInstance = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'br' },
        fields: ['formatted_address', 'geometry', 'name', 'place_id']
      });

      autocompleteInstance.addListener('place_changed', () => {
        const place = autocompleteInstance.getPlace();
        
        if (place.geometry && place.geometry.location) {
          const addressData: AddressData = {
            address: place.formatted_address || place.name || '',
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng()
          };
          
          onChange(addressData);
        }
      });

      setAutocomplete(autocompleteInstance);
      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing Google Maps autocomplete:', error);
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    onChange({
      address: newAddress,
      latitude: null,
      longitude: null
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="address" className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          ref={inputRef}
          id="address"
          value={value.address}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled || isLoading}
          className="pr-10"
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      
      {value.latitude && value.longitude && (
        <div className="text-sm text-muted-foreground">
          <p>📍 Coordenadas: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</p>
        </div>
      )}
      
      {!isGoogleMapsLoaded && !isLoading && (
        <p className="text-sm text-amber-600">
          ⚠️ Carregando Google Maps API...
        </p>
      )}
      
      {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <p className="text-sm text-red-600">
          ⚠️ Chave da API do Google Maps não configurada. Configure VITE_GOOGLE_MAPS_API_KEY no arquivo .env
        </p>
      )}
    </div>
  );
}