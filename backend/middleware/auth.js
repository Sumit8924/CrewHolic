    const jwt = require("jsonwebtoken");

    function auth(req, res, next) {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send("No token");

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).send("Invalid token");
    }
    }

    function isAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).send("Admin only");
    }
    next();
    }

    module.exports = { auth, isAdmin };