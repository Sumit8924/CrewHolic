require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SibApiV3Sdk = require("sib-api-v3-sdk");

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
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "officialcrewholic@gmail.com";

// ================= BREVO API SETUP =================
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmail(to, subject, html) {
    try {
        const sendSmtpEmail = {
            sender: {
                name: "CREWHOLIC",
                email: BREVO_SENDER_EMAIL
            },
            to: [
                {
                    email: to
                }
            ],
            subject,
            htmlContent: html
        };

        const result = await emailApi.sendTransacEmail(sendSmtpEmail);

        console.log("✅ Email sent:", result);

        return result;

    } catch (err) {
        console.log("❌ Email failed:", err.response?.body || err.message);
        throw err;
    }
}

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

// ================= TEST ROUTE =================
app.get("/", (req, res) => {
    res.send("🚀 Backend Running Successfully with Brevo API");
});

// ================= TEST EMAIL =================
app.get("/api/test-email", async (req, res) => {
    try {
        const result = await sendEmail(
            "srout2023@gift.edu.in",
            "✅ CREWHOLIC Test Email",
            `
            <div style="font-family: Arial; padding: 20px;">
                <h1>Email Working Successfully 🚀</h1>
                <p>Brevo API configured correctly.</p>
            </div>
            `
        );

        res.json({
            msg: "Email Sent",
            result
        });

    } catch (err) {
        res.status(500).json({
            msg: "Email Failed",
            error: err.response?.body || err.message
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

    const otp = Math.floor(100000 + Math.random() * 900000);

    otpStore[email] = {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    };

    try {
        await sendEmail(
            email,
            "🔐 Your OTP Code",
            `
            <div style="font-family: Arial; padding: 20px;">
                <h2>Your OTP: ${otp}</h2>
                <p>This OTP is valid for 5 minutes.</p>
            </div>
            `
        );

        res.json({
            msg: "OTP sent successfully"
        });

    } catch (err) {
        console.log("OTP ERROR:", err.response?.body || err.message);

        res.status(500).json({
            msg: "Failed to send OTP",
            error: err.response?.body || err.message
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

        // Welcome email in background, signup does not wait
        sendEmail(
            email,
            "🎉 Welcome to CREWHOLIC",
            `
            <div style="font-family: Arial, sans-serif; background: #0a0a2a; padding: 30px; color: #fff;">
                <div style="max-width: 600px; margin: auto; background: #111328; border-radius: 20px; padding: 30px; text-align: center;">
                    
                    <h1 style="color: #9B51E0; margin-bottom: 10px;">
                        Welcome, ${name} 🚀
                    </h1>
                    
                    <p style="font-size: 16px; color: #ccc;">
                        Your account has been successfully created at <b style="color:#F2994A;">CREWHOLIC</b>.
                    </p>

                    <p style="font-size: 14px; color: #aaa; margin-top: 20px;">
                        You are now ready to explore CREWHOLIC services.
                    </p>

                    <div style="margin: 30px 0;">
                        <a href="https://crew-holic.vercel.app/login.html"
                        style="background: linear-gradient(90deg,#9B51E0,#F2994A);
                                padding: 12px 25px;
                                border-radius: 50px;
                                color: white;
                                text-decoration: none;
                                font-weight: bold;">
                        Login Now
                        </a>
                    </div>

                    <p style="font-size: 12px; color: #777;">
                        CREWHOLIC Team 🚀
                    </p>
                </div>
            </div>
            `
        ).catch((err) => {
            console.log("⚠️ Welcome email failed, but user registered:", err.response?.body || err.message);
        });

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
            msg: "Server error",
            error: err.message
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
            msg: "Server error",
            error: err.message
        });
    }
});

// ================= VERIFY ADMIN =================
function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            msg: "No token"
        });
    }

    const token = authHeader.split(" ")[1];

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

// ================= ROLE BASED ACCESS =================
function authorizeRoles(...roles) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                msg: "No token"
            });
        }

        const token = authHeader.split(" ")[1] || authHeader;

        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            if (!roles.includes(decoded.role)) {
                return res.status(403).json({
                    msg: "Access denied"
                });
            }

            req.user = decoded;
            next();

        } catch (err) {
            res.status(401).json({
                msg: "Invalid token"
            });
        }
    };
}

