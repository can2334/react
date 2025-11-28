const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const app = express();
const crypto = require('crypto');
app.use(cors());

app.use(cookieParser());
app.use(express.json());

const clients = [];

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "myapp",
});

const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};


function getClientByUserId(userId) {
    return clients.find(c => c.userId === userId) || null;
};

function addClient(client) {
    const exClientIndex = clients.findIndex(c => c.userId === client.userId);

    // varsa eskiyi sil
    if (exClientIndex !== -1) {
        clients.splice(exClientIndex, 1);
    }

    clients.push(client);
};

function sendJSON(client, obj) {
    console.log("SEND JSON")
    client.write(`data: ${JSON.stringify(obj)}\n\n`);
};

// tüm bağlı olan kullanıcılara mesaj atmak için kullanılabilir. Bu akışta şu an kullanılmıyor.
function broadcast(dict) {
    if (client.length === 0) return;
    for (const client of clients) {
        sendJSON(client.res, dict);
    }
};

function sendGroupMessage(receivers, message) {
    for (const receiver of receivers) {
        const client = getClientByUserId(receiver);
        if (client) {
            sendJSON(client.res, message);
        }
    }
};

function parseCookie(cookieString) {
    const result = {};
    if (!cookieString || typeof cookieString !== "string") return result;

    const cookies = cookieString.split(";");
    for (const cookie of cookies) {
        const [key, value] = cookie.trim().split("=");
        result[key] = value;
    }

    return result;
}

// ------------------------- GRUPLAR (DÜZELTİLDİ) -------------------------
app.post('/groups', async (req, res) => {
    const { cookie } = req.body;
    const cookies = parseCookie(cookie);
    const token = cookies?.token
    if (!token) return res.status(400).json({ error: "Token gerekli" });

    try {
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [token]
        );
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(401).json({ error: "Gecersiz token" });

        const currentUserId = rowsBySession[0].userId.toString();

        // Üye olunan grupları çek
        const [rows] = await db.query(
            "SELECT id, name, users, admins FROM groups WHERE JSON_CONTAINS(users, ?)",
            [`"${currentUserId}"`] // JSON_CONTAINS'e string olarak göndermek için çift tırnak eklenmeli
        );

        // Admin olunan grupları çek (Bu sorgu yukarıdakinin bir alt kümesi olabilir, ancak front-end'e ayrı ayrı göndermek için tutulur)
        const [rowsAdmin] = await db.query(
            "SELECT id, name, users, admins FROM groups WHERE JSON_CONTAINS(admins, ?)",
            [`"${currentUserId}"`]
        );

        // Front-end'in 404 hatası almadan boş liste alabilmesi için
        if (rows.length === 0 && rowsAdmin.length === 0) {
            return res.json({ users: [], admins: [] });
        }

        // MySQL JSON alanlarını otomatik olarak parse etmeyebilir. Front-end'in istediği formata dönüştürülür.
        const formatGroups = (groupRows) => groupRows.map(group => ({
            ...group,
            users: JSON.parse(group.users),
            admins: JSON.parse(group.admins)
        }));

        res.json({
            users: formatGroups(rows),
            admins: formatGroups(rowsAdmin)
        });

    } catch (error) {
        console.error("Grup çekme hatası:", error);
        res.status(500).json({ error: "Sunucu hatası: Gruplar alınamadı" });
    }
});


app.post('/me', async (req, res) => {
    const { cookie } = req.body;
    const cookies = parseCookie(cookie);
    const token = cookies?.token
    if (!token) return res.status(400).json({ error: "Token gerekli" });
    const [rowsBySession] = await db.query(
        "SELECT * FROM sessions WHERE token = ?",
        [token]
    )
    if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(401).json({ error: "Gecersiz token" });
    const [rows] = await db.query(
        "SELECT id, username, email, is_admin, profile_image FROM users WHERE id = ?",
        [rowsBySession[0].userId]
    );
    if (!rows?.[0]) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    res.json([rows[0]]);
});

app.get("/socket", async (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
    });
    const token = req.query.token;
    res.write(`data: baglisin\n\n`);
    try {
        if (!token) return res.end();
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [token]
        )
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.end();

        const client = { "res": res, "userId": rowsBySession?.[0]?.userId };
        addClient(client); // addClient fonksiyonu zaten eski client'ı silip yenisini ekliyor

        console.log("Yeni SSE client! Toplam:", clients.length);

        req.on("close", () => {
            const index = clients.findIndex(c => c.res === res);
            if (index !== -1) {
                clients.splice(index, 1);
            }

            console.log("Client ayrıldı. Toplam:", clients.length);
        });
    } catch (e) {
        console.error(e)
    }
});

