import axios from "axios";

const BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:4000";

export const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});