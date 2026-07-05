import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import App from "./App.jsx";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute.jsx";
import { AdminAuthProvider } from "./context/AdminAuthContext.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin/login" element={<AdminAuthProvider><AdminLoginPage /></AdminAuthProvider>} />
        <Route path="/admin" element={
          <AdminAuthProvider>
            <ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>
          </AdminAuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
