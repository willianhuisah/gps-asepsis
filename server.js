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

// 🏥 MODELO CENTRO MÉDICO
const centroMedicoSchema = new mongoose.Schema({
  nombre: String,
  direccion: String,
  tipo: { type: String, default: "clinica" }, 
  lat: Number,
  lng: Number
}, { collection: 'centromedicos' });

const CentroMedico = mongoose.models.CentroMedico || mongoose.model("CentroMedico", centroMedicoSchema);

// 📜 MODELO HISTORIAL
const Historial = mongoose.model("Historial", {
  placa: String,
  chofer: String,
  ayudante: String,
  fecha: String,
  horaSalida: String,
  horaRegreso: String,
  observaciones: String,
  centros: [String],
  totalParadas: Number,
  creadoEn: { type: Date, default: Date.now }
});

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
      velocidad: 30 + Math.floor(Math.random() * 40),
      latitud: baseLat + (Math.random() - 0.5) * 0.08,
      longitud: baseLng + (Math.random() - 0.5) * 0.08,
      ruta: [],
      puntoActual: 0
    }));

    await Vehiculo.insertMany(nuevosVehiculos);
  }

  const countAyudantes = await Ayudante.countDocuments();
  if (countAyudantes === 0) {
    await Ayudante.insertMany([{ nombre: "Luis Ayudante" }, { nombre: "Carlos Soporte" }, { nombre: "José Apoyo" }]);
  }
}

// 📡 SOCKET.IO
io.on("connection", (socket) => {
  Vehiculo.find().lean().then(data => {
    socket.emit("actualizarMapa", data);
  });
});

// 🌐 API - Vehículos
app.get("/api/vehiculos", async (req, res) => {
  const vehiculos = await Vehiculo.find().lean();
  res.json(vehiculos);
});

// 🏥 API - Centros Médicos
app.get("/api/centros", async (req, res) => {
  const centros = await CentroMedico.find().lean();
  res.json(centros);
});

app.post("/api/centros", async (req, res) => {
  try {
    let { nombre, direccion, tipo } = req.body;
    tipo = tipo.toString().toLowerCase().trim();
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ", Lima, Peru")}`;
    const geocodeRes = await fetch(url, { headers: { 'User-Agent': 'Asepsis/1.0' } });
    const geocodeData = await geocodeRes.json();
    if (!geocodeData || geocodeData.length === 0) return res.status(404).json({ error: "No coordenadas" });
    const lat = parseFloat(geocodeData[0].lat);
    const lng = parseFloat(geocodeData[0].lon);
    const nuevo = new CentroMedico({ nombre, direccion, tipo, lat, lng });
    await nuevo.save();
    io.emit("actualizarCentros");
    res.json(nuevo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/centros/:id", async (req, res) => {
  try {
    let { nombre, direccion, tipo } = req.body;
    tipo = tipo.toString().toLowerCase().trim();
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ", Lima, Peru")}`;
    const geocodeRes = await fetch(url, { headers: { 'User-Agent': 'Asepsis/1.0' } });
    const geocodeData = await geocodeRes.json();
    const lat = parseFloat(geocodeData[0].lat);
    const lng = parseFloat(geocodeData[0].lon);
    await CentroMedico.findByIdAndUpdate(req.params.id, { nombre, direccion, tipo, lat, lng });
    io.emit("actualizarCentros");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/centros/:id", async (req, res) => {
  await CentroMedico.findByIdAndDelete(req.params.id);
  io.emit("actualizarCentros");
  res.json({ success: true });
});

// 👨‍🔧 API - Ayudantes
app.get("/api/ayudantes", async (req, res) => {
  const data = await Ayudante.find();
  res.json(data);
});

app.post("/api/ayudantes", async (req, res) => {
  const nuevo = new Ayudante({ nombre: req.body.nombre });
  await nuevo.save();
  res.json(nuevo);
});

// 📜 API - Historial
app.get("/api/historial", async (req, res) => {
  const data = await Historial.find().sort({ creadoEn: -1 }).limit(50);
  res.json(data);
});

