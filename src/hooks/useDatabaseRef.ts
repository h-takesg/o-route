import { FirebaseApp } from "firebase/app";
import { ref, getDatabase, DatabaseReference } from "firebase/database"
import { useEffect, useState } from "react"

const useDatabaseRef = (firebaseApp: FirebaseApp, path: string) => {
  const [databaseRef, setDatabaseRef] = useState<DatabaseReference>(() => {
    const database = getDatabase(firebaseApp);
    return ref(database, path);
  });
  return databaseRef;
};

export {useDatabaseRef};
