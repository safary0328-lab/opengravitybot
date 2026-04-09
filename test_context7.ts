import { resolve_library_id } from "./src/tools/resolve_library_id.js";
import { get_library_docs } from "./src/tools/get_library_docs.js";

async function testContext7() {
  console.log("--- INICIANDO TEST DE CONTEXT7 ---");
  
  // Paso 1: Resolver ID
  const libraryName = "@upstash/redis";
  const resolveResult = await resolve_library_id.execute({ libraryName });
  console.log("Resultado de resolución:", resolveResult);
  
  if (resolveResult.includes("Error") || resolveResult.includes("No se pudo")) {
    console.error("Fallo la resolución del ID.");
    return;
  }

  // Extraemos el ID si viene en formato JSON string o intentamos buscarlo
  // El MCP suele devolver texto, vamos a intentar usar el ID directamente si es corto
  const idMatch = resolveResult.match(/"([^"]+)"/);
  const libraryId = idMatch ? idMatch[1] : "@upstash/redis";

  // Paso 2: Obtener documentación
  console.log(`--- Obteniendo docs para ID: ${libraryId} ---`);
  const docsResult = await get_library_docs.execute({ 
    libraryId, 
    topic: "getting started" 
  });
  
  console.log("Muestra de los docs recibidos (primeros 500 caracteres):");
  console.log(docsResult.substring(0, 500) + "...");
}

testContext7();
