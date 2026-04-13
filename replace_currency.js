const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const sub = path.join(dir, f);
    if (fs.statSync(sub).isDirectory()) {
      walk(sub);
    } else if (sub.endsWith('.jsx')) {
      let content = fs.readFileSync(sub, 'utf8');
      let orig = content;
      // Replace $ before curly brace, eg ${price} -> ₱{price}
      content = content.replace(/\$(?=\{[a-zA-Z])/g, '₱');
      // Replace $ before numbers, eg $120 -> ₱120
      content = content.replace(/\$([0-9]+)/g, '₱$1');
      if (content !== orig) {
        fs.writeFileSync(sub, content);
        console.log('Updated', sub);
      }
    }
  });
}

walk('client/src/app');
