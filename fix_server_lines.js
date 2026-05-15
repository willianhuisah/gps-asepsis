const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');

const start = 407; // Line 408 (0-indexed is 407)
const end = 416;   // Line 417 (0-indexed is 416)

const newLines = [
  '      // 🧹 LIMPIEZA AUTOMÁTICA MEJORADA',
  '      const paradasRestantes = v.ruta.slice(v.puntoActual).filter(p => p.esParadaPrincipal && p.estado !== \'completado\');',
  '      if (paradasRestantes.length === 0) {',
  '        v.ruta = [];',
  '        v.puntoActual = 0;',
  '        v.ayudante = "";',
  '        v.observaciones = "";',
  '        v.horaSalida = "";',
  '        v.horaRegreso = "";',
  '      }'
];

lines.splice(start, end - start + 1, ...newLines);
fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log("✅ server.js actualizado por líneas.");