// 🌐 API - Asignar Ruta
app.post("/api/vehiculos/:id/ruta", async (req, res) => {
  try {
    const v = await Vehiculo.findById(req.params.id);
    const destinos = req.body.centros;
    v.ayudante = req.body.ayudante || "";
    v.observaciones = req.body.observaciones || "";
    v.horaSalida = req.body.horaSalida || "";
    v.horaRegreso = req.body.horaRegreso || "";
    v.ruta = [];
    v.puntoActual = 0;

    let origenLat = v.latitud;
    let origenLng = v.longitud;

    for (const destino of destinos) {
      const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${origenLng},${origenLat};${destino.lng},${destino.lat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      if (osrmData.routes && osrmData.routes.length > 0) {
        const coords = osrmData.routes[0].geometry.coordinates;
        const puntos = coords.map((c, i) => ({
          nombre: i === coords.length - 1 ? destino.nombre : "En tránsito",
          lat: c[1], lng: c[0], estado: "pendiente", esParadaPrincipal: i === coords.length - 1
        }));
        v.ruta.push(...puntos);
      }
      origenLat = destino.lat; origenLng = destino.lng;
    }
    await v.save();
    io.emit("actualizarMapa", await Vehiculo.find().lean());
    res.json(v);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function archivarRuta(v) {
  try {
    const paradasPrincipales = v.ruta.filter(p => p.esParadaPrincipal);
    const historial = new Historial({
      placa: v.placa,
      chofer: v.chofer,
      ayudante: v.ayudante,
      fecha: new Date().toLocaleDateString(),
      horaSalida: v.horaSalida,
      horaRegreso: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      observaciones: v.observaciones,
      centros: paradasPrincipales.map(p => p.nombre),
      totalParadas: paradasPrincipales.length
    });
    await historial.save();
    console.log(`📜 Ruta archivada para ${v.placa}`);
  } catch (e) { console.error("Error archivando:", e); }
}

// 🌐 API - Entregado
app.post("/api/vehiculos/:id/entregado", async (req, res) => {
  const v = await Vehiculo.findById(req.params.id);
  if (v && v.ruta.length > 0) {
    while (v.puntoActual < v.ruta.length) {
      v.ruta[v.puntoActual].estado = "completado";
      v.latitud = v.ruta[v.puntoActual].lat;
      v.longitud = v.ruta[v.puntoActual].lng;
      const isP = v.ruta[v.puntoActual].esParadaPrincipal;
      v.puntoActual++;
      if (isP) break;
    }
    const restantes = v.ruta.slice(v.puntoActual).filter(p => p.esParadaPrincipal && p.estado !== 'completado');
    if (restantes.length === 0) {
      await archivarRuta(v); // ARCHIVAR ANTES DE LIMPIAR
      v.ruta = []; v.puntoActual = 0; v.ayudante = ""; v.horaSalida = ""; v.horaRegreso = "";
    }
    v.markModified('ruta');
    await v.save();
    io.emit("actualizarMapa", await Vehiculo.find().lean());
  }
  res.json(v);
});

app.patch("/api/vehiculos/:id/horario", async (req, res) => {
  const v = await Vehiculo.findByIdAndUpdate(req.params.id, req.body, { new: true });
  io.emit("actualizarMapa", await Vehiculo.find().lean());
  res.json(v);
});

server.listen(3000, () => { console.log("🚀 http://localhost:3000"); });

setInterval(async () => {
  const vehiculos = await Vehiculo.find();
  let hayCambios = false;
  for (let v of vehiculos) {
    if (!v.ruta || v.ruta.length === 0 || v.puntoActual >= v.ruta.length) continue;
    const dest = v.ruta[v.puntoActual];
    const factor = v.velocidad * 0.000005;
    const dLat = dest.lat - v.latitud;
    const dLng = dest.lng - v.longitud;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist > factor) {
      const r = factor / dist;
      v.latitud += dLat * r; v.longitud += dLng * r;
    } else {
      v.latitud = dest.lat; v.longitud = dest.lng;
      v.ruta[v.puntoActual].estado = "completado";
      v.puntoActual++;
      if (v.puntoActual >= v.ruta.length) {
        await archivarRuta(v); // ARCHIVAR ANTES DE LIMPIAR
        v.ruta = []; v.puntoActual = 0; v.ayudante = ""; v.horaSalida = ""; v.horaRegreso = "";
      }
      v.markModified('ruta');
    }
    await v.save();
    hayCambios = true;
  }
  if (hayCambios) io.emit("actualizarMapa", await Vehiculo.find().lean());
}, 3000);