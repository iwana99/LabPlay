import {
  useCallback,
  useEffect,
  useState
} from "react";

import {api} from "../lib/api.js";


export function useLabSession() {

  const [view, setView] =useState(null);

  const [loading, setLoading] =useState(true);

  const [error, setError] = useState("");


  const refresh = useCallback(async () => {

      try {
        setError("");

        const response = await api.get("/attempts/current");

        setView(
          response.data
        );

      } catch (err) {

        setError(
          err.response?.data?.message ||
          err.message
        );

      } finally {

        setLoading(false);

      }

    }, []);


  useEffect(() => {

    refresh();

  }, [refresh]);


  return {
    view,
    loading,
    error,
    refresh
  };
}