// js/firebase-config.js
// ตั้งค่าการเชื่อมต่อ Firebase / Firestore / Authentication
//
// ⚠️ ค่า firebaseConfig ด้านล่างเป็น "client config" ของ Firebase ที่ตั้งใจให้เปิดเผยฝั่งเบราว์เซอร์ได้
//    ความปลอดภัยจริงของข้อมูลมาจาก Firestore Security Rules (ดูไฟล์ firestore.rules)
//    ไม่ใช่การซ่อนค่านี้ — ห้ามย้ายค่านี้ไปไฟล์ลับ และห้ามใช้ไฟล์นี้อ้างว่า "ใส่คีย์ลงไฟล์ได้" กับไฟล์อื่น
//
// โหลดแบบ ES module (<script type="module">) ผ่าน CDN ของ Firebase SDK v9+ (ไม่ผ่าน npm bundling)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCLtV4lxyeM3amIztyJITvVAkmKznpH4jU",
  authDomain: "leaveeasy-oneshot-82d59.firebaseapp.com",
  projectId: "leaveeasy-oneshot-82d59",
  storageBucket: "leaveeasy-oneshot-82d59.firebasestorage.app",
  messagingSenderId: "666367799333",
  appId: "1:666367799333:web:bfafef95eeb2afe2f90fcc",
  measurementId: "G-JW6NCB61DV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
