
import fs from "fs";

const file = "server/models/Emergency.js";
let code = fs.readFileSync(file, "utf8");

// Update responseMode enum
code = code.replace(
  `enum: ["doctor", "ambulance"],`,
  `enum: ["doctor", "ambulance", "uber"],`
);

fs.writeFileSync(file, code);

