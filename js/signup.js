// js/signup.js
// ฟอร์มสมัครสมาชิก สร้างบัญชี Firebase Authentication + ไฟล์ users/{uid}
// role เริ่มต้นเป็น "employee" เสมอ — ห้ามให้ผู้ใช้เลือก role เอง
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ฟอร์ม = document.getElementById("ฟอร์มสมัครสมาชิก");
const ช่องชื่อ = document.getElementById("ชื่อ");
const ช่องอีเมล = document.getElementById("อีเมล");
const ช่องรหัสผ่าน = document.getElementById("รหัสผ่าน");
const ช่องยืนยันรหัสผ่าน = document.getElementById("ยืนยันรหัสผ่าน");
const ข้อความแจ้งเตือน = document.getElementById("ข้อความแจ้งเตือน");
const ปุ่มสมัครสมาชิก = document.getElementById("ปุ่มสมัครสมาชิก");

function แสดงข้อผิดพลาด(ข้อความ) {
  ข้อความแจ้งเตือน.textContent = ข้อความ;
  ข้อความแจ้งเตือน.hidden = false;
}

function แปลรหัสข้อผิดพลาด(err) {
  const รหัส = err && err.code;
  const แผนที่ = {
    "auth/email-already-in-use": "อีเมลนี้ถูกใช้สมัครสมาชิกไปแล้ว",
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/weak-password": "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)"
  };
  return แผนที่[รหัส] || "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

ฟอร์ม.addEventListener("submit", async function (e) {
  e.preventDefault();
  ข้อความแจ้งเตือน.hidden = true;

  const ชื่อ = ช่องชื่อ.value.trim();
  const อีเมล = ช่องอีเมล.value.trim();
  const รหัสผ่าน = ช่องรหัสผ่าน.value;
  const ยืนยันรหัสผ่าน = ช่องยืนยันรหัสผ่าน.value;

  if (!ชื่อ || !อีเมล || !รหัสผ่าน || !ยืนยันรหัสผ่าน) {
    แสดงข้อผิดพลาด("กรุณากรอกข้อมูลให้ครบทุกช่อง");
    return;
  }
  if (รหัสผ่าน !== ยืนยันรหัสผ่าน) {
    แสดงข้อผิดพลาด("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    return;
  }

  ปุ่มสมัครสมาชิก.disabled = true;
  ปุ่มสมัครสมาชิก.textContent = "กำลังสมัครสมาชิก...";

  try {
    const ผลลัพธ์ = await createUserWithEmailAndPassword(auth, อีเมล, รหัสผ่าน);
    const uid = ผลลัพธ์.user.uid;

    // สร้างไฟล์ users/{uid} เสมอ — role เป็น "employee" เท่านั้น ห้ามให้ผู้ใช้เลือกเอง
    await setDoc(doc(db, "users", uid), {
      name: ชื่อ,
      email: อีเมล,
      role: "employee"
    });

    window.location.href = "leave-requests.html";
  } catch (err) {
    console.error("สมัครสมาชิกไม่สำเร็จ:", err);
    แสดงข้อผิดพลาด(แปลรหัสข้อผิดพลาด(err));
    ปุ่มสมัครสมาชิก.disabled = false;
    ปุ่มสมัครสมาชิก.textContent = "สมัครสมาชิก";
  }
});
