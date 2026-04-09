import { tools } from "./src/tools/index.js";

async function finalTest() {
  console.log("--- TEST DE INTEGRACIÓN MCP ---");
  
  try {
    const libraryName = "grammy";
    console.log(`Buscando ID para: ${libraryName}...`);
    
    const id = await tools.resolve_library_id.execute({ libraryName });
    console.log("Respuesta de ID:", id);

    if (id && !id.includes("Error")) {
      console.log("¡ÉXITO! Protocolo MCP verificado.");
    } else {
      console.log("Respuesta inesperada o error.");
    }
  } catch (e) {
    console.error("Error en el test:", e);
  }
}

finalTest();
