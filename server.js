require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(cors());

// ================= ENV VARIABLES =================
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

// ================= BREVO SMTP =================
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ================= TEST SMTP =================
transporter.verify((error, success) => {
    if (error) {
        console.log("❌ SMTP ERROR:", error.message);
    } else {
        console.log("✅ SMTP Server Ready");
    }
});

// ================= OTP STORE =================
let otpStore = {};

// ================= MONGODB =================
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
.then(() => {

    console.log("✅ MongoDB Connected");

    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });

})
.catch(err => console.log("❌ DB ERROR:", err));

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

// ================= SEND OTP =================
app.post("/api/send-otp", async (req, res) => {

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({
            msg: "Email required"
        });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    otpStore[email] = {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    };

    try {

        await transporter.sendMail({
            from: `"CREWHOLIC" <officialcrewholic@gmail.com>`,
            to: email,
            subject: "🔐 Your OTP Code",
            html: `
                <div style="font-family:Arial;padding:20px;">
                    <h2>Your OTP: ${otp}</h2>
                    <p>This OTP is valid for 5 minutes.</p>
                </div>
            `
        });

        console.log("✅ OTP Sent");

        res.json({
            msg: "OTP sent successfully"
        });

    } catch (err) {

        console.log("❌ OTP ERROR:", err.message);

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

        const { name, email, password } = req.body;

        if (!name || !email || !password) {

            return res.status(400).json({
                msg: "All fields required"
            });
        }

        const exist = await User.findOne({ email });

        if (exist) {

            return res.status(400).json({
                msg: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        });

        // ================= SEND WELCOME EMAIL =================

        try {

            const info = await transporter.sendMail({

                from: `"CREWHOLIC" <officialcrewholic@gmail.com>`,

                to: email,

                subject: "🎉 Welcome to CREWHOLIC",

                html: `
                    <div style="
                        font-family: Arial, sans-serif;
                        background: #0a0a2a;
                        padding: 40px;
                        color: white;
                    ">

                        <div style="
                            max-width: 600px;
                            margin: auto;
                            background: #111328;
                            padding: 40px;
                            border-radius: 20px;
                            text-align: center;
                        ">

                            <h1 style="color:#9B51E0;">
                                Welcome ${name} 🚀
                            </h1>

                            <p style="
                                font-size:16px;
                                color:#ccc;
                                margin-top:20px;
                            ">
                                Your CREWHOLIC account has been created successfully.
                            </p>

                            <a href="http://localhost:5500/frontend/login.html"
                               style="
                                    display:inline-block;
                                    margin-top:30px;
                                    background:linear-gradient(90deg,#9B51E0,#F2994A);
                                    padding:12px 25px;
                                    border-radius:50px;
                                    color:white;
                                    text-decoration:none;
                                    font-weight:bold;
                               ">
                               Login Now
                            </a>

                            <p style="
                                margin-top:30px;
                                color:#777;
                                font-size:12px;
                            ">
                                CREWHOLIC Team 🚀
                            </p>

                        </div>
                    </div>
                `
            });

            console.log("✅ Welcome Email Sent:", info.messageId);

        } catch (emailErr) {

            console.log("❌ Email failed:", emailErr.message);
        }

        // ================= RESPONSE =================

        res.status(201).json({

            msg: "Registered successfully",

            user: {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (err) {

        console.log("REGISTER ERROR:", err);

        if (err.code === 11000) {

            return res.status(400).json({
                msg: "User already exists"
            });
        }

        res.status(500).json({
            msg: "Server error"
        });
    }
});

// ================= LOGIN =================
app.post("/api/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {

            return res.status(404).json({
                msg: "User not found"
            });
        }

        const match = await bcrypt.compare(password, user.password);

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

// ================= TEST EMAIL =================
app.get("/api/test-email", async (req, res) => {

    try {

        const info = await transporter.sendMail({

            from: `"CREWHOLIC" <officialcrewholic@gmail.com>`,

            to: "srout2023@gift.edu.in",

            subject: "✅ CREWHOLIC Test Email",

            html: `
                <h1>Email Working Successfully 🚀</h1>
                <p>Brevo SMTP configured correctly.</p>
            `
        });

        console.log("✅ TEST EMAIL SENT:", info.messageId);

        res.json({
            msg: "Email Sent",
            messageId: info.messageId
        });

    } catch (err) {

        console.log("❌ TEST EMAIL ERROR:", err.message);

        res.status(500).json({
            msg: "Email Failed",
            error: err.message
        });
    }
});

// ================= HOME ROUTE =================
app.get("/", (req, res) => {
    res.send("🚀 CREWHOLIC Backend Running");
});