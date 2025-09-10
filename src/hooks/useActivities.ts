import { useState, useEffect } from 'react';
import { ActivityService } from '@/services/activityService';
import { ActivityDisplay } from '@/types/activity';

export function useActivities(limit: number = 10) {
  const [activities, setActivities] = useState<ActivityDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Buscar atividades de auditoria e importação
        const [auditActivities, importActivities] = await Promise.all([
          ActivityService.getRecentActivities(limit),
          ActivityService.getImportActivities(Math.floor(limit / 2))
        ]);

        // Combinar e ordenar por timestamp
        const allActivities = [...auditActivities, ...importActivities]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit);

        setActivities(allActivities);
      } catch (err) {
        console.error('Erro ao buscar atividades:', err);
        setError('Erro ao carregar atividades');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [limit]);

  const refreshActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [auditActivities, importActivities] = await Promise.all([
        ActivityService.getRecentActivities(limit),
        ActivityService.getImportActivities(Math.floor(limit / 2))
      ]);

      const allActivities = [...auditActivities, ...importActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      setActivities(allActivities);
    } catch (err) {
      console.error('Erro ao atualizar atividades:', err);
      setError('Erro ao atualizar atividades');
    } finally {
      setLoading(false);
    }
  };

  return {
    activities,
    loading,
    error,
    refreshActivities,
  };
}