// ------------------------- LOGIN -------------------------
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: "Kullanıcı adı ve şifre gerekli" });
    try {
        const [rows] = await db.query(
            "SELECT id, username, email, is_admin, profile_image FROM users WHERE username = ? AND password = ?",
            [username, password]
        );

        if (rows.length === 0)
            return res.status(401).json({ error: "Geçersiz kullanıcı adı veya şifre" });
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE userId = ?",
            [rows[0].id]
        );
        const token = 'user_' + generateRandomString();
        // Şu anda şu an sadece bir kullanıcı bir cihazda oturum açabiliyor.
        // Eğer bir kullanıcı birden fazla kez oturum açması gerekiyorsa buradaki if ve else'i silerek else kısmını referans al
        if (rowsBySession.length > 0) {
            await db.query(
                "UPDATE sessions SET token = ? WHERE userId = ?",
                [token, rows[0].id]
            );
        } else {
            await db.query(
                "INSERT INTO sessions (token, userId) VALUES (?, ?)",
                [token, rows[0].id]
            );
        }
        const user = rows[0];
        res.json({
            message: "Giriş başarılı",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profile_image: user.profile_image || "/default-profile.png",
                token,
                is_admin: Boolean(user.is_admin),
            },
        });
    } catch (err) {
        console.error("Login hatası:", err);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});
// ------------------------- CURRENT USER -------------------------
app.get("/me/:id", async (req, res) => {
    const userId = req.params.id;

    try {
        const [rows] = await db.query(
            "SELECT id, username, email, profile_image, is_admin FROM users WHERE id = ?",
            [userId]
        );

        if (!rows?.[0]) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE userId = ?",
            [rows[0].id]
        )
        if (!rowsBySession?.[0]) return res.status(404).json({ error: "Kullanıcı oturumu bulunamadı" });
        const user = rows[0];
        res.json({
            ...user,
            profile_image: user.profile_image || "/default-profile.png",
            is_admin: Boolean(user.is_admin),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

// ------------------------- USER CRUD -------------------------
app.get("/users", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, username, email, profile_image, is_admin FROM users"
        );
        const users = rows.map(u => ({
            ...u,
            profile_image: u.profile_image || "/default-profile.png",
            is_admin: Boolean(u.is_admin),
        }));
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Kullanıcılar alınamadı" });
    }
});

app.post("/users", async (req, res) => {
    const { username, email, password, is_admin } = req.body;
    try {
        const [result] = await db.query(
            "INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)",
            [username, email, password, is_admin ? 1 : 0]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Kullanıcı eklenemedi" });
    }
});

app.put("/users/:id", async (req, res) => {
    const { id } = req.params;
    const { username, email, profile_image, password, is_admin } = req.body;

    try {
        if (password && password.trim() !== "") {
            await db.query(
                "UPDATE users SET username = ?, email = ?, profile_image = ?, password = ?, is_admin = ? WHERE id = ?",
                [username, email, profile_image, password, is_admin ? 1 : 0, id]
            );
        } else {
            await db.query(
                "UPDATE users SET username = ?, email = ?, profile_image = ?, is_admin = ? WHERE id = ?",
                [username, email, profile_image, is_admin ? 1 : 0, id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Güncelleme başarısız" });
    }
});

app.delete("/users/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: "Kullanıcı silinemedi" });
    }
});

// ------------------------- MESSAGES CRUD -------------------------
// http://localhost:5000/messages?otherId=
// Tüm mesajları çek (kullanıcılar arası)
app.post("/messages", async (req, res) => {
    const { otherId, cookie, isGroup } = req.body;
    const cookies = parseCookie(cookie);
    const token = cookies?.token;

    if (!token || !otherId) return res.json([]);

    try {
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [token]
        )
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(404).json({ error: "Kullanıcı oturumu bulunamadı" });

        const currentUserId = rowsBySession[0].userId;

        // 1. Önce bu otherId'nin bir grup olup olmadığını kontrol edelim.
        const [groupCheck] = await db.query(
            "SELECT id FROM groups WHERE id = ?",
            [otherId]
        );

        let query;
        let params;

        if (isGroup) {
            // BU BİR GRUP MESAJIDIR: Alıcı ID'si (receiver_id) grubun ID'si olmalı
            query = `SELECT * FROM messages 
                     WHERE receiver_id = ? AND is_group = 1
                     ORDER BY timestamp ASC`;
            params = [otherId];

        } else {
            // BU BİREBİR SOHBETTİR: Gönderici/Alıcı ikilisinden biri olmalı
            query = `SELECT * FROM messages 
                     WHERE is_group = 0 AND 
                     ((sender_id = ? AND receiver_id = ?) 
                     OR (sender_id = ? AND receiver_id = ?))
                     ORDER BY timestamp ASC`;
            params = [currentUserId, otherId, otherId, currentUserId];
        }
        console.log("is grup::::", groupCheck.length > 0)
        const [rows] = await db.query(query, params);
        console.log(rows, currentUserId, otherId);
        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Mesajlar alınamadı" });
    }
});
app.post("/read_message", async (req, res) => {
    const { sender_id, cookie } = req.body;
    const cookies = parseCookie(cookie);
    if (!cookies?.token) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });
    const [rowsBySession] = await db.query(
        "SELECT * FROM sessions WHERE token = ?",
        [cookies.token]
    )
    if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });
    const currentUserId = rowsBySession[0].userId;
    console.log("sender_id", sender_id, "currentUserId", currentUserId);
    await db.query("UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0", [currentUserId, sender_id]);
    res.json({ success: true });
});

