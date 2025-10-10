const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 MySQL bağlantısı
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "myapp",
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

        const user = rows[0];

        res.json({
            message: "Giriş başarılı",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profile_image: user.profile_image || "/default-profile.png",
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

        if (!rows[0]) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

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

// PUT endpoint: duyuru düzenleme
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
