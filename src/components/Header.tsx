import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../css/dashboard.css";

type User = {
    username: string;
    profile_image?: string;
    is_admin: boolean;
};

export default function Header() {
    const [tanımlamalarOpen, setTanımlamalarOpen] = useState(false);
    const [profilOpen, setProfilOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const navigate = useNavigate();

    const tanımlamalarRef = useRef<HTMLDivElement>(null);
    const profilRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const stored = localStorage.getItem("user");
        if (stored) {
            setUser(JSON.parse(stored));
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (
                tanımlamalarRef.current &&
                !tanımlamalarRef.current.contains(event.target as Node)
            ) {
                setTanımlamalarOpen(false);
            }
            if (
                profilRef.current &&
                !profilRef.current.contains(event.target as Node)
            ) {
                setProfilOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("user");
        navigate("/login");
    };

    return (
        <header>
            <div className="menu-links">
                <Link to="/home">🏠 Home</Link>
                <Link to="/meyvelistesi">🍎 Meyve Listesi</Link>

                {/* Tanımlamalar Dropdown */}
                <div className="dropdown-container" ref={tanımlamalarRef}>
                    <span
                        className="dropdown-toggle"
                        onClick={() => setTanımlamalarOpen(!tanımlamalarOpen)}
                    >
                        🛠️ Tanımlamalar ▼
                    </span>
                    {tanımlamalarOpen && (
                        <div className="dropdown-menu">
                            <Link to="/Il">İl</Link>
                            <Link to="/tanımlamalar/kategori2">Kategori 2</Link>
                            <Link to="/tanımlamalar/kategori3">Kategori 3</Link>
                        </div>
                    )}
                </div>

                {user?.is_admin ? <Link to="/users">👤 Kullanıcılar</Link> : null}
                {user?.is_admin ? <Link to="/duyuru">📢 Duyurular</Link> : null}
            </div>

            {/* Profil Dropdown */}
            {
                user && (
                    <div className="profile-container" ref={profilRef}>
                        <img
                            src={user.profile_image}
                            alt="profil"
                            className="profile-img"
                            onClick={() => setProfilOpen(!profilOpen)}
                        />
                        {profilOpen && (
                            <div className="profile-dropdown">
                                <Link to="/profil">Profil</Link>
                                <button onClick={handleLogout}>Çıkış</button>
                            </div>
                        )}
                    </div>
                )
            }
        </header >
    );
}
