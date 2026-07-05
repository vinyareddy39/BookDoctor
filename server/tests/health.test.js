import request from "supertest";
import { app } from "../server.js";

describe("Health Check API", () => {
  it("should return a 200 OK status on the root route", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("BookDoctor API is running");
  });
});
