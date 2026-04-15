// notificaciones.js — envío a ntfy.sh
// Depende de: settings.js

async function enviarNtfy(titulo, mensaje, prioridad = 'default') {
  try {
    await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': encodeURIComponent(titulo),
        'Priority': prioridad,
        'Tags':     'chocolate,money_with_wings',
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: mensaje,
    });
  } catch (err) {
    console.warn('[ntfy] Error al enviar notificación:', err.message);
  }
}

async function notificarNuevaVenta(venta, items, perfil = null) {
  const resumen = items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
  const tipo    = venta.tipo_entrega === 'domicilio' ? 'Domicilio' : 'Recogida';
  const titulo  = `Nueva venta ${Number(venta.total).toFixed(2)}`;

  const lineas = [
    `Tipo: ${tipo} | Pago: ${venta.metodo_pago}`,
    `Items: ${resumen}`,
  ];

  // Fecha y hora de entrega programada
  if (venta.fecha_entrega) {
    const fechaStr = new Date(venta.fecha_entrega + 'T00:00:00').toLocaleDateString('es', { dateStyle: 'medium' });
    const horaStr  = venta.hora_entrega ? ` a las ${venta.hora_entrega}` : '';
    lineas.push(`Fecha ${tipo.toLowerCase()}: ${fechaStr}${horaStr}`);
  }

  if (perfil) {
    lineas.push(`Cliente: ${perfil.nombre_completo ?? '—'}`);
    lineas.push(`CI: ${perfil.carnet ?? '—'} | Tel: ${perfil.telefono ?? '—'}`);
    if (venta.tipo_entrega === 'domicilio') {
      // Usar la dirección específica del pedido si fue ingresada, si no la del perfil
      const dir = venta.direccion_entrega || perfil.direccion;
      if (dir) lineas.push(`Dirección: ${dir}`);
    }
  }

  if (venta.notas) lineas.push(`Notas: ${venta.notas}`);

  await enviarNtfy(titulo, lineas.join('\n'), 'default');
}

// Cambios iniciados por el cliente (cancelación, aprobación, confirmación)
async function notificarCambioPedidoCliente(venta, tipo, perfil = null) {
  const cfg = {
    cancelado_cliente: {
      titulo: `Pedido ${venta.id} cancelado por cliente`,
      prioridad: 'high', tags: 'x,chocolate',
    },
    aprobado_cliente: {
      titulo: `Pedido ${venta.id} — cargos aprobados`,
      prioridad: 'default', tags: 'white_check_mark,chocolate',
    },
    confirmado_entrega: {
      titulo: `Pedido ${venta.id} — entrega confirmada por cliente`,
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
      const dir = venta.direccion_entrega || perfil.direccion;
      if (dir) lineas.push(`Dir: ${dir}`);
    }
  }

  try {
    await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': encodeURIComponent(c.titulo),
        'Priority': c.prioridad,
        'Tags':     c.tags,
        'Content-Type': 'text/plain; charset=utf-8',
      },
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
  if (!ventaAntes.vendedor_confirmo_entrega && ventaDespues.vendedor_confirmo_entrega)
    cambios.push(`Entrega confirmada por vendedor`);

  if (!cambios.length) return;

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
