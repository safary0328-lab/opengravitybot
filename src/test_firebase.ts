import admin from "firebase-admin";
import { readFileSync } from "fs";

async function testFirebase() {
  try {
    const serviceAccount = JSON.parse(readFileSync("./service-account.json", "utf8"));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const firestore = admin.firestore();
    console.log("Conectando a Firestore...");
    
    // Intentar escribir un documento de prueba (opcional) o listar colecciones
    const collections = await firestore.listCollections();
    console.log("¡Éxito! Conexión establecida. Colecciones encontradas:", collections.length);
    
    process.exit(0);
  } catch (err: any) {
    console.error("Error en la comprobación de Firebase:", err.message);
    process.exit(1);
  }
}

testFirebase();
