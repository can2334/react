import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminYetkiKontrol from "../components/AdminYetkiKontrol";
import { Log } from "../interface/duyuru";


const Duyurular: React.FC = () => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingLog, setEditingLog] = useState<Log | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    const fetchLogs = async () => {
        try {
            const res = await fetch("http://localhost:5000/duyurular");
            const data = await res.json();
            setLogs(data);
        } catch (err) {
            toast.error("Veri çekilirken hata oluştu");
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    // Yeni duyuru ekleme
    const handleAdd = async () => {
        if (!title.trim() || !content.trim()) {
            toast.warn("Başlık ve içerik boş olamaz");
            return;
        }

        const storedUser = localStorage.getItem("user");
        if (!storedUser) return toast.error("Kullanıcı bilgisi bulunamadı");
        const user = JSON.parse(storedUser);

        try {
            await fetch("http://localhost:5000/duyurular", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content, user_id: user.id }),
            });
            toast.success("Duyuru paylaşıldı");
            setTitle(""); setContent("");
            fetchLogs();
        } catch (err) {
            toast.error("Duyuru eklenirken hata oluştu");
        }
    };

    // Düzenleme modalını aç
    const openEditModal = (log: Log) => {
        setEditingLog(log);
        setTitle(log.title);
        setContent(log.content);
        setShowEditModal(true);
    };

    // Düzenlemeyi kaydet
    const handleEditSave = async () => {
        if (!editingLog) return;
        try {
            await fetch(`http://localhost:5000/duyurular/${editingLog.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content }),
            });
            toast.success("Duyuru güncellendi");
            setShowEditModal(false);
            setEditingLog(null);
            setTitle(""); setContent("");
            fetchLogs();
        } catch (err) {
            toast.error("Duyuru güncellenirken hata oluştu");
        }
    };

    // Silme modalı
    const confirmDelete = (id: number) => {
        setDeleteId(id);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (deleteId === null) return;
        try {
            await fetch(`http://localhost:5000/duyurular/${deleteId}`, { method: "DELETE" });
            toast.info("Duyuru silindi");
            fetchLogs();
        } catch {
            toast.error("Duyuru silinirken hata oluştu");
        }
        setShowDeleteModal(false);
        setDeleteId(null);
    };

    return (
        <AdminYetkiKontrol>
            <div className="container">
                <ToastContainer position="top-right" autoClose={2000} />
                <h2>Duyurular</h2>

                <div className="input-group">
                    <input placeholder="Başlık" value={title} onChange={e => setTitle(e.target.value)} />
                    <input placeholder="İçerik" value={content} onChange={e => setContent(e.target.value)} />
                    <button className="add-btn" onClick={handleAdd}>Paylaş</button>
                </div>

                <div className="table-section">
                    <table>
                        <thead>
                            <tr>
                                <th>Profil</th>
                                <th>Başlık</th>
                                <th>İçerik</th>
                                <th>Kullanıcı</th>
                                <th>Tarih</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td>{log.profile_image ? <img src={log.profile_image} alt="profil" style={{ width: 40, height: 40, borderRadius: 50 }} /> : "—"}</td>
                                    <td>{log.title}</td>
                                    <td>{log.content}</td>
                                    <td>{log.username}</td>
                                    <td>{new Date(log.created_at).toLocaleString()}</td>
                                    <td>
                                        <button className="edit-btn" onClick={() => openEditModal(log)}>Düzenle</button>
                                        <button className="delete-btn" onClick={() => confirmDelete(log.id)}>Sil</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Düzenleme Modal */}
                {showEditModal && (
                    <div className="modal-backdrop">
                        <div className="modal">
                            <h3>Duyuruyu Düzenle</h3>
                            <input placeholder="Başlık" value={title} onChange={e => setTitle(e.target.value)} />
                            <input placeholder="İçerik" value={content} onChange={e => setContent(e.target.value)} />
                            <p><strong>Paylaşılma Tarihi:</strong> {editingLog && new Date(editingLog.created_at).toLocaleString()}</p>
                            <div className="modal-buttons">
                                <button className="add-btn" onClick={handleEditSave}>Kaydet</button>
                                <button onClick={() => setShowEditModal(false)}>İptal</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Silme Modal */}
                {showDeleteModal && (
                    <div className="modal-backdrop">
                        <div className="modal">
                            <h3>Onay</h3>
                            <p>Bu duyuruyu silmek istediğine emin misin?</p>
                            <div className="modal-buttons">
                                <button className="delete-btn" onClick={handleDelete}>Evet</button>
                                <button onClick={() => setShowDeleteModal(false)}>Hayır</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminYetkiKontrol>
    );
};

export default Duyurular;
