/**
 * Dijkstra's Shortest Path Algorithm with Min-Heap Priority Queue
 * Used to compute the shortest road path from the user's location to the nearest hospital.
 */

export class MinHeap {
  constructor() {
    this.heap = [];
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  insert(node, priority) {
    this.heap.push({ node, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  extractMin() {
    if (this.isEmpty()) return null;
    const min = this.heap[0];
    const end = this.heap.pop();
    if (!this.isEmpty()) {
      this.heap[0] = end;
      this._sinkDown(0);
    }
    return min;
  }

  _bubbleUp(index) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIdx];
      if (element.priority >= parent.priority) break;
      this.heap[index] = parent;
      this.heap[parentIdx] = element;
      index = parentIdx;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      const leftChildIdx = 2 * index + 1;
      const rightChildIdx = 2 * index + 2;
      let leftChild, rightChild;
      let swap = null;

      if (leftChildIdx < length) {
        leftChild = this.heap[leftChildIdx];
        if (leftChild.priority < element.priority) {
          swap = leftChildIdx;
        }
      }

      if (rightChildIdx < length) {
        rightChild = this.heap[rightChildIdx];
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null && rightChild.priority < leftChild.priority)
        ) {
          swap = rightChildIdx;
        }
      }

      if (swap === null) break;
      this.heap[index] = this.heap[swap];
      this.heap[swap] = element;
      index = swap;
    }
  }
}

/**
 * Weighted Graph Representation
 */
export class WeightedGraph {
  constructor() {
    this.adjacencyList = new Map();
    this.nodeData = new Map();
  }

  addNode(id, data = null) {
    if (!this.adjacencyList.has(id)) {
      this.adjacencyList.set(id, []);
      if (data) this.nodeData.set(id, data);
    }
  }

  addEdge(fromNode, toNode, weight, metadata = {}) {
    this.addNode(fromNode);
    this.addNode(toNode);
    this.adjacencyList.get(fromNode).push({ node: toNode, weight, metadata });
    this.adjacencyList.get(toNode).push({ node: fromNode, weight, metadata });
  }

  getNeighbors(nodeId) {
    return this.adjacencyList.get(nodeId) || [];
  }

  getNodeData(nodeId) {
    return this.nodeData.get(nodeId);
  }
}

/**
 * Standard Haversine straight-line distance in kilometers.
 * Used as fallback weight if routing APIs are unavailable.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Runs Dijkstra's algorithm from a start node on a weighted graph using a Min-Heap.
 * @param {WeightedGraph} graph
 * @param {string} startNodeId
 * @returns {{ distances: Record<string, number>, previous: Record<string, string> }}
 */
export function dijkstra(graph, startNodeId) {
  const distances = {};
  const previous = {};
  const pq = new MinHeap();

  for (const nodeId of graph.adjacencyList.keys()) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
  }

  distances[startNodeId] = 0;
  pq.insert(startNodeId, 0);

  while (!pq.isEmpty()) {
    const { node: current, priority: currentDist } = pq.extractMin();

    if (currentDist > distances[current]) continue;

    const neighbors = graph.getNeighbors(current);
    for (const edge of neighbors) {
      const alt = distances[current] + edge.weight;
      if (alt < distances[edge.node]) {
        distances[edge.node] = alt;
        previous[edge.node] = current;
        pq.insert(edge.node, alt);
      }
    }
  }

  return { distances, previous };
}

/**
 * Reusable function to find the nearest hospital using Dijkstra's algorithm.
 * 
 * @param {{ latitude: number, longitude: number }} userLoc 
 * @param {Array<{ id: string, name: string, address: string, lat: number, lng: number }>} hospitals 
 * @param {Record<string, { distanceKm: number, durationMinutes: number }>} roadWeights - OSRM/ORS road distance and duration matrix
 * @returns {{ hospital: object, name: string, address: string, lat: number, lng: number, distanceKm: number, etaMinutes: number }}
 */
export function findNearestHospital(userLoc, hospitals, roadWeights = {}) {
  if (!userLoc || typeof userLoc.latitude !== "number" || typeof userLoc.longitude !== "number") {
    throw new Error("Invalid user coordinates provided to findNearestHospital.");
  }

  if (!Array.isArray(hospitals) || hospitals.length === 0) {
    throw new Error("No candidate hospitals available for Dijkstra shortest-path calculation.");
  }

  const graph = new WeightedGraph();
  const USER_NODE = "USER_NODE";

  graph.addNode(USER_NODE, {
    type: "user",
    lat: userLoc.latitude,
    lng: userLoc.longitude
  });

  // Build the graph: User is the source node, candidate hospitals are destination nodes
  for (const hosp of hospitals) {
    const hospId = hosp._id ? String(hosp._id) : hosp.id ? String(hosp.id) : hosp.name;
    const nodeKey = `HOSP_${hospId}`;

    graph.addNode(nodeKey, {
      type: "hospital",
      hospital: hosp
    });

    // Check if real road duration/distance was computed via OSRM/ORS
    const roadData = roadWeights[hospId] || roadWeights[nodeKey];

    let edgeWeight; // Primary optimization metric: Road travel time in minutes
    let distanceKm;
    let etaMinutes;

    if (roadData && typeof roadData.durationMinutes === "number" && roadData.durationMinutes > 0) {
      edgeWeight = roadData.durationMinutes;
      etaMinutes = Math.max(1, Math.round(roadData.durationMinutes));
      distanceKm = parseFloat((roadData.distanceKm || 0).toFixed(1));
    } else {
      // Fallback: Haversine distance with urban traffic coefficient (1.35x detour, 35 km/h avg speed)
      const straightDist = haversineDistanceKm(
        userLoc.latitude,
        userLoc.longitude,
        hosp.lat,
        hosp.lng
      );
      distanceKm = parseFloat((straightDist * 1.35).toFixed(1));
      etaMinutes = Math.max(2, Math.round((distanceKm / 35) * 60));
      edgeWeight = etaMinutes; // edge weight = travel time
    }

    graph.addEdge(USER_NODE, nodeKey, edgeWeight, {
      distanceKm,
      etaMinutes
    });
  }

  // Execute Dijkstra's Algorithm from the USER node
  const { distances } = dijkstra(graph, USER_NODE);

  let bestHospitalNode = null;
  let minWeight = Infinity;

  for (const nodeId of graph.adjacencyList.keys()) {
    if (nodeId === USER_NODE) continue;
    if (distances[nodeId] < minWeight) {
      minWeight = distances[nodeId];
      bestHospitalNode = nodeId;
    }
  }

  if (!bestHospitalNode) {
    throw new Error("Dijkstra was unable to determine a shortest path to any hospital.");
  }

  const selectedNodeData = graph.getNodeData(bestHospitalNode);
  const selectedHospital = selectedNodeData.hospital;

  // Retrieve the edge metadata connecting USER to the selected hospital
  const userEdges = graph.getNeighbors(USER_NODE);
  const targetEdge = userEdges.find((e) => e.node === bestHospitalNode);

  const finalDistanceKm = targetEdge?.metadata?.distanceKm ?? parseFloat(minWeight.toFixed(1));
  const finalEtaMinutes = targetEdge?.metadata?.etaMinutes ?? Math.round(minWeight);

  return {
    hospital: selectedHospital,
    name: selectedHospital.name,
    address: selectedHospital.address || "Emergency Department",
    lat: selectedHospital.lat,
    lng: selectedHospital.lng,
    distanceKm: finalDistanceKm,
    etaMinutes: finalEtaMinutes
  };
}
