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

// Cambios iniciados por el cliente (cancelación, aprobación, confirmación)
async function notificarCambioPedidoCliente(venta, tipo, perfil = null) {
  const cfg = {
    cancelado_cliente: {
      titulo: `[Horte] ❌ Pedido #${venta.id} cancelado por cliente`,
      prioridad: 'high', tags: 'x,chocolate',
    },
    aprobado_cliente: {
      titulo: `[Horte] ✅ Pedido #${venta.id} — cargos aprobados`,
      prioridad: 'default', tags: 'white_check_mark,chocolate',
    },
    confirmado_entrega: {
      titulo: `[Horte] 📦 Pedido #${venta.id} — entrega confirmada`,
      prioridad: 'low', tags: 'package,chocolate',
    },
  };
  const c = cfg[tipo];
  if (!c) return;

  const lineas = [
    `Total: $${Number(venta.total).toFixed(2)} | Tipo: ${venta.tipo_entrega} | Pago: ${venta.metodo_pago}`,
  ];
  if (perfil) {
    lineas.push(`Cliente: ${perfil.nombre_completo ?? '—'} | Tel: ${perfil.telefono ?? '—'}`);
    if (venta.tipo_entrega === 'domicilio' && tipo === 'cancelado_cliente') {
      lineas.push(`Dir: ${perfil.direccion ?? '—'}`);
    }
  }

  try {
    await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: { 'Title': c.titulo, 'Priority': c.prioridad, 'Tags': c.tags },
      body: lineas.join('\n'),
    });
  } catch (err) {
    console.warn('[ntfy] Error:', err.message);
  }
}

// Cambios realizados por el vendedor sobre un pedido existente
async function notificarModificacionPedido(ventaAntes, ventaDespues, vendedorPerfil = null) {
  const cambios = [];
  if (ventaAntes.estado !== ventaDespues.estado)
    cambios.push(`Estado: ${ventaAntes.estado} → ${ventaDespues.estado}`);
  if (Number(ventaAntes.cargo_domicilio) !== Number(ventaDespues.cargo_domicilio))
    cambios.push(`Cargo domicilio: $${Number(ventaAntes.cargo_domicilio).toFixed(2)} → $${Number(ventaDespues.cargo_domicilio).toFixed(2)}`);
  if (Number(ventaAntes.cargo_transferencia) !== Number(ventaDespues.cargo_transferencia))
    cambios.push(`Cargo transf.: $${Number(ventaAntes.cargo_transferencia).toFixed(2)} → $${Number(ventaDespues.cargo_transferencia).toFixed(2)}`);

  if (!cambios.length) return; // nada relevante cambió

  const lineas = [
    ...cambios,
    `Total actual: $${Number(ventaDespues.total).toFixed(2)}`,
    ...(ventaDespues.aprobacion_cliente === 'pendiente' ? ['⚠ Requiere aprobación del cliente'] : []),
    ...(vendedorPerfil ? [`Vendedor: ${vendedorPerfil.nombre_completo}`] : []),
  ];

  await enviarNtfy(
    `[Horte] 📝 Pedido #${ventaAntes.id} modificado`,
    lineas.join('\n'),
    'default'
  );
}
