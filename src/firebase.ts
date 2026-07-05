import { initializeApp } from "firebase/app";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCs6u1FqePbYk1b5dx8NcICCH7Xc8zUjBg",
  authDomain: "o-route.firebaseapp.com",
  databaseURL:
    "https://o-route-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "o-route",
  storageBucket: "o-route.appspot.com",
  messagingSenderId: "110047467361",
  appId: "1:110047467361:web:16cbf4ad30cf8940ef1720",
};

const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_DATABASE_PORT = 9000;
const EMULATOR_STORAGE_PORT = 9199;

let emulatorsConnected = false;

function connectFirebaseEmulators() {
  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR !== "true" || emulatorsConnected) {
    return;
  }

  connectDatabaseEmulator(
    getDatabase(firebaseApp),
    EMULATOR_HOST,
    EMULATOR_DATABASE_PORT,
  );
  connectStorageEmulator(
    getStorage(firebaseApp),
    EMULATOR_HOST,
    EMULATOR_STORAGE_PORT,
  );
  emulatorsConnected = true;
}

const firebaseApp = initializeApp(firebaseConfig);
connectFirebaseEmulators();

export { firebaseApp };
