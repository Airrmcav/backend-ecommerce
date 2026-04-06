/**
 * Email sending utility using Nodemailer with retry logic
 */
const nodemailer = require('nodemailer');

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

function createTransporter() {
  // Validar variables de entorno
  const requiredVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error(`⚠️ ADVERTENCIA: Variables SMTP faltantes en producción: ${missing.join(', ')}`);
  }

  const secureMode = process.env.SMTP_SECURE === 'true'; // Explicito: true for 465, false for 587
  const port = parseInt(process.env.SMTP_PORT || '465');
  
  console.log(`🔧 Configuración SMTP:
    Host: ${process.env.SMTP_HOST}
    Puerto: ${port}
    Seguro (SSL): ${secureMode}
    Usuario: ${process.env.SMTP_USER?.substring(0, 10)}...`);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: secureMode,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 15000, // 15 segundos - más generoso en producción
    socketTimeout: 30000,     // 30 segundos - más tiempo para enviar
    pool: {
      maxConnections: 5,
      maxMessages: 100,
    },
    logger: process.env.NODE_ENV === 'development', // Más info en desarrollo
    debug: process.env.NODE_ENV === 'development',
  });
}

export async function sendEmail({ to, subject, html }: SendEmailOptions, retryCount = 0): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 segundos entre reintentos

  const transporter = createTransporter();

  const mailOptions = {
    from: `"SALMETEX MED" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  };

  try {
    console.log(`📤 Intentando enviar email #${retryCount + 1}/${MAX_RETRIES + 1} a ${to}`);

    // Envolver con timeout de 30 segundos
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
    );
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`✅ Email enviado a ${to}: ${(info as any).messageId}`);
  } catch (error: any) {
    console.error(`❌ Error en intento #${retryCount + 1} enviando email a ${to}:`, error.message);

    // Reintentar si no hemos alcanzado el máximo
    if (retryCount < MAX_RETRIES) {
      console.log(`⏳ Reintentando en ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return sendEmail({ to, subject, html }, retryCount + 1);
    } else {
      console.error(`❌ FALLO FINAL: No se pudo enviar email a ${to} después de ${MAX_RETRIES + 1} intentos`);
      throw error;
    }
  }
}