// post isteği atılırken bu satır eklenmeli "credentials: 'include'"
app.post("/send_message", async (req, res) => {
    console.log("send post")
    try {
        const { receiver_id, message, is_group, cookie } = req.body;
        if (!receiver_id || !message || !cookie)
            return res.status(400).json({ error: "Mesaj gerekli" });
        const cookies = parseCookie(cookie);
        if (!cookies?.token) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });

        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [cookies.token]
        )
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(412).json({ error: "Kullanıcı oturumu bulunamadı" });

        const senderId = rowsBySession[0].userId;

        // Mesajı veritabanına kaydet
        await db.query(
            "INSERT INTO messages (sender_id, receiver_id, text, is_group, timestamp) VALUES (?, ?, ?, ?, NOW())",
            [senderId, receiver_id, message, is_group]
        );

        // Eğer grup mesajıysa
        if (is_group) {
            // İlgili grubu bul
            const [groupRows] = await db.query(
                "SELECT users, admins FROM groups WHERE id = ?",
                [receiver_id]
            );

            if (!groupRows?.[0]) return res.status(404).json({ error: "Grup bulunamadı" });

            // Üyeler ve adminler dahil, mesajı alacak tüm kullanıcı ID'leri
            const groupMembers = [...JSON.parse(groupRows[0].users), ...JSON.parse(groupRows[0].admins)];
            const uniqueMembers = [...new Set(groupMembers)].map(String);

            // Göndericiyi listeden çıkar (kendi kendine bildirim göndermemek için, SSE zaten kendi mesajını alacaktır)
            const receivers = uniqueMembers.filter(id => id !== String(senderId));

            // SSE ile alıcılara gönder
            const sseMessage = {
                sender_id: senderId,
                receiver_id: receiver_id,
                text: message,
                is_group: 1
            };

            for (const memberId of receivers) {
                const memberClient = getClientByUserId(parseInt(memberId, 10)); // ID'ler number ise parse et
                if (memberClient) {
                    sendJSON(memberClient.res, sseMessage);
                }
            }

        } else {
            // Birebir mesaj
            const receiverClient = getClientByUserId(receiver_id);
            const sseMessage = {
                sender_id: senderId,
                receiver_id: receiver_id,
                text: message,
                is_group: 0
            };

            if (receiverClient) {
                console.log("alıcı client bulundu");
                sendJSON(receiverClient.res, sseMessage);
            }
        }

        // Frontend'in beklemediği ancak yine de gönderebileceği başarılı cevap
        res.json({ sender_id: senderId, receiver_id, text: message, is_group: is_group });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Mesaj gönderilemedi" });
    }
});

// ------------------------- GRUP YÖNETİMİ -------------------------

