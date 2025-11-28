const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "myapp",
});

(async () => {
    params = [1, 2, 2, 1];

    query = `SELECT * FROM messages 
                     WHERE is_group = 0 AND 
                     ((sender_id = ? AND receiver_id = ?) 
                     OR (sender_id = ? AND receiver_id = ?))
                     ORDER BY timestamp ASC`;
    const [rows] = await db.query(query, params);
    console.log(rows);
})()