import { execSync } from 'child_process';
try {
  console.log("Restoring src/App.tsx...");
  const output = execSync('git checkout src/App.tsx', { encoding: 'utf8' });
  console.log("Output:", output);
} catch (e) {
  console.error("Error restoring:", e.message);
}
