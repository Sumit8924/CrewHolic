require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");

const Order = require("./backend/models/Order");
const orderRoutes = require("./backend/routes/orderRoutes");

const app = express();

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(cors());

// ================= ROUTES =================
app.use("/api/orders", orderRoutes);

// ================= ENV =================
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// ================= RESEND =================
const resend = new Resend(RESEND_API_KEY);

// ================= OTP STORE =================
let otpStore = {};

// ================= MONGODB =================
mongoose.connect(MONGO_URI)
.then(() => {
    console.log("✅ MongoDB Connected");

    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });

})
.catch((err) => {
    console.log("❌ DB Error:", err);
});

// ================= USER SCHEMA =================
const userSchema = new mongoose.Schema({
    name: String,

    email: {
        type: String,
        unique: true
    },

    password: String,

    role: {
        type: String,
        enum: [
            "super_admin",
            "rental_admin",
            "finance_admin",
            "webdev_admin",
            "marketing_admin",
            "event_admin",
            "user"
        ],
        default: "user"
    }

}, { timestamps: true });

const User = mongoose.model("User", userSchema);

// ================= DEFAULT ADMIN =================
async function createAdmin() {

    const adminEmail = "admin@crewholic.com";

    const exist = await User.findOne({
        email: adminEmail
    });

    if (!exist) {

        const hashed = await bcrypt.hash("admin123", 10);

        await User.create({
            name: "Main Admin",
            email: adminEmail,
            password: hashed,
            role: "super_admin"
        });

        console.log("👑 Super Admin Created");
    }
}

mongoose.connection.once("open", createAdmin);

// ================= EMAIL HELPER =================
async function sendEmail(to, subject, html) {

    try {

        const result = await resend.emails.send({
            from: "CREWHOLIC <onboarding@resend.dev>",
            to,
            subject,
            html
        });

        console.log("✅ Email Sent:", result);

    } catch (err) {

        console.log("❌ Email Error:", err.message);
    }
}

// ================= TEST ROUTE =================
app.get("/", (req, res) => {
    res.send("🚀 Backend Running Successfully");
});

// ================= TEST EMAIL =================
app.get("/api/test-email", async (req, res) => {

    try {

        const result = await resend.emails.send({
            from: "CREWHOLIC <onboarding@resend.dev>",
            to: "srout2023@gift.edu.in",
            subject: "CREWHOLIC Test Email",
            html: "<h1>Email test working ✅</h1>"
        });

        res.json({
            msg: "Email Sent",
            result
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            msg: "Email Failed",
            error: err.message
        });
    }
});

// ================= SEND OTP =================
app.post("/api/send-otp", async (req, res) => {

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            msg: "Email required"
        });
    }

    const otp =
        Math.floor(100000 + Math.random() * 900000);

    otpStore[email] = {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    };

    try {

        await sendEmail(
            email,
            "🔐 Your OTP Code",
            `
            <h2>Your OTP: ${otp}</h2>
            <p>This OTP is valid for 5 minutes.</p>
            `
        );

        res.json({
            msg: "OTP sent successfully"
        });

    } catch (err) {

        console.log("OTP ERROR:", err);

        res.status(500).json({
            msg: "Failed to send OTP"
        });
    }
});

// ================= VERIFY OTP =================
app.post("/api/verify-otp", (req, res) => {

    const { email, otp } = req.body;

    const record = otpStore[email];

    if (!record) {
        return res.status(400).json({
            msg: "No OTP found"
        });
    }

    if (Date.now() > record.expires) {
        return res.status(400).json({
            msg: "OTP expired"
        });
    }

    if (record.otp != otp) {
        return res.status(400).json({
            msg: "Invalid OTP"
        });
    }

    delete otpStore[email];

    res.json({
        msg: "OTP verified successfully"
    });
});

// ================= REGISTER =================
app.post("/api/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;

        if (!name || !email || !password) {

            return res.status(400).json({
                msg: "All fields required"
            });
        }

        const exist = await User.findOne({
            email
        });

        if (exist) {

            return res.status(400).json({
                msg: "User already exists"
            });
        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        });

        // ✅ SEND WELCOME EMAIL
        sendEmail(
            email,
            "🎉 Welcome to CREWHOLIC",
            `
            <div style="font-family:Arial;padding:20px;">
                <h2>Welcome ${name} 🚀</h2>

                <p>
                    Your account has been successfully created.
                </p>

                <p>
                    Thank you for joining CREWHOLIC.
                </p>
            </div>
            `
        );

        res.status(201).json({

            msg: "Registered successfully",

            user: {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (err) {

        if (err.code === 11000) {

            return res.status(400).json({
                msg: "User already exists"
            });
        }

        console.log("REGISTER ERROR:", err);

        res.status(500).json({
            msg: "Server error"
        });
    }
});

// ================= LOGIN =================
app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        const user = await User.findOne({
            email
        });

        if (!user) {

            return res.status(404).json({
                msg: "User not found"
            });
        }

        const match =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!match) {

            return res.status(401).json({
                msg: "Wrong password"
            });
        }

        const token = jwt.sign(

            {
                id: user._id,
                role: user.role
            },

            JWT_SECRET,

            {
                expiresIn: "1d"
            }
        );

        res.json({

            msg: "Login successful",

            user: {
                name: user.name,
                email: user.email,
                role: user.role
            },

            token
        });

    } catch (err) {

        console.log("LOGIN ERROR:", err);

        res.status(500).json({
            msg: "Server error"
        });
    }
});

// ================= VERIFY ADMIN =================
function verifyAdmin(req, res, next) {

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {

        return res.status(401).json({
            msg: "No token"
        });
    }

    const token =
        authHeader.split(" ")[1];

    try {

        const decoded =
            jwt.verify(token, JWT_SECRET);

        if (![
            "super_admin",
            "rental_admin",
            "finance_admin",
            "webdev_admin",
            "marketing_admin",
            "event_admin"
        ].includes(decoded.role)) {

            return res.status(403).json({
                msg: "Admin only"
            });
        }

        req.user = decoded;

        next();

    } catch (err) {

        console.log("ADMIN ERROR:", err);

        res.status(401).json({
            msg: "Invalid token"
        });
    }
}

// ================= ADMIN DATA =================
app.get(
    "/api/admin-data",
    verifyAdmin,

    (req, res) => {

        res.json({
            msg: "🔥 Admin access granted"
        });
    }
);

// ================= TEST ORDER =================
app.get("/api/test-order", async (req, res) => {

    try {

        const order = await Order.create({
            service: "rental",
            amount: 2000,
            status: "pending"
        });

        res.json(order);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            msg: "Error creating order"
        });
    }
});