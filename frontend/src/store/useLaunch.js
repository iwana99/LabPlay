

import {
  useCallback,
  useState
} from "react";

import {
  api
} from "../lib/api.js";


export function useLaunch() {

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);


  const exchangeLaunch = useCallback(async (code) => {

        try {
          setLoading(true);
          setError("");

          await api.post(
            "/auth/exchange", {code});

          return true;

        } catch (err) {

          setError(
            err.response
              ?.data
              ?.message ||
            err.message
          );

          return false;

        } finally {

          setLoading(false);

        }

      },
      []
    );


  return {
    exchangeLaunch,
    loading,
    error
  };
}