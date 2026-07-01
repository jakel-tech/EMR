import fs from 'fs';
let c = fs.readFileSync('src/App.tsx', 'utf8');
c = c.replace(
  '<ViewHeader\n                  title={\n                    navItems.find((n) => n.id === activeTab)?.label || activeTab\n                  }\n                  subtitle={isRTL ? "مساحة العمل" : "Workspace"}\n                />',
  '<ViewHeader\n                  title={\n                    navItems.find((n) => n.id === activeTab)?.label || activeTab\n                  }\n                  icon={navItems.find((n) => n.id === activeTab)?.icon || Activity}\n                  subtitle={isRTL ? "مساحة العمل" : "Workspace"}\n                />'
);
fs.writeFileSync('src/App.tsx', c);
