// src/pages/Profil.tsx
import React, { useEffect, useState } from "react";
import "../css/profil.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { User } from "../interface/profil";

const Profil: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [showModal, setShowModal] = useState(false);

    // Modal inputları için ayrı state
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        profile_image: "",
    });

    useEffect(() => {
        const stored = localStorage.getItem("user");
        if (stored) {
            const parsedUser = JSON.parse(stored);
            setUser(parsedUser);
            setFormData({
                username: parsedUser.username,
                email: parsedUser.email,
                password: "",
                profile_image: parsedUser.profile_image || "",
            });
        }
    }, []);

    if (!user) return <p>Kullanıcı bulunamadı.</p>;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`http://localhost:5000/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: formData.username,
                    email: formData.email,
                    profile_image: formData.profile_image,
                    password: formData.password || undefined,
                }),
            });

            if (!res.ok) throw new Error("Güncelleme başarısız");

            const updatedUser = {
                ...user,
                username: formData.username,
                email: formData.email,
                profile_image: formData.profile_image,
            };

            // State ve localStorage güncelle
            setUser(updatedUser);
            localStorage.setItem("user", JSON.stringify(updatedUser));

            // Formu resetle, şifreyi temizle
            setFormData({
                username: updatedUser.username,
                email: updatedUser.email,
                password: "",
                profile_image: updatedUser.profile_image || "",
            });

            toast.success("Profil güncellendi");
            setShowModal(false);
        } catch (err) {
            toast.error("Profil güncellenirken hata oluştu");
            console.error(err);
        }
    };

    return (
        <div className="profil-container">
            <ToastContainer position="top-right" autoClose={2000} />

            <h2>Profil Bilgileri</h2>
            <img
                key={user.profile_image} // resim değişince render
                src={user.profile_image || "/default-profile.png"}
                alt="profil"
                onError={(e) => { (e.target as HTMLImageElement).src = "/default-profile.png"; }}
            />

            <div className="profil-info">
                <p key={user.username}><strong>Kullanıcı Adı:</strong> {user.username}</p>
                <p key={user.email}><strong>Email:</strong> {user.email}</p>
                <p><strong>Admin:</strong> {user.is_admin ? "Evet" : "Hayır"}</p>
                <button className="add-btn" onClick={() => setShowModal(true)}>Profili Düzenle</button>
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3>Profil Düzenle</h3>
                        <form onSubmit={handleUpdate}>
                            <label>Kullanıcı Adı</label>
                            <input
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                            />

                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />

                            <label>Yeni Şifre</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Şifreyi değiştirmek için girin"
                            />

                            <label>Profil Fotoğraf URL</label>
                            <input
                                name="profile_image"
                                value={formData.profile_image}
                                onChange={handleChange}
                                placeholder="Fotoğraf URL'si"
                            />

                            <div className="modal-buttons">
                                <button className="add-btn" type="submit">Güncelle</button>
                                <button type="button" className="delete-btn" onClick={() => {
                                    setShowModal(false);
                                    // formu eski user bilgileri ile resetle
                                    setFormData({
                                        username: user.username,
                                        email: user.email,
                                        password: "",
                                        profile_image: user.profile_image || "",
                                    });
                                }}>İptal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profil;
