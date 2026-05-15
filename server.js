const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));


// 🔗 CONEXIÓN MONGODB
mongoose.connect("mongodb://127.0.0.1:27017/flotagps")
  .then(async () => {
    console.log("✅ MongoDB conectado")
    await inicializarVehiculos(); // Inicializar después de conectar
  })
  .catch(err => console.log(err));


// 📦 MODELO VEHÍCULO
const Vehiculo = mongoose.model("Vehiculo", {
  placa: String,
  chofer: String,
  tipo: { type: String, default: "camioneta" }, // moto, camioneta, camion
  velocidad: { type: Number, default: 40 }, // km/h
  latitud: Number,
  longitud: Number,
  ayudante: { type: String, default: "" },
  observaciones: { type: String, default: "" },
  horaSalida: { type: String, default: "" },
  horaRegreso: { type: String, default: "" },

  ruta: [
    {
      nombre: String,
      lat: Number,
      lng: Number,
      estado: {
        type: String,
        default: "pendiente"
      },
      esParadaPrincipal: {
        type: Boolean,
        default: false
      }
    }
  ],

  puntoActual: {
    type: Number,
    default: 0
  }
});

// 👨‍🔧 MODELO AYUDANTE
const Ayudante = mongoose.model("Ayudante", {
  nombre: String
});

// 🏥 MODELO CENTRO MÉDICO (Forzando nombre de colección 'centromedicos')
const centroMedicoSchema = new mongoose.Schema({
  nombre: String,
  direccion: String,
  tipo: { type: String, default: "clinica" }, // hospital, clinica, particular
  lat: Number,
  lng: Number
}, { collection: 'centromedicos' }); // <--- IMPORTANTE: Forzar nombre de colección

const CentroMedico = mongoose.models.CentroMedico || mongoose.model("CentroMedico", centroMedicoSchema);

// 🚀 FUNCIÓN PARA INICIALIZAR DATOS
async function inicializarVehiculos() {
  const count = await Vehiculo.countDocuments();
  if (count === 0) {
    console.log("🌱 Inicializando 10 vehículos de prueba para Asepsis...");
    const tipos = ["moto", "camioneta", "camion"];
    const choferes = ["Juan Pérez", "Carlos Gómez", "Luis Silva", "Ana Rojas", "María Torres", "Pedro Ruiz", "José Vargas", "Miguel Flores", "Rosa Castro", "Jorge Luna"];

    const baseLat = -12.0852;
    const baseLng = -76.9772;

    const nuevosVehiculos = Array.from({ length: 10 }).map((_, i) => ({
      placa: `ASE-${100 + i}`,
      chofer: choferes[i],
      tipo: tipos[i % 3],
      velocidad: 30 + Math.floor(Math.random() * 40), // 30-70 km/h
      latitud: baseLat + (Math.random() - 0.5) * 0.08,
      longitud: baseLng + (Math.random() - 0.5) * 0.08,
      ruta: [],
      puntoActual: 0,
      historial: []
    }));

    await Vehiculo.insertMany(nuevosVehiculos);
    console.log("✅ Datos guardados.");
  }

  const countAyudantes = await Ayudante.countDocuments();
  if (countAyudantes === 0) {
    console.log("🌱 Inicializando ayudantes de prueba...");
    await Ayudante.insertMany([{ nombre: "Luis Ayudante" }, { nombre: "Carlos Soporte" }, { nombre: "José Apoyo" }]);
  }
}

// 📡 SOCKET.IO
io.on("connection", (socket) => {
  console.log("🔌 Cliente conectado");

  // Enviar data actual cuando alguien entra
  Vehiculo.find().lean().then(data => {
    socket.emit("actualizarMapa", data);
  });
});


// 🌐 API - obtener vehículos
app.get("/api/vehiculos", async (req, res) => {
  const vehiculos = await Vehiculo.find().lean();
  res.json(vehiculos);
});


// 🌐 API - crear vehículo
app.post("/api/vehiculos", async (req, res) => {
  const nuevo = new Vehiculo(req.body);
  await nuevo.save();
  res.json(nuevo);
});

// ============================================
// 🏥 API - MÓDULO DE CENTROS MÉDICOS
// ============================================

