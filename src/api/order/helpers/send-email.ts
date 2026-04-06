/**
 * Email sending utility using Nodemailer
 */
const nodemailer = require('nodemailer');

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000,  // 5 segundos max para conectar
    socketTimeout: 10000,     // 10 segundos max para enviar
    pool: {
      maxConnections: 5,
      maxMessages: 100,
    },
  });
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"SALMETEX MED" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  };

  try {
    // Envolver con timeout de 15 segundos
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email send timeout after 15 seconds')), 15000)
    );
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`✅ Email enviado a ${to}: ${(info as any).messageId}`);
  } catch (error) {
    console.error(`❌ Error enviando email a ${to}:`, error);
    throw error;
  }
}
