const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const app = express();
const crypto = require('crypto');
app.use(cors());
// app.use(cors({
//     origin: "http://localhost:3000",
//     credentials: true
// }));

app.use(cookieParser());
app.use(express.json());

// 🔗 MySQL bağlantısı
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "myapp",
});

const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

const clients = [];

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
        clients.push(client);

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
    console.log("req.body", req.body);
    const { otherId, cookie } = req.body;
    const cookies = parseCookie(cookie);
    console.log("otherId", otherId);
    console.log("cookie", cookies);
    const userId = cookies?.token
    console.log("userId", userId);
    if (!userId || !otherId) return res.json([]);

    try {
        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [userId]
        )
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(404).json({ error: "Kullanıcı oturumu bulunamadı" });
        const [rows] = await db.query(
            `SELECT * FROM messages 
             WHERE (sender_id = ? AND receiver_id = ?) 
                OR (sender_id = ? AND receiver_id = ?)
             ORDER BY timestamp ASC`,
            [rowsBySession[0].userId, otherId, otherId, rowsBySession[0].userId]
        );
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
    const otherId = rowsBySession[0].userId;
    console.log("sender_id", sender_id, "otherId", otherId);
    await db.query("UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0", [otherId, sender_id]);
    res.json({ success: true });
});

// post isteği atılırken bu satır eklenmeli "credentials: 'include'"
app.post("/send_message", async (req, res) => {
    console.log("send post")
    try {
        const { receiver_id, message, cookie } = req.body;
        if (!receiver_id || !message || !cookie)
            return res.status(400).json({ error: "Mesaj gerekli" });
        const cookies = parseCookie(cookie);
        if (!cookies?.token) return res.status(408).json({ error: "Kullanıcı oturumu bulunamadı" });

        const [rowsBySession] = await db.query(
            "SELECT * FROM sessions WHERE token = ?",
            [cookies.token]
        )
        if (!rowsBySession?.[0] || !rowsBySession[0]?.userId) return res.status(412).json({ error: "Kullanıcı oturumu bulunamadı" });
        await db.query(
            "INSERT INTO messages (sender_id, receiver_id, text) VALUES (?, ?, ?)",
            [rowsBySession[0].userId, receiver_id, message]
        );
        console.log("rowsBySession[0].userId", receiver_id);
        const receiverClient = getClientByUserId(receiver_id);
        if (receiverClient) {
            console.log("alıcı client bulundu");
            sendJSON(receiverClient.res, {
                sender_id: rowsBySession[0].userId,
                receiver_id,
                text: message
            });
        }

        res.json({ sender_id: rowsBySession[0].userId, receiver_id, text: message });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Mesaj gönderilemedi" });
    }
});

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
