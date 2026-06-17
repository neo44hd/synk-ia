import { useState, useEffect } from 'react';
import axios from 'axios';

interface UseApiOptions {
  refetchInterval?: number;
  onError?: (error: any) => void;
}

export function useApi<T>(
  url: string,
  options?: UseApiOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get<T>(url);
        setData(response.data);
        setError(null);
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Error desconocido';
        setError(errorMessage);
        if (options?.onError) {
          options.onError(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    if (options?.refetchInterval) {
      const interval = setInterval(fetchData, options.refetchInterval);
      return () => clearInterval(interval);
    }
  }, [url, options?.refetchInterval]);

  return { data, loading, error };
}