// ================= APPROVE ORDER =================
app.post("/api/admin/approve-order", verifyAdmin, async (req, res) => {
    try {
        const { email, name, service } = req.body;

        if (!email || !name || !service) {
            return res.status(400).json({
                msg: "Missing data"
            });
        }

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

        const result = await sendEmail(
            email,
            serviceTitle,
            `
            <div style="font-family: Arial; padding: 20px;">
                <h2 style="color:#4CAF50;">Congratulations ${name}! 🎉</h2>
                <h3>${serviceTitle}</h3>
                <p>${serviceMessage}</p>
                <p>Our team will contact you shortly to proceed further.</p>

                <br>

                <a href="https://crew-holic.vercel.app"
                    style="padding:10px 20px; background:#9B51E0; color:white; text-decoration:none; border-radius:5px;">
                    Go to Website
                </a>

                <p style="margin-top:20px; font-size:12px; color:#777;">
                    CREWHOLIC Team 🚀
                </p>
            </div>
            `
        );

        res.json({
            msg: `${service} approved & email sent`,
            result
        });

    } catch (err) {
        console.log("❌ APPROVE ERROR FULL:", err.response?.body || err.message);

        res.status(500).json({
            msg: "Failed to approve order",
            error: err.response?.body || err.message
        });
    }
});

// ================= CONTACT FORM =================
app.post("/api/contact", async (req, res) => {
    try {
        const { name, email, service, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({
                msg: "All fields required"
            });
        }

        await sendEmail(
            BREVO_SENDER_EMAIL,
            `📬 New Contact Message from ${name}`,
            `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #9B51E0;">New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Service:</strong> ${service || "Not specified"}</p>
                <p><strong>Message:</strong></p>
                <p style="background: #f0f0f0; padding: 15px; border-radius: 10px;">${message}</p>
            </div>
            `
        );

        await sendEmail(
            email,
            "✅ We've Received Your Message!",
            `
            <div style="font-family: Arial, sans-serif; background: #0a0a2a; padding: 30px; color: #fff;">
                <div style="max-width: 600px; margin: auto; background: #111328; border-radius: 20px; padding: 30px; text-align: center;">
                    <h1 style="color: #9B51E0;">Thank You, ${name}! 🙏</h1>
                    <p>We have received your message and our team will get back to you within 24 hours.</p>
                    <p style="margin-top: 20px; font-size: 12px; color: #777;">CREWHOLIC Team 🚀</p>
                </div>
            </div>
            `
        );

        res.json({
            msg: "Message sent successfully"
        });

    } catch (err) {
        console.log("CONTACT ERROR:", err.response?.body || err.message);

        res.status(500).json({
            msg: "Failed to send message",
            error: err.response?.body || err.message
        });
    }
});

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

// ================= ADMIN ANALYTICS =================
app.get("/api/admin/analytics", verifyAdmin, async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({
            status: "pending"
        });
        const approvedOrders = await Order.countDocuments({
            status: "approved"
        });

        const revenueData = await Order.aggregate([
            {
                $group: {
                    _id: "$service",
                    total: {
                        $sum: "$amount"
                    }
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

        res.status(500).json({
            msg: "Error fetching analytics",
            error: err.message
        });
    }
});

// ================= ROLE DASHBOARDS =================
app.get("/api/rental-dashboard", authorizeRoles("rental_admin", "super_admin"), (req, res) => {
    res.json({
        msg: "📦 Rental Dashboard Data"
    });
});

app.get("/api/finance-dashboard", authorizeRoles("finance_admin", "super_admin"), (req, res) => {
    res.json({
        msg: "💰 Finance Dashboard Data"
    });
});

app.get("/api/webdev-dashboard", authorizeRoles("webdev_admin", "super_admin"), (req, res) => {
    res.json({
        msg: "💻 Web Development Dashboard Data"
    });
});

app.get("/api/marketing-dashboard", authorizeRoles("marketing_admin", "super_admin"), (req, res) => {
    res.json({
        msg: "📈 Marketing Dashboard Data"
    });
});

app.get("/api/event-dashboard", authorizeRoles("event_admin", "super_admin"), (req, res) => {
    res.json({
        msg: "🎉 Event Management Dashboard Data"
    });
});

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
        res.status(500).json({
            msg: "Error loading dashboard",
            error: err.message
        });
    }
});

// ================= ADMIN DATA =================
app.get("/api/admin-data", verifyAdmin, (req, res) => {
    res.json({
        msg: "🔥 Admin access granted"
    });
});