// notificaciones.js — envío a ntfy.sh
// Depende de: settings.js

async function enviarNtfy(titulo, mensaje, prioridad = 'default') {
  try {
    await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title':    titulo,
        'Priority': prioridad,
        'Tags':     'chocolate,money_with_wings',
      },
      body: mensaje,
    });
  } catch (err) {
    // La notificación falla silenciosamente — no interrumpe el flujo
    console.warn('[ntfy] Error al enviar notificación:', err.message);
  }
}

async function notificarNuevaVenta(venta, items, perfil = null) {
  const resumen = items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
  const tipo    = venta.tipo_entrega === 'domicilio' ? 'Domicilio' : 'Recogida';
  const titulo  = `[Horte] Nueva venta — $${Number(venta.total).toFixed(2)}`;

  const lineas = [
    `Tipo: ${tipo} | Pago: ${venta.metodo_pago}`,
    `Items: ${resumen}`,
  ];

  if (perfil) {
    lineas.push(`Cliente: ${perfil.nombre_completo ?? '—'}`);
    lineas.push(`CI: ${perfil.carnet ?? '—'} | Tel: ${perfil.telefono ?? '—'}`);
    if (venta.tipo_entrega === 'domicilio') {
      lineas.push(`Direccion: ${perfil.direccion ?? '—'}`);
    }
  }

  if (venta.notas) lineas.push(`Notas: ${venta.notas}`);

  await enviarNtfy(titulo, lineas.join('\n'), 'default');
}
