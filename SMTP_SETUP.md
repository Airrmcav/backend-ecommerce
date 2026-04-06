# Configuración SMTP - Envío de Correos en Producción

## 🔴 PROBLEMA IDENTIFICADO

Los correos **NO se envían en producción** porque faltaban las variables de entorno SMTP en tu `.env.production`.

## ✅ SOLUCIÓN

### 1. Configura las variables SMTP en tu `.env.production`

Añade estas líneas a tu archivo `.env.production` con los valores correctos de tu proveedor de correo:

```bash
# SMTP Email Configuration
SMTP_HOST=tu-servidor-smtp.com
SMTP_PORT=465
SMTP_USER=tu-email@ejemplo.com
SMTP_PASS=tu-contraseña-o-app-token
SMTP_FROM=noreply@salmetexmed.com.mx
SMTP_SECURE=true
```

### 2. Selecciona tu proveedor de correo

#### **Opción A: Gmail (Recomendado para desarrollo)**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicación (NO contraseña de Google)
SMTP_FROM=tu-email@gmail.com
SMTP_SECURE=true
```

**⚠️ Importante**: Para Gmail necesitas:
1. Activar "Acesso a aplicaciones menos seguras" O
2. Crear una "Contraseña de aplicación" (recomendado):
   - Ve a https://myaccount.google.com/apppasswords
   - Selecciona "Mail" y "Windows Computer"
   - Copia la contraseña generada y úsala en `SMTP_PASS`

#### **Opción B: SendGrid (Recomendado para producción)**
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.tu-api-key-muy-larga
SMTP_FROM=tu-email@salmetexmed.com.mx
SMTP_SECURE=false
```

**Cómo obtener API Key**:
1. Regístrate en https://sendgrid.com
2. Ve a Settings > API Keys
3. Crea una nueva "API Key" con permisos de "Mail Send"

#### **Opción C: HubSpot SMTP**
```
SMTP_HOST=smtp.hubapi.com
SMTP_PORT=587
SMTP_USER=tu-email@salmetexmed.com.mx
SMTP_PASS=tu-hubspot-smtp-password
SMTP_FROM=tu-email@salmetexmed.com.mx
SMTP_SECURE=false
```

#### **Opción D: MailChimp Transactional (Mandrill)**
```
SMTP_HOST=smtp.mandrillapp.com
SMTP_PORT=587
SMTP_USER=tu-email@salmetexmed.com.mx
SMTP_PASS=tu-mandrill-api-key
SMTP_FROM=tu-email@salmetexmed.com.mx
SMTP_SECURE=false
```

### 3. Mejoras implementadas en el código

✅ **Reintentos automáticos** (hasta 3 intentos si falla)
✅ **Tiempos de espera más largos** (15s conexión, 30s envío)
✅ **Mejor logging** para diagnosticar problemas
✅ **Validación de variables de entorno**
✅ **Envío asincrónico** sin bloquear la respuesta

### 4. Verifica que funciona

Después de actualizar `.env.production`:

```bash
# 1. Reinicia tu servidor Strapi
npm run build
npm run start

# 2. Verifica los logs al procesar un pago
# Deberías ver:
# ✅ Email enviado a ventas@salmetexmed.com.mx
# ✅ Email de confirmación enviado al cliente
```

## 🐛 Debugging

Si los correos aún no se envían, revisa:

### 1. Verifica en los logs del servidor:
```
- ⚠️ ADVERTENCIA: Variables SMTP faltantes en producción
- 📤 Intentando enviar email
- ❌ Error enviando email
```

### 2. Variables mal configuradas:
```bash
# ❌ MAL - Estos NO funcionarán:
echo $SMTP_HOST  # Debería mostrar tu servidor SMTP
echo $SMTP_USER  # Debería mostrar tu email
```

### 3. Prueba manualmente con Node.js:
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: 'test@ejemplo.com',
  subject: 'Test Email',
  html: '<p>Test</p>',
}, (err, info) => {
  if (err) console.error('Error:', err);
  else console.log('Enviado:', info);
});
```

## 📧 Próximos pasos

### Para melhorar aún más:

1. **Base de datos de intentos fallidos** - Guardar emails que fallaron para reintentar después
2. **Cola de emails** - Usar Redis/Bull para encolar emails de forma confiable
3. **Módulo de email profesional** - Res y, Sendinblue, o similar
4. **Templates mejorados** - HTML más profesional y responsive

¿Necesitas ayuda con alguno de estos?
