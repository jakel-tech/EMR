import fs from 'fs';
let c = fs.readFileSync('src/App.tsx', 'utf8');
c = c.replace('className={\\`h-1 rounded-full transition-all \\${i === activeSlide ? "w-8 bg-primary-500" : "w-2 bg-slate-700"}\\`}', 'className={`h-1 rounded-full transition-all ${i === activeSlide ? "w-8 bg-primary-500" : "w-2 bg-slate-700"}`}');
fs.writeFileSync('src/App.tsx', c);
