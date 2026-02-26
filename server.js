require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectDB = require("./db");
const routes = require("./routes");

const app = express();   //  EXPRESS APP CREATE

// app.use(cors({
//   origin:"http://localhost:5173",
//   credentials:true
// }));
app.use(cors({
  origin: "*",
  credentials: true
}));
// Middleware
app.use(express.json()); // Read JSON Body

// Routes
app.use("/api", routes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB(); // DB FIRST
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();