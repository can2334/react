import React, { useState, useEffect, useRef, useCallback } from "react";

// Cookie yardımcı fonksiyonları
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

// Kullanıcı ID oluştur
const generateUserId = (): string => {
    return `user_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

// Kullanıcı token oluştur
const generateToken = (userId: string): string => {
    return `token_${userId}_${Date.now()}`;
};

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    text: string;
    timestamp: number;
    isRead: boolean;
}

interface User {
    id: string;
    name: string;
    status: "online" | "offline";
    isAI?: boolean;
}

const ChatButton: React.FC = () => {
    const [chatOpen, setChatOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [showUserSelector, setShowUserSelector] = useState(false);
    const [activeChats, setActiveChats] = useState<User[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Kullanıcı listesi
    const [availableUsers] = useState<User[]>([
        { id: "user_ahmet_005", name: "Ahmet", status: "online" },
        { id: "user_mehmet_006", name: "Mehmet", status: "offline" },
        { id: "user_zeynep_007", name: "Zeynep", status: "online" },
        { id: "user_ai_999", name: "AI Asistan", status: "online", isAI: true }, // AI Kullanıcısı
    ]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // AI Yanıt Simülasyonu
    const getAIResponse = (text: string): string => {
        const lowerText = text.toLowerCase();
        if (lowerText.includes("merhaba") || lowerText.includes("selam")) {
            return "Merhaba! Size nasıl yardımcı olabilirim? (AI Yanıtı)";
        } else if (lowerText.includes("fiyat") || lowerText.includes("ne kadar")) {
            return "Fiyat bilgisi için lütfen ürün kodunu belirtiniz. (AI Yanıtı)";
        } else if (lowerText.includes("teşekkürler") || lowerText.includes("sağol")) {
            return "Rica ederim, iyi günler dilerim! (AI Yanıtı)";
        } else if (lowerText.includes("yardım")) {
            return "Elbette, hangi konuda yardıma ihtiyacınız var? (AI Yanıtı)";
        }
        return "Anladım. İlgili birime yönlendiriyorum. (AI Yanıtı)";
    };

    // AI veya kullanıcı mesaj gönderme
    const sendAIMessage = useCallback((senderId: string, receiverId: string, originalMessage: string) => {
        const aiUser = availableUsers.find(u => u.id === senderId && u.isAI);
        if (!aiUser) return;

        const aiResponseText = getAIResponse(originalMessage);

        setTimeout(() => {
            const aiMessage: Message = {
                id: `msg_${Date.now()}_ai`,
                senderId: aiUser.id,
                receiverId: receiverId,
                text: aiResponseText,
                timestamp: Date.now(),
                isRead: chatOpen && selectedUser?.id === aiUser.id,
            };

            setMessages(prevMessages => {
                const newMessages = [...prevMessages, aiMessage];
                localStorage.setItem("chat_messages", JSON.stringify(newMessages));
                return newMessages;
            });

            // Gelen mesajı aktif sohbetlere ekle
            setActiveChats(prevChats => {
                if (!prevChats.find(u => u.id === aiUser.id)) {
                    return [...prevChats, aiUser];
                }
                return prevChats;
            });
        }, 1000);
    }, [availableUsers, chatOpen, selectedUser]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, selectedUser]);

    // Kullanıcı ID, token ve mesaj kontrolü
    useEffect(() => {
        let userId = getCookie("user_id");
        let token = getCookie("user_token");

        if (!userId || !token) {
            userId = generateUserId();
            token = generateToken(userId);
            setCookie("user_id", userId, 30);
            setCookie("user_token", token, 30);
        }

        setCurrentUserId(userId);

        const storedMessages = localStorage.getItem("chat_messages");
        if (storedMessages) {
            const parsedMessages = JSON.parse(storedMessages) as Message[];

            // Tüm okunmamış mesajları okundu olarak işaretle (Kullanıcının mesajları için)
            const updatedMessages = parsedMessages.map(msg => {
                if (msg.senderId === userId && !msg.isRead) {
                    return { ...msg, isRead: true };
                }
                return msg;
            });

            setMessages(updatedMessages);

            // Aktif sohbetleri belirle
            const chatUserIds = new Set(updatedMessages.flatMap(msg => [msg.senderId, msg.receiverId]));
            const chats = availableUsers.filter(user => chatUserIds.has(user.id) && user.id !== userId);
            setActiveChats(chats);
        }
    }, [availableUsers]);

    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem("chat_messages", JSON.stringify(messages));
        }
    }, [messages]);

    // Chat açıldığında okundu olarak işaretle
    useEffect(() => {
        if (chatOpen && selectedUser) {
            setMessages(prevMessages => {
                let updated = false;
                const newMessages = prevMessages.map(msg => {
                    if (msg.senderId === selectedUser.id && msg.receiverId === currentUserId && !msg.isRead) {
                        updated = true;
                        return { ...msg, isRead: true };
                    }
                    return msg;
                });
                if (updated) {
                    localStorage.setItem("chat_messages", JSON.stringify(newMessages));
                    return newMessages;
                }
                return prevMessages;
            });
        }
    }, [chatOpen, selectedUser, currentUserId]);

    const selectNewUser = (user: User) => {
        if (!activeChats.find(u => u.id === user.id)) {
            setActiveChats([...activeChats, user]);
        }
        setSelectedUser(user);
        setShowUserSelector(false);
    };

    const sendMessage = () => {
        if (!messageInput.trim() || !selectedUser) return;

        const newMessage: Message = {
            id: `msg_${Date.now()}`,
            senderId: currentUserId,
            receiverId: selectedUser.id,
            text: messageInput,
            timestamp: Date.now(),
            isRead: true,
        };

        setMessages(prevMessages => [...prevMessages, newMessage]);
        setMessageInput("");

        if (!activeChats.find(u => u.id === selectedUser.id)) {
            setActiveChats([...activeChats, selectedUser]);
        }

        // AI ise yanıt gönder
        if (selectedUser.isAI) {
            sendAIMessage(selectedUser.id, currentUserId, newMessage.text);
        } else {
            // Diğer kullanıcılar için AI yanıtı (her kullanıcı için)
            const aiUser = availableUsers.find(u => u.isAI);
            if (aiUser) {
                sendAIMessage(aiUser.id, currentUserId, newMessage.text);
            }
        }
    };

    // Filtrelenmiş mesajlar
    const filteredMessages = messages.filter(
        msg =>
            (msg.senderId === currentUserId && msg.receiverId === selectedUser?.id) ||
            (msg.receiverId === currentUserId && msg.senderId === selectedUser?.id)
    );

    const totalUnreadCount = messages.filter(msg => msg.receiverId === currentUserId && !msg.isRead).length;

    const getUnreadCountForUser = (userId: string) => {
        return messages.filter(msg => msg.senderId === userId && msg.receiverId === currentUserId && !msg.isRead).length;
    };

    const getLastMessageTimeForUser = (userId: string) => {
        const userMessages = messages.filter(
            msg =>
                (msg.senderId === currentUserId && msg.receiverId === userId) ||
                (msg.receiverId === currentUserId && msg.senderId === userId)
        );
        const lastMessage = userMessages[userMessages.length - 1];
        if (!lastMessage) return "";
        return new Date(lastMessage.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <>
            {/* SOHBET BUTONU */}
            <div
                style={{
                    position: "fixed",
                    bottom: "20px",
                    right: "20px",
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: "pointer",
                    zIndex: 9999,
                    color: "white",
                    fontSize: "28px",
                    boxShadow: "0 8px 16px rgba(102, 126, 234, 0.4)",
                    transform: chatOpen ? "scale(0.9)" : "scale(1)",
                }}
                onClick={() => setChatOpen(!chatOpen)}
            >
                {chatOpen ? "✕" : "💬"}
                {totalUnreadCount > 0 && !chatOpen && (
                    <div
                        style={{
                            position: "absolute",
                            top: "0px",
                            right: "0px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            backgroundColor: "#ff4d4f",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            border: "2px solid white",
                            animation: "pulse 1s infinite",
                        }}
                    >
                        {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                        <style>{`
                            @keyframes pulse {
                                0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
                                70% { box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); }
                                100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
                            }
                        `}</style>
                    </div>
                )}
            </div>

            {/* SOHBET PANELİ */}
            {chatOpen && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "100px",
                        right: "20px",
                        width: "750px",
                        height: "550px",
                        backgroundColor: "white",
                        borderRadius: "16px",
                        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                        zIndex: 9998,
                        display: "flex",
                        flexDirection: "row",
                        overflow: "hidden",
                        animation: "slideUp 0.3s ease-out",
                    }}
                >
                    <style>{`
                        @keyframes slideUp {
                            from { opacity: 0; transform: translateY(20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>

                    {/* SOL TARAF - KULLANICILAR */}
                    <div
                        style={{
                            width: "280px",
                            borderRight: "1px solid #e8e8e8",
                            display: "flex",
                            flexDirection: "column",
                            backgroundColor: "#fafafa",
                        }}
                    >
                        <div
                            style={{
                                padding: "20px",
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                color: "white",
                                fontWeight: "600",
                                fontSize: "16px",
                            }}
                        >
                            Mesajlar
                        </div>

                        <div style={{ padding: "15px", position: "relative" }}>
                            <div
                                onClick={() => setShowUserSelector(!showUserSelector)}
                                style={{
                                    padding: "12px 16px",
                                    backgroundColor: "white",
                                    border: "2px solid #667eea",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    color: "#555",
                                }}
                            >
                                <span>Kullanıcı Seçin</span>
                                <span style={{ fontSize: "12px", transform: showUserSelector ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                            </div>

                            {showUserSelector && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "calc(100% + 5px)",
                                        left: "15px",
                                        right: "15px",
                                        backgroundColor: "white",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                        borderRadius: "10px",
                                        zIndex: 1000,
                                        border: "1px solid #e8e8e8",
                                        maxHeight: "200px",
                                        overflowY: "auto",
                                    }}
                                >
                                    {availableUsers
                                        .filter(user => !activeChats.find(u => u.id === user.id) && user.id !== currentUserId)
                                        .map((user, index, array) => (
                                            <div
                                                key={user.id}
                                                onClick={() => selectNewUser(user)}
                                                style={{
                                                    padding: "14px 16px",
                                                    cursor: "pointer",
                                                    borderBottom: index < array.length - 1 ? "1px solid #f0f0f0" : "none",
                                                    fontSize: "14px",
                                                }}
                                            >
                                                {user.name} {user.isAI && "(AI)"}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {activeChats.length === 0 ? (
                                <div style={{ padding: "30px 20px", textAlign: "center", color: "#999", fontSize: "13px" }}>
                                    Henüz sohbet yok.<br />Yukarıdan kullanıcı seçin! 😊
                                </div>
                            ) : (
                                activeChats.map((user) => {
                                    const unreadCount = getUnreadCountForUser(user.id);
                                    const lastMessageTime = getLastMessageTimeForUser(user.id);
                                    const userMessages = messages.filter(
                                        msg =>
                                            (msg.senderId === currentUserId && msg.receiverId === user.id) ||
                                            (msg.receiverId === currentUserId && msg.senderId === user.id)
                                    );
                                    const lastMessage = userMessages[userMessages.length - 1];

                                    return (
                                        <div
                                            key={user.id}
                                            onClick={() => setSelectedUser(user)}
                                            style={{
                                                padding: "14px 16px",
                                                cursor: "pointer",
                                                backgroundColor: selectedUser?.id === user.id ? "#e8f0ff" : "transparent",
                                                borderLeft: selectedUser?.id === user.id ? "3px solid #667eea" : "3px solid transparent",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                                borderBottom: "1px solid #eee",
                                            }}
                                        >
                                            <div style={{
                                                width: "12px",
                                                height: "12px",
                                                borderRadius: "50%",
                                                backgroundColor: user.status === "online" ? "#10b981" : "#9e9e9e",
                                            }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: "600", fontSize: "14px", color: "#333" }}>
                                                    {user.name} {user.isAI && "(AI)"}
                                                </div>
                                                {lastMessage && (
                                                    <div style={{ fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                                                        {lastMessage.text}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0, marginLeft: "auto" }}>
                                                {lastMessageTime && <div style={{ fontSize: "10px", color: "#999" }}>{lastMessageTime}</div>}
                                                {unreadCount > 0 && <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#ff4d4f", color: "white", fontSize: "11px", fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center" }}>{unreadCount}</div>}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>

                    {/* SAĞ TARAF - MESAJ PANELİ */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ padding: "15px", fontWeight: "600", borderBottom: "1px solid #f0f0f0", backgroundColor: "#fafafa" }}>
                            {selectedUser ? selectedUser.name : "Sohbet Seçin"}
                        </div>
                        <div style={{ flex: 1, padding: "15px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                            {selectedUser ? (
                                filteredMessages.length === 0 ? (
                                    <div style={{ textAlign: "center", color: "#999", marginTop: "20px" }}>Henüz mesaj yok</div>
                                ) : (
                                    filteredMessages.map(msg => (
                                        <div key={msg.id} style={{ display: "flex", justifyContent: msg.senderId === currentUserId ? "flex-end" : "flex-start" }}>
                                            <div style={{
                                                backgroundColor: msg.senderId === currentUserId ? "#667eea" : "#e8e8e8",
                                                color: msg.senderId === currentUserId ? "white" : "#333",
                                                padding: "10px 14px",
                                                borderRadius: "16px",
                                                maxWidth: "70%",
                                                wordBreak: "break-word",
                                                fontSize: "14px",
                                            }}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                <div style={{ textAlign: "center", color: "#999", marginTop: "20px" }}>Lütfen bir kullanıcı seçin</div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div style={{ padding: "10px 15px", borderTop: "1px solid #f0f0f0", display: "flex", gap: "10px" }}>
                            <input
                                type="text"
                                placeholder="Mesaj yazın..."
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                style={{
                                    flex: 1,
                                    padding: "10px 14px",
                                    borderRadius: "16px",
                                    border: "1px solid #ccc",
                                    outline: "none",
                                    fontSize: "14px",
                                }}
                            />
                            <button
                                onClick={sendMessage}
                                style={{
                                    padding: "10px 16px",
                                    backgroundColor: "#667eea",
                                    color: "white",
                                    borderRadius: "16px",
                                    border: "none",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                }}
                            >
                                Gönder
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatButton;
