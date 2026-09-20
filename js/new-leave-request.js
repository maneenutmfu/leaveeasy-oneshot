// ─────────────────────────────────────────────────────────────
// js/new-leave-request.js — หน้าที่ 2 ยื่นใบลาใหม่ (US-02, US-09)
//
// อ่านรายการประเภทการลาจริงจาก Firestore collection "leaveTypes" มาเติม dropdown
// กดบันทึก → addDoc ใบใหม่ลง collection "leaveRequests" ตามช่องข้อมูลในสเปกหัวข้อ 5.2
//   - status ตั้งเป็น "รอพิจารณา" เสมอ (ผู้ใช้เลือกเองไม่ได้ — หัวข้อ 6)
//   - requesterId = uid ของคนที่ล็อกอินอยู่จริง (ผู้ใช้กรอกเองไม่ได้)
// กดยกเลิก → กลับ leave-requests.html โดยไม่บันทึกอะไร
//
// ปุ่ม "ให้ AI ช่วยจัดประเภทการลา" (US-09) — เรียก OpenRouter ด้วยรายชื่อ leaveTypes จริง
// ที่หน้านี้โหลดมาแล้ว + ข้อความเหตุผลการลา แล้วเติมค่า dropdown ให้ (ผู้ใช้แก้ไขเองได้เสมอ)
// เป็นแค่ตัวช่วยเติมค่า ไม่บันทึกอะไรลง Firestore เอง
// คีย์ (window.OPENROUTER_API_KEY, window.OPENROUTER_MODEL) มาจาก openrouter-key.local.js
// ที่โหลดแบบ <script> ธรรมดา (global) ก่อนสคริปต์นี้ — ดู new-leave-request.html
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
  var ปุ่มAIจัดประเภท = document.getElementById("ปุ่มAIจัดประเภท");
  var ป้ายข้อเสนอAI = document.getElementById("ป้ายข้อเสนอAI");
  var ข้อความAI = document.getElementById("ข้อความAI");
  var ข้อความปุ่มAIเดิม = ปุ่มAIจัดประเภท.textContent;
  var รายการประเภทการลาที่โหลดมา = [];

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

  ปุ่มAIจัดประเภท.addEventListener("click", function () {
    ให้AIจัดประเภทการลา();
  });

  // ผู้ใช้แก้ประเภทการลาที่ AI เลือกเองได้เสมอ — ถ้าแก้เอง ป้าย "ข้อเสนอจาก AI" ก็ไม่ควรค้างอยู่
  // (ตั้ง .value ด้วยโค้ดของเราเองจะไม่ทำให้ event นี้ทำงาน จึงไม่กระทบตอนเราเติมค่าให้)
  ช่องประเภทการลา.addEventListener("change", function () {
    ป้ายข้อเสนอAI.style.display = "none";
  });

  // ── อ่านประเภทการลาจริงจาก Firestore มาเติม dropdown (US-02) ──
  async function โหลดประเภทการลา() {
    try {
      var สแนปช็อต = await getDocs(collection(db, "leaveTypes"));
      var รายการประเภทการลา = [];
      สแนปช็อต.forEach(function (เอกสาร) {
        รายการประเภทการลา.push({ id: เอกสาร.id, name: เอกสาร.data().name });
      });

      รายการประเภทการลาที่โหลดมา = รายการประเภทการลา; // เก็บไว้ใช้ตอนส่งให้ AI จัดประเภท (US-09)

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

  // ── กดปุ่ม "ให้ AI ช่วยจัดประเภทการลา" (US-09) ──
  // อ่านช่องเหตุผล + รายชื่อ leaveTypes จริงที่โหลดมาแล้ว ส่งให้ OpenRouter เดาประเภทที่ตรงที่สุด
  // แค่เติมค่า dropdown ให้เท่านั้น ไม่บันทึกอะไรลง Firestore เอง และผู้ใช้แก้ค่าที่ AI เลือกได้เสมอ
  async function ให้AIจัดประเภทการลา() {
    ซ่อนข้อความAI();
    ป้ายข้อเสนอAI.style.display = "none";

    var เหตุผล = ช่องเหตุผล.value.trim();
    if (!เหตุผล) {
      แสดงข้อความAI("กรุณาพิมพ์เหตุผลการลาก่อน แล้วค่อยกดให้ AI ช่วยจัดประเภท");
      return;
    }

    if (!window.OPENROUTER_API_KEY) {
      แสดงข้อความAI(
        "ยังไม่ได้ตั้งค่าคีย์ OpenRouter (ไฟล์ openrouter-key.local.js) จึงเรียก AI ไม่ได้ กรุณาเลือกประเภทการลาเอง"
      );
      return;
    }

    if (รายการประเภทการลาที่โหลดมา.length === 0) {
      แสดงข้อความAI("ยังไม่มีประเภทการลาในระบบให้ AI เลือก");
      return;
    }

    ปุ่มAIจัดประเภท.disabled = true;
    ปุ่มAIจัดประเภท.textContent = "กำลังจัดประเภท...";

    var ตัวควบคุมการยกเลิก = new AbortController();
    var ตัวจับเวลาเกิน15วิ = setTimeout(function () {
      ตัวควบคุมการยกเลิก.abort();
    }, 15000);

    try {
      var รายชื่อประเภทเป็นข้อความ = รายการประเภทการลาที่โหลดมา
        .map(function (ประเภท) {
          return "id: " + ประเภท.id + " ชื่อ: " + ประเภท.name;
        })
        .join("\n");

      var พรอมป์ระบบ =
        'คุณเป็นผู้ช่วยจัดประเภทการลา รับรายชื่อประเภทการลา (id + ชื่อ) และข้อความเหตุผลการลา ' +
        'หน้าที่ของคุณคือเลือก "id" ของประเภทการลาที่ตรงกับเหตุผลมากที่สุดเพียงค่าเดียว ' +
        "ตอบกลับเฉพาะค่า id นั้นคำเดียว ห้ามมีคำอธิบายหรือข้อความอื่นปนมาเด็ดขาด " +
        'ถ้าไม่มีประเภทใดตรงกับเหตุผลเลย ให้ตอบกลับว่า "ไม่พบ" เท่านั้น';

      var พรอมป์ผู้ใช้ =
        "รายชื่อประเภทการลาที่มีอยู่จริงในระบบ:\n" +
        รายชื่อประเภทเป็นข้อความ +
        "\n\nเหตุผลการลาที่ผู้ขอลาพิมพ์:\n" +
        เหตุผล;

      var ผลตอบกลับ = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + window.OPENROUTER_API_KEY
        },
        body: JSON.stringify({
          model: window.OPENROUTER_MODEL,
          messages: [
            { role: "system", content: พรอมป์ระบบ },
            { role: "user", content: พรอมป์ผู้ใช้ }
          ]
        }),
        signal: ตัวควบคุมการยกเลิก.signal
      });

      if (!ผลตอบกลับ.ok) {
        throw new Error("เรียก AI ไม่สำเร็จ (สถานะ " + ผลตอบกลับ.status + ")");
      }

      var ข้อมูลตอบกลับ = await ผลตอบกลับ.json();
      var ข้อความจากAI =
        ข้อมูลตอบกลับ &&
        ข้อมูลตอบกลับ.choices &&
        ข้อมูลตอบกลับ.choices[0] &&
        ข้อมูลตอบกลับ.choices[0].message &&
        ข้อมูลตอบกลับ.choices[0].message.content;

      var รหัสที่AIเลือก = ข้อความจากAI ? String(ข้อความจากAI).trim() : "";

      var ประเภทที่ตรงกัน = รายการประเภทการลาที่โหลดมา.find(function (ประเภท) {
        return ประเภท.id === รหัสที่AIเลือก;
      });

      if (!ประเภทที่ตรงกัน) {
        แสดงข้อความAI("AI จัดประเภทให้ไม่ได้ กรุณาเลือกประเภทการลาเอง");
        return;
      }

      ช่องประเภทการลา.value = ประเภทที่ตรงกัน.id;
      ป้ายข้อเสนอAI.style.display = "";
    } catch (ข้อผิดพลาด) {
      if (ข้อผิดพลาด && ข้อผิดพลาด.name === "AbortError") {
        แสดงข้อความAI("เรียก AI ไม่สำเร็จ: รอนานเกิน 15 วินาที กรุณาเลือกประเภทการลาเอง");
      } else {
        แสดงข้อความAI("เรียก AI ไม่สำเร็จ กรุณาเลือกประเภทการลาเอง");
      }
    } finally {
      clearTimeout(ตัวจับเวลาเกิน15วิ);
      ปุ่มAIจัดประเภท.disabled = false;
      ปุ่มAIจัดประเภท.textContent = ข้อความปุ่มAIเดิม;
    }
  }

  function แสดงข้อความAI(ข้อความ) {
    ข้อความAI.textContent = ข้อความ;
    ข้อความAI.style.display = "";
  }
  function ซ่อนข้อความAI() {
    ข้อความAI.style.display = "none";
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
