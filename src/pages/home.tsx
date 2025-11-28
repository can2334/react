import React, { useEffect, useState } from "react";
import "../css/App.css";
import { Log } from "../interface/home";
import ChatButton from "../components/chatbuttons"; // <-- ChatButton import

const Home: React.FC = () => {
    const [logs, setLogs] = useState<Log[]>([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await fetch("http://localhost:5000/duyurular"); // senin endpoint
                const data = await response.json();
                setLogs(data);
            } catch (error) {
                console.error("Veri çekilirken hata oluştu:", error);
            }
        };

        fetchLogs();
    }, []);


    return (
        <div className="container">
            <h2>Dashboard</h2>
            <div className="grid">
                <div className="card">
                    <img src="https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcT5O2ULQd3Y-dMBFPXkSvQr6t-v0DaT2j1p0KiSVRcxi5AZid0g" alt="Kart 1" />
                    <h4>Uzun Kuyruk</h4>
                    <p>Marsupilami, Ormanda yaşayan, uzun, güçlü ve esnek kuyruğu ile dikkat çeker.</p>
                </div>
                <div className="card">
                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShj5SuUDxkpcZ6ur34DNT1f3g244kyQ1PauQ&s" alt="Kart 2" />
                    <h4>Ornitorenk peri</h4>
                    <p>Ornitorenk (Platypus), Avustralya’nın doğu bölgelerindeki tatlı su habitatlarında yaşayan ilginç ve yarı sucul bir memelidir.</p>
                </div>
                <div className="card">
                    <img src="https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcS_1j6A3oVeJHegzSrjVfWdmJ3dxORBf7WPMcztL_BGLYzedxdiGeKo4B80Ru7Sxce1Xr0fRwNeYMpUpSnwjLV8An6iQEUU8Apn-rVh8i4" alt="Kart 3" />
                    <h4>Su Samuru</h4>
                    <p>Samurlar, yarı sucul memelilerdir ve genellikle nehir, göl ya da deniz kıyılarında yaşarlar.</p>
                </div>
                <div className="card">
                    <img src="https://media.istockphoto.com/id/177228186/tr/foto%C4%9Fraf/young-capybara.jpg?s=612x612&w=0&k=20&c=yVfQMjXcXEmyBMvk3sveRcp0IcEcen5wgKC0kYMF_-o=" alt="Kart 4" />
                    <h4>Kapibara</h4>
                    <p>Kapibara, dünyanın en büyük kemirgenidir ve Güney Amerika’nın sulak alanlarında, nehir ve göl kıyılarında yaşar.</p>
                </div>
            </div>
            <div className="table-section">
                <h3 style={{ textAlign: "center" }}>Duyuru Tablosu</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Tarih</th>
                            <th>Başlık</th>
                            <th>İçerik</th>
                            <th>Kullanıcı</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.id}>
                                <td>{new Date(log.created_at).toLocaleString()}</td>
                                <td>{log.title}</td>
                                <td>{log.content}</td>
                                <td>{log.username}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ChatButton />

        </div>
    );
};

export default Home;
