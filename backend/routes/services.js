    const express = require("express");
    const router = express.Router();
    const Service = require("../models/Service");
    const { auth, isAdmin } = require("../middleware/auth");

    // GET all services (public)
    router.get("/", async (req, res) => {
    const services = await Service.find();
    res.json(services);
    });

    // ADD service (admin only)
    router.post("/", auth, isAdmin, async (req, res) => {
    const service = new Service(req.body);
    await service.save();
    res.json(service);
    });

    module.exports = router;