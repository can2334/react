import React from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
    children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

export default ProtectedRoute;
