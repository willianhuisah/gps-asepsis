const mongoose = require('mongoose');

mongoose.connect("mongodb://localhost:27017/flotagps", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log("Conectado. Limpiando rutas antiguas...");
  const Vehiculo = mongoose.model("Vehiculo", new mongoose.Schema({ ruta: Array, puntoActual: Number }), "vehiculos");
  
  await Vehiculo.updateMany({}, { $set: { ruta: [], puntoActual: 0 } });
  
  console.log("¡Rutas limpiadas!");
  process.exit(0);
}).catch(console.error);
