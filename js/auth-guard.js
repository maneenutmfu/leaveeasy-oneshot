// js/auth-guard.js
// ด่านตรวจล็อกอินที่ใช้ร่วมทุกหน้า
// โหลดแบบ <script defer src="js/auth-guard.js"></script> ธรรมดา (ไม่ใช่ module)
// ข้างในใช้ dynamic import() เพื่อคุยกับ Firebase Authentication/Firestore (โมดูล ES ผ่าน CDN)
//
// หมายเหตุทางเทคนิค: จับตำแหน่งไฟล์ตัวเอง (document.currentScript) ไว้ตั้งแต่ตอนโหลด
// แล้วใช้คำนวณ URL แบบ absolute ให้ import('./firebase-config.js') หา js/firebase-config.js เจอแน่นอน
// ไม่ว่าเบราว์เซอร์จะตีความ "base URL" ของ dynamic import ในสคริปต์ธรรมดาต่างกันอย่างไร

(function () {
  const ตำแหน่งไฟล์นี้ = document.currentScript
    ? document.currentScript.src
    : window.location.href;

  function หาไฟล์ในโฟลเดอร์เดียวกัน(ชื่อไฟล์) {
    return new URL(ชื่อไฟล์, ตำแหน่งไฟล์นี้).href;
  }

  const FIREBASE_CONFIG_URL = หาไฟล์ในโฟลเดอร์เดียวกัน("firebase-config.js");
  const FIREBASE_AUTH_URL = "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
  const FIREBASE_FIRESTORE_URL = "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

  // รอผู้ใช้ล็อกอิน() — คืนค่า Promise ที่ resolve เป็น Firebase user object
  // ถ้ายังไม่ได้ล็อกอิน จะเด้งไปหน้า login.html แล้วไม่ resolve (reject)
  window.รอผู้ใช้ล็อกอิน = function () {
    return new Promise(function (resolve, reject) {
      Promise.all([import(FIREBASE_CONFIG_URL), import(FIREBASE_AUTH_URL)])
        .then(function (modules) {
          const auth = modules[0].auth;
          const onAuthStateChanged = modules[1].onAuthStateChanged;
          let ยกเลิกฟัง = null;
          ยกเลิกฟัง = onAuthStateChanged(
            auth,
            function (user) {
              if (ยกเลิกฟัง) ยกเลิกฟัง();
              if (user) {
                resolve(user);
              } else {
                window.location.href = "login.html";
                reject(new Error("ยังไม่ได้ล็อกอิน"));
              }
            },
            function (err) {
              if (ยกเลิกฟัง) ยกเลิกฟัง();
              window.location.href = "login.html";
              reject(err);
            }
          );
        })
        .catch(function (err) {
          console.error("เชื่อมต่อ Firebase ไม่สำเร็จ:", err);
          if (window.showConfigWarning) window.showConfigWarning();
          reject(err);
        });
    });
  };

  // รอบทบาทผู้ใช้() — คืนค่า Promise ที่ resolve เป็น string บทบาท (role) ของผู้ใช้ที่ล็อกอินอยู่
  // อ่านจากไฟล์ users/{uid} ใน Firestore
  window.รอบทบาทผู้ใช้ = function () {
    return window.รอผู้ใช้ล็อกอิน().then(function (user) {
      return Promise.all([import(FIREBASE_CONFIG_URL), import(FIREBASE_FIRESTORE_URL)]).then(function (
        modules
      ) {
        const db = modules[0].db;
        const doc = modules[1].doc;
        const getDoc = modules[1].getDoc;
        return getDoc(doc(db, "users", user.uid)).then(function (snap) {
          return snap.exists() ? snap.data().role : null;
        });
      });
    });
  };
})();
