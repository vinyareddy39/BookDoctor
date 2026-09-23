import assert from "node:assert";
import {
  MinHeap,
  WeightedGraph,
  dijkstra,
  findNearestHospital,
  haversineDistanceKm
} from "./dijkstra.js";

console.log("Running Dijkstra Unit Tests...");

// 1. Test MinHeap priority queue
{
  const heap = new MinHeap();
  assert.strictEqual(heap.isEmpty(), true, "Heap should initially be empty");
  
  heap.insert("B", 10);
  heap.insert("A", 4);
  heap.insert("C", 15);
  heap.insert("D", 1);

  assert.strictEqual(heap.size(), 4, "Heap size should be 4");
  assert.strictEqual(heap.extractMin().node, "D", "Min element should be D (priority 1)");
  assert.strictEqual(heap.extractMin().node, "A", "Next min element should be A (priority 4)");
  assert.strictEqual(heap.extractMin().node, "B", "Next min element should be B (priority 10)");
  assert.strictEqual(heap.extractMin().node, "C", "Last element should be C (priority 15)");
  assert.strictEqual(heap.isEmpty(), true, "Heap should now be empty");
  console.log("✓ MinHeap priority queue tests passed");
}

// 2. Test Dijkstra on a known weighted graph
{
  const graph = new WeightedGraph();
  graph.addEdge("A", "B", 4);
  graph.addEdge("A", "C", 2);
  graph.addEdge("C", "B", 1);
  graph.addEdge("B", "D", 5);
  graph.addEdge("C", "D", 8);

  const { distances, previous } = dijkstra(graph, "A");

  assert.strictEqual(distances["A"], 0, "Distance A->A should be 0");
  assert.strictEqual(distances["C"], 2, "Distance A->C should be 2");
  assert.strictEqual(distances["B"], 3, "Distance A->B should be 3 (via C: 2+1=3 instead of direct 4)");
  assert.strictEqual(distances["D"], 8, "Distance A->D should be 8 (via C->B->D: 2+1+5=8)");
  assert.strictEqual(previous["B"], "C", "Shortest path to B comes from C");
  console.log("✓ Dijkstra shortest path algorithm tests passed");
}

// 3. Test findNearestHospital with road weights
{
  const userLoc = { latitude: 17.4485, longitude: 78.6841 }; // Ghatkesar Center

  const hospitals = [
    {
      id: "hosp-1",
      name: "Distant Apex Hospital",
      address: "Highway 65",
      lat: 17.5000,
      lng: 78.7500
    },
    {
      id: "hosp-2",
      name: "Fast Road Hospital",
      address: "Main Road Express",
      lat: 17.4450,
      lng: 78.6850
    },
    {
      id: "hosp-3",
      name: "Traffic Jam Clinic",
      address: "Congested Lane",
      lat: 17.4490,
      lng: 78.6830
    }
  ];

  // Notice: hosp-3 is physically closest by straight line,
  // but road routing gives hosp-2 lower travel time (4 mins vs 15 mins due to traffic/road barriers)
  const roadWeights = {
    "hosp-1": { distanceKm: 8.5, durationMinutes: 18 },
    "hosp-2": { distanceKm: 2.1, durationMinutes: 4 },  // Fastest road route!
    "hosp-3": { distanceKm: 1.2, durationMinutes: 15 }  // Congested road
  };

  const result = findNearestHospital(userLoc, hospitals, roadWeights);

  assert.strictEqual(result.name, "Fast Road Hospital", "Should select Fast Road Hospital via Dijkstra");
  assert.strictEqual(result.etaMinutes, 4, "ETA should be 4 minutes");
  assert.strictEqual(result.distanceKm, 2.1, "Distance should be 2.1 km");
  console.log("✓ findNearestHospital road-weighted Dijkstra tests passed");
}

// 4. Test findNearestHospital with Haversine fallback when roadWeights is empty
{
  const userLoc = { latitude: 17.4485, longitude: 78.6841 };

  const hospitals = [
    { id: "h1", name: "Far Hospital", address: "Far", lat: 17.6000, lng: 78.8000 },
    { id: "h2", name: "Near Hospital", address: "Near", lat: 17.4490, lng: 78.6850 }
  ];

  const result = findNearestHospital(userLoc, hospitals, {});

  assert.strictEqual(result.name, "Near Hospital", "Should pick physically nearer hospital on fallback");
  assert.ok(result.distanceKm > 0, "Distance should be positive");
  assert.ok(result.etaMinutes > 0, "ETA should be positive");
  console.log("✓ findNearestHospital Haversine fallback tests passed");
}

console.log("\nALL DIJKSTRA UNIT TESTS PASSED SUCCESSFULLY! ✓");
