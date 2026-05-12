const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    orderId: {
        type: String
    },

    service: {
        type: String,
        required: true
    },

    serviceType: {
        type: String
    },

    amount: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: ["pending", "approved", "completed", "cancelled"],
        default: "pending"
    },

    // USER DETAILS
    customerName: String,
    customerEmail: String,
    customerPhone: String,

    // RENTAL
    equipmentName: String,
    dailyRate: Number,
    rentalDays: Number,
    startDate: String,
    address: String,

    // WEB DEVELOPMENT
    projectType: String,
    features: String,
    timeline: String,

    // DIGITAL MARKETING
    marketingGoal: String,
    platform: [String],
    marketingType: String,

    // EVENT
    eventType: String,
    guestCount: Number,
    eventDate: String,
    venue: String

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);