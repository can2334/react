// src/pages/AdminRoute.tsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth";

interface AdminRouteProps {
    children: React.ReactNode;
}
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) return null; // user localStorage’dan gelene kadar bekle
    if (!user) return <Navigate to="/login" replace />;
    if (!user.is_admin) return <Navigate to="/home" replace />;

    return <>{children}</>;
};



export default AdminRoute;
