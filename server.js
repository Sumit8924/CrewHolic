require("dotenv").config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require("resend");
const Order = require("./backend/models/Order");
const orderRoutes = require("./backend/routes/orderRoutes");

const app = express();

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(cors());

// ================= ORDER ROUTES =================
app.use("/api/orders", orderRoutes);

// ================= ENV VARIABLES =================
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const resend = new Resend(process.env.RESEND_API_KEY);


// 🔥 ADD THIS (VERY IMPORTANT)
//transporter.verify((error, success) => {
//     if (error) {
//         console.log("❌ Email config error:", error);
//     } else {
//         console.log("✅ Email server is ready");
//     }
// });

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
.catch(err => console.log("❌ DB Error:", err));

// ================= SCHEMA =================
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
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

const User = mongoose.model('User', userSchema);


// ================= DEFAULT ADMIN =================
async function createAdmin() {
    const adminEmail = "admin@crewholic.com";

    const exist = await User.findOne({ email: adminEmail });

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
mongoose.connection.once('open', createAdmin);


// ================= SEND OTP =================
app.post("/api/send-otp", async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ msg: "Email required" });

    const otp = Math.floor(100000 + Math.random() * 900000);

    otpStore[email] = {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    };

    try {
        await transporter.sendMail({
            from: `"CREWHOLIC" <${EMAIL_USER}>`,
            to: email,
            subject: "🔐 Your OTP Code",
            html: `
                <h2>Your OTP: ${otp}</h2>
                <p>This OTP is valid for 5 minutes.</p>
            `
        });

        console.log("📩 OTP sent:", otp);

        res.json({ msg: "OTP sent successfully" });

    } catch (err) {
        console.log("❌ OTP ERROR:", err);
        res.status(500).json({ msg: "Failed to send OTP" });
    }
});


// ================= VERIFY OTP =================
app.post("/api/verify-otp", (req, res) => {
    const { email, otp } = req.body;

    const record = otpStore[email];

    if (!record) return res.status(400).json({ msg: "No OTP found" });

    if (Date.now() > record.expires) {
        return res.status(400).json({ msg: "OTP expired" });
    }

    if (record.otp != otp) {
        return res.status(400).json({ msg: "Invalid OTP" });
    }

    delete otpStore[email];

    res.json({ msg: "OTP verified successfully" });
});


// ================= REGISTER =================
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ msg: "All fields required" });
        }

        const exist = await User.findOne({ email });
        if (exist) {
            return res.status(400).json({ msg: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        });
        try {
                const emailResult = await resend.emails.send({
                    from: "CREWHOLIC <onboarding@resend.dev>",
                    to: "srout2023@gift.edu.in",
                    subject: "TEST EMAIL 🚀",
                    html: `<h2>Resend working</h2>`
                });

                console.log("✅ Resend result:", emailResult);

        } catch (emailErr) {
            console.log("❌ Resend email failed:", emailErr);
        }

        res.status(201).json({
            msg: "Registered successfully",
            user: {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (err) {
        // ✅ FIXED DUPLICATE EMAIL ERROR HANDLING
        if (err.code === 11000) {
            return res.status(400).json({ msg: "User already exists" });
        }

        console.log("REGISTER ERROR:", err);
        res.status(500).json({ msg: "Server error" });
    }
});


// ================= LOGIN =================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ msg: "User not found" });

        const match = await bcrypt.compare(password, user.password);

        if (!match) return res.status(401).json({ msg: "Wrong password" });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            JWT_SECRET,
            { expiresIn: "1d" }
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
        res.status(500).json({ msg: "Server error" });
    }
});

// ================= ADMIN VERIFICATION MIDDLEWARE =================
function verifyAdmin(req, res, next) {
const authHeader = req.headers.authorization;
if (!authHeader) return res.status(401).json({ msg: "No token" });

const token = authHeader.split(" ")[1]; // 🔥 extract token

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (![
            "super_admin",
            "rental_admin",
            "finance_admin",
            "webdev_admin",
            "marketing_admin",
            "event_admin"
        ].includes(decoded.role)) {
        return res.status(403).json({ msg: "Admin only" });
    }

        next();

    } catch (err) {
        console.log("ADMIN ERROR:", err);
        res.status(401).json({ msg: "Invalid token" });
    }
}

// ================= ROLE BASED ACCESS =================
function authorizeRoles(...roles) {
    return (req, res, next) => {
        const token = req.headers.authorization;

        if (!token) return res.status(401).json({ msg: "No token" });

        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            if (!roles.includes(decoded.role)) {
                return res.status(403).json({ msg: "Access denied" });
            }

            req.user = decoded;
            next();

        } catch (err) {
            res.status(401).json({ msg: "Invalid token" });
        }
    };
}

