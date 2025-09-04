'use strict';

// Este script migra las imágenes existentes en el directorio public/uploads a Cloudinary
// y actualiza las referencias en la base de datos

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { Pool } = require('pg');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Configurar conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DATABASE_USERNAME,
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT,
});

// Directorio de uploads de Strapi
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

// Función para verificar si la tabla existe
async function checkTableExists(tableName) {
  try {
    const result = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error al verificar la tabla:', error);
    return false;
  }
}

// Función para obtener todas las imágenes de la base de datos
async function getImagesFromDB() {
  try {
    // Verificar si la tabla files existe
    const filesTableExists = await checkTableExists('files');
    if (!filesTableExists) {
      console.log('La tabla "files" no existe en la base de datos.');
      return [];
    }

    const result = await pool.query('SELECT * FROM files');
    return result.rows;
  } catch (error) {
    console.error('Error al obtener imágenes de la base de datos:', error);
    return [];
  }
}

// Función para subir una imagen a Cloudinary
async function uploadToCloudinary(filePath, publicId) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      resource_type: 'auto',
    });
    return result;
  } catch (error) {
    console.error(`Error al subir ${filePath} a Cloudinary:`, error);
    return null;
  }
}

// Función para actualizar la URL en la base de datos
async function updateImageUrl(id, url, provider) {
  try {
    // Verificar si la tabla files existe
    const filesTableExists = await checkTableExists('files');
    if (!filesTableExists) {
      console.log(`No se pudo actualizar la imagen con ID ${id} porque la tabla "files" no existe.`);
      return false;
    }

    await pool.query(
      'UPDATE files SET url = $1, provider = $2 WHERE id = $3',
      [url, provider, id]
    );
    return true;
  } catch (error) {
    console.error(`Error al actualizar la URL para la imagen con ID ${id}:`, error);
    return false;
  }
}

// Función para procesar todas las imágenes en el directorio de uploads
async function processUploadsDirectory() {
  try {
    // Verificar si el directorio existe
    if (!fs.existsSync(uploadsDir)) {
      console.log(`El directorio ${uploadsDir} no existe.`);
      return;
    }

    // Obtener todas las imágenes de la base de datos
    const dbImages = await getImagesFromDB();
    console.log(`Se encontraron ${dbImages.length} imágenes en la base de datos.`);

    // Recorrer el directorio de uploads recursivamente
    const processDirectory = async (dir) => {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Procesar subdirectorio
          await processDirectory(filePath);
        } else {
          // Ignorar archivos que no son imágenes
          const ext = path.extname(file).toLowerCase();
          if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
            console.log(`Ignorando archivo no imagen: ${filePath}`);
            continue;
          }

          // Generar public_id para Cloudinary (ruta relativa sin extensión)
          const relativePath = path.relative(uploadsDir, filePath);
          const publicId = `strapi-uploads/${path.dirname(relativePath)}/${path.basename(relativePath, ext)}`
            .replace(/\\/g, '/'); // Reemplazar barras invertidas por barras normales

          console.log(`Procesando: ${relativePath}`);

          // Buscar la imagen en la base de datos
          const dbImage = dbImages.find(img => {
            const imgPath = img.url.split('/').slice(-2).join('/');
            return relativePath.includes(imgPath);
          });

          if (dbImage) {
            // Subir a Cloudinary
            const uploadResult = await uploadToCloudinary(filePath, publicId);
            if (uploadResult) {
              // Actualizar URL en la base de datos
              const updated = await updateImageUrl(dbImage.id, uploadResult.secure_url, 'cloudinary');
              if (updated) {
                console.log(`✅ Imagen actualizada: ${relativePath} -> ${uploadResult.secure_url}`);
              }
            }
          } else {
            console.log(`⚠️ No se encontró referencia en DB para: ${relativePath}`);
            // Subir a Cloudinary de todos modos
            const uploadResult = await uploadToCloudinary(filePath, publicId);
            if (uploadResult) {
              console.log(`✅ Imagen subida a Cloudinary: ${relativePath} -> ${uploadResult.secure_url}`);
            }
          }
        }
      }
    };

    await processDirectory(uploadsDir);
    console.log('Migración completa.');
  } catch (error) {
    console.error('Error al procesar el directorio de uploads:', error);
  } finally {
    // Cerrar la conexión a la base de datos
    await pool.end();
  }
}

// Ejecutar el script
processUploadsDirectory();