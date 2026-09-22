
import fs from "fs";

const file = "server/controllers/emergencyController.js";
let code = fs.readFileSync(file, "utf8");

const exportDemoStart = `
// HACKATHON DEMO: Disable all ambulances to force the Uber fallback
export const disableAllAmbulances = async (req, res, next) => {
  try {
    await Ambulance.updateMany({}, { isAvailable: false });
    return res.status(200).json({ 
      success: true, 
      message: "All ambulances disabled! Next SOS trigger will force the Uber Fallback flow."
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
  `disableAllDoctors\n} from "../controllers/emergencyController.js";`,
  `disableAllDoctors,\n  disableAllAmbulances\n} from "../controllers/emergencyController.js";`
);

routeCode = routeCode.replace(
  `router.get("/demo/disable-all-doctors", disableAllDoctors);`,
  `router.get("/demo/disable-all-doctors", disableAllDoctors);\nrouter.get("/demo/disable-all-ambulances", disableAllAmbulances);`
);

fs.writeFileSync(routeFile, routeCode);

