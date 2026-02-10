const fs = require('fs');

// Get files from arguments
const files = process.argv.slice(2);

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    // Pattern 1: w-[18px] h-[18px] inside Icon className
    if (content.includes('w-[18px]') && content.includes('h-[18px]') && content.includes('<Icon')) {
        const lines = content.split('\n');
        const newLines = lines.map(line => {
            if (line.includes('<Icon') && line.includes('w-[18px]') && line.includes('h-[18px]')) {
                let newLine = line.replace(/w-\[18px\]/g, '').replace(/h-\[18px\]/g, '');
                // Cleanup double spaces
                newLine = newLine.replace(/className="\s+/g, 'className="').replace(/\s+"/g, '"').replace(/\s\s+/g, ' ');
                
                if (!newLine.includes('size=')) {
                    newLine = newLine.replace('<Icon', '<Icon size="md"');
                }
                return newLine;
            }
            return line;
        });
        content = newLines.join('\n');
    }
    
    // Pattern 2: size-[18px] (re-run to catch any left overs or new finds)
    if (content.includes('size-[18px]') && content.includes('<Icon')) {
        const lines = content.split('\n');
        const newLines = lines.map(line => {
            if (line.includes('<Icon') && line.includes('size-[18px]')) {
                let newLine = line.replace(/size-\[18px\]/g, '');
                // Cleanup
                newLine = newLine.replace(/className="\s+/g, 'className="').replace(/\s+"/g, '"').replace(/\s\s+/g, ' ');
                
                if (!newLine.includes('size=')) {
                    newLine = newLine.replace('<Icon', '<Icon size="md"');
                }
                return newLine;
            }
            return line;
        });
        content = newLines.join('\n');
    }

    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated: ${file}`);
    }
  } catch (e) {
    // Ignore errors for directories or non-text files passed by find
  }
});
