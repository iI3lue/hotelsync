import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import arrivalsRouter from "./routes/arrivals.js";
import checkInRouter from "./routes/check-in.js";
import checkOutRouter from "./routes/check-out.js";
import incidentsRouter from "./routes/incidents.js";

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "front-desk-service",
  });
});

// API routes
app.use("/v1/arrivals", arrivalsRouter);
app.use("/v1/check-in", checkInRouter);
app.use("/v1/check-out", checkOutRouter);
app.use("/v1/incidents", incidentsRouter);

// Error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Front Desk Service running on port ${PORT}`);
  });
}

export default app;
