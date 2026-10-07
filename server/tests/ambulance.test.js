import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../server.js";
import Ambulance from "../models/Ambulance.js";

let mongoServer;

describe("Ambulance Routes API Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("should return 404 if ambulance does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/ambulance/${fakeId}`);
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Ambulance not found");
  });

  it("should return 200 and ambulance status when valid ambulance exists", async () => {
    const ambulance = await Ambulance.create({
      driverName: "Ramesh Kumar",
      phone: "+919876543210",
      vehicleNumber: "TS09-AB-1234",
      lat: 17.4474,
      lng: 78.3762,
      isAvailable: true,
    });

    const res = await request(app).get(`/api/ambulance/${ambulance._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehicleNumber).toBe("TS09-AB-1234");
    expect(res.body.data.driverName).toBe("Ramesh Kumar");
    expect(res.body.data.isAvailable).toBe(true);
  });
});
