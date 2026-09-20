// ─────────────────────────────────────────────────────────────
// js/new-leave-request.js — หน้าที่ 2 ยื่นใบลาใหม่ (US-02)
//
// อ่านรายการประเภทการลาจริงจาก Firestore collection "leaveTypes" มาเติม dropdown
// กดบันทึก → addDoc ใบใหม่ลง collection "leaveRequests" ตามช่องข้อมูลในสเปกหัวข้อ 5.2
//   - status ตั้งเป็น "รอพิจารณา" เสมอ (ผู้ใช้เลือกเองไม่ได้ — หัวข้อ 6)
//   - requesterId = uid ของคนที่ล็อกอินอยู่จริง (ผู้ใช้กรอกเองไม่ได้)
// กดยกเลิก → กลับ leave-requests.html โดยไม่บันทึกอะไร
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
  getDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(async function () {
  var ฟอร์ม = document.getElementById("ฟอร์มยื่นใบลา");
  var ช่องหัวข้อ = document.getElementById("ช่องหัวข้อ");
  var ช่องเหตุผล = document.getElementById("ช่องเหตุผล");
  var ช่องประเภทการลา = document.getElementById("ช่องประเภทการลา");
  var ช่องวันที่เริ่มลา = document.getElementById("ช่องวันที่เริ่มลา");
  var ช่องวันที่สิ้นสุด = document.getElementById("ช่องวันที่สิ้นสุด");
  var ปุ่มบันทึก = document.getElementById("ปุ่มบันทึก");
  var ปุ่มยกเลิก = document.getElementById("ปุ่มยกเลิก");
  var ข้อความข้อผิดพลาด = document.getElementById("ข้อความข้อผิดพลาด");

  var ผู้ใช้ = await รอผู้ใช้ล็อกอิน();
  var บทบาท = await รอบทบาทผู้ใช้();

  if (typeof ปรับเมนูตามบทบาท === "function") {
    ปรับเมนูตามบทบาท(บทบาท);
  }

  // ยื่นใบขอลาใหม่ได้ทุกบทบาทที่ล็อกอินแล้ว (ACL.md: createRequest) — กันไว้อีกชั้นฝั่ง UI
  // ตัวป้องกันข้อมูลจริงอยู่ที่ firestore.rules เสมอ
  var มีสิทธิ์ยื่นใบลา =
    typeof ตรวจสิทธิ์ === "function" ? ตรวจสิทธิ์("createRequest", { role: บทบาท }) : true;

  if (!มีสิทธิ์ยื่นใบลา) {
    ฟอร์ม.style.display = "none";
    แสดงข้อผิดพลาด("คุณไม่มีสิทธิ์ยื่นใบขอลา");
    return;
  }

  var ชื่อผู้ใช้ปัจจุบัน = await หาชื่อผู้ใช้ปัจจุบัน(ผู้ใช้.uid);

  await โหลดประเภทการลา();

  ฟอร์ม.addEventListener("submit", function (เหตุการณ์) {
    เหตุการณ์.preventDefault();
    บันทึกใบลา();
  });

  ปุ่มยกเลิก.addEventListener("click", function () {
    location.href = "leave-requests.html";
  });

  // ── อ่านประเภทการลาจริงจาก Firestore มาเติม dropdown (US-02) ──
  async function โหลดประเภทการลา() {
    try {
      var สแนปช็อต = await getDocs(collection(db, "leaveTypes"));
      var รายการประเภทการลา = [];
      สแนปช็อต.forEach(function (เอกสาร) {
        รายการประเภทการลา.push({ id: เอกสาร.id, name: เอกสาร.data().name });
      });

      if (รายการประเภทการลา.length === 0) {
        ช่องประเภทการลา.innerHTML = '<option value="">ยังไม่มีประเภทการลาในระบบ</option>';
        return;
      }

      ช่องประเภทการลา.innerHTML =
        '<option value="">-- เลือกประเภทการลา --</option>' +
        รายการประเภทการลา
          .map(function (ประเภท) {
            return '<option value="' + esc(ประเภท.id) + '">' + esc(ประเภท.name) + "</option>";
          })
          .join("");
    } catch (ข้อผิดพลาด) {
      ช่องประเภทการลา.innerHTML = '<option value="">โหลดประเภทการลาไม่สำเร็จ</option>';
      if (typeof showConfigWarning === "function") {
        showConfigWarning();
      }
    }
  }

  // ── กดบันทึก → addDoc ใบใหม่ลง leaveRequests (US-02, หัวข้อ 5.2, หัวข้อ 6) ──
  async function บันทึกใบลา() {
    ซ่อนข้อผิดพลาด();

    var หัวข้อ = ช่องหัวข้อ.value.trim();
    var เหตุผล = ช่องเหตุผล.value.trim();
    var รหัสประเภทการลา = ช่องประเภทการลา.value;
    var ตัวเลือกประเภทที่เลือก = ช่องประเภทการลา.options[ช่องประเภทการลา.selectedIndex];
    var ชื่อประเภทการลา = ตัวเลือกประเภทที่เลือก ? ตัวเลือกประเภทที่เลือก.text : "";
    var วันที่เริ่มลา = ช่องวันที่เริ่มลา.value;
    var วันที่สิ้นสุด = ช่องวันที่สิ้นสุด.value;

    if (!หัวข้อ || !เหตุผล || !รหัสประเภทการลา || !วันที่เริ่มลา || !วันที่สิ้นสุด) {
      แสดงข้อผิดพลาด("กรุณากรอกข้อมูลให้ครบทุกช่องก่อนบันทึก");
      return;
    }
    if (วันที่สิ้นสุด < วันที่เริ่มลา) {
      แสดงข้อผิดพลาด("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา");
      return;
    }

    ปุ่มบันทึก.disabled = true;

    var ใบลาใหม่ = {
      title: หัวข้อ,
      reason: เหตุผล,
      status: "รอพิจารณา", // ตั้งอัตโนมัติเสมอ ผู้ใช้เลือกเองไม่ได้ (หัวข้อ 6)
      requesterId: ผู้ใช้.uid, // uid ของคนที่ล็อกอินอยู่จริง ห้ามให้ผู้ใช้กรอกเอง
      requesterName: ชื่อผู้ใช้ปัจจุบัน,
      approverId: "",
      approverName: "",
      leaveTypeId: รหัสประเภทการลา,
      leaveTypeName: ชื่อประเภทการลา,
      startDate: วันที่เริ่มลา,
      endDate: วันที่สิ้นสุด,
      createdAt: เวลาตอนนี้()
    };

    try {
      await addDoc(collection(db, "leaveRequests"), ใบลาใหม่);
      location.href = "leave-requests.html";
    } catch (ข้อผิดพลาด) {
      แสดงข้อผิดพลาด("บันทึกใบลาไม่สำเร็จ: " + ข้อผิดพลาด.message);
      ปุ่มบันทึก.disabled = false;
    }
  }

  function แสดงข้อผิดพลาด(ข้อความ) {
    ข้อความข้อผิดพลาด.textContent = ข้อความ;
    ข้อความข้อผิดพลาด.style.display = "";
  }
  function ซ่อนข้อผิดพลาด() {
    ข้อความข้อผิดพลาด.style.display = "none";
  }

  // ── หาชื่อไทยของผู้ใช้ที่ล็อกอินอยู่ จากโฟลเดอร์ users (ใช้เป็น requesterName) ──
  async function หาชื่อผู้ใช้ปัจจุบัน(uid) {
    try {
      var สแนปช็อตผู้ใช้ = await getDoc(doc(db, "users", uid));
      if (สแนปช็อตผู้ใช้.exists() && สแนปช็อตผู้ใช้.data().name) {
        return สแนปช็อตผู้ใช้.data().name;
      }
    } catch (ข้อผิดพลาด) {
      // ปล่อยไปใช้ค่า fallback ด้านล่าง
    }
    return (ผู้ใช้ && ผู้ใช้.email) || "ไม่ทราบชื่อ";
  }
})();
