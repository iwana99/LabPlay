import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import {
  api,
} from "../api.js";

import LoginPage
  from "./pages/LoginPage.jsx";

import LabsPage
  from "./pages/LabsPage.jsx";

import LabEditorPage
  from "./pages/LabEditorPage.jsx";


export default function App() {
  const [admin, setAdmin] =
    useState(null);

  const [loading, setLoading] =
    useState(true);


  useEffect(() => {
    api("/admin/auth/me")
      .then((data) => {
        setAdmin(
          data.admin
        );
      })
      .catch(() => {
        setAdmin(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);


  async function logout() {
    await api(
      "/admin/auth/logout",
      {
        method: "POST",
      }
    );

    setAdmin(null);
  }


  if (loading) {
    return (
      <div className="center-page">
        Učitavanje...
      </div>
    );
  }


  return (
    <Routes>
      <Route
        path="/login"
        element={
          admin ? (
            <Navigate
              to="/labs"
              replace
            />
          ) : (
            <LoginPage
              onLogin={
                setAdmin
              }
            />
          )
        }
      />

      <Route
        path="/labs"
        element={
          admin ? (
            <LabsPage
              admin={
                admin
              }
              onLogout={
                logout
              }
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/labs/:labId"
        element={
          admin ? (
            <LabEditorPage />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={
              admin
                ? "/labs"
                : "/login"
            }
            replace
          />
        }
      />
    </Routes>
  );
}