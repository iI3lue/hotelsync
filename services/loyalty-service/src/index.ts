import express from "express";
import { startConsumer } from "./lib/consumer";
import { errorHandler } from "./middleware/error-handler";
import { levelsRouter } from "./routes/levels";
import { loyaltyRouter } from "./routes/loyalty";
import { adminRouter } from "./routes/admin";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Registrar rutas
app.use("/v1/loyalty/levels", levelsRouter);
app.use("/v1/loyalty/me", loyaltyRouter); // Se mapea a /v1/loyalty/me y /v1/loyalty/me/redeem
app.use("/v1/loyalty/admin", adminRouter);

// Manejador centralizado de errores
app.use(errorHandler);

const PORT = process.env.PORT || 3009;

app.listen(PORT, async () => {
  console.log(`[loyalty-service] Servidor corriendo en puerto ${PORT}`);
  try {
    await startConsumer();
  } catch (error) {
    console.error("[loyalty-service] Error iniciando RabbitMQ consumer:", error);
  }
});
