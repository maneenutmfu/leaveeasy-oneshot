// ─────────────────────────────────────────────────────────────
// js/leave-types.js — หน้าที่ 4 จัดการประเภทการลา (US-06)
//
// เพิ่ม / แก้ / ลบ ประเภทการลาจริงใน Firestore collection "leaveTypes"
// หน้านี้เข้าได้เฉพาะบทบาท hr เท่านั้น — ใช้ js/acl.js (ตรวจสิทธิ์("manageLeaveTypes", ...))
// ช่วยตัดสินใจ เป็นแค่ชั้นกัน UX เท่านั้น ตัวป้องกันข้อมูลจริงอยู่ที่ firestore.rules
//
// ใช้ฟังก์ชัน global จาก js/util.js, js/nav.js, js/acl.js, js/auth-guard.js ตรง ๆ ไม่ import
// เพราะสคริปต์เหล่านั้นโหลดแบบ <script defer> ธรรมดา (ดู CLAUDE.md)
// ─────────────────────────────────────────────────────────────

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(async function () {
  var กล่องไม่มีสิทธิ์ = document.getElementById("กล่องไม่มีสิทธิ์");
  var กล่องเนื้อหา = document.getElementById("กล่องเนื้อหา");
  var ช่องชื่อประเภทใหม่ = document.getElementById("ช่องชื่อประเภทใหม่");
  var ปุ่มเพิ่มประเภท = document.getElementById("ปุ่มเพิ่มประเภท");
  var กล่องตารางประเภทการลา = document.getElementById("กล่องตารางประเภทการลา");
  var ข้อความข้อผิดพลาด = document.getElementById("ข้อความข้อผิดพลาด");

  var ผู้ใช้ = await รอผู้ใช้ล็อกอิน();
  var บทบาท = await รอบทบาทผู้ใช้();

  if (typeof ปรับเมนูตามบทบาท === "function") {
    ปรับเมนูตามบทบาท(บทบาท);
  }

  // หน้านี้เข้าได้เฉพาะ hr เท่านั้น (US-06 + ACL.md: manageLeaveTypes)
  var มีสิทธิ์จัดการ =
    typeof ตรวจสิทธิ์ === "function"
      ? ตรวจสิทธิ์("manageLeaveTypes", { role: บทบาท })
      : บทบาท === "hr";

  if (!มีสิทธิ์จัดการ) {
    กล่องไม่มีสิทธิ์.style.display = "";
    return;
  }

  กล่องเนื้อหา.style.display = "";

  ปุ่มเพิ่มประเภท.addEventListener("click", เพิ่มประเภท);

  await โหลดประเภทการลา();

  // ── อ่านประเภทการลาทั้งหมดจาก Firestore แล้ววาดตาราง ──
  async function โหลดประเภทการลา() {
    try {
      var สแนปช็อต = await getDocs(collection(db, "leaveTypes"));
      var รายการประเภทการลา = [];
      สแนปช็อต.forEach(function (เอกสาร) {
        รายการประเภทการลา.push({ id: เอกสาร.id, name: เอกสาร.data().name });
      });
      วาดตาราง(รายการประเภทการลา);
    } catch (ข้อผิดพลาด) {
      กล่องตารางประเภทการลา.innerHTML =
        "<p>โหลดประเภทการลาไม่สำเร็จ: " + esc(ข้อผิดพลาด.message) + "</p>";
      if (typeof showConfigWarning === "function") {
        showConfigWarning();
      }
    }
  }

  // ── วาดตารางประเภทการลา พร้อมปุ่มแก้ไข/ลบในแต่ละแถว (US-06) ──
  function วาดตาราง(รายการประเภทการลา) {
    if (รายการประเภทการลา.length === 0) {
      กล่องตารางประเภทการลา.innerHTML = "<p>ยังไม่มีประเภทการลาในระบบ</p>";
      return;
    }

    var html = '<table class="table"><thead><tr><th>ชื่อประเภท</th><th></th></tr></thead><tbody>';
    รายการประเภทการลา.forEach(function (ประเภท) {
      html +=
        '<tr data-id="' + esc(ประเภท.id) + '">' +
        '<td class="ชื่อประเภท-เซลล์">' + esc(ประเภท.name) + "</td>" +
        '<td style="white-space:nowrap;">' +
        '<button type="button" class="btn btn-secondary ปุ่มแก้ไข">แก้ไข</button> ' +
        '<button type="button" class="btn btn-danger ปุ่มลบ">ลบ</button>' +
        "</td></tr>";
    });
    html += "</tbody></table>";
    กล่องตารางประเภทการลา.innerHTML = html;

    กล่องตารางประเภทการลา.querySelectorAll("tr[data-id]").forEach(function (แถว) {
      var รหัสประเภท = แถว.dataset.id;
      var ชื่อเดิม = แถว.querySelector(".ชื่อประเภท-เซลล์").textContent;

      แถว.querySelector(".ปุ่มแก้ไข").addEventListener("click", function () {
        เริ่มแก้ไขแถว(แถว, รหัสประเภท, ชื่อเดิม);
      });
      แถว.querySelector(".ปุ่มลบ").addEventListener("click", function () {
        ลบประเภท(รหัสประเภท, ชื่อเดิม);
      });
    });
  }

  // ── เปลี่ยนแถวเป็นโหมดแก้ไข: ช่องกรอกชื่อใหม่ + ปุ่มบันทึก/ยกเลิก ──
  function เริ่มแก้ไขแถว(แถว, รหัสประเภท, ชื่อเดิม) {
    var เซลล์ชื่อ = แถว.querySelector(".ชื่อประเภท-เซลล์");
    var เซลล์ปุ่ม = แถว.querySelector("td:last-child");

    เซลล์ชื่อ.innerHTML = '<input type="text" class="ช่องแก้ไขชื่อ" value="' + esc(ชื่อเดิม) + '">';
    เซลล์ปุ่ม.innerHTML =
      '<button type="button" class="btn btn-primary ปุ่มบันทึกแก้ไข">บันทึก</button> ' +
      '<button type="button" class="btn btn-secondary ปุ่มยกเลิกแก้ไข">ยกเลิก</button>';

    var ช่องแก้ไขชื่อ = เซลล์ชื่อ.querySelector(".ช่องแก้ไขชื่อ");
    ช่องแก้ไขชื่อ.focus();

    เซลล์ปุ่ม.querySelector(".ปุ่มบันทึกแก้ไข").addEventListener("click", function () {
      แก้ไขประเภท(รหัสประเภท, ช่องแก้ไขชื่อ.value.trim());
    });
    เซลล์ปุ่ม.querySelector(".ปุ่มยกเลิกแก้ไข").addEventListener("click", function () {
      โหลดประเภทการลา(); // ยกเลิก → โหลดตารางใหม่ ทิ้งการแก้ไขที่ยังไม่บันทึก
    });
  }

  // ── เพิ่มประเภทการลาใหม่ (US-06) ──
  async function เพิ่มประเภท() {
    ซ่อนข้อผิดพลาด();
    var ชื่อใหม่ = ช่องชื่อประเภทใหม่.value.trim();
    if (!ชื่อใหม่) {
      แสดงข้อผิดพลาด("กรุณากรอกชื่อประเภทการลาก่อนกด เพิ่มประเภทการลา");
      return;
    }

    ปุ่มเพิ่มประเภท.disabled = true;
    try {
      await addDoc(collection(db, "leaveTypes"), { name: ชื่อใหม่ });
      ช่องชื่อประเภทใหม่.value = "";
      await โหลดประเภทการลา(); // ตารางอัปเดตทันที
    } catch (ข้อผิดพลาด) {
      แสดงข้อผิดพลาด("เพิ่มประเภทการลาไม่สำเร็จ: " + ข้อผิดพลาด.message);
    } finally {
      ปุ่มเพิ่มประเภท.disabled = false;
    }
  }

  // ── แก้ไขชื่อประเภทการลา (US-06) ──
  async function แก้ไขประเภท(รหัสประเภท, ชื่อใหม่) {
    ซ่อนข้อผิดพลาด();
    if (!ชื่อใหม่) {
      แสดงข้อผิดพลาด("กรุณากรอกชื่อประเภทการลาก่อนกด บันทึก");
      return;
    }
    try {
      await updateDoc(doc(db, "leaveTypes", รหัสประเภท), { name: ชื่อใหม่ });
      await โหลดประเภทการลา(); // ตารางอัปเดตทันที
    } catch (ข้อผิดพลาด) {
      แสดงข้อผิดพลาด("แก้ไขประเภทการลาไม่สำเร็จ: " + ข้อผิดพลาด.message);
    }
  }

  // ── ลบประเภทการลา (US-06) ──
  async function ลบประเภท(รหัสประเภท, ชื่อ) {
    ซ่อนข้อผิดพลาด();
    if (!confirm('ยืนยันการลบประเภทการลา "' + ชื่อ + '" หรือไม่')) return;
    try {
      await deleteDoc(doc(db, "leaveTypes", รหัสประเภท));
      await โหลดประเภทการลา(); // ตารางอัปเดตทันที
    } catch (ข้อผิดพลาด) {
      แสดงข้อผิดพลาด("ลบประเภทการลาไม่สำเร็จ: " + ข้อผิดพลาด.message);
    }
  }

  function แสดงข้อผิดพลาด(ข้อความ) {
    ข้อความข้อผิดพลาด.textContent = ข้อความ;
    ข้อความข้อผิดพลาด.style.display = "";
  }
  function ซ่อนข้อผิดพลาด() {
    ข้อความข้อผิดพลาด.style.display = "none";
  }
})();
