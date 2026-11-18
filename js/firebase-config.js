/* ตั้งค่า Firebase สำหรับระบบบัญชี PIN + รหัสผ่าน
   1. สร้างโปรเจกต์ที่ https://console.firebase.google.com
   2. Build → Authentication → Sign-in method → เปิด Email/Password
   3. Build → Firestore Database → Create database → แล้ววางกฎจากไฟล์ firestore.rules ในแท็บ Rules
   4. Project settings → Your apps → เพิ่มแอปแบบ Web (</>) → คัดลอก firebaseConfig มาแทน null ด้านล่าง
   5. Authentication → Settings → Authorized domains → เพิ่ม jittrakan-k.github.io
   ค่าเหล่านี้เปิดเผยได้ ความปลอดภัยมาจากกฎของ Firestore ไม่ใช่การซ่อน apiKey */
window.FIREBASE_CONFIG = null;
/* ตัวอย่างหลังวางแล้ว:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "epic-chinese.firebaseapp.com",
  projectId: "epic-chinese",
  storageBucket: "epic-chinese.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/
