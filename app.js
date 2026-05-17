import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import employeeRoutes from "./routes/employeeRoutes.js";

dotenv.config();

const app = express();

// CORS CONFIG
app.use(
  cors({
    origin: [
      "http://targetportal.s3-website.ap-south-1.amazonaws.com",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
    credentials: true,
  })
);

// HANDLE PREFLIGHT
app.options("*", cors());

// BODY PARSER
app.use(express.json());

// STATIC FILES
app.use("/uploads", express.static("uploads"));

// ROUTES
app.use("/api", employeeRoutes);

// TEST API
app.get("/", (req, res) => {
  res.send("API Running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});