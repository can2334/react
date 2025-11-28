import React, { useState, useEffect, useRef } from "react";

// ----------------- INTERFACES -----------------
interface Message {
    id: number | string;
    sender_id: string | number;
    receiver_id: string | number;
    text: string;
    timestamp: number;
    is_read: boolean | number;
    is_group: boolean | number;
}

interface User {
    id: number | string;
    username: string;
    email?: string;
    profile_image?: string;
    is_admin?: boolean;
}

interface Group {
    id: number | string;
    name: string;
    users: (number | string)[];
    admins: (number | string)[];
}

interface GroupApiResponse {
    users: Group[];
    admins: Group[];
}


// ----------------- COOKIE YARDIMCI FONKSİYONLARI -----------------
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

const logOut = () => {
    setCookie("token", "", -1);
    window.localStorage.removeItem("user");
    window.location.href = "/";
    window.location.reload();
};

const API_URL = "http://localhost:5000";

const readMessage = (senderId: string | number, isGroup: boolean | number = 0) => {
    if (isGroup) return;

    fetch(`${API_URL}/read_message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: senderId, cookie: document.cookie }),
    });
};

// ----------------- CHAT BUTTON COMPONENT -----------------

const ChatButton: React.FC = () => {
    const [chatOpen, setChatOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>("");

    const [selectedChat, setSelectedChat] = useState<User | Group | null>(null);
    const selectedChatRef = useRef<User | Group | null>(null);

    const [messageInput, setMessageInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);

    const [showUserSelector, setShowUserSelector] = useState(false);
    const [showGroupCreator, setShowGroupCreator] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    const [activeChats, setActiveChats] = useState<(User | Group)[]>([]);

    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [availableGroups, setAvailableGroups] = useState<Group[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [selectedTab, setSelectedTab] = useState<'messages' | 'groups'>('messages');

    // Seçili sohbetin tipini kontrol etme
    const isSelectedChatGroup = (chat: User | Group | null): chat is Group => {
        return chat !== null && 'admins' in chat && chat.admins !== undefined;
    };

    // selectedChat state'i her değiştiğinde ref'i günceller
    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);

    // ----------------- #1 Kullanıcı ID'sini Çek (Yetkilendirme) -----------------
    useEffect(() => {
        fetch(`${API_URL}/me`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookie: document.cookie }),
        })
            .then(async res => {
                if (res.status !== 200) {
                    logOut();
                    return;
                }
                const data = await res.json();
                const fetchedId = data?.[0]?.id;
                if (fetchedId) {
                    setCurrentUserId(String(fetchedId));
                } else {
                    logOut();
                }
            })
            .catch(() => logOut());
    }, []);

    // ----------------- #2 Kullanıcıları ve Grupları Çek (OTOMATİK YÜKLEME) -----------------
    const fetchUsersAndGroups = async () => {
        if (!currentUserId) return;

        // Kullanıcıları Çek
        try {
            const userRes = await fetch(`${API_URL}/users`);
            const userData = await userRes.json();
            const filteredUsers = userData.filter((user: User) => String(user.id) !== currentUserId);
            setAvailableUsers(filteredUsers);
        } catch (err) {
            console.error("Kullanıcılar alınamadı:", err);
        }

        // Grupları Çek
        try {
            const groupRes = await fetch(`${API_URL}/groups`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cookie: document.cookie }),
            });

            if (groupRes.status === 200) {
                const groupApiData: GroupApiResponse = await groupRes.json();

                const combinedGroups = [...groupApiData.users, ...groupApiData.admins];
                const uniqueGroups: Group[] = [];
                const seenIds = new Set();

                for (const group of combinedGroups) {
                    if (!seenIds.has(group.id)) {
                        seenIds.add(group.id);
                        uniqueGroups.push(group);
                    }
                }

                setAvailableGroups(uniqueGroups);

                // Grupları aktif sohbetlere de ekle
                setActiveChats(prevChats => {
                    const existingGroupIds = prevChats.filter(isSelectedChatGroup).map(g => String(g.id));
                    const newGroups = uniqueGroups.filter(g => !existingGroupIds.includes(String(g.id)));

                    // Mevcut birebir sohbetleri koru ve yeni grupları ekle.
                    const existingUsers = prevChats.filter(c => !isSelectedChatGroup(c));

                    // Yeniden sıralama yapmıyoruz, mevcut sırayı koruyoruz.
                    return [...existingUsers, ...newGroups];
                });

                // Eğer seçili sohbet bir gruptuysa, güncel veriyi yansıt.
                if (selectedChat && isSelectedChatGroup(selectedChat)) {
                    const updatedGroup = uniqueGroups.find(g => String(g.id) === String(selectedChat.id));
                    if (updatedGroup) setSelectedChat(updatedGroup);
                }

            } else if (groupRes.status === 404) {
                setAvailableGroups([]);
            } else {
                setAvailableGroups([]);
            }
        } catch (err) {
            console.error("Gruplar alınamadı:", err);
            setAvailableGroups([]);
        }
    };

    useEffect(() => {
        fetchUsersAndGroups();
    }, [currentUserId]);

    // ----------------- #3 SSE Bağlantısı (Mesajları Anlık Al) -----------------
    useEffect(() => {
        if (!currentUserId) return;
        const token = getCookie("token");
        if (!token) return;

        const ev = new EventSource(`${API_URL}/socket?token=${token}`);

        ev.onmessage = (event) => {
            const currentSelectedChat = selectedChatRef.current;

            try {
                const data = JSON.parse(event.data);

                if (data.message === "baglisin") return;

                if (data.text && data.sender_id && data.receiver_id) {
                    let messageToAdd: Message = {
                        id: Date.now() + Math.random(),
                        timestamp: Date.now(),
                        is_read: 0,
                        is_group: !!data.is_group,
                        ...data
                    };

                    const isMessageForGroup = !!data.is_group;
                    const isCurrentChatGroup = isSelectedChatGroup(currentSelectedChat);

                    // Sohbeti aktif sohbetlere ekle/güncelle (SADECE YENİ SOHBETİ EKLER, SIRALAMA YAPMAZ)
                    setActiveChats(prevChats => {
                        // Birebir
                        if (!isMessageForGroup) {
                            const senderId = String(data.sender_id);
                            const isUserInActiveChats = prevChats.some(c => !isSelectedChatGroup(c) && String(c.id) === senderId);

                            // Gelen mesaj bizeyse VE gönderici aktif sohbetlerde yoksa, ekle.
                            if (String(data.receiver_id) === currentUserId && !isUserInActiveChats) {
                                const sender = availableUsers.find(u => String(u.id) === senderId);
                                return sender ? [sender, ...prevChats] : prevChats;
                            }
                        }
                        // Grup
                        if (isMessageForGroup) {
                            const groupId = String(data.receiver_id);
                            const isGroupInActiveChats = prevChats.some(c => isSelectedChatGroup(c) && String(c.id) === groupId);

                            // Gelen mesaj aktif sohbetlerde yoksa, ekle.
                            if (!isGroupInActiveChats) {
                                const group = availableGroups.find(g => String(g.id) === groupId);
                                return group ? [group, ...prevChats] : prevChats;
                            }
                        }
                        return prevChats;
                    });


                    // Birebir Sohbet Okundu Mantığı
                    if (!isMessageForGroup && !isCurrentChatGroup && currentSelectedChat?.id.toString() === data.sender_id.toString() && data.receiver_id.toString() === currentUserId) {
                        readMessage(data.sender_id);
                        messageToAdd.is_read = 1;
                    }

                    // Her gelen mesajı state'e ekle
                    setMessages(prev => [...prev, messageToAdd]);

                }
            } catch (e) {
                // console.error("SSE JSON Parse error:", e);
            }
        };

        ev.onerror = err => {
            console.error("SSE error:", err);
        };

        return () => {
            ev.close();
        };

    }, [currentUserId, availableUsers, availableGroups]);

    // ----------------- #4 Mesajları Çek (Sohbet Değişiminde) -----------------
    // Bu kısım, seçili sohbet değiştiğinde (yeni bir sohbete tıklandığında) o sohbetin tüm geçmişini backend'den çeker.
    useEffect(() => {
        if (!selectedChat || !currentUserId) return;

        // **DÜZELTME:** Yeni sohbete geçerken mesajları temizle
        setMessages([]);

        const isGroup = isSelectedChatGroup(selectedChat);

        fetch(`${API_URL}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                otherId: selectedChat.id,
                cookie: document.cookie,
                isGroup
            }),
        })
            .then(res => res.json())
            .then(data => {

                if (!isGroup) {
                    // Birebir ise okundu bilgisini gönder
                    readMessage(selectedChat.id);

                    const updatedData = data.map((msg: Message) => {
                        // **HATA DÜZELTMESİ:** Birebir sohbetlerde is_group kontrolü yapıldı.
                        if (String(msg.receiver_id) === currentUserId && String(msg.sender_id) === String(selectedChat.id) && !msg.is_read && !msg.is_group) {
                            return { ...msg, is_read: 1 };
                        }
                        return msg;
                    });
                    setMessages(updatedData);
                } else {
                    // Grup mesajı ise doğrudan ata (Backend'den artık sadece grup mesajları geliyor)
                    setMessages(data);
                }

            })
            .catch(err => console.error("Mesajlar alınamadı:", err));

    }, [selectedChat, currentUserId]);


    // ----------------- Mesaj Gönder (Kullanıcı veya Grup) -----------------
    const sendMessage = () => {
        if (!messageInput.trim() || !selectedChat || !currentUserId) return;

        const messageText = messageInput.trim();
        const isGroup = isSelectedChatGroup(selectedChat);

        const payload = {
            cookie: document.cookie,
            receiver_id: selectedChat.id,
            message: messageText,
            is_group: isGroup ? 1 : 0,
        };

        fetch(`${API_URL}/send_message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
            .then(res => res.json())
            .then((response: Partial<Message>) => {

                // Backend eksik alanlar döndürdüğü için manuel tamamlama
                const newMessage: Message = {
                    id: Date.now() + Math.random(),
                    timestamp: Date.now(),
                    is_read: 0,
                    is_group: isGroup,
                    sender_id: currentUserId,
                    receiver_id: selectedChat.id,
                    text: messageText,
                };

                setMessages(prev => [...prev, newMessage]);
                setMessageInput("");

                // **DÜZELTME:** Mesaj gönderildikten sonra sohbeti en üste taşı. (PHASE 10)
                setActiveChats(prev => {
                    const filtered = prev.filter(c => String(c.id) !== String(selectedChat.id));
                    return [selectedChat, ...filtered];
                });

            })
            .catch(err => console.error("Mesaj gönderilemedi:", err));
    };

    // ----------------- Mesajları Filtrele -----------------
    // Mesajlar artık useEffect'te filtrelendiği için burada sadece görüntüleme için filtrelenmiş kabul edilir.
    const filteredMessages = messages.filter(
        msg => {
            const selectedId = selectedChat?.id.toString();
            if (!selectedId) return false;

            const senderId = msg.sender_id?.toString();
            const receiverId = msg.receiver_id?.toString();
            const isGroupChat = isSelectedChatGroup(selectedChat);

            if (isGroupChat) {
                // Sadece seçili gruptan gelen grup mesajları (Zaten useEffect'te çekildi ama son kontrol)
                return !!msg.is_group && receiverId === selectedId;
            } else {
                // Sadece seçili kullanıcıyla olan birebir mesajlar
                const isOutgoing = senderId === currentUserId && receiverId === selectedId;
                const isIncoming = receiverId === currentUserId && senderId === selectedId;
                return !msg.is_group && (isOutgoing || isIncoming);
            }
        }
    );

    // ----------------- Unread count -----------------
    const totalUnreadCount = messages.filter(msg => String(msg.receiver_id) === currentUserId && !msg.is_read && !msg.is_group).length;

    const getUnreadCountForChat = (chat: User | Group) => {
        const isGroup = isSelectedChatGroup(chat);
        const chatId = chat.id.toString();

        if (isGroup) {
            return 0; // Grup okundu sayımı yok
        } else {
            return messages.filter(msg =>
                !msg.is_group &&
                String(msg.sender_id) === chatId &&
                String(msg.receiver_id) === currentUserId &&
                !msg.is_read
            ).length;
        }
    };

    // ----------------- Sohbet Seç -----------------
    const selectChat = (chat: User | Group) => {

        // **DÜZELTME:** Sohbet seçildiğinde listeyi en üste taşı. (PHASE 10)
        setActiveChats(prev => {
            const filtered = prev.filter(c => String(c.id) !== String(chat.id));
            return [chat, ...filtered];
        });

        setSelectedChat(chat);
        setShowUserSelector(false);
        setShowGroupCreator(false);
        setShowAdminPanel(false);
    };

    // ----------------- Scroll -----------------
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [filteredMessages]);

    // ----------------- Admin Yönetimi Fonksiyonları -----------------

    const selectedGroup = isSelectedChatGroup(selectedChat) ? selectedChat : null;
    const isAdmin = selectedGroup && selectedGroup.admins.map(String).includes(currentUserId);

    const handleAdminToggle = async (userId: string | number, makeAdmin: boolean) => {
        if (!selectedGroup || !isAdmin) return alert("Yetkiniz yok.");

        const isUserAdmin = selectedGroup.admins.map(String).includes(String(userId));
        const username = availableUsers.find(u => String(u.id) === String(userId))?.username || "Kullanıcı";

        const endpoint = makeAdmin ? '/set_member_admin' : '/remove_member_admin';

        if (!makeAdmin) {
            if (!isUserAdmin) return alert(`${username} zaten admin değil!`);
            if (selectedGroup.admins.length === 1) {
                return alert("Grupta en az bir admin bulunmalıdır.");
            }
        }

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupId: selectedGroup.id, userId, cookie: document.cookie }),
            });

            if (res.ok) {
                alert(`${username} ${makeAdmin ? 'admin yapıldı' : 'adminlikten çıkarıldı'}.`);
            } else {
                const error = await res.json();
                alert(`${makeAdmin ? 'Admin atama' : 'Admin çıkarma'} başarısız oldu: ${error.error || res.statusText}`);
            }
        } catch (error) {
            alert("Sunucuya bağlanılamadı.");
        }

        fetchUsersAndGroups();
    };

    const handleMemberToggle = async (userId: string | number, action: 'add' | 'remove') => {
        if (!selectedGroup || !isAdmin) return alert("Yetkiniz yok.");
        const username = availableUsers.find(u => String(u.id) === String(userId))?.username || "Kullanıcı";

        const endpoint = action === 'add' ? '/add_member' : '/remove_member';

        if (action === 'remove') {
            const isUserAdmin = selectedGroup.admins.map(String).includes(String(userId));
            if (isUserAdmin) {
                return alert("Kullanıcı admin olduğu için önce adminlikten çıkarılmalıdır.");
            }
            if (String(userId) === currentUserId) {
                return alert("Kendinizi gruptan atamazsınız.");
            }
        }

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ group_id: selectedGroup.id, user_id: userId, cookie: document.cookie }),
            });

            if (res.ok) {
                alert(`${username} gruptan ${action === 'add' ? 'eklendi' : 'çıkarıldı'}.`);
            } else {
                const error = await res.json();
                alert(`Kullanıcı ${action === 'add' ? 'ekleme' : 'çıkarma'} başarısız: ${error.error || res.statusText}`);
            }
        } catch (error) {
            alert("Sunucuya bağlanılamadı.");
        }

        fetchUsersAndGroups();
    };

    // ----------------- Grup Oluşturma Modalı -----------------
    const GroupCreatorModal: React.FC = () => {
        const [groupName, setGroupName] = useState('');
        const [selectedMembers, setSelectedMembers] = useState<User[]>([]);

        const toggleMember = (user: User) => {
            if (selectedMembers.find(m => m.id === user.id)) {
                setSelectedMembers(selectedMembers.filter(m => m.id !== user.id));
            } else {
                setSelectedMembers([...selectedMembers, user]);
            }
        };

        const createGroup = async () => {
            if (!groupName.trim() || selectedMembers.length < 1) {
                alert("Grup adı ve en az bir üye seçimi zorunludur!");
                return;
            }

            const userIds = selectedMembers.map(m => m.id).map(String);

            if (!userIds.includes(currentUserId)) {
                userIds.push(currentUserId);
            }

            const payload = {
                name: groupName.trim(),
                users: userIds,
                cookie: document.cookie
            };

            try {
                const res = await fetch(`${API_URL}/create_groups`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    alert("Grup başarıyla oluşturuldu!");
                    setShowGroupCreator(false);
                    fetchUsersAndGroups();
                } else {
                    const errorData = await res.json();
                    alert("Grup oluşturma hatası: " + (errorData.error || res.statusText));
                }
            } catch (err) {
                console.error("Grup oluşturma hatası:", err);
                alert("Sunucuya bağlanılamadı.");
            }
        };

        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ backgroundColor: 'white', padding: 30, borderRadius: 12, width: 400, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                    <h3 style={{ marginBottom: 20, color: '#667eea' }}>Yeni Grup Oluştur</h3>

                    <input
                        type="text"
                        placeholder="Grup Adı"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', marginBottom: 15, borderRadius: 8, border: '1px solid #ccc', outline: 'none' }}
                    />

                    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
                        <p style={{ fontWeight: 'bold', marginBottom: 10, fontSize: 14 }}>Üyeleri Seçin (Siz otomatik admin olarak ekleneceksiniz):</p>
                        {availableUsers.map(user => (
                            <div key={user.id} onClick={() => toggleMember(user)} style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: selectedMembers.find(m => m.id === user.id) ? '#e8f0ff' : 'white', borderBottom: '1px solid #f0f0f0' }}>
                                <span>{user.username}</span>
                                {selectedMembers.find(m => m.id === user.id) && <span style={{ float: 'right', color: '#667eea' }}>✓</span>}
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button onClick={() => setShowGroupCreator(false)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer' }}>
                            İptal
                        </button>
                        <button onClick={createGroup} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', backgroundColor: '#667eea', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                            Oluştur
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    // ----------------- ADMIN PANEL MODAL -----------------
    const AdminPanelModal: React.FC = () => {
        if (!selectedGroup) return null;

        const allGroupUserIds = [...new Set([...selectedGroup.users.map(String), ...selectedGroup.admins.map(String)])];
        const allGroupUsers = allGroupUserIds.map(id => availableUsers.find(u => String(u.id) === id) || { id, username: "Bilinmeyen Kullanıcı" } as User);

        const usersToAddToGroup = availableUsers.filter(u => !allGroupUserIds.includes(String(u.id)));

        return (
            <div style={{ flex: 1, padding: 15, overflowY: "auto", backgroundColor: '#f9f9f9' }}>
                <h4 style={{ color: '#764ba2', marginBottom: 15 }}>👥 Grup Yönetimi: **{selectedGroup.name}**</h4>
                <p style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: 5, marginBottom: 10 }}>Üyeler:</p>

                <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 20 }}>
                    {allGroupUsers.map(user => {
                        const userId = String(user.id);
                        const isGroupAdmin = selectedGroup.admins.map(String).includes(userId);
                        const isCurrentUser = userId === currentUserId;

                        const disableRemoveAdmin = selectedGroup.admins.length === 1;
                        const disableRemoveMember = isCurrentUser || isGroupAdmin;

                        return (
                            <div key={userId} style={{ padding: '10px 0', borderBottom: '1px dotted #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                                <span>{user.username} {isCurrentUser ? "(Siz)" : ""}</span>
                                <div style={{ minWidth: 280, textAlign: 'right' }}>
                                    <span style={{ color: isGroupAdmin ? 'green' : '#999', marginRight: 10 }}>{isGroupAdmin ? "Admin" : "Üye"}</span>

                                    {/* Adminlik İşlemleri */}
                                    {isGroupAdmin ? (
                                        <button
                                            onClick={() => handleAdminToggle(userId, false)}
                                            disabled={disableRemoveAdmin}
                                            title={disableRemoveAdmin ? "Grupta en az bir admin kalmalıdır" : "Adminliğini Al"}
                                            style={{ padding: '5px 10px', backgroundColor: disableRemoveAdmin ? '#ddd' : '#ff4d4f', color: disableRemoveAdmin ? '#999' : 'white', border: 'none', borderRadius: 5, cursor: disableRemoveAdmin ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}>
                                            Adminlikten Çıkar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleAdminToggle(userId, true)}
                                            style={{ padding: '5px 10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', transition: 'background-color 0.2s' }}>
                                            Admin Yap
                                        </button>
                                    )}

                                    {/* Üye Çıkarma İşlemi */}
                                    <button
                                        onClick={() => handleMemberToggle(userId, 'remove')}
                                        disabled={disableRemoveMember}
                                        title={disableRemoveMember ? (isCurrentUser ? "Kendinizi atamazsınız" : (isGroupAdmin ? "Önce adminlikten çıkarın" : "Üyeyi Çıkar")) : "Üyeyi Çıkar"}
                                        style={{ marginLeft: 5, padding: '5px 10px', backgroundColor: disableRemoveMember ? '#ddd' : '#f79f4c', color: disableRemoveMember ? '#999' : 'white', border: 'none', borderRadius: 5, cursor: disableRemoveMember ? 'not-allowed' : 'pointer', opacity: disableRemoveMember ? 0.5 : 1 }}>
                                        Üyeyi Çıkar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Üye Ekleme Bölümü */}
                {usersToAddToGroup.length > 0 && (
                    <>
                        <p style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: 5, marginBottom: 10 }}>Yeni Üye Ekle:</p>
                        <div style={{ maxHeight: 100, overflowY: 'auto', border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
                            {usersToAddToGroup.map(user => (
                                <div key={user.id} style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dotted #f0f0f0' }}>
                                    <span>{user.username}</span>
                                    <button
                                        onClick={() => handleMemberToggle(user.id, 'add')}
                                        style={{ padding: '5px 10px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', transition: 'background-color 0.2s' }}>
                                        Ekle
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                {usersToAddToGroup.length === 0 && (
                    <p style={{ color: '#999', fontSize: 14 }}>Gruba eklenecek başka kullanıcı yok.</p>
                )}
            </div>
        );
    };

    // ----------------- RENDER -----------------
    return (
        <>
            {showGroupCreator && <GroupCreatorModal />}

            {/* Chat Button */}
            <div
                style={{
                    position: "fixed", bottom: 20, right: 20, width: 60, height: 60, borderRadius: "50%",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", zIndex: 9999,
                    color: "white", fontSize: 28, boxShadow: "0 8px 16px rgba(102,126,234,0.4)",
                    transform: chatOpen ? "scale(0.9)" : "scale(1)", transition: "transform 0.3s ease",
                }}
                onClick={() => setChatOpen(!chatOpen)}
            >
                {chatOpen ? "✕" : "💬"}
                {totalUnreadCount > 0 && !chatOpen && (
                    <div
                        style={{
                            position: "absolute", top: 0, right: 0, width: 20, height: 20, borderRadius: "50%",
                            backgroundColor: "#ff4d4f", color: "white", fontSize: 12, fontWeight: "bold",
                            display: "flex", justifyContent: "center", alignItems: "center", border: "2px solid white",
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

                        {/* Sekme Başlığı - Mesajlar / Gruplar */}
                        <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: 10, display: "flex", gap: 10 }}>
                            <div
                                onClick={() => setSelectedTab('messages')}
                                style={{ flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontWeight: 600, color: selectedTab === 'messages' ? '#333' : 'white', backgroundColor: selectedTab === 'messages' ? 'white' : 'transparent', boxShadow: selectedTab === 'messages' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', transition: 'all 0.3s ease', }}>
                                Mesajlar
                            </div>
                            <div
                                onClick={() => setSelectedTab('groups')}
                                style={{ flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontWeight: 600, color: selectedTab === 'groups' ? '#333' : 'white', backgroundColor: selectedTab === 'groups' ? 'white' : 'transparent', boxShadow: selectedTab === 'groups' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', transition: 'all 0.3s ease', }}>
                                Gruplar
                            </div>
                        </div>

                        {/* Sekme İçeriği */}
                        {selectedTab === 'messages' ? (
                            <>
                                {/* Kullanıcı Seçimi Alanı */}
                                <div style={{ padding: 15, position: "relative" }}>
                                    <div onClick={() => setShowUserSelector(!showUserSelector)} style={{ padding: "12px 16px", backgroundColor: "white", border: "2px solid #667eea", borderRadius: 10, cursor: "pointer", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#555" }}>
                                        <span>Yeni Sohbet Başlat</span>
                                        <span style={{ fontSize: 12, transform: showUserSelector ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
                                    </div>
                                    {showUserSelector && (
                                        <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 15, right: 15, backgroundColor: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", borderRadius: 10, zIndex: 1000, border: "1px solid #e8e8e8", maxHeight: 200, overflowY: "auto" }}>
                                            {availableUsers
                                                .filter(user => !activeChats.find(c => String(c.id) === String(user.id) && !isSelectedChatGroup(c)))
                                                .map(user => (
                                                    <div key={user.id} onClick={() => selectChat(user)} style={{ padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
                                                        {user.username}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {/* Aktif Birebir Sohbetler Listesi */}
                                <div style={{ flex: 1, overflowY: "auto" }}>
                                    {activeChats.filter(c => !isSelectedChatGroup(c)).map(chat => {
                                        const unreadCount = getUnreadCountForChat(chat);
                                        return (
                                            <div
                                                key={chat.id}
                                                onClick={() => selectChat(chat)}
                                                style={{
                                                    padding: "14px 16px", cursor: "pointer",
                                                    backgroundColor: selectedChat?.id === chat.id ? "#e8f0ff" : "transparent",
                                                    borderLeft: selectedChat?.id === chat.id ? "3px solid #667eea" : "3px solid transparent",
                                                    display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #eee",
                                                    transition: "background-color 0.2s"
                                                }}>
                                                <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#10b981" }} />
                                                <div style={{ flex: 1, minWidth: 0, fontWeight: unreadCount > 0 ? 600 : 400 }}>{(chat as User).username}</div>
                                                {unreadCount > 0 && <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#ff4d4f", color: "white", fontSize: 11, fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center" }}>{unreadCount}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            // ********* GRUPLAR SEKME İÇERİĞİ *********
                            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

                                {/* Grup Oluştur Butonu */}
                                <div style={{ padding: 15, borderBottom: "1px solid #e8e8e8" }}>
                                    <button
                                        onClick={() => setShowGroupCreator(true)}
                                        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #667eea', backgroundColor: '#667eea', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                                        ➕ Yeni Grup Oluştur
                                    </button>
                                </div>

                                {/* Grup Listesi */}
                                <div style={{ flex: 1, overflowY: "auto" }}>
                                    {activeChats.filter(isSelectedChatGroup).map(chat => {
                                        const unreadCount = getUnreadCountForChat(chat);
                                        const group = chat as Group;
                                        return (
                                            <div
                                                key={group.id}
                                                onClick={() => selectChat(group)}
                                                style={{
                                                    padding: "14px 16px", cursor: "pointer",
                                                    backgroundColor: selectedChat?.id === group.id ? "#e8f0ff" : "transparent",
                                                    borderLeft: selectedChat?.id === group.id ? "3px solid #667eea" : "3px solid transparent",
                                                    display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #eee",
                                                    transition: "background-color 0.2s"
                                                }}>
                                                <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#764ba2" }} />
                                                <div style={{ flex: 1, minWidth: 0, fontWeight: unreadCount > 0 ? 600 : 400 }}>{group.name} (Grup)</div>
                                                {unreadCount > 0 && <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#ff4d4f", color: "white", fontSize: 11, fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center" }}>{unreadCount}</div>}
                                            </div>
                                        );
                                    })}
                                    {availableGroups.length === 0 && (
                                        <p style={{ textAlign: 'center', padding: 20, color: '#999' }}>Henüz aktif bir grubunuz yok.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>

                        {/* Header: Seçili Sohbet */}
                        <div style={{ padding: 15, fontWeight: 600, borderBottom: "1px solid #f0f0f0", backgroundColor: "#fafafa", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{selectedChat ? (isSelectedChatGroup(selectedChat) ? selectedChat.name + " (Grup)" : (selectedChat as User).username) : "Sohbet Seçin"}</span>

                            {/* Admin Paneli Butonu (Sadece Adminler İçin) */}
                            {selectedGroup && isAdmin && (
                                <button
                                    onClick={() => setShowAdminPanel(!showAdminPanel)}
                                    style={{ padding: '5px 10px', borderRadius: 8, border: 'none', backgroundColor: '#764ba2', color: 'white', cursor: 'pointer', fontWeight: 500, fontSize: 12 }}
                                >
                                    {showAdminPanel ? "Sohbete Dön" : "Admin Yönetimi"}
                                </button>
                            )}
                        </div>

                        {/* Admin Yönetimi Modalı */}
                        {showAdminPanel && selectedGroup && isAdmin ? (
                            <AdminPanelModal />
                        ) : (
                            // Mesaj Akışı
                            <div style={{ flex: 1, padding: 15, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                                {selectedChat ? (
                                    filteredMessages.length === 0 ? (
                                        <div style={{ textAlign: "center", color: "#999", marginTop: 20 }}>Henüz mesaj yok</div>
                                    ) : (
                                        filteredMessages.map(msg => (
                                            <div key={msg.id} style={{ display: "flex", flexDirection: 'column', alignItems: String(msg.sender_id) === currentUserId ? "flex-end" : "flex-start" }}>
                                                {/* Grup Mesajlarında Gönderen Adını Göster */}
                                                {!!msg.is_group && String(msg.sender_id) !== currentUserId && (
                                                    <span style={{ fontSize: 10, color: '#764ba2', marginBottom: 3, fontWeight: 'bold' }}>
                                                        {availableUsers.find(u => String(u.id) === String(msg.sender_id))?.username || "Bilinmeyen"}
                                                    </span>
                                                )}
                                                <div style={{
                                                    backgroundColor: String(msg.sender_id) === currentUserId ? "#667eea" : "#e8e8e8",
                                                    color: String(msg.sender_id) === currentUserId ? "white" : "#333",
                                                    padding: "10px 14px",
                                                    borderRadius: 16,
                                                    maxWidth: "70%",
                                                    wordBreak: "break-word",
                                                    fontSize: 14,
                                                    position: 'relative'
                                                }}>
                                                    {msg.text}
                                                    {/* Okundu işareti - Sadece birebir ve biz gönderdiysek */}
                                                    {String(msg.sender_id) === currentUserId && !msg.is_group && (
                                                        <span
                                                            style={{
                                                                position: 'absolute', right: 5, bottom: 2, fontSize: 10,
                                                                color: msg.is_read ? '#c8d4f7' : 'rgba(255,255,255,0.4)'
                                                            }}
                                                            title={msg.is_read ? "Okundu" : "Gönderildi"}
                                                        >
                                                            ✓{msg.is_read ? '✓' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )
                                ) : (
                                    <div style={{ textAlign: "center", color: "#999", marginTop: 20 }}>Lütfen sol panelden bir sohbet seçin</div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}

                        {/* Input Alanı (Admin Paneli Kapalıysa) */}
                        {!showAdminPanel && (
                            <div style={{ padding: "10px 15px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 10 }}>
                                <input
                                    type="text"
                                    placeholder="Mesaj yazın..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                    style={{ flex: 1, padding: "10px 14px", borderRadius: 16, border: "1px solid #ccc", outline: "none", fontSize: 14 }}
                                    disabled={!selectedChat}
                                />
                                <button
                                    onClick={sendMessage}
                                    style={{
                                        padding: "10px 16px", backgroundColor: "#667eea", color: "white", borderRadius: 16, border: "none",
                                        cursor: "pointer", fontWeight: 600, opacity: !selectedChat ? 0.6 : 1, transition: "opacity 0.2s"
                                    }}
                                    disabled={!selectedChat}
                                >
                                    Gönder
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatButton;