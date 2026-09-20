// ─────────────────────────────────────────────────────────────
// js/leave-request-detail.js — หน้าที่ 3 รายละเอียดใบลา
//   US-03 แสดงรายละเอียดใบลาครบทุกช่อง + รายการความเห็น
//   US-04 เปลี่ยนสถานะ (อนุมัติ / ไม่อนุมัติ) — แก้เฉพาะช่อง status
//   US-05 เขียนความเห็นการอนุมัติ ลงโฟลเดอร์ย่อย approvals
//   US-07 ลบใบลาของตัวเอง (เฉพาะสถานะ รอพิจารณา)
//   สัปดาห์ที่ 8 — AI ช่วยสรุปใบลาให้หัวหน้าอ่านก่อนกดอนุมัติ (ช่อง aiSuggestion + โฟลเดอร์ย่อย aiLog)
//
// ใช้ฟังก์ชัน global จาก js/util.js, js/nav.js, js/auth-guard.js ตรง ๆ ไม่ import
// เพราะสคริปต์เหล่านั้นโหลดแบบ <script defer> ธรรมดา (ดู CLAUDE.md)
// ─────────────────────────────────────────────────────────────

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(async function () {
  var รหัสใบลา = ค่าจากURL("id");
  var กล่องรายละเอียดใบลา = document.getElementById("กล่องรายละเอียดใบลา");
  var กล่องการดำเนินการ = document.getElementById("กล่องการดำเนินการ");
  var กล่องความเห็น = document.getElementById("กล่องความเห็น");
  var รายการความเห็นEl = document.getElementById("รายการความเห็น");
  var เนื้อหาสรุปAI = document.getElementById("เนื้อหาสรุปAI");
  var ปุ่มสรุปAI = document.getElementById("ปุ่มสรุปAI");
  var ข้อความปุ่มสรุปAIปกติ = ปุ่มสรุปAI ? ปุ่มสรุปAI.textContent : "ให้ AI ช่วยสรุปใบลา";

  var ผู้ใช้ = await รอผู้ใช้ล็อกอิน();
  var บทบาท = await รอบทบาทผู้ใช้();

  if (typeof ปรับเมนูตามบทบาท === "function") {
    ปรับเมนูตามบทบาท(บทบาท);
  }

  if (!รหัสใบลา) {
    กล่องรายละเอียดใบลา.innerHTML = "<p>ไม่พบใบขอลาที่ต้องการ — ลิงก์ไม่ถูกต้อง</p>";
    return;
  }

  var ใบลา = null;
  var รายการความเห็น = [];
  var ชื่อผู้ใช้ปัจจุบัน = await หาชื่อผู้ใช้ปัจจุบัน(ผู้ใช้.uid);

  await โหลดใบลา();

  // ── โหลดใบลา 1 ใบจาก Firestore แล้ววาดทุกส่วนของหน้า ──
  async function โหลดใบลา() {
    try {
      var สแนปช็อต = await getDoc(doc(db, "leaveRequests", รหัสใบลา));
      if (!สแนปช็อต.exists()) {
        กล่องรายละเอียดใบลา.innerHTML = "<p>ไม่พบใบขอลาที่ต้องการ — อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง</p>";
        return;
      }
      ใบลา = Object.assign({}, สแนปช็อต.data(), { id: สแนปช็อต.id });

      // ผู้ขอลาเปิดใบของคนอื่นไม่ได้ (ชั้นกัน UX เท่านั้น อิง js/acl.js ตัวป้องกันจริงอยู่ที่ firestore.rules)
      var เป็นเจ้าของใบลาเพื่อดู = ใบลา.requesterId === ผู้ใช้.uid;
      var เห็นรายละเอียดได้ = เรียกตรวจสิทธิ์(
        "viewRequestDetail",
        { role: บทบาท, isOwner: เป็นเจ้าของใบลาเพื่อดู },
        บทบาท !== "employee" || เป็นเจ้าของใบลาเพื่อดู
      );
      if (!เห็นรายละเอียดได้) {
        กล่องรายละเอียดใบลา.innerHTML = "<p>คุณไม่มีสิทธิ์ดูใบลานี้</p>";
        return;
      }

      await โหลดความเห็น();
      วาดรายละเอียด();
      วาดปุ่มดำเนินการ();
      วาดความเห็น();
      วาดสรุปAI();
      กล่องความเห็น.style.display = "";
      ผูกเหตุการณ์ส่งความเห็น();
      ผูกเหตุการณ์สรุปAI();
    } catch (ข้อผิดพลาด) {
      กล่องรายละเอียดใบลา.innerHTML =
        "<p>โหลดข้อมูลใบลาไม่สำเร็จ: " + esc(ข้อผิดพลาด.message) + "</p>";
    }
  }

  // ── อ่านความเห็นการอนุมัติจากโฟลเดอร์ย่อย approvals ของใบนี้ เรียงเก่า→ใหม่ ──
  async function โหลดความเห็น() {
    try {
      var ตัวสืบค้น = query(
        collection(db, "leaveRequests", รหัสใบลา, "approvals"),
        orderBy("createdAt", "asc")
      );
      var สแนปช็อต = await getDocs(ตัวสืบค้น);
      รายการความเห็น = [];
      สแนปช็อต.forEach(function (เอกสาร) {
        รายการความเห็น.push(Object.assign({}, เอกสาร.data(), { id: เอกสาร.id }));
      });
    } catch (ข้อผิดพลาด) {
      // เผื่อ orderBy ใช้ไม่ได้ (เช่น field createdAt ยังไม่มีในบางเอกสาร) — ดึงมาทั้งหมดแล้วเรียงเอง
      try {
        var สแนปช็อตสำรอง = await getDocs(collection(db, "leaveRequests", รหัสใบลา, "approvals"));
        รายการความเห็น = [];
        สแนปช็อตสำรอง.forEach(function (เอกสาร) {
          รายการความเห็น.push(Object.assign({}, เอกสาร.data(), { id: เอกสาร.id }));
        });
        รายการความเห็น.sort(function (a, b) {
          return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        });
      } catch (ข้อผิดพลาด2) {
        รายการความเห็น = [];
      }
    }
  }

  // ── วาดข้อมูลใบลาครบทุกช่องตาม US-03 ──
  function วาดรายละเอียด() {
    var แถว = [
      ["หัวข้อ", esc(ใบลา.title)],
      ["เหตุผล", esc(ใบลา.reason)],
      ["ประเภทการลา", esc(ใบลา.leaveTypeName)],
      ["วันที่เริ่มลา", esc(ใบลา.startDate)],
      ["วันที่สิ้นสุด", esc(ใบลา.endDate)],
      ["ผู้ขอลา", esc(ใบลา.requesterName)],
      ["ผู้อนุมัติ", ใบลา.approverId ? esc(ใบลา.approverName) : "ยังไม่ได้กำหนดผู้อนุมัติ"],
      ["สถานะ", ป้ายสถานะ(ใบลา.status)],
      ["วันที่ยื่น", esc(ใบลา.createdAt)]
    ];

    กล่องรายละเอียดใบลา.innerHTML = แถว
      .map(function (คู่) {
        return (
          '<div class="form-group">' +
          "<strong>" + คู่[0] + "</strong><br>" +
          "<span>" + คู่[1] + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  // ── วาดปุ่มอนุมัติ/ไม่อนุมัติ/ลบ ตามสิทธิ์และสถานะปัจจุบัน (US-04, US-07, หัวข้อ 6) ──
  function วาดปุ่มดำเนินการ() {
    var รอพิจารณาอยู่ = ใบลา.status === "รอพิจารณา";
    var เป็นเจ้าของใบลา = ใบลา.requesterId === ผู้ใช้.uid;

    // เปลี่ยนสถานะได้เฉพาะ manager/hr และเฉพาะตอนที่ใบยังรอพิจารณาอยู่เท่านั้น (หัวข้อ 6)
    // ใช้ js/acl.js (ตรวจสิทธิ์) ช่วยตัดสินใจ ถ้าเรียกไม่ได้ ใช้ค่าที่คำนวณตรงตามสเปกแทน
    var เห็นปุ่มเปลี่ยนสถานะ = เรียกตรวจสิทธิ์(
      "changeStatus",
      { role: บทบาท, status: ใบลา.status },
      รอพิจารณาอยู่ && (บทบาท === "manager" || บทบาท === "hr")
    );

    // ลบได้เฉพาะเจ้าของใบเองและเฉพาะตอนที่ยังรอพิจารณาอยู่เท่านั้น (US-07)
    var เห็นปุ่มลบ = เรียกตรวจสิทธิ์(
      "deleteRequest",
      { role: บทบาท, isOwner: เป็นเจ้าของใบลา, status: ใบลา.status },
      รอพิจารณาอยู่ && เป็นเจ้าของใบลา
    );

    var html = "";
    if (เห็นปุ่มเปลี่ยนสถานะ) {
      // data-roles ให้ js/nav.js (ปรับเมนูตามบทบาท) ช่วยซ่อนซ้ำอีกชั้นถ้าบทบาทไม่ตรง
      html +=
        '<p data-roles="manager,hr">' +
        '<button type="button" class="btn btn-primary" id="ปุ่มอนุมัติ">อนุมัติ</button> ' +
        '<button type="button" class="btn btn-danger" id="ปุ่มไม่อนุมัติ">ไม่อนุมัติ</button>' +
        "</p>";
    }
    if (เห็นปุ่มลบ) {
      html += '<p><button type="button" class="btn btn-danger" id="ปุ่มลบ">ลบใบลานี้</button></p>';
    }
    if (!รอพิจารณาอยู่) {
      html += "<p>ใบนี้พิจารณาผลแล้ว จึงเปลี่ยนสถานะหรือลบต่อไม่ได้</p>";
    }

    กล่องการดำเนินการ.innerHTML = html;

    if (เห็นปุ่มเปลี่ยนสถานะ) {
      document.getElementById("ปุ่มอนุมัติ").addEventListener("click", function () {
        เปลี่ยนสถานะ("อนุมัติ");
      });
      document.getElementById("ปุ่มไม่อนุมัติ").addEventListener("click", function () {
        เปลี่ยนสถานะ("ไม่อนุมัติ");
      });
    }
    if (เห็นปุ่มลบ) {
      document.getElementById("ปุ่มลบ").addEventListener("click", ลบใบลา);
    }

    // เผื่อ data-roles ที่เพิ่งวาดใหม่ต้องถูกซ่อน/แสดงตามบทบาทอีกครั้ง
    if (typeof ปรับเมนูตามบทบาท === "function") {
      ปรับเมนูตามบทบาท(บทบาท);
    }
  }

  // ── เปลี่ยนสถานะ — แก้เฉพาะช่อง status เท่านั้น ห้ามเขียนทับช่องอื่น (US-04, หัวข้อ 6) ──
  async function เปลี่ยนสถานะ(สถานะใหม่) {
    if (ใบลา.status !== "รอพิจารณา") return; // ปลายทางแล้ว เปลี่ยนต่อไม่ได้

    // การเปลี่ยนเป็น "ไม่อนุมัติ" ต้องมีความเห็นอย่างน้อย 1 รายการก่อน (หัวข้อ 6)
    if (สถานะใหม่ === "ไม่อนุมัติ" && รายการความเห็น.length === 0) {
      alert("ต้องเขียนความเห็นอย่างน้อย 1 รายการก่อน จึงจะกดไม่อนุมัติได้");
      return;
    }

    var ปุ่มอนุมัติ = document.getElementById("ปุ่มอนุมัติ");
    var ปุ่มไม่อนุมัติ = document.getElementById("ปุ่มไม่อนุมัติ");
    if (ปุ่มอนุมัติ) ปุ่มอนุมัติ.disabled = true;
    if (ปุ่มไม่อนุมัติ) ปุ่มไม่อนุมัติ.disabled = true;

    try {
      await updateDoc(doc(db, "leaveRequests", รหัสใบลา), { status: สถานะใหม่ });
      ใบลา.status = สถานะใหม่; // แก้เฉพาะตัวแปรในหน้าจอให้ตรงกับที่บันทึกจริง
      วาดรายละเอียด();
      วาดปุ่มดำเนินการ();
    } catch (ข้อผิดพลาด) {
      alert("เปลี่ยนสถานะไม่สำเร็จ: " + ข้อผิดพลาด.message);
      if (ปุ่มอนุมัติ) ปุ่มอนุมัติ.disabled = false;
      if (ปุ่มไม่อนุมัติ) ปุ่มไม่อนุมัติ.disabled = false;
    }
  }

  // ── ลบใบลา — ต้องยืนยันก่อนเสมอ (US-07) ──
  async function ลบใบลา() {
    if (ใบลา.status !== "รอพิจารณา") return;
    if (!confirm('ยืนยันการลบใบลา "' + ใบลา.title + '" หรือไม่ — ลบแล้วกู้คืนไม่ได้')) return;

    var ปุ่มลบ = document.getElementById("ปุ่มลบ");
    if (ปุ่มลบ) ปุ่มลบ.disabled = true;

    try {
      await deleteDoc(doc(db, "leaveRequests", รหัสใบลา));
      location.href = "leave-requests.html";
    } catch (ข้อผิดพลาด) {
      alert("ลบใบลาไม่สำเร็จ: " + ข้อผิดพลาด.message);
      if (ปุ่มลบ) ปุ่มลบ.disabled = false;
    }
  }

  // ── วาดรายการความเห็น เรียงเก่า→ใหม่ (US-05) ──
  function วาดความเห็น() {
    if (รายการความเห็น.length === 0) {
      รายการความเห็นEl.innerHTML = "<p>ยังไม่มีความเห็นในใบนี้</p>";
      return;
    }
    รายการความเห็นEl.innerHTML = รายการความเห็น
      .map(function (ความเห็น) {
        return (
          '<div class="form-group">' +
          "<strong>" + esc(ความเห็น.authorName) + "</strong> · " +
          "<span>" + esc(ความเห็น.createdAt) + "</span><br>" +
          "<span>" + esc(ความเห็น.message) + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function ผูกเหตุการณ์ส่งความเห็น() {
    var ปุ่มส่งความเห็น = document.getElementById("ปุ่มส่งความเห็น");
    if (ปุ่มส่งความเห็น) {
      ปุ่มส่งความเห็น.addEventListener("click", ส่งความเห็น);
    }
  }

  // ── ส่งความเห็นใหม่ลงโฟลเดอร์ย่อย approvals ของใบนี้ (US-05) ──
  async function ส่งความเห็น() {
    var ช่องข้อความ = document.getElementById("ข้อความความเห็นใหม่");
    var ข้อความ = (ช่องข้อความ.value || "").trim();

    if (!ข้อความ) {
      alert("กรุณาพิมพ์ข้อความความเห็นก่อนกดส่ง");
      return;
    }

    var ปุ่มส่งความเห็น = document.getElementById("ปุ่มส่งความเห็น");
    ปุ่มส่งความเห็น.disabled = true;

    var ความเห็นใหม่ = {
      authorId: ผู้ใช้.uid,
      authorName: ชื่อผู้ใช้ปัจจุบัน,
      message: ข้อความ,
      createdAt: เวลาตอนนี้()
    };

    try {
      var อ้างอิงใหม่ = await addDoc(
        collection(db, "leaveRequests", รหัสใบลา, "approvals"),
        ความเห็นใหม่
      );
      รายการความเห็น.push(Object.assign({}, ความเห็นใหม่, { id: อ้างอิงใหม่.id }));
      ช่องข้อความ.value = "";
      วาดความเห็น();
      วาดปุ่มดำเนินการ(); // มีความเห็นแล้วอาจทำให้กดไม่อนุมัติได้ตอนนี้
    } catch (ข้อผิดพลาด) {
      alert("ส่งความเห็นไม่สำเร็จ: " + ข้อผิดพลาด.message);
    } finally {
      ปุ่มส่งความเห็น.disabled = false;
    }
  }

  // ── วาดส่วน "สรุปจาก AI" ตามช่อง aiSuggestion ของใบลา (สัปดาห์ที่ 8) ──
  function วาดสรุปAI() {
    if (!เนื้อหาสรุปAI) return;
    if (ใบลา.aiSuggestion) {
      เนื้อหาสรุปAI.innerHTML =
        "<p><strong>ข้อเสนอจาก AI — โปรดตรวจสอบก่อนตัดสินใจ</strong></p>" +
        "<p>" + esc(ใบลา.aiSuggestion) + "</p>";
    } else {
      เนื้อหาสรุปAI.innerHTML = "<p>ยังไม่มีสรุปจาก AI</p>";
    }
  }

  function ผูกเหตุการณ์สรุปAI() {
    if (ปุ่มสรุปAI) {
      ปุ่มสรุปAI.addEventListener("click", เรียกAIสรุปใบลา);
    }
  }

  // ── กดปุ่ม "ให้ AI ช่วยสรุปใบลา" — เรียก OpenRouter แล้วบันทึกผลลง aiSuggestion + aiLog เสมอ ──
  // เห็นปุ่มนี้เฉพาะ manager/hr (data-roles="manager,hr" ในหน้า HTML + ปรับเมนูตามบทบาท() ช่วยซ่อน)
  // แก้เฉพาะช่อง aiSuggestion เท่านั้น ห้ามแตะช่องอื่นของ leaveRequests (ตรงกับ firestore.rules)
  async function เรียกAIสรุปใบลา() {
    if (!ปุ่มสรุปAI || ปุ่มสรุปAI.disabled) return;

    ปุ่มสรุปAI.disabled = true;
    ปุ่มสรุปAI.textContent = "กำลังสรุป...";

    if (!window.OPENROUTER_API_KEY) {
      alert("ยังไม่ได้ตั้งค่าคีย์ OpenRouter (window.OPENROUTER_API_KEY) — กรุณาตั้งค่าก่อนใช้งาน AI สรุปใบลา");
      ปุ่มสรุปAI.disabled = false;
      ปุ่มสรุปAI.textContent = ข้อความปุ่มสรุปAIปกติ;
      return;
    }

    var ข้อความที่ส่งให้AI =
      "ช่วยสรุปใบลาต่อไปนี้สั้น ๆ 2-3 ประโยค เป็นภาษาไทย ให้หัวหน้าอ่านก่อนตัดสินใจอนุมัติหรือไม่อนุมัติ:\n" +
      "หัวข้อ: " + (ใบลา.title || "") + "\n" +
      "ประเภทการลา: " + (ใบลา.leaveTypeName || "") + "\n" +
      "ช่วงวันที่: " + (ใบลา.startDate || "") + " ถึง " + (ใบลา.endDate || "") + "\n" +
      "เหตุผล: " + (ใบลา.reason || "");

    var ผลลัพธ์AI = null;
    var ข้อความข้อผิดพลาด = null;

    var ตัวควบคุมยกเลิก = new AbortController();
    var ตัวจับเวลา = setTimeout(function () {
      ตัวควบคุมยกเลิก.abort();
    }, 15000);

    try {
      var การตอบกลับ = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + window.OPENROUTER_API_KEY
        },
        body: JSON.stringify({
          model: window.OPENROUTER_MODEL,
          messages: [{ role: "user", content: ข้อความที่ส่งให้AI }]
        }),
        signal: ตัวควบคุมยกเลิก.signal
      });

      if (!การตอบกลับ.ok) {
        throw new Error("เรียก AI ไม่สำเร็จ (HTTP " + การตอบกลับ.status + ")");
      }

      var ข้อมูลตอบกลับ = await การตอบกลับ.json();
      ผลลัพธ์AI =
        ข้อมูลตอบกลับ &&
        ข้อมูลตอบกลับ.choices &&
        ข้อมูลตอบกลับ.choices[0] &&
        ข้อมูลตอบกลับ.choices[0].message &&
        ข้อมูลตอบกลับ.choices[0].message.content;
      ผลลัพธ์AI = (ผลลัพธ์AI || "").trim();

      if (!ผลลัพธ์AI) {
        throw new Error("AI ไม่ได้ตอบข้อความสรุปกลับมา");
      }

      // แก้เฉพาะช่อง aiSuggestion เท่านั้น (firestore.rules อนุญาตเฉพาะช่องนี้ในกรณีนี้)
      await updateDoc(doc(db, "leaveRequests", รหัสใบลา), { aiSuggestion: ผลลัพธ์AI });
      ใบลา.aiSuggestion = ผลลัพธ์AI;
      วาดสรุปAI();
    } catch (ข้อผิดพลาด) {
      ข้อความข้อผิดพลาด =
        ข้อผิดพลาด && ข้อผิดพลาด.name === "AbortError"
          ? "หมดเวลารอคำตอบจาก AI (เกิน 15 วินาที) กรุณาลองใหม่อีกครั้ง"
          : "เรียก AI สรุปใบลาไม่สำเร็จ: " +
            (ข้อผิดพลาด && ข้อผิดพลาด.message ? ข้อผิดพลาด.message : String(ข้อผิดพลาด));
      alert(ข้อความข้อผิดพลาด);
    } finally {
      clearTimeout(ตัวจับเวลา);

      // บันทึกทุกครั้งที่เรียก AI ไม่ว่าสำเร็จหรือล้มเหลว (audit log — ห้ามแก้/ลบภายหลัง)
      try {
        await addDoc(collection(db, "leaveRequests", รหัสใบลา, "aiLog"), {
          input: ข้อความที่ส่งให้AI,
          output: ผลลัพธ์AI || ข้อความข้อผิดพลาด || "ไม่ทราบสาเหตุ",
          createdAt: เวลาตอนนี้()
        });
      } catch (ข้อผิดพลาดบันทึกล็อก) {
        // การบันทึกล็อกล้มเหลว ไม่ควรทำให้หน้าใช้งานต่อไม่ได้ ปล่อยผ่านเงียบ ๆ
      }

      ปุ่มสรุปAI.disabled = false;
      ปุ่มสรุปAI.textContent = ข้อความปุ่มสรุปAIปกติ;
    }
  }

  // ── เรียก ตรวจสิทธิ์() จาก js/acl.js อย่างปลอดภัย ──
  // ถ้ายังไม่มีฟังก์ชันนี้ หรือเรียกแล้วพัง ให้ใช้ค่าเริ่มต้นที่คำนวณตรงตามสเปกแทน
  // (ชั้นนี้เป็นแค่ชั้นกัน UX เท่านั้น ตัวป้องกันข้อมูลจริงอยู่ที่ firestore.rules)
  function เรียกตรวจสิทธิ์(action, ctx, ค่าเริ่มต้น) {
    if (typeof ตรวจสิทธิ์ !== "function") return ค่าเริ่มต้น;
    try {
      return !!ตรวจสิทธิ์(action, ctx);
    } catch (ข้อผิดพลาด) {
      return ค่าเริ่มต้น;
    }
  }

  // ── หาชื่อไทยของผู้ใช้ที่ล็อกอินอยู่ จากโฟลเดอร์ users (ใช้เป็น authorName ตอนเขียนความเห็น) ──
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
