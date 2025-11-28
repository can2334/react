// DashboardLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";

export default function DashboardLayout() {
    const user = JSON.parse(localStorage.getItem("user") || "null");

    return (
        <div className="dashboard-layout">
            <Header />
            <main style={{ padding: "20px" }}>
                {/* Outlet sayesinde nested route'lar burada render edilir */}
                <Outlet />

            </main>
        </div>
    );
}
