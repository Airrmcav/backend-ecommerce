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
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email enviado a ${to}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Error enviando email a ${to}:`, error);
    throw error;
  }
}
