// src/api/axios.ts
import axios from "axios";

const instance = axios.create({
    baseURL: "http://localhost:5000",
    // timeout: 5000,
});

// Eğer localStorage'da token varsa başlangıçta ekle
const token = localStorage.getItem("token");
if (token) {
    instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

export default instance;
