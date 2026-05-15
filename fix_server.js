const fs = require('fs');
const path = 'server.js';
let content = fs.readFileSync(path, 'utf8');

const target = `      // 🧹 LIMPIEZA AUTOMÁTICA: Si ya no quedan más puntos en la ruta
      if (v.puntoActual >= v.ruta.length) {
        console.log(\`🧹 Limpiando ruta completada para \${v.placa}\`);
        v.ruta = [];
        v.puntoActual = 0;
        v.ayudante = "";
        v.observaciones = "";
        v.horaSalida = "";
        v.horaRegreso = "";
      }`;

const replacement = `      // 🧹 LIMPIEZA AUTOMÁTICA MEJORADA
      const paradasRestantes = v.ruta.slice(v.puntoActual).filter(p => p.esParadaPrincipal && p.estado !== 'completado');
      if (paradasRestantes.length === 0) {
        v.ruta = [];
        v.puntoActual = 0;
        v.ayudante = "";
        v.observaciones = "";
        v.horaSalida = "";
        v.horaRegreso = "";
      }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("✅ server.js actualizado con éxito.");
} else {
  console.log("❌ No se encontró el bloque objetivo en server.js.");
  // Intentar una versión sin emojis por si acaso
  const targetSimple = `      if (v.puntoActual >= v.ruta.length) {
        console.log(\`🧹 Limpiando ruta completada para \${v.placa}\`);
        v.ruta = [];
        v.puntoActual = 0;
        v.ayudante = "";
        v.observaciones = "";
        v.horaSalida = "";
        v.horaRegreso = "";
      }`;
  if (content.includes(targetSimple)) {
      content = content.replace(targetSimple, replacement);
      fs.writeFileSync(path, content, 'utf8');
      console.log("✅ server.js actualizado con éxito (match simple).");
  }
}
