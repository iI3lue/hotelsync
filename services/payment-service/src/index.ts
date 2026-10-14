import express from "express";
import { errorHandler } from "./middleware/error-handler";
import { checkoutRouter } from "./routes/checkout";
import { adminRouter } from "./routes/admin";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Montaje directo bajo /v1 para que el rewrite /api/payments/:path* del
// front resuelva 1:1 (mismo patrón que loyalty-service).
app.use("/v1/checkout", checkoutRouter); // POST / y GET /:bookingId
app.use("/v1/admin", adminRouter); // POST /payments (pago manual front-desk)

app.use(errorHandler);

const PORT = process.env.PORT || 3010;

app.listen(PORT, () => {
  console.log(`[payment-service] Servidor corriendo en puerto ${PORT}`);
});
