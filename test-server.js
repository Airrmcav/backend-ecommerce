const axios = require("axios");
const fs = require("fs");
const path = require("path");

// CONFIGURACIÓN
const LOCAL_STRAPI_URL = "http://localhost:1337";
const REMOTE_STRAPI_URL = "https://ecommerce-salmetex-backend.onrender.com";
const REMOTE_API_TOKEN = "b897022746945f38da90da87dd599db391ea0f10d7919c1d2b0f2ced7aadc750409f70f65fa3627e917cb1b165d75b52acc8e6c1f504b0e9d35ed02678afa1f7bf9a4aa420915bd9afa81cbb38576912e6fe928495f305333b63f26716b408f24ba9bc2f0e397ca47fb62e8b66332b3c46a11a3a92ea023f8f2ebd7fb2dc567b"; // ← PEGA TU TOKEN
const TEMP_DOWNLOAD_DIR = "./tmp_uploads";

async function inspectAndTransfer() {
  console.log("🔍 INSPECCIÓN Y TRANSFERENCIA DIRECTA");
  console.log("=".repeat(60));
  
  if (REMOTE_API_TOKEN === "b897022746945f38da90da87dd599db391ea0f10d7919c1d2b0f2ced7aadc750409f70f65fa3627e917cb1b165d75b52acc8e6c1f504b0e9d35ed02678afa1f7bf9a4aa420915bd9afa81cbb38576912e6fe928495f305333b63f26716b408f24ba9bc2f0e397ca47fb62e8b66332b3c46a11a3a92ea023f8f2ebd7fb2dc567b") {
    console.error("❌ Por favor actualiza REMOTE_API_TOKEN en el script");
    return;
  }
  
  if (!fs.existsSync(TEMP_DOWNLOAD_DIR)) {
    fs.mkdirSync(TEMP_DOWNLOAD_DIR, { recursive: true });
  }

  const collections = ['categories', 'products', 'orders']; // Removemos users por el 403

  for (const collection of collections) {
    console.log(`\n📦 PROCESANDO: ${collection.toUpperCase()}`);
    console.log("-".repeat(50));

    try {
      // 1. Obtener datos locales
      console.log("📥 Obteniendo datos locales...");
      const localResponse = await axios.get(
        `${LOCAL_STRAPI_URL}/api/${collection}?pagination[pageSize]=1000&populate=*`,
        { timeout: 15000 }
      );

      const items = localResponse.data?.data || [];
      console.log(`📊 Encontrados ${items.length} registros`);

      if (items.length === 0) {
        console.log("⚠️ No hay datos que transferir");
        continue;
      }

      // 2. Mostrar estructura del primer elemento
      const firstItem = items[0];
      console.log("\n🔍 ESTRUCTURA DEL PRIMER ELEMENTO:");
      console.log("Campos disponibles:", Object.keys(firstItem.attributes));
      console.log("Muestra de datos:", JSON.stringify(firstItem.attributes, null, 2));

      // 3. Intentar diferentes variaciones de campos para encontrar la correcta
      console.log("\n🧪 PROBANDO DIFERENTES ESTRUCTURAS DE CAMPOS...");
      
      const sampleData = firstItem.attributes;
      const testVariations = [];
      
      // Variación 1: campos exactos como están
      testVariations.push({ ...sampleData });
      
      // Variación 2: solo campos básicos comunes
      if (sampleData.name) {
        testVariations.push({ 
          name: sampleData.name,
          description: sampleData.description || "Sin descripción"
        });
      }
      
      // Variación 3: campos con mayúsculas
      if (sampleData.name) {
        testVariations.push({
          Name: sampleData.name,
          Description: sampleData.description || "Sin descripción"
        });
      }
      
      // Para products, agregar precio
      if (collection === 'products' && sampleData.price !== undefined) {
        testVariations.push({
          name: sampleData.name || "Producto Test",
          description: sampleData.description || "Sin descripción",
          price: sampleData.price
        });
        
        testVariations.push({
          Name: sampleData.name || "Producto Test",
          Description: sampleData.description || "Sin descripción", 
          Price: sampleData.price
        });
      }

      let workingStructure = null;
      
      for (let i = 0; i < testVariations.length; i++) {
        const testData = { ...testVariations[i] };
        
        // Limpiar campos que pueden causar problemas
        delete testData.createdAt;
        delete testData.updatedAt;
        delete testData.publishedAt;
        delete testData.image; // Procesaremos imágenes después
        delete testData.id;
        
        console.log(`\n   Prueba ${i + 1}: ${JSON.stringify(testData)}`);
        
        try {
          const testResponse = await axios.post(
            `${REMOTE_STRAPI_URL}/api/${collection}`,
            { data: testData },
            {
              headers: {
                'Authorization': `Bearer ${REMOTE_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000
            }
          );

          if (testResponse.status === 200 || testResponse.status === 201) {
            console.log(`   ✅ ¡ESTRUCTURA VÁLIDA ENCONTRADA!`);
            workingStructure = testData;
            
            // Eliminar el registro de prueba
            const createdId = testResponse.data?.data?.id;
            if (createdId) {
              try {
                await axios.delete(`${REMOTE_STRAPI_URL}/api/${collection}/${createdId}`, {
                  headers: { 'Authorization': `Bearer ${REMOTE_API_TOKEN}` }
                });
                console.log(`   🗑️ Registro de prueba eliminado`);
              } catch (deleteError) {
                console.log(`   ⚠️ Elimina manualmente el registro ID: ${createdId}`);
              }
            }
            break;
          }
        } catch (error) {
          const errorMsg = error.response?.data?.error?.message || error.message;
          console.log(`   ❌ Error: ${errorMsg}`);
          
          if (error.response?.data?.error?.details) {
            console.log(`      Detalles:`, error.response.data.error.details);
          }
        }
      }

      if (!workingStructure) {
        console.log(`\n❌ No se encontró estructura válida para ${collection}`);
        console.log(`💡 Revisa manualmente los campos requeridos en tu Strapi remoto`);
        continue;
      }

      // 4. Transferir todos los elementos usando la estructura que funciona
      console.log(`\n🚀 TRANSFIRIENDO ${items.length} ELEMENTOS...`);
      let transferred = 0;
      let errors = 0;

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        console.log(`\n📤 ${index + 1}/${items.length}: Procesando...`);

        try {
          // Mapear datos usando la estructura que funciona
          const mappedData = {};
          const originalData = item.attributes;

          // Copiar campos que sabemos que funcionan
          for (const [key, value] of Object.entries(workingStructure)) {
            if (originalData[key.toLowerCase()]) {
              mappedData[key] = originalData[key.toLowerCase()];
            } else if (originalData[key]) {
              mappedData[key] = originalData[key];
            } else {
              mappedData[key] = value; // Usar valor por defecto
            }
          }

          // Procesar imagen para products
          if (collection === 'products' && originalData.image?.data) {
            console.log("   🖼️ Procesando imagen...");
            try {
              const imageData = originalData.image.data;
              const imageUrl = `${LOCAL_STRAPI_URL}${imageData.attributes.url}`;
              const tempPath = path.join(TEMP_DOWNLOAD_DIR, `${Date.now()}_${imageData.attributes.name}`);

              // Descargar imagen
              const writer = fs.createWriteStream(tempPath);
              const imageResponse = await axios.get(imageUrl, { responseType: 'stream', timeout: 30000 });
              imageResponse.data.pipe(writer);

              await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
              });

              // Subir imagen
              const FormData = require('form-data');
              const formData = new FormData();
              formData.append('files', fs.createReadStream(tempPath));

              const uploadResponse = await axios.post(`${REMOTE_STRAPI_URL}/api/upload`, formData, {
                headers: {
                  ...formData.getHeaders(),
                  Authorization: `Bearer ${REMOTE_API_TOKEN}`,
                },
                timeout: 60000
              });

              mappedData.image = uploadResponse.data[0].id;
              fs.unlinkSync(tempPath); // Limpiar
              console.log("   ✅ Imagen procesada");
            } catch (imageError) {
              console.log(`   ⚠️ Error procesando imagen: ${imageError.message}`);
              // Continuar sin imagen
            }
          }

          // Crear registro
          const createResponse = await axios.post(
            `${REMOTE_STRAPI_URL}/api/${collection}`,
            { data: mappedData },
            {
              headers: {
                'Authorization': `Bearer ${REMOTE_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );

          transferred++;
          console.log(`   ✅ Transferido exitosamente (ID: ${createResponse.data?.data?.id})`);

        } catch (error) {
          errors++;
          console.error(`   ❌ Error: ${error.response?.data?.error?.message || error.message}`);
        }
      }

      console.log(`\n📊 RESUMEN ${collection}:`);
      console.log(`   ✅ Transferidos: ${transferred}`);
      console.log(`   ❌ Errores: ${errors}`);

    } catch (error) {
      console.error(`❌ Error fatal en ${collection}: ${error.message}`);
    }
  }

  // Limpiar archivos temporales
  try {
    if (fs.existsSync(TEMP_DOWNLOAD_DIR)) {
      fs.rmSync(TEMP_DOWNLOAD_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.log("⚠️ Error limpiando archivos temporales");
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 PROCESO COMPLETADO");
  console.log("=".repeat(60));
}

inspectAndTransfer().catch(console.error);