import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../login.css";

export const Login: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await fetch("http://localhost:5000/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.user) {
                localStorage.setItem("user", JSON.stringify(data.user));
                if (!data?.user?.token) return setError("Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.");
                document.cookie = "token=" + data.user.token + ";";
                navigate("/home");
            } else {
                setError(data.error || "Hatalı kullanıcı adı veya şifre");
            };

        } catch (err) {
            console.error("Bağlantı hatası:", err);
            setError("Sunucuya bağlanılamadı.");
        }
    };

    return (
        <div className="login-container">
            <h2>Giriş Yap</h2>
            <form className="login-form" onSubmit={handleLogin}>
                <input
                    type="text"
                    placeholder="Kullanıcı adı"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="login-input"
                />
                <input
                    type="password"
                    placeholder="Şifre"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                />
                <button type="submit" className="login-btn">Giriş</button>
            </form>
            {error && <p className="login-error">{error}</p>}
        </div>
    );
};

export default Login;
