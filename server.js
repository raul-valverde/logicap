const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicialización y lectura de la Base de Datos
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      clients: [],
      products: [],
      orders: [],
      routes: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error leyendo db.json:', err);
    return { users: [], clients: [], products: [], orders: [], routes: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error escribiendo db.json:', err);
  }
}

// ==========================================
// 1. AUTENTICACIÓN Y GESTIÓN DE USUARIOS
// ==========================================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => 
    u.username.trim().toLowerCase() === (username || '').trim().toLowerCase() && 
    u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
  }

  // No enviar la contraseña en la respuesta
  const { password: _, ...userSafe } = user;
  res.json({ success: true, user: userSafe });
});

app.get('/api/users', (req, res) => {
  const db = readDB();
  // Sanitizar contraseñas para seguridad
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// Admin: Crear nuevo usuario (Conductor, Vendedor, etc.)
app.post('/api/users', (req, res) => {
  const db = readDB();
  const { username, password, name, role, phone, vehicle } = req.body;

  if (!username || !password || !name || !role) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
  }

  const exists = db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ success: false, message: 'El nombre de usuario ya está registrado' });
  }

  const newUser = {
    id: Date.now(),
    username: username.trim(),
    password: password.trim(),
    name: name.trim(),
    role: role.trim().toLowerCase(),
    phone: phone ? phone.trim() : '',
    vehicle: vehicle ? vehicle.trim() : ''
  };

  db.users.push(newUser);
  writeDB(db);

  const { password: _, ...userSafe } = newUser;
  res.json({ success: true, user: userSafe });
});

// Admin: Editar usuario
app.put('/api/users/:id', (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  const idx = db.users.findIndex(u => u.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  const { name, role, phone, vehicle, password } = req.body;
  if (name) db.users[idx].name = name.trim();
  if (role) db.users[idx].role = role.trim().toLowerCase();
  if (phone !== undefined) db.users[idx].phone = phone.trim();
  if (vehicle !== undefined) db.users[idx].vehicle = vehicle.trim();
  if (password) db.users[idx].password = password.trim();

  writeDB(db);
  const { password: _, ...userSafe } = db.users[idx];
  res.json({ success: true, user: userSafe });
});

// Admin: Eliminar usuario
app.delete('/api/users/:id', (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);

  const target = db.users.find(u => u.id === id);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  if (target.username === 'admin') {
    return res.status(400).json({ success: false, message: 'No se puede eliminar la cuenta principal de administrador' });
  }

  db.users = db.users.filter(u => u.id !== id);
  writeDB(db);
  res.json({ success: true, message: 'Usuario eliminado exitosamente' });
});

// ==========================================
// 2. CLIENTES
// ==========================================
app.get('/api/clients', (req, res) => {
  res.json(readDB().clients || []);
});

app.post('/api/clients', (req, res) => {
  const db = readDB();
  const newClient = {
    id: Date.now(),
    code: req.body.code || `CLI-${Date.now().toString().slice(-4)}`,
    name: req.body.name,
    address: req.body.address,
    phone: req.body.phone || '',
    lat: req.body.lat || '',
    lng: req.body.lng || ''
  };
  db.clients.push(newClient);
  writeDB(db);
  res.json({ success: true, client: newClient });
});

app.put('/api/clients/:id', (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  const idx = db.clients.findIndex(c => c.id === id);
  if (idx !== -1) {
    db.clients[idx] = { ...db.clients[idx], ...req.body };
    writeDB(db);
    return res.json({ success: true, client: db.clients[idx] });
  }
  res.status(404).json({ success: false, message: 'Cliente no encontrado' });
});

