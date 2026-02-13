import { useCallback, useState } from "react";
import type { ApiResponse } from "../types";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (apiCall: () => Promise<ApiResponse<T>>): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await apiCall();
        if (result.success) {
          setState({ data: result.data, loading: false, error: null });
          return result.data;
        } else {
          setState({
            data: null,
            loading: false,
            error: result.error ?? "Unknown error",
          });
          return null;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Request failed";
        setState({ data: null, loading: false, error: message });
        return null;
      }
    },
    []
  );

  return { ...state, execute };
}
