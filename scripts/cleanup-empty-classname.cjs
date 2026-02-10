const fs = require('fs');

const files = process.argv.slice(2);

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    // Replace className="" with nothing
    content = content.replace(/\s+className=""/g, '');
    content = content.replace(/\s+className=" "/g, '');

    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Cleaned: ${file}`);
    }
  } catch (e) { }
});
