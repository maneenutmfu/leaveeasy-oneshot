// js/seed.js
// ปุ่มใส่ข้อมูลตัวอย่างจาก js/data.js ขึ้น Firestore ครั้งเดียว (ตาม leaveeasy-spec.md หัวข้อ 7)
// ไม่ได้เป็นส่วนหนึ่งของการใช้งานปกติของระบบ
//
// ⚠️ ดูหมายเหตุเรื่อง firestore.rules ในไฟล์ seed.html ก่อนใช้งาน — ข้อมูลตัวอย่างบางรายการ
// (ใบลาที่มีสถานะอนุมัติ/ไม่อนุมัติมาตั้งแต่ต้น และผู้ใช้ที่มีรหัสไฟล์คงที่ไม่ตรงกับ uid จริง)
// จะเขียนไม่ผ่านถ้ากฎเฝ้าข้อมูลเป็นแบบรายบทบาทที่รัดกุมอยู่ ต้องเปิดกฎกว้างชั่วคราวก่อนใส่ข้อมูล

import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ปุ่มใส่ข้อมูล = document.getElementById("ปุ่มใส่ข้อมูลตัวอย่าง");
const กล่องผลลัพธ์ = document.getElementById("ผลลัพธ์การใส่ข้อมูล");

function เพิ่มบรรทัดผลลัพธ์(ข้อความ, เป็นข้อผิดพลาด) {
  const บรรทัด = document.createElement("div");
  บรรทัด.className = เป็นข้อผิดพลาด ? "seed-log seed-log-error" : "seed-log";
  บรรทัด.textContent = ข้อความ;
  กล่องผลลัพธ์.appendChild(บรรทัด);
}

async function ใส่ข้อมูลตัวอย่าง() {
  const ข้อมูล = window.LEAVE_DATA;
  if (!ข้อมูล) {
    เพิ่มบรรทัดผลลัพธ์("ไม่พบ window.LEAVE_DATA — ตรวจสอบว่าโหลด js/data.js สำเร็จหรือยัง", true);
    return;
  }

  ปุ่มใส่ข้อมูล.disabled = true;
  ปุ่มใส่ข้อมูล.textContent = "กำลังใส่ข้อมูล...";
  กล่องผลลัพธ์.innerHTML = "";

  // 1) users
  for (const uid of Object.keys(ข้อมูล.users)) {
    try {
      await setDoc(doc(db, "users", uid), ข้อมูล.users[uid]);
      เพิ่มบรรทัดผลลัพธ์("✅ users/" + uid + " — " + ข้อมูล.users[uid].name);
    } catch (err) {
      เพิ่มบรรทัดผลลัพธ์("❌ users/" + uid + " ล้มเหลว: " + err.message, true);
    }
  }

  // 2) leaveTypes
  for (const ltId of Object.keys(ข้อมูล.leaveTypes)) {
    try {
      await setDoc(doc(db, "leaveTypes", ltId), ข้อมูล.leaveTypes[ltId]);
      เพิ่มบรรทัดผลลัพธ์("✅ leaveTypes/" + ltId + " — " + ข้อมูล.leaveTypes[ltId].name);
    } catch (err) {
      เพิ่มบรรทัดผลลัพธ์("❌ leaveTypes/" + ltId + " ล้มเหลว: " + err.message, true);
    }
  }

  // 3) leaveRequests + 4) approvals (โฟลเดอร์ย่อยของแต่ละใบ)
  for (const lrId of Object.keys(ข้อมูล.leaveRequests)) {
    try {
      await setDoc(doc(db, "leaveRequests", lrId), ข้อมูล.leaveRequests[lrId]);
      เพิ่มบรรทัดผลลัพธ์("✅ leaveRequests/" + lrId + " — " + ข้อมูล.leaveRequests[lrId].title);
    } catch (err) {
      เพิ่มบรรทัดผลลัพธ์("❌ leaveRequests/" + lrId + " ล้มเหลว: " + err.message, true);
      continue;
    }

    const รายการความเห็น = ข้อมูล.approvals[lrId] || [];
    for (const ความเห็น of รายการความเห็น) {
      const { id, ...ข้อมูลความเห็น } = ความเห็น;
      try {
        await setDoc(doc(db, "leaveRequests", lrId, "approvals", id), ข้อมูลความเห็น);
        เพิ่มบรรทัดผลลัพธ์("✅ leaveRequests/" + lrId + "/approvals/" + id);
      } catch (err) {
        เพิ่มบรรทัดผลลัพธ์("❌ leaveRequests/" + lrId + "/approvals/" + id + " ล้มเหลว: " + err.message, true);
      }
    }
  }

  เพิ่มบรรทัดผลลัพธ์("── เสร็จสิ้น ──");
  ปุ่มใส่ข้อมูล.disabled = false;
  ปุ่มใส่ข้อมูล.textContent = "ใส่ข้อมูลตัวอย่างอีกครั้ง";
}

ปุ่มใส่ข้อมูล.addEventListener("click", ใส่ข้อมูลตัวอย่าง);
