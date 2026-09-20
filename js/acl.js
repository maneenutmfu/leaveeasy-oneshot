// js/acl.js
// ตารางสิทธิ์กลางของระบบ อิงตาม ACL.md (คัดลอกมาจาก leaveeasy-spec.md หัวข้อ 2)
// ใช้ฝั่ง UI เท่านั้น (ซ่อนปุ่ม/เมนู/กรองรายการ) — เป็นแค่ชั้นกัน UX
// ตัวป้องกันข้อมูลจริงอยู่ที่ firestore.rules
//
// โหลดแบบ <script defer src="js/acl.js"></script> ธรรมดา (ไม่ใช่ module) — ประกาศเป็นฟังก์ชัน global
//
// ตรวจสิทธิ์(action, ctx) — ctx อาจมีช่องต่อไปนี้ แล้วแต่ action ที่ตรวจ:
//   role     - บทบาทของผู้ใช้ปัจจุบัน: "employee" | "manager" | "hr"
//   isOwner  - true ถ้าผู้ใช้ปัจจุบันเป็นเจ้าของใบลา/ข้อมูลที่กำลังพิจารณาอยู่
//   status   - สถานะปัจจุบันของใบลาที่กำลังพิจารณาอยู่ ("รอพิจารณา" | "อนุมัติ" | "ไม่อนุมัติ")

window.ตรวจสิทธิ์ = function (action, ctx) {
  ctx = ctx || {};
  const role = ctx.role;
  const เป็นผู้อนุมัติหรือฝ่ายบุคคล = role === "manager" || role === "hr";

  switch (action) {
    // ยื่นใบขอลาใหม่ — ทุกบทบาทที่ล็อกอินแล้วทำได้
    case "createRequest":
      return role === "employee" || role === "manager" || role === "hr";

    // ดูใบลาของตัวเอง — ทุกบทบาททำได้
    case "viewOwnRequests":
      return role === "employee" || role === "manager" || role === "hr";

    // ดูใบลาทุกใบในระบบ (ไม่ใช่แค่ของตัวเอง) — ผู้อนุมัติและฝ่ายบุคคลเท่านั้น
    case "viewAllRequests":
      return เป็นผู้อนุมัติหรือฝ่ายบุคคล;

    // เปิดดูรายละเอียดใบลาหนึ่งใบ — เจ้าของใบ หรือ ผู้อนุมัติ/ฝ่ายบุคคล
    case "viewRequestDetail":
      return เป็นผู้อนุมัติหรือฝ่ายบุคคล || ctx.isOwner === true;

    // เปลี่ยนสถานะใบลา (อนุมัติ/ไม่อนุมัติ) — ผู้อนุมัติ/ฝ่ายบุคคล และใบต้องยังรอพิจารณาอยู่เท่านั้น
    case "changeStatus":
      return เป็นผู้อนุมัติหรือฝ่ายบุคคล && ctx.status === "รอพิจารณา";

    // เขียนความเห็นการอนุมัติ — เจ้าของใบ หรือ ผู้อนุมัติ/ฝ่ายบุคคล
    case "addComment":
      return เป็นผู้อนุมัติหรือฝ่ายบุคคล || ctx.isOwner === true;

    // ลบใบลา — เจ้าของใบเท่านั้น และใบต้องยังรอพิจารณาอยู่เท่านั้น
    case "deleteRequest":
      return ctx.isOwner === true && ctx.status === "รอพิจารณา";

    // กำหนดผู้อนุมัติให้แต่ละใบ — ฝ่ายบุคคลเท่านั้น
    case "assignApprover":
      return role === "hr";

    // เพิ่ม / แก้ / ลบ ประเภทการลา — ฝ่ายบุคคลเท่านั้น
    case "manageLeaveTypes":
      return role === "hr";

    // ดูแดชบอร์ดสรุปทั้งระบบ — ฝ่ายบุคคลเท่านั้น
    case "viewDashboard":
      return role === "hr";

    default:
      return false;
  }
};