app.post("/api/admin/approve-order", verifyAdmin, async (req, res) => {
    try {
        const { email, name, service } = req.body;

        if (!email || !name || !service) {
            return res.status(400).json({ msg: "Missing data" });
        }

        console.log("📩 Approve Request:", { email, name, service });

        // 🔥 NORMALIZE SERVICE NAME
        const normalizedService = service.toLowerCase().replace(/\s+/g, "");

        let serviceMessage = "";
        let serviceTitle = "";

        switch (normalizedService) {

            case "rental":
            case "equipmentrental":
                serviceTitle = "📦 Rental Service Approved";
                serviceMessage = "Your rental request has been approved. Our rental team will contact you soon.";
                break;

            case "digitalmarketing":
            case "marketing":
                serviceTitle = "📈 Digital Marketing Project Approved";
                serviceMessage = "Your digital marketing project has been approved. Our marketing team will reach out shortly.";
                break;

            case "eventmanagement":
            case "event":
                serviceTitle = "🎉 Event Management Approved";
                serviceMessage = "Your event management request has been approved. Our team will contact you for planning.";
                break;

            case "webdevelopment":
            case "webdev":
                serviceTitle = "💻 Web Development Project Approved";
                serviceMessage = "Your web development project has been approved. Our developers will connect with you soon.";
                break;

            default:
                serviceTitle = "✅ Request Approved";
                serviceMessage = `Your request for "${service}" has been approved by our team.`;
        }

        // 📧 SEND EMAIL
        const info = await transporter.sendMail({
            from: `"CREWHOLIC" <${EMAIL_USER}>`,
            to: email,
            subject: serviceTitle,
            html: `
                <div style="font-family: Arial; padding: 20px;">
                    <h2 style="color:#4CAF50;">Congratulations ${name}! 🎉</h2>

                    <h3>${serviceTitle}</h3>

                    <p>${serviceMessage}</p>

                    <p>Our team will contact you shortly to proceed further.</p>

                    <br>

                    <a href="http://localhost:5500/frontend/index.html"
                        style="padding:10px 20px; background:#9B51E0; color:white; text-decoration:none; border-radius:5px;">
                        Go to Website
                    </a>

                    <p style="margin-top:20px; font-size:12px; color:#777;">
                        CREWHOLIC Team 🚀
                    </p>
                </div>
            `
        });

        console.log("✅ Email sent:", info.response);

        res.json({ msg: `${service} approved & email sent` });

    } catch (err) {
        console.log("❌ APPROVE ERROR FULL:", err);

        res.status(500).json({
            msg: "Failed to approve order",
            error: err.message
        });
    }
});
// ================= CONTACT FORM =================
app.post("/api/contact", async (req, res) => {
    try {
        const { name, email, service, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ msg: "All fields required" });
        }

        await transporter.sendMail({
            from: `"CREWHOLIC Contact" <${EMAIL_USER}>`,
            to: EMAIL_USER, // Send to admin email
            subject: `📬 New Contact Message from ${name}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #9B51E0;">New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Service:</strong> ${service || "Not specified"}</p>
                    <p><strong>Message:</strong></p>
                    <p style="background: #f0f0f0; padding: 15px; border-radius: 10px;">${message}</p>
                    <hr>
                    <p style="font-size: 12px; color: #777;">Sent from CREWHOLIC Contact Form</p>
                </div>
            `
        });

        // Send auto-reply to user
        await transporter.sendMail({
            from: `"CREWHOLIC" <${EMAIL_USER}>`,
            to: email,
            subject: "✅ We've Received Your Message!",
            html: `
                <div style="font-family: Arial, sans-serif; background: #0a0a2a; padding: 30px; color: #fff;">
                    <div style="max-width: 600px; margin: auto; background: #111328; border-radius: 20px; padding: 30px; text-align: center;">
                        <h1 style="color: #9B51E0;">Thank You, ${name}! 🙏</h1>
                        <p>We have received your message and our team will get back to you within 24 hours.</p>
                        <p style="margin-top: 20px; font-size: 12px; color: #777;">CREWHOLIC Team 🚀</p>
                    </div>
                </div>
            `
        });

        res.json({ msg: "Message sent successfully" });

    } catch (err) {
        console.log("CONTACT ERROR:", err);
        res.status(500).json({ msg: "Failed to send message" });
    }
});

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
        res.status(500).json({ msg: "Error creating order" });
    }
});

// ================= ADMIN ANALYTICS =================
app.get("/api/admin/analytics", verifyAdmin, async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: "pending" });
        const approvedOrders = await Order.countDocuments({ status: "approved" });

        const revenueData = await Order.aggregate([
            {
                $group: {
                    _id: "$service",
                    total: { $sum: "$amount" }
                }
            }
        ]);

        res.json({
            totalOrders,
            pendingOrders,
            approvedOrders,
            revenueData
        });

    } catch (err) {
        console.log("ANALYTICS ERROR:", err);
        res.status(500).json({ msg: "Error fetching analytics" });
    }
});
// ================= ROLE DASHBOARDS =================

// Rental Admin Dashboard
app.get("/api/rental-dashboard", authorizeRoles("rental_admin", "super_admin"), (req, res) => {
    res.json({ msg: "📦 Rental Dashboard Data" });
});

// Finance Admin Dashboard
app.get("/api/finance-dashboard", authorizeRoles("finance_admin", "super_admin"), (req, res) => {
    res.json({ msg: "💰 Finance Dashboard Data" });
});

// Web Dev Admin Dashboard
app.get("/api/webdev-dashboard", authorizeRoles("webdev_admin", "super_admin"), (req, res) => {
    res.json({ msg: "💻 Web Development Dashboard Data" });
});

// Digital Marketing Admin Dashboard
app.get("/api/marketing-dashboard", authorizeRoles("marketing_admin", "super_admin"), (req, res) => {
    res.json({ msg: "📈 Marketing Dashboard Data" });
});

// Event Management Admin Dashboard
app.get("/api/event-dashboard", authorizeRoles("event_admin", "super_admin"), (req, res) => {
    res.json({ msg: "🎉 Event Management Dashboard Data" });
});

// Super Admin Dashboard
app.get("/api/super-dashboard", authorizeRoles("super_admin"), async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();

        res.json({
            msg: "👑 Super Admin Dashboard",
            totalUsers,
            totalOrders
        });

    } catch (err) {
        res.status(500).json({ msg: "Error loading dashboard" });
    }
});


// ================= ADMIN DATA ROUTE =================
app.get('/api/admin-data', verifyAdmin, (req, res) => {
    res.json({ msg: "🔥 Admin access granted" });
});

// ================= TEST ROUTE =================
app.get('/', (req, res) => {
    res.send("🚀 Backend Running with OTP + Email + ENV");
});