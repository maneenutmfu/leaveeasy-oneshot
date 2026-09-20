// js/nav.js
// วาดแถบเมนูด้านบนลงใน <div id="nav"></div> ของทุกหน้า (ยกเว้น login.html / signup.html)
// โหลดแบบ <script defer src="js/nav.js"></script> ธรรมดา (ไม่ใช่ module)
//
// กำหนดฟังก์ชัน global:
//   ปรับเมนูตามบทบาท(role) — ซ่อนลิงก์เมนู/element ใด ๆ ในหน้าที่มี data-roles="a,b" ถ้า role ปัจจุบันไม่อยู่ในรายการ
//   showConfigWarning()   — โชว์แถบเตือนถ้ายังไม่ได้ตั้งค่า Firebase/Firestore

(function () {
  const ตำแหน่งไฟล์นี้ = document.currentScript
    ? document.currentScript.src
    : window.location.href;

  function หาไฟล์ในโฟลเดอร์เดียวกัน(ชื่อไฟล์) {
    return new URL(ชื่อไฟล์, ตำแหน่งไฟล์นี้).href;
  }

  const FIREBASE_CONFIG_URL = หาไฟล์ในโฟลเดอร์เดียวกัน("firebase-config.js");
  const FIREBASE_AUTH_URL = "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

  const รายการเมนู = [
    { href: "leave-requests.html", label: "รายการใบลา" },
    { href: "new-leave-request.html", label: "ยื่นใบลาใหม่" },
    { href: "leave-types.html", label: "ประเภทการลา", roles: "hr" },
    { href: "dashboard.html", label: "แดชบอร์ด", roles: "hr" },
    { href: "index.html", label: "หน้าแรก" }
  ];

  function ชื่อไฟล์ปัจจุบัน() {
    const ส่วนของพาธ = window.location.pathname.split("/");
    return ส่วนของพาธ[ส่วนของพาธ.length - 1] || "index.html";
  }

  function วาดเมนู() {
    const nav = document.getElementById("nav");
    if (!nav) return;

    const หน้าปัจจุบัน = ชื่อไฟล์ปัจจุบัน();
    let html = '<nav class="navbar">';
    html += '<div class="navbar-brand"><a href="index.html">🔧 LeaveEasy</a></div>';
    html += '<button type="button" class="navbar-toggle" id="ปุ่มเปิดเมนู" aria-label="เปิดเมนู">☰</button>';
    html += '<div class="navbar-links" id="รายการลิงก์เมนู">';

    รายการเมนู.forEach(function (item) {
      const คลาสไฮไลต์ = item.href === หน้าปัจจุบัน ? " active" : "";
      const dataRoles = item.roles ? ' data-roles="' + item.roles + '"' : "";
      html +=
        '<a class="navbar-link' +
        คลาสไฮไลต์ +
        '" href="' +
        item.href +
        '"' +
        dataRoles +
        ">" +
        item.label +
        "</a>";
    });

    html += '<button type="button" class="btn btn-secondary btn-nav" id="ปุ่มออกจากระบบ">ออกจากระบบ</button>';
    html += "</div></nav>";

    nav.innerHTML = html;

    const ปุ่มเปิดเมนู = document.getElementById("ปุ่มเปิดเมนู");
    const รายการลิงก์ = document.getElementById("รายการลิงก์เมนู");
    if (ปุ่มเปิดเมนู && รายการลิงก์) {
      ปุ่มเปิดเมนู.addEventListener("click", function () {
        รายการลิงก์.classList.toggle("open");
      });
    }

    const ปุ่มออกจากระบบ = document.getElementById("ปุ่มออกจากระบบ");
    if (ปุ่มออกจากระบบ) {
      ปุ่มออกจากระบบ.addEventListener("click", ออกจากระบบ);
    }
  }

  async function ออกจากระบบ() {
    try {
      const [{ auth }, { signOut }] = await Promise.all([
        import(FIREBASE_CONFIG_URL),
        import(FIREBASE_AUTH_URL)
      ]);
      await signOut(auth);
    } catch (err) {
      console.error("ออกจากระบบไม่สำเร็จ:", err);
    }
    window.location.href = "login.html";
  }

  // ฟังก์ชัน global — หน้าอื่นเรียกใช้ตรง ๆ หลังจากรู้ role ของผู้ใช้แล้ว (จาก รอบทบาทผู้ใช้())
  window.ปรับเมนูตามบทบาท = function (role) {
    document.querySelectorAll("[data-roles]").forEach(function (el) {
      const รายการที่อนุญาต = el
        .getAttribute("data-roles")
        .split(",")
        .map(function (r) {
          return r.trim();
        });
      el.style.display = รายการที่อนุญาต.indexOf(role) === -1 ? "none" : "";
    });
  };

  window.showConfigWarning = function () {
    let กล่องเตือน = document.getElementById("คำเตือนตั้งค่า");
    if (!กล่องเตือน) {
      กล่องเตือน = document.createElement("div");
      กล่องเตือน.id = "คำเตือนตั้งค่า";
      กล่องเตือน.className = "config-warning";
      กล่องเตือน.textContent =
        "⚠️ ยังไม่ได้ตั้งค่าการเชื่อมต่อ Firebase/Firestore — กรุณาตรวจสอบไฟล์ js/firebase-config.js ก่อนใช้งาน";
      document.body.insertBefore(กล่องเตือน, document.body.firstChild);
    }
    กล่องเตือน.style.display = "block";
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", วาดเมนู);
  } else {
    วาดเมนู();
  }
})();
