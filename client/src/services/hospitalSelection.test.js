import assert from "node:assert/strict";
import { selectFastestHospitalByRoad, haversineDistanceKm } from "./hospitalService.js";

async function runTests() {
  console.log("==================================================================");
  console.log("RUNNING UNIT TESTS: Nearest Hospital Selection (OSRM Table Engine)");
  console.log("==================================================================\n");

  // 1. Test Haversine calculation with generic coordinates
  {
    console.log("Test 1: Haversine distance calculation between arbitrary coordinates");
    const dist = haversineDistanceKm(10.0000, 20.0000, 10.0100, 20.0100);
    assert(typeof dist === "number", "Distance must be a number");
    assert(dist > 0 && dist < 5, `Expected distance ~1.5km, got ${dist}`);
    console.log(`✓ Passed: Calculated Haversine distance is ${dist} km\n`);
  }

  // 2. Test Selection of lowest road duration over straight-line Haversine distance
  {
    console.log("Test 2: Hospital with lowest road duration is selected (Mocked OSRM Table API)");

    // Generic mocked coordinates (no hardcoded cities or real hospitals)
    const mockUserLoc = {
      latitude: 10.0000,
      longitude: 20.0000,
      accuracy: 4.5
    };

    // Hospital A is closer in straight-line Haversine (1.1 km) but slower by road (480s / 8 min)
    // Hospital B is farther in straight-line Haversine (2.4 km) but faster via expressway (180s / 3 min)
    // Hospital C is 3.5 km away with 600s road time
    const mockCandidates = [
      {
        id: "mock-hospital-a",
        name: "Hospital Alpha (Trauma Wing)",
        address: "Sector 1",
        lat: 10.0090,
        lng: 20.0080,
        haversineKm: 1.1
      },
      {
        id: "mock-hospital-b",
        name: "Hospital Beta (Emergency Center)",
        address: "Expressway Corridor",
        lat: 10.0210,
        lng: 20.0190,
        haversineKm: 2.4
      },
      {
        id: "mock-hospital-c",
        name: "Hospital Gamma (Medical Unit)",
        address: "Sector 9",
        lat: 10.0310,
        lng: 20.0280,
        haversineKm: 3.5
      }
    ];

    // Mock global fetch for OSRM Table API
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (url.includes("/table/v1/driving/")) {
        return {
          ok: true,
          json: async () => ({
            code: "Ok",
            durations: [
              [
                480.0, // Hospital Alpha duration: 8 mins (slower due to city congestion)
                180.0, // Hospital Beta duration: 3 mins (fastest via main road)
                600.0  // Hospital Gamma duration: 10 mins
              ]
            ],
            distances: [
              [
                1300.0, // Hospital Alpha distance in meters
                2600.0, // Hospital Beta distance in meters
                3900.0  // Hospital Gamma distance in meters
              ]
            ]
          })
        };
      }
      return originalFetch(url);
    };

    try {
      const selected = await selectFastestHospitalByRoad(mockUserLoc, mockCandidates);

      // Verify that Hospital Beta was chosen because it has the minimum road duration (180s)
      assert.equal(
        selected.name,
        "Hospital Beta (Emergency Center)",
        `Expected Hospital Beta to be selected, but got ${selected.name}`
      );
      assert.equal(selected.lat, 10.0210);
      assert.equal(selected.lng, 20.0190);
      assert.equal(selected.roadDurationSec, 180.0);
      assert.equal(selected.etaMinutes, 3);
      assert.equal(selected.distanceKm, 2.6);

      console.log("✓ Passed: Correctly prioritized Hospital Beta with lowest road duration (180s / 3m) despite Hospital Alpha having shorter straight-line distance.\n");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // 3. Test Offline Fallback when OSRM Table fails
  {
    console.log("Test 3: Graceful offline fallback when OSRM API is unreachable");

    const mockUserLoc = {
      latitude: 10.0000,
      longitude: 20.0000,
      accuracy: 6.0
    };

    const mockCandidates = [
      {
        id: "mock-1",
        name: "Clinic East",
        address: "Route 1",
        lat: 10.0050,
        lng: 20.0050,
        haversineKm: 0.8
      },
      {
        id: "mock-2",
        name: "Clinic West",
        address: "Route 2",
        lat: 10.0150,
        lng: 20.0150,
        haversineKm: 2.1
      }
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Simulated network disconnection");
    };

    try {
      const selected = await selectFastestHospitalByRoad(mockUserLoc, mockCandidates);
      assert(selected !== null, "Fallback must return a selected hospital");
      assert.equal(selected.name, "Clinic East", "Fallback should select closest candidate by distance");
      assert(selected.etaMinutes > 0, "ETA must be greater than 0");
      console.log("✓ Passed: Gracefully handled offline network disconnection with valid selection.\n");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  console.log("==================================================================");
  console.log("ALL UNIT TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
