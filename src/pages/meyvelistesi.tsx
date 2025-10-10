import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../css/App.css";
import { Meyve } from "../interface/meyve";


const columns = [
    { header: "İsim", field: "isim" },
    { header: "Adet", field: "adet" },
    { header: "Mevsim", field: "mevsim" },
];

export default function MeyveListesi() {
    const [items, setItems] = useState<Meyve[]>([]);
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<"isim" | "adetBuyuktenKucuge" | "adetKucuktenBuyuge">("isim");
    const fileRef = useRef<HTMLInputElement | null>(null);

    // Yeni meyve modal kontrolü
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [yeniIsim, setYeniIsim] = useState("");
    const [yeniAdet, setYeniAdet] = useState<number>(1);
    const [yeniMevsim, setYeniMevsim] = useState("Yaz");

    // Düzenleme modal kontrolü
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Meyve | null>(null);

    // Silme modal kontrolü
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteItem, setDeleteItem] = useState<Meyve | null>(null);

    // localStorage'dan yükle
    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem("meyveler") || "[]");
        if (saved.length) setItems(saved);
    }, []);

    // localStorage'a kaydet
    useEffect(() => {
        localStorage.setItem("meyveler", JSON.stringify(items));
    }, [items]);

    // Yeni meyve ekleme
    const saveNewMeyve = () => {
        if (!yeniIsim.trim()) {
            toast.error("⚠️ Meyve adı boş olamaz!");
            return;
        }
        if (items.some((it) => it.isim.toLowerCase() === yeniIsim.toLowerCase())) {
            toast.error("⚠️ Bu isimde bir meyve zaten var!");
            return;
        }
        const yeni = {
            id: Date.now().toString(),
            isim: yeniIsim,
            adet: yeniAdet,
            mevsim: yeniMevsim,
        };
        setItems([...items, yeni]);
        setAddModalOpen(false);
        setYeniIsim("");
        setYeniAdet(1);
        setYeniMevsim("Yaz");
        toast.success("✅ Meyve başarıyla eklendi!");
    };

    // Düzenleme kaydet
    const saveEdit = () => {
        if (!editItem || !editItem.isim.trim()) {
            toast.error("⚠️ Meyve adı boş olamaz!");
            return;
        }
        setItems(items.map((it) => (it.id === editItem.id ? editItem : it)));
        setEditModalOpen(false);
        toast.success("✅ Meyve bilgisi güncellendi!");
    };

    // Silme modal aç
    const openDeleteModal = (item: Meyve) => {
        setDeleteItem(item);
        setDeleteModalOpen(true);
    };

    // Silme onayla
    const confirmDelete = () => {
        if (!deleteItem) return;
        setItems(items.filter((it) => it.id !== deleteItem.id));
        toast.error("🗑️ Meyve silindi!");
        setDeleteItem(null);
        setDeleteModalOpen(false);
    };

    // Silme iptal
    const cancelDelete = () => {
        toast.info("❌ Silme işlemi iptal edildi.");
        setDeleteItem(null);
        setDeleteModalOpen(false);
    };

    // Export & Import
    const handleExport = () => {
        const data = JSON.stringify(items, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "meyveler.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target?.result as string);
                setItems(parsed);
                toast.success("✅ Meyveler başarıyla içe aktarıldı!");
            } catch {
                toast.error("❌ Geçersiz dosya");
            }
        };
        reader.readAsText(file);
    };

    const toplamAdet = items.reduce((sum, it) => sum + it.adet, 0);

    const filtered = items.filter((it) =>
        it.isim.toLowerCase().includes(search.toLowerCase())
    );

    const sorted = filtered.sort((a, b) => {
        if (sortBy === "isim") return a.isim.localeCompare(b.isim);
        if (sortBy === "adetBuyuktenKucuge") return b.adet - a.adet;
        if (sortBy === "adetKucuktenBuyuge") return a.adet - b.adet;
        return 0;
    });

    return (
        <div className="container">
            <ToastContainer position="top-right" autoClose={2000} />

            <h2>🍎 Meyve Listesi</h2>

            {/* Üst menü */}
            <div className="input-group">
                <button className="add-btn" onClick={() => setAddModalOpen(true)}>➕ Yeni Meyve Ekle</button>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ara..."
                />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                    <option value="isim">İsim (A → Z)</option>
                    <option value="adetBuyuktenKucuge">Adet (Büyükten Küçüğe)</option>
                    <option value="adetKucuktenBuyuge">Adet (Küçükten Büyüğe)</option>
                </select>
            </div>

            <div className="input-group">
                <button className="export-btn" onClick={handleExport}>📤 Export</button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json"
                    style={{ display: "none" }}
                    onChange={(e) => handleImport(e.target.files?.[0])}
                />
                <button className="import-btn" onClick={() => fileRef.current?.click()}>📥 Import</button>
            </div>

            {/* Tablo */}
            {items.length > 0 ? (
                <table>
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.field}>{c.header}</th>
                            ))}
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((item) => (
                            <motion.tr key={item.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                <td>{item.isim}</td>
                                <td>{item.adet}</td>
                                <td>{item.mevsim}</td>
                                <td>
                                    <button className="delete-btn" onClick={() => openDeleteModal(item)}>🗑 Sil</button>
                                    <button className="edit-btn" onClick={() => { setEditItem(item); setEditModalOpen(true); }}>✏️ Düzenle</button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p className="total-info">📭 Henüz listeye meyve eklemediniz.</p>
            )}

            <div className="total-info">
                Toplam çeşit: <strong>{items.length}</strong> — Toplam adet: <strong>{toplamAdet}</strong>
            </div>

            {/* Yeni Meyve Modal */}
            {addModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3>Yeni Meyve Ekle</h3>
                        <label>İsim:</label>
                        <input value={yeniIsim} onChange={(e) => setYeniIsim(e.target.value)} />
                        <label>Adet:</label>
                        <input type="number" min={1} value={yeniAdet} onChange={(e) => setYeniAdet(Number(e.target.value))} />
                        <label>Mevsim:</label>
                        <select value={yeniMevsim} onChange={(e) => setYeniMevsim(e.target.value)}>
                            <option>Yaz</option>
                            <option>Kış</option>
                            <option>İlkbahar</option>
                            <option>Sonbahar</option>
                        </select>
                        <div className="modal-buttons">
                            <button onClick={saveNewMeyve}>✅ Ekle</button>
                            <button onClick={() => setAddModalOpen(false)}>❌ İptal</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Düzenleme Modal */}
            {editModalOpen && editItem && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3>Meyve Düzenle</h3>
                        <label>İsim:</label>
                        <input value={editItem.isim} onChange={(e) => setEditItem({ ...editItem, isim: e.target.value })} />
                        <label>Adet:</label>
                        <input type="number" min={1} value={editItem.adet} onChange={(e) => setEditItem({ ...editItem, adet: Number(e.target.value) })} />
                        <label>Mevsim:</label>
                        <select value={editItem.mevsim} onChange={(e) => setEditItem({ ...editItem, mevsim: e.target.value })}>
                            <option>Yaz</option>
                            <option>Kış</option>
                            <option>İlkbahar</option>
                            <option>Sonbahar</option>
                        </select>
                        <div className="modal-buttons">
                            <button onClick={saveEdit}>💾 Kaydet</button>
                            <button onClick={() => setEditModalOpen(false)}>❌ Kapat</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Silme Modal */}
            {deleteModalOpen && deleteItem && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3>📛 "{deleteItem.isim}" meyvesini silmek istediğine emin misin?</h3>
                        <div className="modal-buttons">
                            <button onClick={confirmDelete}>✅ Evet, Sil</button>
                            <button onClick={cancelDelete}>❌ İptal</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
