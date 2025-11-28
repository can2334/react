import React, { useState, useEffect, useRef } from "react";

interface Message {
    id: number | string;
    sender_id: string | number;
    receiver_id: string | number;
    text: string;
    timestamp: number;
    is_read: boolean | number;
}

interface User {
    id: number | string;
    username: string;
    email?: string;
    profile_image?: string;
    is_admin?: boolean;
}

// ----------------- Cookie yardımcı fonksiyonları -----------------
const setCookie = (name: string, value: string, days: number) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
};

const generateUserId = (): string => {
    return `user_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

const API_URL = "http://localhost:5000";

const ChatButton: React.FC = () => {
    const [chatOpen, setChatOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [showUserSelector, setShowUserSelector] = useState(false);
    const [activeChats, setActiveChats] = useState<User[]>([]);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // ----------------- Kullanıcı ID -----------------
    // useEffect(() => {
    //     let uid = getCookie("userId");
    //     if (!uid) {
    //         uid = generateUserId();
    //         setCookie("userId", uid, 365);
    //     }
    //     setCurrentUserId(uid);
    // }, []);

    useEffect(() => {
        fetch(`${API_URL}/me`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookie: document.cookie }),
        })
            .then(res => res.json())
            .then(data => setCurrentUserId(data[0]?.id.toString()))
            .catch(err => console.error("Kullanıcı ID alınamadı:", err));
    }, []);

    // ----------------- Kullanıcıları çek -----------------
    useEffect(() => {
        fetch(`${API_URL}/users`)
            .then(res => res.json())
            .then(data => {
                // Kendi kullanıcıyı filtrele
                const filteredUsers = data.filter((user: User) => user.id !== currentUserId);
                setAvailableUsers(filteredUsers);
            })
            .catch(err => console.error("Kullanıcılar alınamadı:", err));
    }, []);

    useEffect(() => {
        if (!currentUserId) return;
        const token = getCookie("token");
        const ev = new EventSource("http://localhost:5000/socket?token=" + token);

        ev.onmessage = (event) => {
            console.log("HAM GELEN:", event.data);
            try {
                const data = JSON.parse(event.data);
                console.log("SSE DATA:", data);
                if (!data) return;

                // // Eğer gelen mesaj bu konuşmaya aitse UI'a ekle
                // if (selectedUser && (
                //     (data.sender_id?.toString() === selectedUser.id.toString() &&
                //         data.receiver_id?.toString() === currentUserId) ||
                //     (data.receiver_id?.toString() === selectedUser.id.toString() &&
                //         data.sender_id?.toString() === currentUserId)
                // )) {
                setMessages(prev => [...prev, data]);
                // }

            }
            catch (e) {
                console.error("SSE JSON Parse error:", e);
            }
        };

        ev.onerror = err => {
            console.error("SSE error:", err);
            // Bağlantı koparsa tekrar bağlanmaya çalışır
        };

    }, [selectedUser, currentUserId]);


    // ----------------- Mesajları çek -----------------
    useEffect(() => {
        if (!selectedUser || !currentUserId) return;

        fetch(`${API_URL}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                otherId: selectedUser.id,
                cookie: document.cookie,
            }),
        })
            .then(res => res.json())
            .then(data => setMessages(data))
            .catch(err => console.error("Mesajlar alınamadı:", err));
    }, [selectedUser, currentUserId]);

    // ----------------- Mesaj gönder -----------------
    const sendMessage = () => {
        if (!messageInput.trim() || !selectedUser || !currentUserId) return;

        const payload = {
            cookie: document.cookie,
            receiver_id: selectedUser.id,
            sender_id: currentUserId,
            message: messageInput.trim(),
        };

        fetch(`${API_URL}/send_message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
            .then(res => res.json())
            .then((newMessage: Message) => {
                setMessages(prev => [...prev, newMessage]);
                setMessageInput("");
                if (!activeChats.find(u => u.id === selectedUser.id)) {
                    setActiveChats(prev => [...prev, selectedUser]);
                }
            })
            .catch(err => console.error("Mesaj gönderilemedi:", err));
    };
    console.log(messages);

    // ----------------- Mesaj filtreleme -----------------
    const filteredMessages = messages.filter(
        msg =>
            (msg.sender_id.toString() === currentUserId && msg.receiver_id.toString() === selectedUser?.id.toString()) ||
            (msg.receiver_id.toString() === currentUserId && msg.sender_id.toString() === selectedUser?.id.toString())
    );
    // ----------------- Unread count -----------------
    const totalUnreadCount = messages.filter(msg => msg.receiver_id.toString() === currentUserId && !msg.is_read).length;
    const getUnreadCountForUser = (userId: string | number) =>
        messages.filter(msg => msg.sender_id.toString() === userId.toString() && msg.receiver_id.toString() === currentUserId && !msg.is_read).length;

    // ----------------- Kullanıcı seç -----------------
    const selectNewUser = (user: User) => {
        if (!activeChats.find(u => u.id === user.id)) setActiveChats(prev => [...prev, user]);
        setSelectedUser(user);
        setShowUserSelector(false);
    };

    // ----------------- Scroll -----------------
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ----------------- Render -----------------
    return (
        <>
            {/* Chat Button */}
            <div
                style={{
                    position: "fixed",
                    bottom: 20,
                    right: 20,
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: "pointer",
                    zIndex: 9999,
                    color: "white",
                    fontSize: 28,
                    boxShadow: "0 8px 16px rgba(102,126,234,0.4)",
                    transform: chatOpen ? "scale(0.9)" : "scale(1)",
                }}
                onClick={() => setChatOpen(!chatOpen)}
            >
                {chatOpen ? "✕" : "💬"}
                {totalUnreadCount > 0 && !chatOpen && (
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            backgroundColor: "#ff4d4f",
                            color: "white",
                            fontSize: 12,
                            fontWeight: "bold",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            border: "2px solid white",
                        }}
                    >
                        {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                    </div>
                )}
            </div>

            {/* Chat Panel */}
            {chatOpen && (
                <div style={{ position: "fixed", bottom: 100, right: 20, width: 750, height: 550, backgroundColor: "white", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", display: "flex", overflow: "hidden", zIndex: 9998 }}>
                    {/* Left Panel */}
                    <div style={{ width: 280, borderRight: "1px solid #e8e8e8", display: "flex", flexDirection: "column", backgroundColor: "#fafafa" }}>
                        <div style={{ padding: 20, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white", fontWeight: 600, fontSize: 16 }}>Mesajlar</div>
                        <div style={{ padding: 15, position: "relative" }}>
                            <div onClick={() => setShowUserSelector(!showUserSelector)} style={{ padding: "12px 16px", backgroundColor: "white", border: "2px solid #667eea", borderRadius: 10, cursor: "pointer", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#555" }}>
                                <span>Kullanıcı Seçin</span>
                                <span style={{ fontSize: 12, transform: showUserSelector ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                            </div>
                            {showUserSelector && (
                                <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 15, right: 15, backgroundColor: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", borderRadius: 10, zIndex: 1000, border: "1px solid #e8e8e8", maxHeight: 200, overflowY: "auto" }}>
                                    {availableUsers
                                        // 1. ADIM: Kendimizi listeden çıkarıyoruz (String çevirimi yaparak garantiye alıyoruz)
                                        .filter(user => user.id.toString() !== currentUserId)

                                        // 2. ADIM: Zaten açık olan sohbetleri çıkarıyoruz (Eski kodun)
                                        .filter(user => !activeChats.find(u => u.id === user.id))

                                        .map(user => (
                                            <div key={user.id} onClick={() => selectNewUser(user)} style={{ padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
                                                {user.username}
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {activeChats.map(user => {
                                const unreadCount = getUnreadCountForUser(user.id);
                                return (
                                    <div key={user.id} onClick={() => setSelectedUser(user)} style={{ padding: "14px 16px", cursor: "pointer", backgroundColor: selectedUser?.id === user.id ? "#e8f0ff" : "transparent", borderLeft: selectedUser?.id === user.id ? "3px solid #667eea" : "3px solid transparent", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #eee" }}>
                                        <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#10b981" }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>{user.username}</div>
                                        {unreadCount > 0 && <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#ff4d4f", color: "white", fontSize: 11, fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center" }}>{unreadCount}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ padding: 15, fontWeight: 600, borderBottom: "1px solid #f0f0f0", backgroundColor: "#fafafa" }}>
                            {selectedUser ? selectedUser.username : "Sohbet Seçin"}
                        </div>

                        <div style={{ flex: 1, padding: 15, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                            {selectedUser ? (
                                filteredMessages.length === 0 ? (
                                    <div style={{ textAlign: "center", color: "#999", marginTop: 20 }}>Henüz mesaj yok</div>
                                ) : (
                                    filteredMessages.map(msg => (
                                        <div key={msg.id} style={{ display: "flex", justifyContent: msg.sender_id.toString() === currentUserId ? "flex-end" : "flex-start" }}>
                                            <div style={{ backgroundColor: msg.sender_id.toString() === currentUserId ? "#667eea" : "#e8e8e8", color: msg.sender_id.toString() === currentUserId ? "white" : "#333", padding: "10px 14px", borderRadius: 16, maxWidth: "70%", wordBreak: "break-word", fontSize: 14 }}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                <div style={{ textAlign: "center", color: "#999", marginTop: 20 }}>Lütfen bir kullanıcı seçin</div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div style={{ padding: "10px 15px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 10 }}>
                            <input
                                type="text"
                                placeholder="Mesaj yazın..."
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                style={{ flex: 1, padding: "10px 14px", borderRadius: 16, border: "1px solid #ccc", outline: "none", fontSize: 14 }}
                            />
                            <button onClick={sendMessage} style={{ padding: "10px 16px", backgroundColor: "#667eea", color: "white", borderRadius: 16, border: "none", cursor: "pointer", fontWeight: 600 }}>Gönder</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatButton;
