import React, { useEffect, useState } from "react";
import { Il } from "../interface/il";
import "../css/App.css";

const STORAGE_KEY = "myapp_iller_v2";
const STORAGE_NEXT_ID = "myapp_iller_nextid_v2";

const defaultData: Il[] = [
    { id: 1, adi: "İstanbul", plakaKodu: "34", ulke: { id: 1, adi: "Türkiye" } },
    { id: 2, adi: "Ankara", plakaKodu: "06", ulke: { id: 1, adi: "Türkiye" } },
    { id: 3, adi: "İzmir", plakaKodu: "35", ulke: { id: 1, adi: "Türkiye" } },
];

interface ToastType {
    message: string;
    type: "success" | "error";
}

export default function IlPage() {
    const [data, setData] = useState<Il[]>(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as Il[];
        return defaultData;
    });

    const [nextId, setNextId] = useState(() => {
        const s = localStorage.getItem(STORAGE_NEXT_ID);
        if (s) return Number(s);
        const maxId = data.reduce((m, it) => (it.id > m ? it.id : m), 0);
        return maxId + 1;
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Il | null>(null);
    const [form, setForm] = useState({ adi: "", plakaKodu: "", ulkeAdi: "Türkiye" });
    const [toast, setToast] = useState<ToastType | null>(null);

    // localStorage sync
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(STORAGE_NEXT_ID, String(nextId));
    }, [data, nextId]);

    useEffect(() => {
        const handleStorage = (ev: StorageEvent) => {
            if (ev.key === STORAGE_KEY && ev.newValue) setData(JSON.parse(ev.newValue));
            if (ev.key === STORAGE_NEXT_ID && ev.newValue) setNextId(Number(ev.newValue));
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);

    const openModal = (item?: Il) => {
        if (item) {
            setSelectedItem(item);
            setForm({ adi: item.adi, plakaKodu: item.plakaKodu, ulkeAdi: item.ulke.adi });
        } else {
            setSelectedItem(null);
            setForm({ adi: "", plakaKodu: "", ulkeAdi: "Türkiye" });
        }
        setModalOpen(true);
    };

    const showToast = (message: string, type: "success" | "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2500);
    };

    const saveItem = () => {
        const trimmedAdi = form.adi.trim();
        const trimmedPlaka = form.plakaKodu.trim();
        if (!trimmedAdi) {
            showToast("İl adı boş olamaz", "error");
            return;
        }

        if (selectedItem) {
            setData(prev => prev.map(d => (d.id === selectedItem.id ? { ...d, adi: trimmedAdi, plakaKodu: trimmedPlaka } : d)));
            showToast("Başarıyla güncellendi", "success");
        } else {
            const newItem: Il = { id: nextId, adi: trimmedAdi, plakaKodu: trimmedPlaka, ulke: { id: 1, adi: form.ulkeAdi } };
            setData(prev => [...prev, newItem]);
            setNextId(prev => prev + 1);
            showToast("Başarıyla eklendi", "success");
        }
        setModalOpen(false);
    };

    const deleteItem = (id: number) => {
        if (!window.confirm("Silmek istediğine emin misin?")) return;
        setData(prev => prev.filter(d => d.id !== id));
        showToast("Başarıyla silindi", "success");
    };

    return (
        <div className="il-container">
            <h2>İller</h2>

            <button onClick={() => openModal()} style={{ marginBottom: 10 }}>Yeni İl</button>
            <button
                style={{ marginLeft: 10, backgroundColor: "#ef5350", color: "white", padding: "6px 12px", borderRadius: 4 }}
                onClick={() => {
                    if (window.confirm("Tüm illeri silmek istediğinize emin misiniz?")) {
                        localStorage.removeItem("myapp_iller_v3");
                        localStorage.removeItem("myapp_iller_nextid_v3");
                        setData([]);
                        setNextId(1);
                        showToast("Tüm veriler silindi", "success");
                    }
                }}
            >
                Tüm Veriyi Temizle
            </button>

            <table className="il-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Ülke</th>
                        <th>İl</th>
                        <th>Plaka Kodu</th>
                        <th>İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(d => (
                        <tr key={d.id}>
                            <td>{d.id}</td>
                            <td>{d.ulke.adi}</td>
                            <td>{d.adi}</td>
                            <td>{d.plakaKodu}</td>
                            <td>
                                <button className="edit" onClick={() => openModal(d)}>Düzenle</button>
                                <button className="delete" onClick={() => deleteItem(d.id)}>Sil</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {modalOpen && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <h3>{selectedItem ? "Güncelle" : "Yeni İl"}</h3>
                        <div>
                            <label>İl Adı</label>
                            <input value={form.adi} onChange={e => setForm({ ...form, adi: e.target.value })} />
                        </div>
                        <div>
                            <label>Plaka Kodu</label>
                            <input value={form.plakaKodu} onChange={e => setForm({ ...form, plakaKodu: e.target.value })} />
                        </div>
                        <div className="modal-buttons">
                            <button onClick={() => setModalOpen(false)}>İptal</button>
                            <button onClick={saveItem}>{selectedItem ? "Güncelle" : "Kaydet"}</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="toast">{toast.message}</div>}
        </div>
    );
}