// Üyeyi kullanıcı seviyesine indir (Adminlikten Çıkarmanın bir parçasıdır)
app.post('/remove_member_admin', async (req, res) => {
    const { groupId, userId, cookie } = req.body;
    const cookies = parseCookie(cookie);
    if (!cookies?.token) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });

    try {
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [cookies.token]
        );
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(401).json({ error: "Gecersiz token" });
        const currentUserId = rowsBySession[0].userId.toString();
        const targetUserId = String(userId);

        // 1. Admin yetkisi kontrolü (Mevcut kullanıcı admin olmalı)
        const [groupRows] = await db.query(
            "SELECT id, admins FROM groups WHERE id = ? AND JSON_CONTAINS(admins, ?)",
            [groupId, `"${currentUserId}"`]
        );
        if (!groupRows?.[0]) return res.status(403).json({ success: false, error: "Yetkisiz işlem veya Grup bulunamadı." });

        const groupAdmins = JSON.parse(groupRows[0].admins);

        // 2. Admin sayısı kontrolü (Admin sayısı 1'in altına düşemez)
        if (groupAdmins.length === 1 && groupAdmins.map(String).includes(targetUserId)) {
            return res.status(400).json({ success: false, error: "Grupta en az bir admin bulunmalıdır." });
        }

        // 3. Admin listesinden kullanıcıyı kaldır
        await db.query("UPDATE groups SET admins = JSON_REMOVE(admins, REPLACE(JSON_UNQUOTE(JSON_SEARCH(admins, 'one', ?)), '\"', '')) WHERE id = ?", [targetUserId, groupId]);

        res.json({ success: true, message: "Kullanıcı adminlikten çıkarıldı." });

    } catch (err) {
        console.error("Admin çıkarma hatası:", err);
        res.status(500).json({ success: false, error: "Sunucu hatası: Adminlikten çıkarılamadı." });
    }
});


// Üyeyi admin yapar (Sadece mevcut adminler yapabilir)
app.post('/set_member_admin', async (req, res) => {
    const { groupId, userId, cookie } = req.body;
    const cookies = parseCookie(cookie);
    if (!cookies?.token) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });

    try {
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [cookies.token]
        );
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(401).json({ error: "Gecersiz token" });
        const currentUserId = rowsBySession[0].userId.toString();

        // Admin yetkisi kontrolü
        const [groupRows] = await db.query(
            "SELECT * FROM groups WHERE id = ? AND JSON_CONTAINS(admins, ?)",
            [groupId, `"${currentUserId}"`]
        );
        if (!groupRows?.[0]) return res.status(403).json({ success: false, error: "Yetkisiz işlem veya Grup bulunamadı." });

        const targetUserId = String(userId);

        // Kullanıcının admin listesinde olup olmadığını kontrol et
        const groupAdmins = JSON.parse(groupRows[0].admins);
        if (groupAdmins.map(String).includes(targetUserId)) {
            return res.status(400).json({ success: false, error: "Kullanıcı zaten admin." });
        }

        // Admin olarak ekle
        await db.query("UPDATE groups SET admins = JSON_ARRAY_APPEND(admins, '$', ?) WHERE id = ?", [targetUserId, groupId]);

        res.json({ success: true, message: "Kullanıcı admin yapıldı." });

    } catch (err) {
        console.error("Admin yapma hatası:", err);
        res.status(500).json({ success: false, error: "Kullanıcı admin yapılamadı." });
    }
})

// Grup oluşturma
app.post('/create_groups', async (req, res) => {
    try {
        const { name, users, cookie } = req.body;
        const cookies = parseCookie(cookie);
        if (!cookies?.token) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [cookies.token]
        )
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });

        const currentUserId = rowsBySession[0].userId.toString();

        // 1. Oluşturan kullanıcıyı otomatik admin yap
        const adminUsers = [currentUserId];

        // 2. user listesinden adminleri ve kopyaları çıkar
        const finalUsers = users.map(String).filter(id => id !== currentUserId);

        const [result] = await db.query(
            "INSERT INTO groups (name, users, admins) VALUES (?, ?, ?)",
            [name, JSON.stringify(finalUsers), JSON.stringify(adminUsers)]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Grup olusturulamadi" });
    }
})

