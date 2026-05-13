const fs = require('fs');
const path = 'public/index.html';
let content = fs.readFileSync(path, 'utf8');

const mapping = {
  "LogÃ­stica": "Logística",
  "ðŸš ": "🚐",
  "ðŸ ¥": "🏥",
  "ðŸ—ºï¸ ": "🗺️",
  "ðŸšš": "🚚",
  "GestiÃ³n": "Gestión",
  "ðŸ“…": "📅",
  "ACCIÃ“N": "ACCIÓN",
  "MÃ©dico": "Médico",
  "ClÃ­nica": "Clínica",
  "DirecciÃ³n": "Dirección",
  "ðŸ©º": "🩺",
  "ðŸ  ": "🏠",
  "ðŸ” ": "🔍",
  "direcciÃ³n": "dirección",
  "ðŸ  ï¸ ": "🏍️",
  "ðŸš›": "🚛",
  "conexiÃ³n": "conexión",
  "Â¿Seguro": "¿Seguro",
  "alfabÃ©ticamente": "alfabéticamente",
  "BotÃ³n": "Botón",
  "ðŸ“‹": "📋",
  "âœ ï¸ ": "✏️",
  "ðŸ—‘ï¸ ": "🗑️",
  "estÃ¡": "está",
  "tambiÃ©n": "también",
  "vehÃ­culo": "vehículo",
  "VolverÃ¡": "Volverá",
  "AsignaciÃ³n": "Asignación",
  "mÃ©dico": "médico",
  "âš ï¸ ": "⚠️",
  "estÃ©ril": "estéril",
  "ðŸ¢": "🟢",
  "ðŸ”´": "🔴",
  "âœ–": "✖",
  "ðŸ“¦": "📦",
  "DiseÃ±o": "Diseño",
  "âœ“": "✓"
};

for (const [key, value] of Object.entries(mapping)) {
  content = content.split(key).join(value);
}

fs.writeFileSync(path, content, 'utf8');
console.log("✅ index.html limpiado con éxito.");
