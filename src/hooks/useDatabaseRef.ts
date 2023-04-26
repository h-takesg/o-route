import { FirebaseApp } from "firebase/app";
import { ref, getDatabase, DatabaseReference } from "firebase/database";
import { useState } from "react";

const useDatabaseRef = (firebaseApp: FirebaseApp, path: string) => {
  const [databaseRef] = useState<DatabaseReference>(() => {
    const database = getDatabase(firebaseApp);
    return ref(database, path);
  });
  return databaseRef;
};

export { useDatabaseRef };
