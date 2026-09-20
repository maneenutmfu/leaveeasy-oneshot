// js/util.js
// ฟังก์ชันช่วยเหลือที่ใช้ร่วมกันทุกหน้า
// โหลดแบบ <script defer src="js/util.js"></script> ธรรมดา (ไม่ใช่ module) — ประกาศเป็นฟังก์ชัน global

// esc(str) — escape ตัวอักษรพิเศษของ HTML กันการโจมตีแบบ XSS
window.esc = function (str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// ป้ายสถานะ(status) — คืนค่า HTML ของป้ายสีตามสถานะใบลา
// รอพิจารณา = เหลือง · อนุมัติ = เขียว · ไม่อนุมัติ = แดง
window.ป้ายสถานะ = function (status) {
  const คลาสตามสถานะ = {
    "รอพิจารณา": "badge-yellow",
    "อนุมัติ": "badge-green",
    "ไม่อนุมัติ": "badge-red"
  };
  const คลาส = คลาสตามสถานะ[status] || "badge-yellow";
  return '<span class="badge ' + คลาส + '">' + window.esc(status) + "</span>";
};

// เวลาตอนนี้() — คืนค่าวันเวลาปัจจุบัน รูปแบบ YYYY-MM-DD HH:mm
window.เวลาตอนนี้ = function () {
  const ตอนนี้ = new Date();
  const เติมศูนย์ = function (n) {
    return String(n).padStart(2, "0");
  };
  return (
    ตอนนี้.getFullYear() +
    "-" +
    เติมศูนย์(ตอนนี้.getMonth() + 1) +
    "-" +
    เติมศูนย์(ตอนนี้.getDate()) +
    " " +
    เติมศูนย์(ตอนนี้.getHours()) +
    ":" +
    เติมศูนย์(ตอนนี้.getMinutes())
  );
};

// ค่าจากURL(name) — อ่านค่าพารามิเตอร์จาก query string ของ URL ปัจจุบัน
window.ค่าจากURL = function (name) {
  const พารามิเตอร์ = new URLSearchParams(window.location.search);
  return พารามิเตอร์.get(name);
};
