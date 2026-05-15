const fs = require('fs');
let css = fs.readFileSync('public/styles.css', 'utf8');
css = css.replace('.premium-table tbody tr {\n  cursor: pointer;\n}', '.premium-table tbody tr {\n  cursor: default;\n}');
fs.writeFileSync('public/styles.css', css, 'utf8');
console.log("✅ styles.css actualizado.");
