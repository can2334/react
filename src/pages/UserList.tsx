import React, { useEffect, useState, useRef } from "react";
import "../css/App.css";
import AdminYetkiKontrol from "../components/AdminYetkiKontrol";
import { Toast } from "primereact/toast";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import "primereact/resources/themes/saga-blue/theme.css";
import "primereact/resources/primereact.min.css";
import { User } from "../interface/userlist";

export default function UserList() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [profileImage, setProfileImage] = useState("");

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newProfileImage, setNewProfileImage] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newIsAdmin, setNewIsAdmin] = useState(false);

    const toast = useRef<Toast>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("http://localhost:5000/users");
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            setError("Veri alınamadı");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = (id: number) => {
        confirmDialog({
            message: "Bu kullanıcıyı silmek istediğine emin misin?",
            header: "Dikkat",
            icon: "pi pi-exclamation-triangle",
            acceptLabel: "Evet",
            rejectLabel: "Hayır",
            accept: async () => {
                await fetch(`http://localhost:5000/users/${id}`, { method: "DELETE" });
                fetchUsers();
                toast.current?.show({
                    severity: "info",
                    summary: "Silindi",
                    detail: "Kullanıcı kaldırıldı",
                    life: 2000,
                });
            },
        });
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setUsername(user.username);
        setEmail(user.email || "");
        setProfileImage(user.profile_image || "");
    };

    const handleUpdate = async () => {
        if (!editingUser) return;
        await fetch(`http://localhost:5000/users/${editingUser.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                email,
                profile_image: profileImage,
                is_admin: editingUser.is_admin
            }),
        });
        setEditingUser(null);
        fetchUsers();
        toast.current?.show({
            severity: "success",
            summary: "Güncellendi",
            detail: "Kullanıcı bilgileri güncellendi",
            life: 2000,
        });
    };

    const handleAddUser = async () => {
        if (!newUsername || !newPassword) {
            toast.current?.show({
                severity: "warn",
                summary: "Hata",
                detail: "Kullanıcı adı ve şifre gerekli",
                life: 2000,
            });
            return;
        }

        await fetch("http://localhost:5000/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: newUsername,
                email: newEmail,
                profile_image: newProfileImage,
                password: newPassword,
                is_admin: newIsAdmin,
            }),
        });

        setNewUsername("");
        setNewEmail("");
        setNewProfileImage("");
        setNewPassword("");
        setNewIsAdmin(false);
        setAddModalOpen(false);

        fetchUsers();
        toast.current?.show({
            severity: "success",
            summary: "Eklendi",
            detail: "Yeni kullanıcı başarıyla eklendi",
            life: 2000,
        });
    };

    return (
        <AdminYetkiKontrol>
            <Toast ref={toast} />
            <ConfirmDialog />
            <div className="container">
                <h2>Kullanıcı Listesi</h2>
                <button className="add-btn" onClick={() => setAddModalOpen(true)}>Yeni Kullanıcı Ekle</button>

                {loading && <p className="loading">Veri yükleniyor...</p>}
                {error && <p className="error">Hata: {error}</p>}
                {!loading && !error && users.length === 0 && <p className="no-users">Hiç kullanıcı yok</p>}

                {!loading && !error && users.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Kullanıcı Adı</th>
                                <th>Email</th>
                                <th>Admin</th>
                                <th>Profil</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.id}</td>
                                    <td>{u.username}</td>
                                    <td>{u.email || "-"}</td>
                                    <td>{u.is_admin ? "Evet" : "Hayır"}</td>
                                    <td>
                                        {u.profile_image ? (
                                            <img
                                                src={u.profile_image}
                                                alt="profile"
                                                style={{ width: 40, height: 40, borderRadius: 8 }}
                                            />
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td>
                                        <button className="add-btn" onClick={() => openEditModal(u)}>
                                            Düzenle
                                        </button>
                                        <button className="delete-btn" onClick={() => handleDelete(u.id)}>
                                            Sil
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Düzenleme Modalı */}
                {editingUser && (
                    <div className="modal-backdrop">
                        <div className="modal">
                            <h3>Kullanıcıyı Düzenle</h3>
                            <label>Kullanıcı Adı</label>
                            <input value={username} onChange={(e) => setUsername(e.target.value)} />

                            <label>Email</label>
                            <input value={email} onChange={(e) => setEmail(e.target.value)} />

                            <label>Profil Fotoğraf URL</label>
                            <input value={profileImage} onChange={(e) => setProfileImage(e.target.value)} />

                            <label>
                                <input
                                    type="checkbox"
                                    checked={editingUser.is_admin}
                                    onChange={(e) =>
                                        setEditingUser({ ...editingUser, is_admin: e.target.checked })
                                    }
                                />{" "}
                                Admin
                            </label>

                            <div className="modal-buttons">
                                <button className="add-btn" onClick={handleUpdate}>Güncelle</button>
                                <button className="delete-btn" onClick={() => setEditingUser(null)}>İptal</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Yeni Kullanıcı Modalı */}
                {addModalOpen && (
                    <div className="modal-backdrop">
                        <div className="modal">
                            <h3>Yeni Kullanıcı Ekle</h3>
                            <input
                                type="text"
                                placeholder="Kullanıcı Adı"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Profil Fotoğraf URL"
                                value={newProfileImage}
                                onChange={(e) => setNewProfileImage(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Şifre"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <label>
                                <input
                                    type="checkbox"
                                    checked={newIsAdmin}
                                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                                /> Admin
                            </label>
                            <div className="modal-buttons">
                                <button className="add-btn" onClick={handleAddUser}>Ekle</button>
                                <button className="delete-btn" onClick={() => setAddModalOpen(false)}>İptal</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminYetkiKontrol>
    );
}
