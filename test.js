import fs from 'fs';
import path from 'path';

try {
  console.log("Listing /workspace contents:");
  if (fs.existsSync('/workspace')) {
    console.log(fs.readdirSync('/workspace'));
  } else {
    console.log("/workspace does not exist");
  }
  
  console.log("Listing /app contents:");
  if (fs.existsSync('/app')) {
    console.log(fs.readdirSync('/app'));
  } else {
    console.log("/app does not exist");
  }
} catch (e) {
  console.error("ERROR:", e.message);
}
