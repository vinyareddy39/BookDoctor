
import fs from "fs";

const file = "server/controllers/emergencyController.js";
let code = fs.readFileSync(file, "utf8");

const exportDemoStart = `
// HACKATHON DEMO: Disable all doctors to force the ambulance fallback
export const disableAllDoctors = async (req, res, next) => {
  try {
    await Doctor.updateMany({}, { acceptingEmergencies: false, erCapacity: 0 });
    return res.status(200).json({ 
      success: true, 
      message: "All doctors disabled! Next SOS trigger will force the Ambulance Fallback flow."
    });
  } catch (error) {
    next(error);
  }
};
`;

code = code + exportDemoStart;
fs.writeFileSync(file, code);

const routeFile = "server/routes/emergencyRoutes.js";
let routeCode = fs.readFileSync(routeFile, "utf8");

routeCode = routeCode.replace(
  `seedGhatkesarData\n} from "../controllers/emergencyController.js";`,
  `seedGhatkesarData,\n  disableAllDoctors\n} from "../controllers/emergencyController.js";`
);

routeCode = routeCode.replace(
  `router.get("/seed-demo", seedGhatkesarData);`,
  `router.get("/seed-demo", seedGhatkesarData);\nrouter.get("/demo/disable-all-doctors", disableAllDoctors);`
);

fs.writeFileSync(routeFile, routeCode);

