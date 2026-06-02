import React, { useEffect, useRef, useState } from 'react';
import { useRestaurant } from '@/components/providers/RestaurantProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Truck,
  MapPin,
  Settings,
  Plus,
  Trash2,
  Navigation,
  RefreshCw,
  Clock,
  User,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Route
} from 'lucide-react';

interface DeliveryZone {
  id: string;
  name: string;
  type: 'exclusion' | 'special_fee';
  fee: number; // em centavos
  shape: 'circle';
  center: { lat: number; lng: number };
  radius: number; // em metros
}

export default function DeliveryPage() {
  const { currentRestaurantId, setCurrentRestaurantId } = useRestaurant();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('panel');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados de Configuração
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryMaxDistance, setDeliveryMaxDistance] = useState(10);
  const [deliveryBaseFee, setDeliveryBaseFee] = useState('0.00');
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState('0.00');
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [restaurantLat, setRestaurantLat] = useState<number | null>(null);
  const [restaurantLng, setRestaurantLng] = useState<number | null>(null);
  const [isCoordsFallback, setIsCoordsFallback] = useState(false);

  // Estado para nova zona interativa
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneType, setNewZoneType] = useState<'exclusion' | 'special_fee'>('special_fee');
  const [newZoneFee, setNewZoneFee] = useState('5.00');
  const [newZoneRadius, setNewZoneRadius] = useState(1000); // metros
  const [newZoneCenter, setNewZoneCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Estados do Painel de Entregas
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Google Maps Refs
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<any>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [markers, setMarkers] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [restaurantMarker, setRestaurantMarker] = useState<any>(null);
  const [maxDistanceCircle, setMaxDistanceCircle] = useState<any>(null);
  const [newZoneMarker, setNewZoneMarker] = useState<any>(null);
  const [newZoneVisualCircle, setNewZoneVisualCircle] = useState<any>(null);

  // 1. Carregar chaves e Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places && window.google.maps.geometry) {
      setGoogleMapsLoaded(true);
      return;
    }

    const loadGoogleMaps = async () => {
      try {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => setGoogleMapsLoaded(true);
        script.onerror = () => console.error('Erro ao carregar Google Maps');
        document.head.appendChild(script);
      } catch (e) {
        console.error(e);
      }
    };

    loadGoogleMaps();
  }, []);

  // 2. Buscar dados do Restaurante e Entregas do Supabase
  const fetchData = async () => {
    console.log('🔍 Debug - fetchData init. currentRestaurantId:', currentRestaurantId);
    
    setLoading(true);
    try {
      let targetRestaurantId = currentRestaurantId;

      // Se não houver restaurante selecionado no contexto, buscar o primeiro disponível
      if (!targetRestaurantId) {
        console.log('🔍 Debug - Sem currentRestaurantId, buscando primeiro restaurante do usuário...');
        const { data: userRest, error: userRestErr } = await supabase
          .from('restaurants')
          .select('id')
          .limit(1);
          
        if (userRestErr) throw userRestErr;
        
        if (userRest && userRest.length > 0) {
          targetRestaurantId = userRest[0].id;
          console.log('🔍 Debug - Restaurante auto-selecionado:', targetRestaurantId);
          // Opcional: atualizar o contexto global
          setCurrentRestaurantId(targetRestaurantId);
          // O return aqui é importante porque atualizar o context vai triggar re-render e chamar fetchData novamente
          return; 
        } else {
          console.log('🔍 Debug - Nenhum restaurante encontrado para o usuário.');
          setLoading(false);
          return;
        }
      }

      // Buscar Restaurante
      console.log('🔍 Debug - fetch restaurant from Supabase');
      const { data: rest, error: restErr } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', targetRestaurantId)
        .single();

      if (restErr) {
        console.error('🔍 Debug - fetch restaurant error:', restErr);
        throw restErr;
      }

      console.log('🔍 Debug - fetch restaurant success:', rest?.name, rest?.id);
      setRestaurantData(rest);
      setDeliveryEnabled(rest.delivery_enabled || false);
      setDeliveryMaxDistance(Number(rest.delivery_max_distance) || 10);
      setDeliveryBaseFee(((rest.delivery_base_fee || 0) / 100).toFixed(2));
      setDeliveryFeePerKm(((rest.delivery_fee_per_km || 0) / 100).toFixed(2));
      setDeliveryZones(rest.delivery_zones || []);

      const latVal = Number(rest.latitude);
      const lngVal = Number(rest.longitude);
      
      const isExactFallback = latVal === -23.55052 && lngVal === -46.633308;

      if (rest.latitude !== null && rest.longitude !== null && !isNaN(latVal) && !isNaN(lngVal) && !isExactFallback) {
        setRestaurantLat(latVal);
        setRestaurantLng(lngVal);
        setIsCoordsFallback(false);
      } else if (!rest.address || rest.address.trim() === '') {
        console.warn('🔍 Debug - Sem endereço. Forçando fallback SP.');
        // Se não tem endereço para o geocoder buscar, usar fallback SP para o mapa não quebrar
        setRestaurantLat(-23.55052);
        setRestaurantLng(-46.633308);
        setIsCoordsFallback(true);
      } else {
        // Deixar nulo para que o useEffect de Geocodificação tente buscar pelo endereço real
        setRestaurantLat(null);
        setRestaurantLng(null);
        setIsCoordsFallback(true); // O geocoder depois vai arrumar se der certo
      }

      // Buscar Entregas Ativas (order_type = delivery, status não finalizado/cancelado)
      const { data: ords, error: ordsErr } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', currentRestaurantId)
        .eq('order_type', 'delivery')
        .in('status', ['new', 'in_preparation', 'ready'])
        .order('created_at', { ascending: true });

      if (ordsErr) throw ordsErr;
      setOrders(ords || []);
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erro ao buscar dados',
        description: e.message || 'Erro inesperado.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Inscrição Realtime para novos pedidos
    if (!currentRestaurantId) return;
    const channel = supabase
      .channel('delivery_orders_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${currentRestaurantId}`
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRestaurantId]);

  // 2.5 Geocodificar endereço de texto do restaurante se coordenadas estiverem nulas
  useEffect(() => {
    if (!googleMapsLoaded || !restaurantData || !restaurantData.address || restaurantLat !== null) return;

    const geocodeAddress = async () => {
      console.log('🔍 Debug - Geocodificando endereço cadastrado:', restaurantData.address);
      try {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: restaurantData.address }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            const lat = loc.lat();
            const lng = loc.lng();
            console.log('🔍 Debug - Endereço geocodificado com sucesso:', lat, lng);
            setRestaurantLat(lat);
            setRestaurantLng(lng);
            setIsCoordsFallback(false);
            
            toast({
              title: 'Localização Encontrada!',
              description: 'Encontramos a posição do seu restaurante com base no seu endereço cadastrado. Lembre-se de clicar em "Salvar Configurações de Delivery" para gravar as coordenadas.'
            });
          } else {
            console.warn('⚠️ Falha ao geocodificar endereço:', status);
            // Se falhar o geocoder, manter o fallback padrão de SP para renderizar o mapa
            setRestaurantLat(-23.55052);
            setRestaurantLng(-46.633308);
          }
        });
      } catch (e) {
        console.error('Erro ao usar Geocoder:', e);
        setRestaurantLat(-23.55052);
        setRestaurantLng(-46.633308);
      }
    };

    geocodeAddress();
  }, [googleMapsLoaded, restaurantData, restaurantLat]);

  // 3. Inicializar e Renderizar o Mapa Google
  useEffect(() => {
    console.log('🔍 Debug - Map rendering useEffect triggered:', {
      googleMapsLoaded,
      hasContainer: !!mapContainer,
      hasRestaurantData: !!restaurantData,
      activeTab,
      restaurantLat,
      restaurantLng
    });

    if (!googleMapsLoaded || !mapContainer || !restaurantData || activeTab !== 'config') {
      console.log('🔍 Debug - Map initialization aborted due to unresolved state conditions.');
      return;
    }

    if (!restaurantLat || !restaurantLng) {
      console.log('🔍 Debug - Map initialization aborted due to missing coordinates.');
      return;
    }

    const centerCoords = { lat: restaurantLat, lng: restaurantLng };

    // Criar Mapa
    const mapInstance = new window.google.maps.Map(mapContainer, {
      center: centerCoords,
      zoom: 13,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    setMap(mapInstance);

    // Adicionar marcador do Restaurante (sempre draggable para ajuste exato no mapa)
    const rMarker = new window.google.maps.Marker({
      position: centerCoords,
      map: mapInstance,
      title: restaurantData.name,
      draggable: true,
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/icons/restaurant.png',
        scaledSize: new window.google.maps.Size(40, 40)
      }
    });
    setRestaurantMarker(rMarker);

    // Círculo de Cobertura Máxima (Translucido cinza/azul)
    const mCircle = new window.google.maps.Circle({
      strokeColor: '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      map: mapInstance,
      center: centerCoords,
      radius: deliveryMaxDistance * 1000, // converter km para metros
      clickable: false
    });
    setMaxDistanceCircle(mCircle);

    // Ouvinte para quando o marcador do restaurante for arrastado pelo usuário
    rMarker.addListener('dragend', (e: any) => {
      const draggedLat = e.latLng.lat();
      const draggedLng = e.latLng.lng();
      setRestaurantLat(draggedLat);
      setRestaurantLng(draggedLng);
      setIsCoordsFallback(false); // remove fallback indicator once moved!
      
      // Atualizar o centro do círculo de cobertura máxima
      mCircle.setCenter({ lat: draggedLat, lng: draggedLng });
      
      toast({
        title: 'Posição do restaurante atualizada',
        description: 'Lembre-se de clicar em "Salvar Configurações" no final da página para gravar no banco.'
      });
    });

    // Ouvinte de clique no mapa para colocar nova zona de entrega
    mapInstance.addListener('click', (e: any) => {
      const clickedLat = e.latLng.lat();
      const clickedLng = e.latLng.lng();
      setNewZoneCenter({ lat: clickedLat, lng: clickedLng });
    });

    return () => {
      if (rMarker) rMarker.setMap(null);
      if (mCircle) mCircle.setMap(null);
    };
  }, [googleMapsLoaded, restaurantData, activeTab, mapContainer]);

  // 4. Efeito para desenhar Zonas já Salvas no Mapa
  useEffect(() => {
    if (!map || !googleMapsLoaded) return;

    // Limpar círculos antigos
    circles.forEach(c => c.setMap(null));
    const newCircles: any[] = [];

    deliveryZones.forEach(zone => {
      if (zone.shape === 'circle' && zone.center && zone.radius) {
        const zCircle = new window.google.maps.Circle({
          strokeColor: zone.type === 'exclusion' ? '#ef4444' : '#6366f1',
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: zone.type === 'exclusion' ? '#ef4444' : '#6366f1',
          fillOpacity: 0.15,
          map: map,
          center: zone.center,
          radius: zone.radius
        });

        // Adicionar InfoWindow com nome da zona
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="font-family: sans-serif; padding: 4px;">
            <strong style="color: ${zone.type === 'exclusion' ? '#ef4444' : '#6366f1'}">${zone.name}</strong><br/>
            ${zone.type === 'exclusion' ? 'Sem Cobertura (Exclusão)' : `Taxa Especial: R$ ${(zone.fee / 100).toFixed(2)}`}
          </div>`
        });

        zCircle.addListener('click', (e: any) => {
          infoWindow.setPosition(e.latLng);
          infoWindow.open(map);
        });

        newCircles.push(zCircle);
      }
    });

    setCircles(newCircles);
  }, [map, deliveryZones, googleMapsLoaded]);

  // 5. Atualizar o Círculo de Distância Máxima dinamicamente
  useEffect(() => {
    if (maxDistanceCircle) {
      maxDistanceCircle.setRadius(deliveryMaxDistance * 1000);
    }
  }, [deliveryMaxDistance, maxDistanceCircle]);

  // 6. Efeito para posicionar o marcador de Nova Zona Interativa
  useEffect(() => {
    if (!map || !newZoneCenter) return;

    if (newZoneMarker) newZoneMarker.setMap(null);
    if (newZoneVisualCircle) newZoneVisualCircle.setMap(null);

    const marker = new window.google.maps.Marker({
      position: newZoneCenter,
      map: map,
      title: newZoneName || 'Nova Zona',
      draggable: true,
      icon: {
        url: newZoneType === 'exclusion' 
          ? 'https://maps.google.com/mapfiles/ms/icons/red-pushpin.png'
          : 'https://maps.google.com/mapfiles/ms/icons/purple-pushpin.png',
        scaledSize: new window.google.maps.Size(32, 32)
      }
    });

    const visualCircle = new window.google.maps.Circle({
      strokeColor: newZoneType === 'exclusion' ? '#ef4444' : '#6366f1',
      strokeOpacity: 0.6,
      strokeWeight: 1.5,
      fillColor: newZoneType === 'exclusion' ? '#ef4444' : '#6366f1',
      fillOpacity: 0.1,
      map: map,
      center: newZoneCenter,
      radius: newZoneRadius,
      clickable: false
    });

    // Evento de arrastar marcador atualiza o centro
    marker.addListener('dragend', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setNewZoneCenter({ lat, lng });
    });

    setNewZoneMarker(marker);
    setNewZoneVisualCircle(visualCircle);

    return () => {
      if (marker) marker.setMap(null);
      if (visualCircle) visualCircle.setMap(null);
    };
  }, [map, newZoneCenter, newZoneType]);

  // Atualiza raio visual da nova zona
  useEffect(() => {
    if (newZoneVisualCircle) {
      newZoneVisualCircle.setRadius(newZoneRadius);
    }
  }, [newZoneRadius, newZoneVisualCircle]);

  // 7. Salvar Configurações Gerais no Supabase
  const handleSaveConfigs = async () => {
    console.log('🔍 Debug - Iniciando salvamento de configurações', {
      currentRestaurantId,
      deliveryEnabled,
      deliveryMaxDistance,
      deliveryBaseFee,
      deliveryFeePerKm,
      deliveryZones,
      restaurantLat,
      restaurantLng,
      isCoordsFallback
    });

    if (!currentRestaurantId) return;

    if (isCoordsFallback) {
      console.warn('🔍 Debug - Tentativa de salvar com fallback de coordenadas.');
      toast({
        title: 'Localização Inválida',
        description: 'Por favor, arraste o pino do restaurante no mapa para a localização correta antes de salvar.',
        variant: 'warning'
      });
      return;
    }

    setSaving(true);

    try {
      const baseFeeCents = Math.round(parseFloat(deliveryBaseFee) * 100);
      const feePerKmCents = Math.round(parseFloat(deliveryFeePerKm) * 100);

      const updatePayload = {
        delivery_enabled: deliveryEnabled,
        delivery_max_distance: deliveryMaxDistance,
        delivery_base_fee: baseFeeCents,
        delivery_fee_per_km: feePerKmCents,
        delivery_zones: deliveryZones,
        latitude: restaurantLat,
        longitude: restaurantLng,
        updated_at: new Date().toISOString()
      };

      console.log('🔍 Debug - Payload de update:', updatePayload);

      const { error } = await supabase
        .from('restaurants')
        .update(updatePayload)
        .eq('id', currentRestaurantId);

      if (error) {
        console.error('🔍 Debug - Erro ao salvar configurações no Supabase:', error);
        throw error;
      }

      console.log('🔍 Debug - Configurações salvas com sucesso!');


      toast({
        title: 'Configurações salvas!',
        description: 'As taxas e regras de entrega foram atualizadas com sucesso.'
      });
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erro ao salvar',
        description: e.message || 'Erro inesperado.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // 8. Adicionar uma Nova Zona Circular à lista
  const handleAddZone = () => {
    if (!newZoneCenter) {
      toast({
        title: 'Selecione no Mapa',
        description: 'Clique em qualquer ponto do mapa para selecionar o centro da zona de entrega.',
        variant: 'warning'
      });
      return;
    }

    if (!newZoneName.trim()) {
      toast({
        title: 'Nome Necessário',
        description: 'Por favor, informe um nome para identificar a zona (Ex: Bairro Norte, Condomínio X).',
        variant: 'warning'
      });
      return;
    }

    const feeCents = newZoneType === 'special_fee' 
      ? Math.round(parseFloat(newZoneFee) * 100)
      : 0;

    const newZone: DeliveryZone = {
      id: `zone-${Date.now()}`,
      name: newZoneName,
      type: newZoneType,
      fee: feeCents,
      shape: 'circle',
      center: newZoneCenter,
      radius: newZoneRadius
    };

    setDeliveryZones([...deliveryZones, newZone]);

    // Limpar formulário de nova zona
    setNewZoneName('');
    setNewZoneCenter(null);
    if (newZoneMarker) newZoneMarker.setMap(null);
    if (newZoneVisualCircle) newZoneVisualCircle.setMap(null);
    setNewZoneMarker(null);
    setNewZoneVisualCircle(null);

    toast({
      title: 'Zona adicionada à lista!',
      description: 'Lembre-se de clicar em "Salvar Configurações" no final da página para gravar no banco.'
    });
  };

  // 9. Excluir uma Zona da lista
  const handleDeleteZone = (zoneId: string) => {
    setDeliveryZones(deliveryZones.filter(z => z.id !== zoneId));
  };

  // 10. Atualizar Status de um Pedido no Painel
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingStatusId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `O status do pedido foi atualizado para "${newStatus}".`
      });

      // Atualizar estado local
      setOrders(prev => 
        prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
            .filter(o => ['new', 'in_preparation', 'ready'].includes(o.status))
      );
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erro ao atualizar status',
        description: e.message || 'Erro inesperado.',
        variant: 'destructive'
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // 11. Resolver o TSP (Traveling Salesperson Problem) Heurística Nearest Neighbor
  // Otimizador de rota multi-stops com retorno ou término na última entrega
  const handleGenerateRoute = () => {
    if (selectedOrders.length === 0) return;

    const restLat = Number(restaurantLat);
    const restLng = Number(restaurantLng);

    if (!restLat || !restLng || isNaN(restLat) || isNaN(restLng) || isCoordsFallback) {
      toast({
        title: 'Coordenadas do restaurante em falta ou padrão',
        description: 'Por favor, defina e salve a localização exata do seu restaurante no mapa de configurações primeiro.',
        variant: 'warning'
      });
      return;
    }

    const restaurantCoords = { lat: restLat, lng: restLng };

    // Filtrar pedidos selecionados que possuem coordenadas válidas
    const points = selectedOrders.map(id => {
      const order = orders.find(o => o.id === id);
      return {
        id: order.id,
        lat: Number(order.delivery_coords_lat),
        lng: Number(order.delivery_coords_lng),
        address: order.delivery_address || 'Endereço desconhecido',
        customer: order.customer_info?.name || 'Cliente'
      };
    }).filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng));

    if (points.length === 0) {
      toast({
        title: 'Coordenadas de entrega inválidas',
        description: 'Os pedidos selecionados não possuem coordenadas de entrega válidas.',
        variant: 'destructive'
      });
      return;
    }

    let orderedPoints: typeof points = [];

    if (points.length === 1) {
      orderedPoints = points;
    } else {
      // Rodar o algoritmo do Vizinho Mais Próximo (Nearest Neighbor TSP Heuristic)
      const unvisited = [...points];
      let current = restaurantCoords;

      while (unvisited.length > 0) {
        let closestIdx = -1;
        let minDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const dist = getHaversineDistance(current, unvisited[i]);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = i;
          }
        }

        const nextPoint = unvisited.splice(closestIdx, 1)[0];
        orderedPoints.push(nextPoint);
        current = nextPoint;
      }
    }

    // Gerar link do Google Maps Directions
    let mapsUrl = '';
    const origin = `${restaurantCoords.lat},${restaurantCoords.lng}`;

    if (orderedPoints.length === 1) {
      const dest = `${orderedPoints[0].lat},${orderedPoints[0].lng}`;
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    } else {
      // O último ponto será a "destination", os anteriores intermediários serão "waypoints"
      const lastPoint = orderedPoints[orderedPoints.length - 1];
      const dest = `${lastPoint.lat},${lastPoint.lng}`;
      const waypoints = orderedPoints.slice(0, -1).map(p => `${p.lat},${p.lng}`).join('|');
      
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
    }

    // Abrir o Google Maps em uma nova aba
    window.open(mapsUrl, '_blank');
    
    toast({
      title: 'Rota gerada com sucesso!',
      description: `Calculado o trajeto mais eficiente para ${orderedPoints.length} entregas.`
    });
  };

  // Cálculo da distância de Haversine
  const getHaversineDistance = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * (Math.PI / 180)) *
        Math.cos(p2.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background/80 backdrop-blur border border-border/40 p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-3xl font-heading font-extrabold bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary shrink-0" />
            Gestão de Entregas & Delivery
          </h1>
          <p className="text-muted-foreground mt-1 font-sans font-medium">
            Configurando taxas e áreas para: <strong className="text-foreground">{restaurantData?.name || "Carregando..."}</strong>
          </p>
        </div>
        <Button 
          onClick={fetchData} 
          variant="outline" 
          size="sm"
          className="border-border/60 hover:border-primary/40 rounded-xl"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Painel
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md bg-muted/50 p-1 rounded-xl border border-border/20 shadow-sm">
          <TabsTrigger value="panel" className="rounded-lg font-heading text-sm py-2">
            <Route className="h-4 w-4 mr-2" />
            Entregas Ativas ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="config" className="rounded-lg font-heading text-sm py-2">
            <Settings className="h-4 w-4 mr-2" />
            Configurações & Zonas
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: PAINEL DE ENTREGAS ATIVAS ==================== */}
        <TabsContent value="panel" className="mt-6 space-y-4 focus-visible:outline-none focus-visible:ring-0">
          {loading ? (
            <div className="flex items-center justify-center p-20">
              <RefreshCw className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <Card className="rounded-2xl border-border/50 bg-background/50 text-center p-12">
              <CardHeader className="flex flex-col items-center">
                <div className="p-4 bg-muted/40 rounded-full mb-3">
                  <Truck className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="text-xl font-heading">Nenhuma Entrega Ativa</CardTitle>
                <CardDescription className="max-w-md mx-auto">
                  Não existem pedidos de delivery pendentes, em preparação ou prontos para entrega no momento. Novos pedidos via cardápio digital aparecerão aqui em tempo real.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Controles do Painel */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 border border-border/30 p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    id="select-all"
                    checked={selectedOrders.length === orders.length && orders.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="rounded border-border/60 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-5 w-5"
                  />
                  <Label htmlFor="select-all" className="font-semibold text-sm cursor-pointer select-none">
                    Selecionar Todos ({orders.length} pedidos)
                  </Label>
                </div>

                <Button
                  onClick={handleGenerateRoute}
                  disabled={selectedOrders.length === 0}
                  className="bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Gerar Rota Otimizada no Google Maps ({selectedOrders.length})
                </Button>
              </div>

              {/* Lista de Cards de Entregas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map(order => {
                  const isSelected = selectedOrders.includes(order.id);
                  const isCoordsValid = order.delivery_coords_lat && order.delivery_coords_lng;
                  const statusColors: Record<string, string> = {
                    new: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
                    in_preparation: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
                    ready: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300'
                  };
                  
                  const statusText: Record<string, string> = {
                    new: 'Novo Pedido',
                    in_preparation: 'Em Preparação',
                    ready: 'Pronto para Entrega'
                  };

                  return (
                    <Card 
                      key={order.id} 
                      className={`rounded-2xl border-border/50 shadow-sm transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : 'hover:shadow-md'}`}
                    >
                      <div className="p-5 space-y-4 flex-1">
                        {/* Cabeçalho do Card */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => handleSelectOrder(order.id)}
                              className="rounded border-border/60 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                ID: #{order.id.slice(0, 8)}
                              </span>
                              <h3 className="font-bold font-heading text-sm text-foreground truncate mt-0.5">
                                {order.customer_info?.name || 'Cliente Sem Nome'}
                              </h3>
                            </div>
                          </div>
                          <Badge className={`${statusColors[order.status]} shrink-0 border text-[10px] py-0.5 font-semibold font-heading rounded-full`}>
                            {statusText[order.status]}
                          </Badge>
                        </div>

                        {/* Endereço */}
                        <div className="space-y-1">
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
                            <p className="line-clamp-2 leading-relaxed">
                              {order.delivery_address || 'Endereço não cadastrado'}
                            </p>
                          </div>
                        </div>

                        {/* Distância e Taxa */}
                        <div className="grid grid-cols-2 gap-2 bg-muted/30 border border-border/10 p-2.5 rounded-xl text-center">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Distância</span>
                            <span className="text-xs font-bold text-foreground font-mono">
                              {order.delivery_distance !== null ? `${Number(order.delivery_distance).toFixed(1)} km` : 'Calculando...'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Taxa de Frete</span>
                            <span className="text-xs font-bold text-foreground font-mono">
                              {order.delivery_fee !== null ? `R$ ${(order.delivery_fee / 100).toFixed(2)}` : 'Grátis'}
                            </span>
                          </div>
                        </div>

                        {/* Horário */}
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Criado em: {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <span className="font-bold text-xs font-mono text-primary">R$ {(order.total_price / 100).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Ações / Footer do Card */}
                      <CardFooter className="border-t border-border/40 p-4 bg-muted/10 gap-2 shrink-0">
                        <Select
                          value={order.status}
                          disabled={updatingStatusId === order.id}
                          onValueChange={(val) => handleStatusChange(order.id, val)}
                        >
                          <SelectTrigger className="w-full h-9 rounded-xl border-border/50 text-xs font-semibold focus:ring-0">
                            {updatingStatusId === order.id ? (
                              <div className="flex items-center justify-center w-full">
                                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                Atualizando...
                              </div>
                            ) : (
                              <SelectValue placeholder="Mudar Status" />
                            )}
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/50 text-xs font-sans">
                            <SelectItem value="new">Novo Pedido</SelectItem>
                            <SelectItem value="in_preparation">Em Preparação</SelectItem>
                            <SelectItem value="ready">Pronto para Entrega</SelectItem>
                            <SelectItem value="finished">Finalizado / Entregue</SelectItem>
                            <SelectItem value="cancelled">Cancelar Pedido</SelectItem>
                          </SelectContent>
                        </Select>

                        {isCoordsValid && (
                          <Button 
                            variant="outline"
                            size="icon"
                            title="Ir para o Google Maps"
                            className="h-9 w-9 border-border/60 hover:border-primary/40 hover:bg-primary/5 text-primary shrink-0 rounded-xl"
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&origin=${restaurantLat},${restaurantLng}&destination=${order.delivery_coords_lat},${order.delivery_coords_lng}`, '_blank')}
                          >
                            <Navigation className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB 2: CONFIGURAÇÕES E ZONAS DE ENTREGA ==================== */}
        <TabsContent value="config" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Lado Esquerdo: Inputs e Lista de Zonas */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Painel Financeiro & Geral */}
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-heading font-extrabold flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Parâmetros de Entrega
                  </CardTitle>
                  <CardDescription>Configure como a taxa de entrega básica é calculada.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Habilitar Delivery */}
                  <div className="flex items-center justify-between border-b border-border/30 pb-4">
                    <div>
                      <Label htmlFor="delivery-active" className="font-bold text-sm">Ativar Serviço de Entrega</Label>
                      <CardDescription className="text-xs">Clientes poderão pedir delivery pelo cardápio.</CardDescription>
                    </div>
                    <Switch 
                      id="delivery-active"
                      checked={deliveryEnabled}
                      onCheckedChange={setDeliveryEnabled}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Distância Máxima */}
                    <div className="space-y-2">
                      <Label htmlFor="max-dist" className="font-bold text-xs">Raio Máximo (Km)</Label>
                      <Input
                        id="max-dist"
                        type="number"
                        min="1"
                        max="50"
                        value={deliveryMaxDistance}
                        onChange={(e) => setDeliveryMaxDistance(Math.max(1, Number(e.target.value)))}
                        className="rounded-xl border-border/60 focus-visible:ring-primary/20 h-10 font-bold"
                      />
                    </div>

                    {/* Taxa Base */}
                    <div className="space-y-2">
                      <Label htmlFor="base-fee" className="font-bold text-xs">Taxa Base (R$)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="base-fee"
                          type="text"
                          value={deliveryBaseFee}
                          onChange={(e) => setDeliveryBaseFee(e.target.value)}
                          className="rounded-xl border-border/60 focus-visible:ring-primary/20 pl-8 h-10 font-mono font-bold"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Taxa por Km */}
                  <div className="space-y-2">
                    <Label htmlFor="km-fee" className="font-bold text-xs">Valor por Quilômetro Adicional (R$/Km)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        id="km-fee"
                        type="text"
                        value={deliveryFeePerKm}
                        onChange={(e) => setDeliveryFeePerKm(e.target.value)}
                        className="rounded-xl border-border/60 focus-visible:ring-primary/20 pl-8 h-10 font-mono font-bold"
                        placeholder="0,00"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground block leading-tight">
                      Fórmula de Cálculo: <code>Taxa Total = Taxa Base + (Distância em Km * Valor por Km)</code>
                    </span>
                  </div>

                </CardContent>
              </Card>

              {/* Formulário para Nova Zona no Mapa */}
              <Card className="rounded-2xl border-border/50 shadow-sm bg-muted/10 border-dashed border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-heading font-bold text-primary flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    Adicionar Zona Customizada (Mapa)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Desenhe uma zona clicando no mapa à direita. Configure os detalhes abaixo:
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5 text-xs">
                  
                  {/* Coordenadas do clique */}
                  <div className="flex items-center gap-1.5 bg-muted/60 p-2 rounded-lg border border-border/20">
                    <MapPin className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-muted-foreground font-mono">
                      {newZoneCenter 
                        ? `Centro: ${newZoneCenter.lat.toFixed(5)}, ${newZoneCenter.lng.toFixed(5)}` 
                        : '⚠️ Clique em algum ponto do mapa à direita...'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="zone-name" className="text-xs font-semibold">Nome da Região / Zona</Label>
                    <Input 
                      id="zone-name"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      placeholder="Ex: Bairro Norte, Condomínio Residencial"
                      className="rounded-lg border-border/60 h-8 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Tipo da Zona */}
                    <div className="space-y-1.5">
                      <Label htmlFor="zone-type" className="text-xs font-semibold">Regra de Entrega</Label>
                      <Select 
                        value={newZoneType} 
                        onValueChange={(val: any) => setNewZoneType(val)}
                      >
                        <SelectTrigger className="h-8 rounded-lg border-border/60 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg text-xs font-sans">
                          <SelectItem value="special_fee">Cobrar Taxa Especial</SelectItem>
                          <SelectItem value="exclusion">Sem Cobertura (Exclusão)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Taxa da Zona */}
                    <div className="space-y-1.5">
                      <Label htmlFor="zone-fee" className="text-xs font-semibold">Valor da Taxa (R$)</Label>
                      <Input
                        id="zone-fee"
                        type="text"
                        disabled={newZoneType === 'exclusion'}
                        value={newZoneFee}
                        onChange={(e) => setNewZoneFee(e.target.value)}
                        className="rounded-lg border-border/60 h-8 text-xs font-mono font-bold"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  {/* Raio do círculo */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <Label htmlFor="zone-radius" className="font-semibold">Raio de Cobertura (Metros)</Label>
                      <span className="font-mono text-muted-foreground font-semibold">{newZoneRadius} m</span>
                    </div>
                    <Input
                      id="zone-radius"
                      type="range"
                      min="100"
                      max="10000"
                      step="50"
                      value={newZoneRadius}
                      onChange={(e) => setNewZoneRadius(Number(e.target.value))}
                      className="accent-primary cursor-pointer w-full h-1 bg-muted rounded-lg"
                    />
                  </div>

                  <Button 
                    onClick={handleAddZone}
                    className="w-full text-xs font-bold rounded-lg h-9"
                    size="sm"
                  >
                    Adicionar Zona à Lista
                  </Button>

                </CardContent>
              </Card>

              {/* Lista de Zonas Criadas */}
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-heading font-bold">Zonas Configuradas ({deliveryZones.length})</CardTitle>
                  <CardDescription className="text-xs">Zonas com taxas de entrega diferenciadas ou sem cobertura.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {deliveryZones.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border-t border-border/20">
                      Nenhuma zona customizada adicionada. O restaurante usará apenas a taxa padrão por quilômetro.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/25 max-h-[250px] overflow-y-auto border-t border-border/20">
                      {deliveryZones.map(zone => (
                        <div key={zone.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/10">
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-foreground block truncate">{zone.name}</span>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge className={`${zone.type === 'exclusion' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'} text-[9px] py-0 border rounded-full`}>
                                {zone.type === 'exclusion' ? 'Exclusão' : `R$ ${(zone.fee / 100).toFixed(2)}`}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground font-mono font-semibold">
                                {zone.radius}m de raio
                              </span>
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteZone(zone.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-500 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Botão de Salvar Tudo */}
              <Button
                onClick={handleSaveConfigs}
                disabled={saving}
                className="w-full bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-white font-bold rounded-2xl h-12 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Salvando Configurações...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Salvar Configurações de Delivery
                  </>
                )}
              </Button>

            </div>

            {/* Lado Direito: Google Maps */}
            <div className="lg:col-span-7 space-y-4">
              {isCoordsFallback && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 p-4 rounded-2xl text-xs flex items-start gap-3 animate-pulse shadow-sm">
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-amber-500" />
                  <div>
                    <span className="font-bold text-sm block">Localização do Restaurante Não Configurada!</span>
                    <p className="mt-1 leading-relaxed">
                      Seu restaurante está usando uma localização padrão (São Paulo, SP). 
                      Para habilitar a estimativa de distância e o cálculo automático das taxas de frete:
                    </p>
                    <ul className="list-disc pl-4 mt-1.5 space-y-1.5 font-medium">
                      <li><strong>Arraste o marcador do restaurante</strong> (o pino vermelho com ícone de restaurante) até o ponto exato no mapa;</li>
                      <li>Clique em <strong>"Salvar Configurações de Delivery"</strong> no final da página para gravar a posição definitiva.</li>
                    </ul>
                  </div>
                </div>
              )}
              
              <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden flex flex-col h-[650px] relative">
                <CardHeader className="bg-background border-b border-border/40 p-4 shrink-0">
                  <CardTitle className="text-sm font-heading font-bold flex items-center gap-1.5">
                    <MapPin className="h-4.5 w-4.5 text-primary" />
                    Visualização Espacial & Mapa de Cobertura
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Arraste o mapa para explorar. Clique para colocar o pino de novas zonas de entrega. O círculo azul translúcido indica o raio de entrega configurado.
                  </CardDescription>
                </CardHeader>
                
                {/* Google Maps Container */}
                <div 
                  ref={setMapContainer} 
                  className="w-full bg-muted/30 border-t border-border/40"
                  style={{ height: '520px', minHeight: '300px' }}
                />

                {/* Legendas de Mapa */}
                <div className="absolute bottom-4 left-4 z-10 bg-background/95 backdrop-blur border border-border/60 p-3 rounded-xl shadow-lg text-[10px] space-y-1.5 pointer-events-none select-none font-sans">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-primary/20 border border-primary block" />
                    <span className="font-semibold text-foreground">Raio Geral de Entrega ({deliveryMaxDistance} km)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-indigo-500/20 border border-indigo-500 block" />
                    <span className="font-semibold text-foreground">Zonas com Taxas Especiais</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500 block" />
                    <span className="font-semibold text-foreground">Zonas de Exclusão (Sem Entrega)</span>
                  </div>
                </div>
              </Card>
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
