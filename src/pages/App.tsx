// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./dashboard";
import Login from "./login";
import MeyveListesi from "./meyvelistesi";
import UserList from "./UserList";
import Home from "./home";
import AdminRoute from "./AdminRoute";
import Duyurular from "./duyuru";
import Il from "../tanımlamalar/il";
import Profile from "../pages/profil"; // veya doğru klasör yolun neyse onu yaz
import ProtectedRoute from "../components/ProtectedRoute"; // ekledik

export default function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="home" />} />
        <Route path="home" element={<Home />} />
        <Route path="meyvelistesi" element={<MeyveListesi />} />
        <Route path="duyuru" element={<Duyurular />} />
        <Route path="il" element={<Il />} />
        <Route path="profil" element={<Profile />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UserList />
            </AdminRoute>
          }
        />
        {/* Wildcard yönlendirme */}
        <Route path="*" element={<Navigate to="/home" />} />
      </Route>
    </Routes>
  );
}
