const express = require("express");
const path = require("path");
const MikroTikAPI = require("./mikrotik-api");
const Database = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// تهيئة قاعدة البيانات
const db = new Database("./data/mikrotik_manager.db");
db.initialize().then(() => {
    console.log("تم الاتصال بقاعدة البيانات بنجاح");
    console.log("تم إنشاء جميع الجداول بنجاح");
    console.log("تم إدراج البيانات الافتراضية بنجاح");
}).catch(err => {
    console.error("خطأ في تهيئة قاعدة البيانات:", err);
});

// Middleware لخدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json()); // لتمكين تحليل طلبات JSON

// مسار الصفحة الرئيسية (الآن ستكون لوحة التحكم مباشرة)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// تهيئة اتصال MikroTik عند بدء تشغيل الخادم
const MIKROTIK_HOST = "12.0.0.1";
const MIKROTIK_PORT = 8728; // أو 8729 لـ SSL
const MIKROTIK_USER = "admin";
const MIKROTIK_PASSWORD = "123456789";

MikroTikAPI.initialize(MIKROTIK_HOST, MIKROTIK_PORT, MIKROTIK_USER, MIKROTIK_PASSWORD)
    .then(() => {
        console.log("تم تهيئة اتصال MikroTik بنجاح عند بدء التشغيل");
    })
    .catch(err => {
        console.error("خطأ في تهيئة اتصال MikroTik عند بدء التشغيل:", err);
    });

// API لجلب إحصائيات النظام
app.get("/api/stats", async (req, res) => {
    const stats = await MikroTikAPI.getSystemStats();
    res.json(stats);
});

// API لجلب المستخدمين النشطين
app.get("/api/active-users", async (req, res) => {
    const activeUsers = await MikroTikAPI.getActiveUsers();
    res.json(activeUsers);
});

// API لقطع اتصال مستخدم
app.post("/api/disconnect-user", async (req, res) => {
    const { userId } = req.body;
    const result = await MikroTikAPI.disconnectUser(userId);
    res.json(result);
});

// API لجلب البروفايلات
app.get("/api/profiles", async (req, res) => {
    const profiles = await MikroTikAPI.getProfiles();
    res.json(profiles);
});

// API لجلب الكروت
app.get("/api/vouchers", async (req, res) => {
    const vouchers = await MikroTikAPI.getVouchers();
    res.json(vouchers);
});

// API لإنشاء كروت جديدة
app.post("/api/generate-vouchers", async (req, res) => {
    const { count, length, type, profile, group } = req.body;
    const result = await MikroTikAPI.generateVouchers(count, length, type, profile, group);
    res.json(result);
});

// API لحذف كارت
app.post("/api/delete-voucher", async (req, res) => {
    const { voucherId } = req.body;
    const result = await MikroTikAPI.deleteVoucher(voucherId);
    res.json(result);
});

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`🚀 خادم نظام إدارة MikroTik يعمل على المنفذ ${PORT}`);
    console.log(`🌐 يمكنك الوصول للنظام عبر: http://localhost:${PORT}`);
});