// GET - Obtener todos
app.get("/api/centros", async (req, res) => {
  try {
    const centros = await CentroMedico.find().lean();
    res.json(centros);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST - Crear y Geocodificar
app.post("/api/centros", async (req, res) => {
  try {
    console.log("📥 Datos recibidos:", req.body);

    let { nombre, direccion, tipo } = req.body;

    if (!nombre || !direccion || !tipo) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // 🔥 NORMALIZAR BIEN
    tipo = tipo.toString().toLowerCase().trim();

    const tiposValidos = ["hospital", "clinica", "particular"];

    if (!tiposValidos.includes(tipo)) {
      console.log("❌ Tipo inválido recibido:", tipo);
      return res.status(400).json({ error: "Tipo inválido" });
    }

    console.log("✅ Tipo procesado:", tipo);

    // 🌍 Geocoding
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ", Lima, Peru")}`;

    const geocodeRes = await fetch(url, {
      headers: { 'User-Agent': 'Asepsis/1.0' }
    });

    const geocodeData = await geocodeRes.json();

    if (!geocodeData || geocodeData.length === 0) {
      return res.status(404).json({ error: "No se encontraron coordenadas" });
    }

    const lat = parseFloat(geocodeData[0].lat);
    const lng = parseFloat(geocodeData[0].lon);

    const nuevoCentro = new CentroMedico({
      nombre,
      direccion,
      tipo, // 🔥 ESTE ES EL IMPORTANTE
      lat,
      lng
    });

    await nuevoCentro.save();

    console.log("💾 Guardado en DB:", nuevoCentro);

    io.emit("actualizarCentros");

    res.json(nuevoCentro);

  } catch (e) {
    console.error("❌ Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT - Editar centro
app.put("/api/centros/:id", async (req, res) => {
  try {
    let { nombre, direccion, tipo } = req.body;

    if (!nombre || !direccion || !tipo) return res.status(400).json({ error: "Faltan datos obligatorios" });

    // 🔥 NORMALIZAR BIEN
    tipo = tipo.toString().toLowerCase().trim();
    const tiposValidos = ["hospital", "clinica", "particular"];

    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: "Tipo inválido" });
    }

    // Re-geocodificar si cambia la dirección
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ", Lima, Peru")}`;
    const geocodeRes = await fetch(url, { headers: { 'User-Agent': 'Asepsis/1.0' } });
    const geocodeData = await geocodeRes.json();

    if (!geocodeData || geocodeData.length === 0) {
      return res.status(404).json({ error: "No se encontraron coordenadas" });
    }

    const lat = parseFloat(geocodeData[0].lat);
    const lng = parseFloat(geocodeData[0].lon);

    await CentroMedico.findByIdAndUpdate(req.params.id, { nombre, direccion, tipo, lat, lng });
    io.emit("actualizarCentros");
    res.json({ success: true });
  } catch (e) {
    console.error("❌ Error en PUT:", e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE - Eliminar centro
app.delete("/api/centros/:id", async (req, res) => {
  try {
    await CentroMedico.findByIdAndDelete(req.params.id);
    io.emit("actualizarCentros");
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================

// 👨‍🔧 API - AYUDANTES
app.get("/api/ayudantes", async (req, res) => {
  try {
    const ayudantes = await Ayudante.find();
    res.json(ayudantes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/ayudantes", async (req, res) => {
  try {
    const nuevo = new Ayudante({ nombre: req.body.nombre });
    await nuevo.save();
    res.json(nuevo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================

// 🌐 API - Asignar Ruta (Ruteo Real por Calles)
app.post("/api/vehiculos/:id/ruta", async (req, res) => {
  try {
    const v = await Vehiculo.findById(req.params.id);
    if (!v) return res.status(404).json({ error: "No encontrado" });

    // Soportar tanto un solo destino como múltiples
    const destinos = Array.isArray(req.body.centros) ? req.body.centros : (Array.isArray(req.body) ? req.body : [req.body]);
    if (destinos.length === 0) return res.status(400).json({ error: "No se enviaron destinos" });

    v.ayudante = req.body.ayudante || "";
    v.observaciones = req.body.observaciones || "";
    v.horaSalida = req.body.horaSalida || "";
    v.horaRegreso = req.body.horaRegreso || "";

    // Contar cuántas paradas principales ya tiene (Req 4: Máximo 7)
    const paradasActuales = v.ruta.filter(p => p.esParadaPrincipal).length;
    if (paradasActuales + destinos.length > 20) {
      return res.status(400).json({ error: "Máximo de 7 paradas en total alcanzado para esta unidad." });
    }

    // Definir punto de origen para el ruteo
    let origenLat = v.latitud;
    let origenLng = v.longitud;

    if (v.ruta.length > 0) {
      const ultimoPunto = v.ruta[v.ruta.length - 1];
      origenLat = ultimoPunto.lat;
      origenLng = ultimoPunto.lng;
    }

    // Iterar por cada destino para armar los tramos de la ruta
    for (const destino of destinos) {
      const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${origenLng},${origenLat};${destino.lng},${destino.lat}?overview=full&geometries=geojson`;

      try {
        const osrmRes = await fetch(osrmUrl);
        const osrmData = await osrmRes.json();

        if (osrmData.routes && osrmData.routes.length > 0) {
          const coordinates = osrmData.routes[0].geometry.coordinates; // [lng, lat]

          const nuevosPuntos = coordinates.map((coord, index) => {
            const isLast = index === coordinates.length - 1;
            return {
              nombre: isLast ? destino.nombre : `En tránsito`,
              lat: coord[1],
              lng: coord[0],
              estado: "pendiente",
              esParadaPrincipal: isLast
            };
          });

          // Agregar a la ruta existente sin borrar lo anterior
          v.ruta.push(...nuevosPuntos);
        } else {
          // Fallback
          destino.estado = "pendiente";
          destino.esParadaPrincipal = true;
          v.ruta.push(destino);
        }
      } catch (err) {
        destino.estado = "pendiente";
        destino.esParadaPrincipal = true;
        v.ruta.push(destino);
      }

      // El nuevo origen para el siguiente destino es el destino actual
      origenLat = destino.lat;
      origenLng = destino.lng;
    }

    await v.save();

    const data = await Vehiculo.find().lean();
    io.emit("actualizarMapa", data);
    res.json(v);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🌐 API - Limpiar Ruta
app.delete("/api/vehiculos/:id/ruta", async (req, res) => {
  try {
    const v = await Vehiculo.findById(req.params.id);
    if (!v) return res.status(404).json({ error: "No encontrado" });

    v.ruta = [];
    v.puntoActual = 0;
    v.ayudante = "";
    v.observaciones = "";
    v.horaSalida = "";
    v.horaRegreso = "";

    await v.save();

    const data = await Vehiculo.find().lean();
    io.emit("actualizarMapa", data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🌐 API - Entregado Manual (Req 8)
app.post("/api/vehiculos/:id/entregado", async (req, res) => {
  try {
    const v = await Vehiculo.findById(req.params.id);
    if (v && v.ruta.length > 0 && v.puntoActual < v.ruta.length) {

      // Avanzar hasta la siguiente parada principal (saltando esquinas interactivas)
      while (v.puntoActual < v.ruta.length) {
        v.ruta[v.puntoActual].estado = "completado";
        const isPrincipal = v.ruta[v.puntoActual].esParadaPrincipal;
        
        // Actualizar ubicación física a la parada
        v.latitud = v.ruta[v.puntoActual].lat;
        v.longitud = v.ruta[v.puntoActual].lng;
        
        v.puntoActual++;

        if (isPrincipal) break;
      }

      // 🧹 LIMPIEZA AUTOMÁTICA MEJORADA
      const paradasRestantes = v.ruta.slice(v.puntoActual).filter(p => p.esParadaPrincipal && p.estado !== 'completado');
      if (paradasRestantes.length === 0) {
        v.ruta = [];
        v.puntoActual = 0;
        v.ayudante = "";
        v.observaciones = "";
        v.horaSalida = "";
        v.horaRegreso = "";
      }

      v.markModified('ruta');
      await v.save();

      const data = await Vehiculo.find().lean();
      io.emit("actualizarMapa", data);
    }
    res.json(v);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🌐 API - GPS Real Integration (Req 15)
app.post("/api/vehiculos/:id/ubicacion", async (req, res) => {
  try {
    const { lat, lng, velocidad } = req.body;
    const v = await Vehiculo.findById(req.params.id);
    if (!v) return res.status(404).json({ error: "No encontrado" });

    v.latitud = lat;
    v.longitud = lng;
    if (velocidad !== undefined) v.velocidad = velocidad;

    await v.save();

    const data = await Vehiculo.find().lean();
    io.emit("actualizarMapa", data);
    res.json({ success: true, vehiculo: v });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🌐 API - Editar Horario (Logística)
app.patch("/api/vehiculos/:id/horario", async (req, res) => {
  try {
    const { horaSalida, horaRegreso } = req.body;
    const v = await Vehiculo.findByIdAndUpdate(req.params.id, { horaSalida, horaRegreso }, { new: true });
    
    const data = await Vehiculo.find().lean();
    io.emit("actualizarMapa", data);
    res.json(v);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🚀 SERVIDOR
server.listen(3000, () => {
  console.log("🚀 http://localhost:3000");
});


// 🤖 MOVIMIENTO AUTOMÁTICO CON RUTA
setInterval(async () => {
  try {
    const vehiculos = await Vehiculo.find();
    let hayCambios = false;

    for (let v of vehiculos) {
      if (!v.ruta || v.ruta.length === 0 || v.puntoActual >= v.ruta.length) continue;

      const destino = v.ruta[v.puntoActual];

      // req 10: Simular velocidad del vehículo (conversión para mapa)
      // 0.000005 grados por tick por km/h
      const factorVelocidad = v.velocidad * 0.000005;

      const diffLat = destino.lat - v.latitud;
      const diffLng = destino.lng - v.longitud;
      const distancia = Math.sqrt(diffLat * diffLat + diffLng * diffLng);

      if (distancia > factorVelocidad) {
        const ratio = factorVelocidad / distancia;
        v.latitud += diffLat * ratio;
        v.longitud += diffLng * ratio;
      } else {
        v.latitud = destino.lat;
        v.longitud = destino.lng;

        v.ruta[v.puntoActual].estado = "completado";
        v.puntoActual++;

        // 🧹 LIMPIEZA AUTOMÁTICA AL LLEGAR AL FINAL
        if (v.puntoActual >= v.ruta.length) {
          console.log(`🏁 Ruta finalizada automáticamente para ${v.placa}`);
          v.ruta = [];
          v.puntoActual = 0;
          v.ayudante = "";
          v.observaciones = "";
          v.horaSalida = "";
          v.horaRegreso = "";
        }

        v.markModified('ruta');
        console.log(`📦 Entrega completada por ${v.placa}`);
      }

      await v.save();
      hayCambios = true;
    }

    if (hayCambios) {
      const data = await Vehiculo.find().lean();
      io.emit("actualizarMapa", data);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }

}, 3000);