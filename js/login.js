// js/login.js
// ฟอร์มเข้าสู่ระบบด้วย Firebase Authentication (email/password)
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const ฟอร์ม = document.getElementById("ฟอร์มล็อกอิน");
const ช่องอีเมล = document.getElementById("อีเมล");
const ช่องรหัสผ่าน = document.getElementById("รหัสผ่าน");
const ข้อความแจ้งเตือน = document.getElementById("ข้อความแจ้งเตือน");
const ปุ่มล็อกอิน = document.getElementById("ปุ่มล็อกอิน");

// ถ้าล็อกอินอยู่แล้ว ให้พาไปหน้ารายการใบลาเลย ไม่ต้องล็อกอินซ้ำ
onAuthStateChanged(auth, function (user) {
  if (user) {
    window.location.href = "leave-requests.html";
  }
});

function แสดงข้อผิดพลาด(ข้อความ) {
  ข้อความแจ้งเตือน.textContent = ข้อความ;
  ข้อความแจ้งเตือน.hidden = false;
}

function แปลรหัสข้อผิดพลาด(err) {
  const รหัส = err && err.code;
  const แผนที่ = {
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/user-not-found": "ไม่พบบัญชีผู้ใช้นี้ในระบบ",
    "auth/wrong-password": "รหัสผ่านไม่ถูกต้อง",
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/too-many-requests": "ลองผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง"
  };
  return แผนที่[รหัส] || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

ฟอร์ม.addEventListener("submit", async function (e) {
  e.preventDefault();
  ข้อความแจ้งเตือน.hidden = true;

  const อีเมล = ช่องอีเมล.value.trim();
  const รหัสผ่าน = ช่องรหัสผ่าน.value;

  if (!อีเมล || !รหัสผ่าน) {
    แสดงข้อผิดพลาด("กรุณากรอกอีเมลและรหัสผ่านให้ครบ");
    return;
  }

  ปุ่มล็อกอิน.disabled = true;
  ปุ่มล็อกอิน.textContent = "กำลังเข้าสู่ระบบ...";

  try {
    await signInWithEmailAndPassword(auth, อีเมล, รหัสผ่าน);
    window.location.href = "leave-requests.html";
  } catch (err) {
    console.error("เข้าสู่ระบบไม่สำเร็จ:", err);
    แสดงข้อผิดพลาด(แปลรหัสข้อผิดพลาด(err));
    ปุ่มล็อกอิน.disabled = false;
    ปุ่มล็อกอิน.textContent = "เข้าสู่ระบบ";
  }
});
