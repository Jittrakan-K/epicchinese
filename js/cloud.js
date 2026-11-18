/* ระบบบัญชีด้วย Firebase: PIN เป็นชื่อบัญชี รหัสผ่านเป็นรหัสผ่าน
   ความคืบหน้าทั้งหมดเก็บใน Firestore ที่ progress/{uid} อ่านเขียนได้เฉพาะเจ้าของ */
const V = '13.4.0';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
const cfg = window.FIREBASE_CONFIG;
const emit = () => window.dispatchEvent(new CustomEvent('cloud-change'));
const pinEmail = pin => `${pin}@pin.epicchinese.app`;
const pinOf = user => (user && user.email ? user.email.split('@')[0] : '');

const api = {
  configured: !!(cfg && cfg.apiKey),
  ready: false,
  user: null,
  pin: '',
  error: '',
  signIn: async () => { throw new Error('not-configured'); },
  signUp: async () => { throw new Error('not-configured'); },
  signOut: async () => {},
  load: async () => null,
  save: async () => {}
};
window.EpicCloud = api;

if (!api.configured) {
  api.ready = true;
  emit();
} else {
  try {
    const [{ initializeApp }, A, F] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore-lite.js`)
    ]);
    const app = initializeApp(cfg);
    const auth = A.getAuth(app);
    const db = F.getFirestore(app);
    await A.setPersistence(auth, A.browserLocalPersistence);
    const ref = () => F.doc(db, 'progress', auth.currentUser.uid);

    api.signIn = async (pin, pass) => (await A.signInWithEmailAndPassword(auth, pinEmail(pin), pass)).user;
    api.signUp = async (pin, pass) => (await A.createUserWithEmailAndPassword(auth, pinEmail(pin), pass)).user;
    api.signOut = () => A.signOut(auth);
    api.load = async () => {
      const snap = await F.getDoc(ref());
      if (!snap.exists()) return null;
      const d = snap.data();
      return { state: JSON.parse(d.data), updatedAt: d.updatedAt || 0 };
    };
    api.save = state => F.setDoc(ref(), { data: JSON.stringify(state), updatedAt: state.updatedAt || Date.now(), pin: pinOf(auth.currentUser) });

    A.onAuthStateChanged(auth, user => {
      api.user = user;
      api.pin = pinOf(user);
      api.ready = true;
      emit();
    });
  } catch (err) {
    api.configured = false;
    api.ready = true;
    api.error = 'load-failed';
    emit();
  }
}
