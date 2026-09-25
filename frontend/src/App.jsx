import { Navigate, Route, Routes } from "react-router-dom";
import LaunchPage from "./LaunchPage.jsx";
import LabPage from "./LabPage.jsx";
import "./styles.css";

export default function App() {
  return <Routes>
    <Route path="/launch" element={<LaunchPage />} />
    <Route path="/lab" element={<LabPage />} />
    <Route path="*" element={<Navigate to="/lab" replace />} />
  </Routes>;
}
