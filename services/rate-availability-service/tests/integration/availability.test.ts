import request from "supertest";
import express from "express";
import availabilityRouter from "../../src/routes/availability.js";
import ratesRouter from "../../src/routes/rates.js";
import blocksRouter from "../../src/routes/blocks.js";
import { errorHandler } from "../../src/middleware/error-handler.js";

jest.mock("../../src/lib/prisma.js", () => ({
  __esModule: true,
  default: {
    inventory: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    rate: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "../../src/lib/prisma.js";
const mockPrisma = prisma as any;

const app = express();
app.use(express.json());

// Health check route (mirrors index.ts)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "rate-availability-service",
  });
});

app.use("/v1/availability", availabilityRouter);
app.use("/v1/rates", ratesRouter);
app.use("/v1/blocks", blocksRouter);
app.use(errorHandler);

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("Rate & Availability Service API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("GET /v1/availability", () => {
    it("should return availability for a room type and date", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        available_count: 10,
        blocked_count: 2,
      });

      const res = await request(app)
        .get("/v1/availability")
        .query({ room_type_id: VALID_UUID, date: "2026-01-15" });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(10);
      expect(res.body.blocked).toBe(2);
    });

    it("should return 400 with missing params", async () => {
      const res = await request(app).get("/v1/availability");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /v1/rates", () => {
    it("should return rates for a room type", async () => {
      mockPrisma.rate.findMany.mockResolvedValue([
        { rate_id: "r1", room_type_id: "rt1", price: 100 },
      ]);

      const res = await request(app)
        .get("/v1/rates")
        .query({ room_type_id: VALID_UUID });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /v1/blocks", () => {
    it("should block rooms successfully", async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue({
        available_count: 10,
        blocked_count: 0,
      });
      mockPrisma.inventory.update.mockResolvedValue({
        available_count: 8,
        blocked_count: 2,
      });

      const res = await request(app)
        .post("/v1/blocks")
        .send({
          room_type_id: VALID_UUID,
          date: "2026-01-15",
          count: 2,
          action: "block",
        });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(8);
      expect(res.body.blocked).toBe(2);
    });

    it("should return 400 with invalid action", async () => {
      const res = await request(app)
        .post("/v1/blocks")
        .send({
          room_type_id: VALID_UUID,
          date: "2026-01-15",
          count: 2,
          action: "invalid",
        });

      expect(res.status).toBe(400);
    });
  });
});