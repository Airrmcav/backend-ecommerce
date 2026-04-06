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
    Usuario: ${process.env.SMTP_USER?.substring(0, 10)}...
    Pass: ${process.env.SMTP_PASS ? '✅ Configurada' : '❌ NO CONFIGURADA'}`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: secureMode,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 20000, // 20 segundos para conectar
    socketTimeout: 40000,     // 40 segundos para enviar
    greetingTimeout: 10000,   // 10 segundos para el greeting
    pool: {
      maxConnections: 5,
      maxMessages: 100,
    },
    logger: true,  // Siempre log en producción para debugging
    debug: true,   // Siempre debug en producción para debugging
  });

  // Verificar conexión al crear el transporter
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Error verifying SMTP connection:', error.message);
      console.error('   Code:', (error as any).code);
      console.error('   Command:', (error as any).command);
    } else {
      console.log('✅ SMTP connection verified successfully');
    }
  });

  return transporter;
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
    console.log(`   Desde: ${mailOptions.from}`);
    console.log(`   Asunto: ${subject.substring(0, 50)}...`);

    // Envolver con timeout de 45 segundos (más buffer para esperar respuesta SMTP)
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => {
        console.error(`⏱️ TIMEOUT: Email tardó más de 45 segundos, abortando...`);
        reject(new Error('Email send timeout after 45 seconds'));
      }, 45000)
    );
    
    console.log(`   ⏳ Esperando respuesta del servidor SMTP...`);
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`✅ Email enviado exitosamente a ${to}`);
    console.log(`   Message ID: ${(info as any).messageId}`);
    console.log(`   Response: ${(info as any).response}`);
  } catch (error: any) {
    console.error(`❌ Error en intento #${retryCount + 1} enviando email a ${to}:`);
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`   Stack: ${error.stack?.substring(0, 200)}`);

    // Reintentar si no hemos alcanzado el máximo
    if (retryCount < MAX_RETRIES) {
      console.log(`⏳ Reintentando en ${RETRY_DELAY}ms... (intento ${retryCount + 2}/${MAX_RETRIES + 1})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return sendEmail({ to, subject, html }, retryCount + 1);
    } else {
      console.error(`❌ FALLO FINAL: No se pudo enviar email a ${to} después de ${MAX_RETRIES + 1} intentos`);
      console.error(`\n🔍 DEBUGGING INFO:`);
      console.error(`   SMTP_HOST: ${process.env.SMTP_HOST}`);
      console.error(`   SMTP_PORT: ${process.env.SMTP_PORT}`);
      console.error(`   SMTP_USER: ${process.env.SMTP_USER}`);
      console.error(`   SMTP_SECURE: ${process.env.SMTP_SECURE}`);
      throw error;
    }
  }
}
