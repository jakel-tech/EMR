const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<([A-Za-z0-9_.-]+)([^>]*?)>/g;
let match;

while ((match = regex.exec(content)) !== null) {
  const tagContent = match[2];
  if (tagContent.includes('font-black')) {
    let cleaned = tagContent.replace(/className=(["'])(?:(?=(\\?))\2.)*?\1/g, '');
    cleaned = cleaned.replace(/className=\{[^{}]*\}/g, '');
    cleaned = cleaned.replace(/className=\{[^{}]*\{[^{}]*\}[^{}]*\}/g, ''); // 1 level nested
    if (cleaned.includes('font-black')) {
      const idx = match.index;
      const lines = content.slice(0, idx).split('\n');
      console.log(`Line ${lines.length}: <${match[1]} ${tagContent}>`);
    }
  }
}
