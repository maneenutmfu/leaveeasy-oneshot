// ─────────────────────────────────────────────────────────────
// js/leave-requests.js — หน้าที่ 1 รายการใบลา (US-01)
//
// อ่านรายการใบลาจริงจาก Firestore collection "leaveRequests"
//   - บทบาท employee  → query กรองด้วย where("requesterId", "==", uid) เท่านั้น
//     (จำเป็น เพราะ firestore.rules ของสัปดาห์ที่ 8 จะปฏิเสธ query ที่ไม่กรองแบบนี้)
//   - บทบาท manager/hr → ดึงทุกใบ (ไม่ใช้ where)
//
// ใช้ฟังก์ชัน global จาก js/util.js (esc, ป้ายสถานะ), js/nav.js (ปรับเมนูตามบทบาท,
// showConfigWarning) และ js/auth-guard.js (รอผู้ใช้ล็อกอิน, รอบทบาทผู้ใช้) ตรง ๆ
// โดยไม่ import เพราะสคริปต์เหล่านั้นโหลดแบบ <script defer> ธรรมดา ประกาศเป็น global
// ─────────────────────────────────────────────────────────────

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(async function () {
  var กล่องรายการใบลา = document.getElementById("กล่องรายการใบลา");

  var ผู้ใช้ = await รอผู้ใช้ล็อกอิน();
  var บทบาท = await รอบทบาทผู้ใช้();

  if (typeof ปรับเมนูตามบทบาท === "function") {
    ปรับเมนูตามบทบาท(บทบาท);
  }

  await โหลดรายการใบลา();

  // ── ดึงรายการใบลาจาก Firestore ตามสิทธิ์ของบทบาทปัจจุบัน ──
  async function โหลดรายการใบลา() {
    try {
      var คอลเลกชันใบลา = collection(db, "leaveRequests");

      // employee เห็นเฉพาะใบของตัวเอง ต้อง query ด้วย where เท่านั้น (ห้ามกรองฝั่งหน้าจอ
      // เพราะ query ที่ไม่มี where แบบนี้จะถูก firestore.rules ปฏิเสธทั้งก้อน)
      var ตัวสืบค้น =
        บทบาท === "employee"
          ? query(คอลเลกชันใบลา, where("requesterId", "==", ผู้ใช้.uid))
          : คอลเลกชันใบลา;

      var สแนปช็อต = await getDocs(ตัวสืบค้น);

      var รายการใบลา = [];
      สแนปช็อต.forEach(function (เอกสาร) {
        รายการใบลา.push(Object.assign({}, เอกสาร.data(), { id: เอกสาร.id }));
      });

      แสดงตาราง(รายการใบลา);
    } catch (ข้อผิดพลาด) {
      if (typeof showConfigWarning === "function") {
        showConfigWarning("อ่านรายการใบลาจาก Firestore ไม่สำเร็จ: " + ข้อผิดพลาด.message);
      }
      กล่องรายการใบลา.innerHTML = "<p>ยังไม่มีใบขอลาในระบบ</p>";
    }
  }

  // ── วาดตารางใบลา หรือข้อความ "ยังไม่มีใบขอลาในระบบ" ถ้าไม่มีข้อมูล ──
  function แสดงตาราง(รายการใบลา) {
    if (รายการใบลา.length === 0) {
      กล่องรายการใบลา.innerHTML = '<p class="table-empty">ยังไม่มีใบขอลาในระบบ</p>';
      return;
    }

    var html =
      '<table class="table"><thead><tr>' +
      "<th>หัวข้อ</th>" +
      "<th>ประเภทการลา</th>" +
      "<th>สถานะ</th>" +
      "<th>ผู้ขอลา</th>" +
      "<th>วันที่ลา</th>" +
      "</tr></thead><tbody>";

    รายการใบลา.forEach(function (ใบลา) {
      html +=
        '<tr class="clickable-row" data-id="' + esc(ใบลา.id) + '">' +
        "<td>" + esc(ใบลา.title) + "</td>" +
        "<td>" + esc(ใบลา.leaveTypeName) + "</td>" +
        "<td>" + ป้ายสถานะ(ใบลา.status) + "</td>" +
        "<td>" + esc(ใบลา.requesterName) + "</td>" +
        "<td>" + esc(ใบลา.startDate) + " ถึง " + esc(ใบลา.endDate) + "</td>" +
        "</tr>";
    });

    html += "</tbody></table>";
    กล่องรายการใบลา.innerHTML = html;

    // กดที่แถวไหน ไปหน้ารายละเอียดของใบนั้น
    กล่องรายการใบลา.querySelectorAll("tr[data-id]").forEach(function (แถว) {
      แถว.addEventListener("click", function () {
        location.href = "leave-request-detail.html?id=" + encodeURIComponent(แถว.dataset.id);
      });
    });
  }
})();