// Üye ekle (Sadece Adminler yapabilir)
app.post('/add_member', async (req, res) => {
    const { group_id, user_id, cookie } = req.body;
    const cookies = parseCookie(cookie);
    if (!cookies?.token) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });

    try {
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [cookies.token]
        )
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(401).json({ error: "Gecersiz token" });
        const currentUserId = rowsBySession[0].userId.toString();

        // Admin yetkisi kontrolü
        const [groupRows] = await db.query(
            "SELECT * FROM groups WHERE id = ? AND JSON_CONTAINS(admins, ?)",
            [group_id, `"${currentUserId}"`] // JSON_CONTAINS için çift tırnak önemli
        );

        if (!groupRows?.[0]) return res.status(403).json({ success: false, error: "Yetkisiz işlem: Sadece adminler üye ekleyebilir." });

        const targetUserId = String(user_id);

        // 1. Hedef kullanıcının zaten üye (users) olup olmadığını kontrol et
        const groupUsers = JSON.parse(groupRows[0].users);
        const groupAdmins = JSON.parse(groupRows[0].admins);

        if (groupUsers.map(String).includes(targetUserId) || groupAdmins.map(String).includes(targetUserId)) {
            return res.status(400).json({ success: false, error: "Kullanıcı zaten grupta." });
        }

        // 2. Üyeyi ekle
        await db.query('UPDATE groups SET users = JSON_ARRAY_APPEND(users, "$", ?) WHERE id = ?', [targetUserId, group_id]);

        res.json({ success: true, message: "Kullanıcı gruba eklendi." });
    } catch (err) {
        console.error("Üye ekleme hatası:", err);
        res.status(500).json({ success: false, error: "Sunucu hatası: Kullanıcı eklenemedi." });
    }
})

// Üye çıkarma (Eksik: Sadece Adminler yapabilir)
app.post('/remove_member', async (req, res) => {
    const { group_id, user_id, cookie } = req.body;
    const cookies = parseCookie(cookie);
    if (!cookies?.token) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });

    try {
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [cookies.token]
        )
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(401).json({ error: "Gecersiz token" });
        const currentUserId = rowsBySession[0].userId.toString();
        const targetUserId = String(user_id);

        // 1. Admin yetkisi kontrolü
        const [groupRows] = await db.query(
            "SELECT users, admins FROM groups WHERE id = ? AND JSON_CONTAINS(admins, ?)",
            [group_id, `"${currentUserId}"`]
        );
        if (!groupRows?.[0]) return res.status(403).json({ success: false, error: "Yetkisiz işlem: Sadece adminler üye çıkarabilir." });

        // 2. Çıkarılacak kullanıcı admin ise, adminlikten çıkarılması gerekir.
        const groupAdmins = JSON.parse(groupRows[0].admins);
        if (groupAdmins.map(String).includes(targetUserId)) {
            return res.status(400).json({ success: false, error: "Kullanıcı admin olduğu için önce adminlikten çıkarılmalıdır." });
        }

        // 3. Kendisini gruptan atmasını engelle (Adminin kendisini atması için farklı bir API olmalı)
        if (targetUserId === currentUserId) {
            return res.status(400).json({ success: false, error: "Kendinizi gruptan atamazsınız." });
        }

        // 4. Üyeler listesinden kaldır (users)
        await db.query("UPDATE groups SET users = JSON_REMOVE(users, REPLACE(JSON_UNQUOTE(JSON_SEARCH(users, 'one', ?)), '\"', '')) WHERE id = ?", [targetUserId, group_id]);

        res.json({ success: true, message: "Kullanıcı gruptan çıkarıldı." });

    } catch (err) {
        console.error("Üye çıkarma hatası:", err);
        res.status(500).json({ success: false, error: "Sunucu hatası: Kullanıcı çıkarılamadı." });
    }
})


// Mesaj sil
app.delete("/messages/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM messages WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Mesaj silinemedi" });
    }
});

// ------------------------- DUYURULAR -------------------------
app.get("/duyurular", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT d.id, d.title, d.content, d.created_at, u.id AS user_id, u.username, u.email, u.profile_image
            FROM duyurular d
            LEFT JOIN users u ON d.user_id = u.id
            ORDER BY d.created_at DESC
        `);
        const duyurular = rows.map(d => ({
            ...d,
            profile_image: d.profile_image || "/default-profile.png"
        }));
        res.json(duyurular);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Duyurular alınamadı" });
    }
});

app.post("/duyurular", async (req, res) => {
    const { title, content, user_id } = req.body;
    try {
        const [result] = await db.query(
            "INSERT INTO duyurular (title, content, user_id, created_at) VALUES (?, ?, ?, NOW())",
            [title, content, user_id]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Duyuru eklenemedi" });
    }
});

app.put("/duyurular/:id", async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    try {
        const [result] = await db.query(
            "UPDATE duyurular SET title = ?, content = ? WHERE id = ?",
            [title, content, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: "Duyuru bulunamadı" });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Duyuru güncelleme hatası:", err);
        res.status(500).json({ success: false, error: "Güncelleme başarısız" });
    }
});

app.delete("/duyurular/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM duyurular WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Silme başarısız" });
    }
});

// ------------------------- SERVER -------------------------
const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server ${PORT} portunda çalışıyor!`));