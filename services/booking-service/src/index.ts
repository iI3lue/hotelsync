import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import bookingsRouter from "./routes/bookings.js";

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "booking-service",
  });
});

// API routes
app.use("/v1/bookings", bookingsRouter);

// Error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Booking Service running on port ${PORT}`);
  });
}

export default app;
