// migrate-to-cloudinary.js
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { Pool } = require("pg"); // PostgreSQL
require('dotenv').config(); // Cargar variables de entorno desde .env

// 🔑 Configura Cloudinary con tus credenciales
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Verificar que las credenciales estén cargadas
console.log("Cloudinary configurado con:", {
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY ? "***" : undefined,
  api_secret: process.env.CLOUDINARY_SECRET ? "***" : undefined,
});

// 📂 Ruta de las imágenes locales de Strapi
const uploadsDir = path.join(__dirname, "public", "uploads");

// 🔗 Configura tu conexión a PostgreSQL
const pool = new Pool({
  host: "127.0.0.1",
  user: "postgres",
  password: "Airrmcav2025*",
  database: "ecommerce-salmetex",
  port: 5432, // puerto por defecto de PostgreSQL
});

async function migrate() {
  const files = fs.readdirSync(uploadsDir);

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);

    try {
      // 📤 Subir archivo a Cloudinary
      const result = await cloudinary.uploader.upload(filePath, {
        folder: "strapi_uploads",
      });

      console.log(`✅ Subido: ${file} -> ${result.secure_url}`);

      // 🛠 Actualizar referencia en DB (tabla files)
      // Nota: Verificamos primero si la tabla existe
      try {
        const checkTableQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'files'
          );
        `;
        const tableCheck = await pool.query(checkTableQuery);
        
        if (tableCheck.rows[0].exists) {
          const fileHash = path.parse(file).name; // hash del archivo
          const query = `
            UPDATE files
            SET url = $1, provider = 'cloudinary'
            WHERE hash = $2
          `;
          const values = [result.secure_url, fileHash];

          const res = await pool.query(query, values);
          if (res.rowCount > 0) {
            console.log(`🔗 DB actualizada para: ${file}`);
          } else {
            console.log(`⚠️ No se encontró referencia en DB para: ${file}`);
          }
        } else {
          console.log(`ℹ️ La tabla 'files' no existe en la base de datos. Solo se subió a Cloudinary.`);
        }
      } catch (dbErr) {
        console.error(`❌ Error al verificar/actualizar la base de datos: ${dbErr.message}`);
      }
    } catch (err) {
      console.error(`❌ Error subiendo ${file}:`, err.message);
    }
  }

  await pool.end();
  console.log("🎉 Migración completa");
}

migrate();
