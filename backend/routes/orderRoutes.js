const express = require("express");
const router = express.Router();

const Order = require("../models/Order");


// CREATE ORDER
router.post("/", async (req, res) => {

    try {

        const order = new Order(req.body);

        await order.save();

        res.status(201).json({
            success: true,
            message: "Order saved successfully",
            order
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});


// GET ALL ORDERS
router.get("/", async (req, res) => {

    try {

        const orders = await Order.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            orders
        });

    } catch (error) {

        res.status(500).json({
            success: false
        });
    }
});

module.exports = router;