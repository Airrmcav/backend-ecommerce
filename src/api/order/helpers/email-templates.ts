/**
 * Email templates for order notifications
 */

interface OrderEmailData {
  sessionId: string;
  customerName: string;
  customerEmail: string;
  shippingName: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    amount_total: number;
    currency: string;
  }>;
  totalAmount: number;
  currency: string;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function buildProductRows(items: OrderEmailData['lineItems'], currency: string): string {
  return items.map(item => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
        ${item.description}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: right; font-weight: 600;">
        ${formatCurrency(item.amount_total, currency)}
      </td>
    </tr>
  `).join('');
}

function formatAddress(address: OrderEmailData['shippingAddress']): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    `${address.postal_code} ${address.state}`,
    address.country === 'MX' ? 'México' : address.country,
  ].filter(Boolean);
  return parts.join('<br>');
}

/**
 * Email template for the SALES TEAM (ventas@salmetexmed.com.mx)
 */
export function buildSalesEmailHtml(data: OrderEmailData): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">
                🛒 NUEVA VENTA RECIBIDA
              </h1>
              <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">
                SALMETEX MED - Notificación de Pedido
              </p>
            </td>
          </tr>

          <!-- Order ID -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">ID de Sesión</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: #1e40af; font-weight: 600; word-break: break-all;">${data.sessionId}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer Info -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <h2 style="margin: 0 0 12px; font-size: 16px; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
                👤 Datos del Cliente
              </h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6b7280; width: 120px;">Nombre:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #111827; font-weight: 600;">${data.customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Email:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #111827; font-weight: 600;">
                    <a href="mailto:${data.customerEmail}" style="color: #2563eb; text-decoration: none;">${data.customerEmail}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping Info -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <h2 style="margin: 0 0 12px; font-size: 16px; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
                🚚 Datos de Envío
              </h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6b7280; width: 120px;">Nombre:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #111827; font-weight: 600;">${data.shippingName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6b7280; vertical-align: top;">Dirección:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #111827; font-weight: 600; line-height: 1.6;">
                    ${formatAddress(data.shippingAddress)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Products -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <h2 style="margin: 0 0 12px; font-size: 16px; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
                📦 Productos
              </h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Producto</th>
                    <th style="padding: 12px 16px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Cant.</th>
                    <th style="padding: 12px 16px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  ${buildProductRows(data.lineItems, data.currency)}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Total -->
          <tr>
            <td style="padding: 20px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 8px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 16px; color: #bfdbfe; font-weight: 600;">TOTAL</td>
                        <td style="font-size: 24px; color: #ffffff; font-weight: 700; text-align: right;">
                          ${formatCurrency(data.totalAmount, data.currency)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Este es un correo automático del sistema de ventas de SALMETEX MED.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email template for the CUSTOMER
 */
export function buildCustomerEmailHtml(data: OrderEmailData): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">
                SALMETEX MED
              </h1>
              <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 15px;">
                Equipos y Soluciones Médicas
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <h2 style="margin: 0 0 8px; font-size: 22px; color: #1f2937;">
                ¡Gracias por tu compra, ${data.customerName}! 🎉
              </h2>
              <p style="margin: 0; font-size: 15px; color: #6b7280; line-height: 1.6;">
                Hemos recibido tu pedido y lo estamos procesando. A continuación encontrarás el resumen de tu compra.
              </p>
            </td>
          </tr>

          <!-- Order ID -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 16px 20px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Estado del Pedido</p>
                    <p style="margin: 6px 0 0; font-size: 16px; color: #16a34a; font-weight: 700;">✅ Pago Confirmado</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping Info -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <h3 style="margin: 0 0 12px; font-size: 16px; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
                🚚 Dirección de Envío
              </h3>
              <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.8;">
                <strong>${data.shippingName}</strong><br>
                ${formatAddress(data.shippingAddress)}
              </p>
            </td>
          </tr>

          <!-- Products -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <h3 style="margin: 0 0 12px; font-size: 16px; color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
                📦 Detalle de Productos
              </h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Producto</th>
                    <th style="padding: 12px 16px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Cant.</th>
                    <th style="padding: 12px 16px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  ${buildProductRows(data.lineItems, data.currency)}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Total -->
          <tr>
            <td style="padding: 20px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 8px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 16px; color: #bfdbfe; font-weight: 600;">TOTAL PAGADO</td>
                        <td style="font-size: 24px; color: #ffffff; font-weight: 700; text-align: right;">
                          ${formatCurrency(data.totalAmount, data.currency)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next Steps -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 20px;">
                    <h4 style="margin: 0 0 8px; font-size: 14px; color: #1e40af;">📋 Próximos pasos</h4>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #374151; line-height: 1.8;">
                      <li>Nuestro equipo revisará tu pedido y preparará el envío.</li>
                      <li>Recibirás información de seguimiento una vez que tu pedido sea enviado.</li>
                      <li>Si tienes alguna pregunta, contáctanos a <a href="mailto:ventas@salmetexmed.com.mx" style="color: #2563eb;">ventas@salmetexmed.com.mx</a></li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #374151; font-weight: 600;">
                SALMETEX MED
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                Equipos y Soluciones Médicas<br>
                <a href="mailto:ventas@salmetexmed.com.mx" style="color: #6b7280;">ventas@salmetexmed.com.mx</a>
              </p>
              <p style="margin: 16px 0 0; font-size: 11px; color: #d1d5db;">
                Este es un correo automático, por favor no respondas directamente a este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type { OrderEmailData };