app.delete('/api/clients/:id', (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  db.clients = db.clients.filter(c => c.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// ==========================================
// 3. PRODUCTOS
// ==========================================
app.get('/api/products', (req, res) => {
  res.json(readDB().products || []);
});

app.post('/api/products', (req, res) => {
  const db = readDB();
  const newProd = {
    id: Date.now(),
    code: req.body.code || `PROD-${Date.now().toString().slice(-4)}`,
    name: req.body.name,
    price: Number(req.body.price) || 0,
    stock: Number(req.body.stock) || 0
  };
  db.products.push(newProd);
  writeDB(db);
  res.json({ success: true, product: newProd });
});

app.put('/api/products/:id', (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  const idx = db.products.findIndex(p => p.id === id);
  if (idx !== -1) {
    db.products[idx] = {
      ...db.products[idx],
      ...req.body,
      price: Number(req.body.price),
      stock: Number(req.body.stock)
    };
    writeDB(db);
    return res.json({ success: true, product: db.products[idx] });
  }
  res.status(404).json({ success: false, message: 'Producto no encontrado' });
});

app.delete('/api/products/:id', (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  db.products = db.products.filter(p => p.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// ==========================================
// 4. PEDIDOS / DOCUMENTOS (VENTAS Y FACTURACIÓN)
// ==========================================
app.get('/api/orders', (req, res) => {
  res.json(readDB().orders || []);
});

app.post('/api/orders', (req, res) => {
  const db = readDB();
  const { doc_number, doc_type, client_id, items, created_by } = req.body;

  const client = db.clients.find(c => c.id === client_id);
  const formattedItems = (items || []).map((it, idx) => ({
    id: idx + 1,
    product_code: it.product_code,
    product_name: it.product_name,
    price: Number(it.price) || 0,
    quantity: Number(it.quantity) || 1,
    subtotal: (Number(it.price) || 0) * (Number(it.quantity) || 1),
    checked_bodega: false,
    checked_driver: false
  }));

  const isProforma = (doc_type === 'PROFORMA');
  const newOrder = {
    id: Date.now(),
    doc_type: doc_type || 'PROFORMA',
    proforma_number: isProforma ? doc_number : '',
    invoice_number: !isProforma ? doc_number : '',
    client_id: client ? client.id : null,
    client_name: client ? client.name : 'Cliente General',
    address: client ? client.address : '',
    phone: client ? client.phone : '',
    lat: client ? client.lat : '',
    lng: client ? client.lng : '',
    status: 'PENDIENTE_BODEGA',
    created_by: created_by || 'Ventas',
    created_at: new Date().toISOString(),
    items: formattedItems,
    delivery_status: 'PENDIENTE',
    delivery_notes: '',
    delivered_at: null
  };

  db.orders.push(newOrder);
  writeDB(db);
  res.json({ success: true, order: newOrder });
});

// Bodega: Marcar checklist físico de ítem individual
app.patch('/api/items/:orderId/:itemId/check-bodega', (req, res) => {
  const db = readDB();
  const orderId = Number(req.params.orderId);
  const itemId = Number(req.params.itemId);
  const { checked } = req.body;

  const order = db.orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

  const item = order.items.find(i => i.id === itemId);
  if (item) {
    item.checked_bodega = !!checked;
    writeDB(db);
    return res.json({ success: true, item });
  }
  res.status(404).json({ success: false, message: 'Ítem no encontrado' });
});

// Bodega: Aprobar verificación física completa
app.patch('/api/orders/:id/aprobar-bodega', (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  const order = db.orders.find(o => o.id === id);

  if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

  // Si era proforma pasa a PROFORMA_REVISADA (para que facturación le asigne factura)
  // Si ya tenía factura directa, pasa a FACTURA_LISTA_RUTA
  if (order.doc_type === 'PROFORMA') {
    order.status = 'PROFORMA_REVISADA';
  } else {
    order.status = 'FACTURA_LISTA_RUTA';
  }

  // Marcar todos los ítems como chequeados
  order.items.forEach(i => i.checked_bodega = true);

  writeDB(db);
  res.json({ success: true, order });
});

// Facturadora: Asignar número de factura definitivo
app.patch('/api/orders/:id/facturar', (req, res) => {
  const db = readDB();
  const id = Number(req.params.id);
  const { invoice_number } = req.body;

  const order = db.orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

  order.invoice_number = invoice_number || `FAC-${Date.now().toString().slice(-4)}`;
  order.status = 'FACTURA_LISTA_RUTA';

  writeDB(db);
  res.json({ success: true, order });
});

// ========================================================
// 5. LOGÍSTICA, RUTAS, HOJA DE PICKING Y ENTREGAS EN VIVO
// ========================================================
app.get('/api/routes', (req, res) => {
  res.json(readDB().routes || []);
});

// Crear nueva ruta y generar automáticamente la HOJA DE PICKING CONSOLIDADA
app.post('/api/routes', (req, res) => {
  const db = readDB();
  const { driver_name, stops } = req.body;

  if (!driver_name || !stops || stops.length === 0) {
    return res.status(400).json({ success: false, message: 'Seleccione un conductor y al menos un pedido' });
  }

  // Buscar vehículo asociado al conductor
  const driverUser = db.users.find(u => u.name === driver_name);
  const vehicle = driverUser ? driverUser.vehicle : '';

  const routeNumber = 'RUT-' + Math.floor(100 + Math.random() * 900);

  // CONSOLIDAR HOJA DE PICKING PARA TODA LA RUTA
  const consolidatedMap = {};
  const formattedStops = [];

  stops.forEach((st, idx) => {
    let order = null;
    if (st.order_id) {
      order = db.orders.find(o => o.id === Number(st.order_id));
      if (order) {
        order.status = 'EN_RUTA';
        order.route_id = routeNumber;
        order.driver_name = driver_name;
        order.delivery_status = 'PENDIENTE';

        // Sumar cada ítem al total consolidado de la ruta completa
        order.items.forEach(it => {
          const code = it.product_code;
          if (!consolidatedMap[code]) {
            consolidatedMap[code] = {
              product_code: it.product_code,
              product_name: it.product_name,
              total_quantity: 0,
              checked: false
            };
          }
          consolidatedMap[code].total_quantity += Number(it.quantity);
        });
      }
    }

    formattedStops.push({
      id: idx + 1,
      type: st.type || 'DELIVERY',
      order_id: st.order_id ? Number(st.order_id) : null,
      title: st.title || (order ? order.client_name : 'Parada'),
      address: st.address || (order ? order.address : ''),
      phone: st.phone || (order ? order.phone : ''),
      sequence: Number(st.sequence) || (idx + 1),
      lat: st.lat || (order ? order.lat : ''),
      lng: st.lng || (order ? order.lng : ''),
      details: st.details || '',
      status: 'PENDIENTE',
      notes: '',
      completed_at: null
    });
  });

  const pickingItems = Object.values(consolidatedMap);

  const newRoute = {
    id: routeNumber,
    driver_name,
    vehicle: vehicle || 'Vehículo de Flota',
    created_at: new Date().toISOString(),
    status: 'ASIGNADA', // ASIGNADA -> EN_RUTA -> FINALIZADA
    picking_confirmed: false,
    picking_items: pickingItems,
    stops: formattedStops
  };

  db.routes.push(newRoute);
  writeDB(db);
  res.json({ success: true, route: newRoute });
});

// Obtener detalle de Hoja de Picking consolidada para la ruta
app.get('/api/routes/:id/picking', (req, res) => {
  const db = readDB();
  const route = db.routes.find(r => r.id === req.params.id);
  if (!route) return res.status(404).json({ success: false, message: 'Ruta no encontrada' });

  res.json({
    success: true,
    route,
    picking_items: route.picking_items || [],
    stops: route.stops || []
  });
});

// El conductor va confirmando cada producto en la web durante la carga
app.patch('/api/routes/:id/picking-item', (req, res) => {
  const db = readDB();
  const route = db.routes.find(r => r.id === req.params.id);
  if (!route) return res.status(404).json({ success: false, message: 'Ruta no encontrada' });

  const { product_code, checked } = req.body;
  const item = (route.picking_items || []).find(p => p.product_code === product_code);

  if (item) {
    item.checked = !!checked;
    writeDB(db);
    return res.json({ success: true, item, picking_items: route.picking_items });
  }

  res.status(404).json({ success: false, message: 'Producto no encontrado en hoja de picking' });
});

// El conductor confirma la carga completa en el vehículo -> Pasa a estado "EN_RUTA"
app.patch('/api/routes/:id/confirm-picking', (req, res) => {
  const db = readDB();
  const route = db.routes.find(r => r.id === req.params.id);
  if (!route) return res.status(404).json({ success: false, message: 'Ruta no encontrada' });

  route.picking_confirmed = true;
  route.status = 'EN_RUTA';

  // Si había ítems sin marcar, los marca como verificados
  if (route.picking_items) {
    route.picking_items.forEach(i => i.checked = true);
  }

  writeDB(db);
  res.json({ success: true, route });
});

// Conductor confirma entrega individual con NOTAS O INCIDENCIAS
app.patch('/api/routes/:id/stop/:stopId/deliver', (req, res) => {
  const db = readDB();
  const route = db.routes.find(r => r.id === req.params.id);
  if (!route) return res.status(404).json({ success: false, message: 'Ruta no encontrada' });

  const stopId = Number(req.params.stopId);
  const stop = (route.stops || []).find(s => s.id === stopId);
  if (!stop) return res.status(404).json({ success: false, message: 'Parada no encontrada' });

  const { status, notes } = req.body; // status: 'ENTREGADO', 'INCIDENCIA', 'NO_ENTREGADO'
  stop.status = status || 'ENTREGADO';
  stop.notes = notes || '';
  stop.completed_at = new Date().toISOString();

  // Actualizar también en el pedido original para trazabilidad de ventas y admin
  if (stop.order_id) {
    const order = db.orders.find(o => o.id === stop.order_id);
    if (order) {
      order.status = stop.status;
      order.delivery_status = stop.status;
      order.delivery_notes = notes || '';
      order.delivered_at = new Date().toISOString();
    }
  }

  // Verificar si todas las paradas de la ruta fueron atendidas
  const allCompleted = route.stops.every(s => s.status && s.status !== 'PENDIENTE');
  if (allCompleted) {
    route.status = 'FINALIZADA';
  }

  writeDB(db);
  res.json({ success: true, route, stop });
});

// Conductor marca ítem individual de un pedido
app.patch('/api/items/:orderId/:itemId/check-driver', (req, res) => {
  const db = readDB();
  const orderId = Number(req.params.orderId);
  const itemId = Number(req.params.itemId);
  const { checked } = req.body;

  const order = db.orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

  const item = order.items.find(i => i.id === itemId);
  if (item) {
    item.checked_driver = !!checked;
    writeDB(db);
    return res.json({ success: true, item });
  }
  res.status(404).json({ success: false, message: 'Ítem no encontrado' });
});

// Agregar Parada Extra (recolección en proveedor) a una ruta
app.post('/api/routes/:id/add-stop', (req, res) => {
  const db = readDB();
  const route = db.routes.find(r => r.id === req.params.id);
  if (!route) return res.status(404).json({ success: false, message: 'Ruta no encontrada' });

  const { title, address, details, sequence } = req.body;
  const newStop = {
    id: Date.now(),
    type: 'PICKUP',
    title: title || 'Recolección Extra',
    address: address || '',
    phone: '',
    sequence: Number(sequence) || ((route.stops || []).length + 1),
    lat: '',
    lng: '',
    details: details || '',
    status: 'PENDIENTE',
    notes: '',
    completed_at: null
  };

  route.stops.push(newStop);
  route.stops.sort((a, b) => a.sequence - b.sequence);

  writeDB(db);
  res.json({ success: true, stop: newStop, route });
});

// Eliminar / Cancelar ruta
app.delete('/api/routes/:id', (req, res) => {
  const db = readDB();
  const route = db.routes.find(r => r.id === req.params.id);
  if (!route) return res.status(404).json({ success: false, message: 'Ruta no encontrada' });

  // Revertir estado de las órdenes que estaban en esta ruta
  (route.stops || []).forEach(st => {
    if (st.order_id) {
      const order = db.orders.find(o => o.id === st.order_id);
      if (order && order.status === 'EN_RUTA') {
        order.status = 'FACTURA_LISTA_RUTA';
        delete order.route_id;
        delete order.driver_name;
      }
    }
  });

  db.routes = db.routes.filter(r => r.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'Ruta cancelada' });
});

// ==========================================
// 6. EXPORTACIÓN DE REPORTES Y COPIA DE SEGURIDAD
// ==========================================
// Exportar reporte de entregas y notas a formato CSV (Compatible con Excel)
app.get('/api/reports/export-csv', (req, res) => {
  const db = readDB();
  const orders = db.orders || [];

  const headers = ['ID', 'Tipo Doc', 'Numero Documento', 'Cliente', 'Direccion', 'Conductor', 'Ruta', 'Estado Entrega', 'Notas Conductor', 'Fecha Creacion', 'Fecha Entrega'];
  const rows = orders.map(o => [
    o.id,
    o.doc_type || 'FACTURA',
    `"${(o.invoice_number || o.proforma_number || '').replace(/"/g, '""')}"`,
    `"${(o.client_name || '').replace(/"/g, '""')}"`,
    `"${(o.address || '').replace(/"/g, '""')}"`,
    `"${(o.driver_name || 'Sin asignar').replace(/"/g, '""')}"`,
    `"${(o.route_id || 'N/A').replace(/"/g, '""')}"`,
    `"${(o.delivery_status || o.status || 'PENDIENTE').replace(/"/g, '""')}"`,
    `"${(o.delivery_notes || '').replace(/"/g, '""')}"`,
    `"${(o.created_at || '').replace(/"/g, '""')}"`,
    `"${(o.delivered_at || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="reporte_entregas_ecologistica.csv"');
  res.send(csvContent);
});

// Descargar respaldo completo de base de datos
app.get('/api/backup', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup_ecologistica_${new Date().toISOString().slice(0, 10)}.json"`);
  res.sendFile(DB_FILE);
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor EcoLogística ejecutándose en http://localhost:${PORT}`);
});