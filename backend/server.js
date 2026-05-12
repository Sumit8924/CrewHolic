const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// ✅ ROUTES IMPORT
const authRoutes = require("./routes/auth");
const serviceRoutes = require("./routes/services");

// ✅ ROUTES USE
app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);

// test route
app.get("/", (req, res) => {
  res.send("API Running...");
});

// DB connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("DB Connected"))
.catch(err => console.log(err));

// server start
app.listen(5000, () => console.log("Server running on port 5000"));