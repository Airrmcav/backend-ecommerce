# 🔧 Corrección SMTP para Producción

## ⚠️ Problema Encontrado

Tu configuración tiene un conflicto:
```
SMTP_PORT=587        ← TLS (no SSL)
SMTP_SECURE=true     ← SSL (no TLS)  ❌ CONFLICTO
```

**Resultado**: Los correos fallan en producción porque le estás diciendo a Nodemailer que use SSL en un puerto TLS.

---

## ✅ Solución: Actualiza tu variable de entorno

Necesitas cambiar `SMTP_SECURE` a **`false`** (no "false" de string, valor booleano):

### Variables correctas para Titan.email:
```
SMTP_HOST=smtp.titan.email
SMTP_PORT=587
SMTP_SECURE=false        ← ⭐ CAMBIO IMPORTANTE
SMTP_USER=ventas@salmetexmed.com.mx
SMTP_PASS=Ventas09012024*
SMTP_FROM=ventas@salmetexmed.com.mx
```

---

## 📍 ¿Dónde actualizar?

Dependiendo de tu plataforma de hosting:

### Si usas **Railway.app** (probable):
1. Ve a tu proyecto
2. Ve a **Variables**
3. Busca `SMTP_SECURE`
4. Cambia el valor de `true` a `false`
5. Guardar y redeploy

### Si usas **Vercel / Heroku / AWS / Render**:
1. Ve a **Environment Variables / Settings / Env Vars**
2. Encuentra `SMTP_SECURE`
3. Cambia a `false`
4. Guardar y redeploy

### Si es un servidor propio (VPS/Linode/DigitalOcean):
1. Edita tu archivo `.env.production` directamente
2. Cambia: `SMTP_SECURE=false`
3. Reinicia el servicio

---

## 🧪 Verificación

Después de cambiar, mira los logs de tu servidor para ver:

```
🔧 Configuración SMTP:
    Host: smtp.titan.email
    Puerto: 587
    Seguro (SSL): false       ← ⭐ DEBE SER FALSE
    Usuario: ventas@...
```

Si ves `Seguro (SSL): true` mientras puerto es 587, **aún no se ha actualizado**.

---

## 📚 Referencia: Puertos y Seguridad

| Proveedor | Puerto | Seguro | Descripción |
|-----------|--------|--------|-------------|
| Titan.email | 587 | false | TLS (StartTLS) |
| Gmail | 465 | true | SSL/TLS |
| SendGrid | 587 | false | TLS |
| HubSpot | 587 | false | TLS |
| Mandrill | 587 | false | TLS |

**Regla general:**
- **Puerto 587** → Use TLS → `secure: false`
- **Puerto 465** → Use SSL → `secure: true`

---

## ❌ Si después de cambiar aún no funciona

Verifica estos 100% seguros:

1. **Los logs muestran el nuevo valor:**
   ```
   Seguro (SSL): false
   Puerto: 587
   ```

2. **La contraseña es correcta:**
   - ¿Es una contraseña de aplicación o contraseña regular?
   - ¿Tiene caracteres especiales bien escapados?

3. **El usuario SMTP es válido:**
   - `ventas@salmetexmed.com.mx` ← ¿Existe este buzón en Titan?

4. **Revisas los logs en tiempo real:**
   ```
   📤 Intentando enviar email #1/4 a cliente@email.com
   ✅ Email enviado a cliente@email.com
   ```

---

## 🚀 Próximos pasos

1. **Haz el cambio ahora** - Actualiza `SMTP_SECURE=false` en tu plataforma
2. **Redeploy** - Reinicia/Redeploy tu backend
3. **Prueba** - Realiza un pedido de prueba
4. **Verifica los logs** - Mira si aparecen los logs SMTP

¿Necesitas ayuda para acceder a tu plataforma de hosting?
