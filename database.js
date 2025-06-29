const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class Database {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, "data", "mikrotik_manager.db");
        this.db = null;
    }

    // إنشاء اتصال بقاعدة البيانات
    async initialize() {
        return new Promise((resolve, reject) => {
            // إنشاء مجلد البيانات إذا لم يكن موجوداً
            const fs = require("fs");
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error("خطأ في الاتصال بقاعدة البيانات:", err.message);
                    reject(err);
                } else {
                    console.log("تم الاتصال بقاعدة البيانات بنجاح");
                    this.initTables().then(resolve).catch(reject);
                }
            });
        });
    }

    // إنشاء الجداول الأساسية
    initTables() {
        return new Promise((resolve, reject) => {
            const tables = [
                // جدول المجموعات
                `CREATE TABLE IF NOT EXISTS groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    price REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                
                // جدول البروفايلات
                `CREATE TABLE IF NOT EXISTS profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id INTEGER,
                    profile_name TEXT NOT NULL,
                    price REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (group_id) REFERENCES groups (id)
                )`,
                
                // جدول الكروت
                `CREATE TABLE IF NOT EXISTS vouchers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL UNIQUE,
                    profile_name TEXT NOT NULL,
                    group_id INTEGER,
                    status TEXT DEFAULT 'inactive',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    activated_at DATETIME NULL,
                    username TEXT NULL,
                    FOREIGN KEY (group_id) REFERENCES groups (id)
                )`,
                
                // جدول المبيعات
                `CREATE TABLE IF NOT EXISTS sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    voucher_id INTEGER,
                    group_id INTEGER,
                    amount REAL NOT NULL,
                    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (voucher_id) REFERENCES vouchers (id),
                    FOREIGN KEY (group_id) REFERENCES groups (id)
                )`
            ];

            let completed = 0;
            const total = tables.length;

            tables.forEach((sql, index) => {
                this.db.run(sql, (err) => {
                    if (err) {
                        console.error(`خطأ في إنشاء الجدول ${index + 1}:`, err.message);
                        reject(err);
                        return;
                    }
                    
                    completed++;
                    if (completed === total) {
                        console.log("تم إنشاء جميع الجداول بنجاح");
                        this.insertDefaultData().then(resolve).catch(reject);
                    }
                });
            });
        });
    }

    // إدراج البيانات الافتراضية
    insertDefaultData() {
        return new Promise((resolve, reject) => {
            // إدراج مجموعات افتراضية
            const defaultGroups = [
                { name: "العملاء", price: 10.0 },
                { name: "الشركاء", price: 8.0 },
                { name: "VIP", price: 15.0 }
            ];

            let completed = 0;
            const total = defaultGroups.length;

            if (total === 0) {
                resolve();
                return;
            }

            defaultGroups.forEach(group => {
                this.db.run(
                    "INSERT OR IGNORE INTO groups (name, price) VALUES (?, ?)",
                    [group.name, group.price],
                    (err) => {
                        if (err) {
                            console.error("خطأ في إدراج المجموعة الافتراضية:", err.message);
                        }
                        
                        completed++;
                        if (completed === total) {
                            console.log("تم إدراج البيانات الافتراضية بنجاح");
                            resolve();
                        }
                    }
                );
            });
        });
    }

    // تنفيذ استعلام
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // جلب صف واحد
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // جلب عدة صفوف
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // إغلاق الاتصال
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log("تم إغلاق اتصال قاعدة البيانات");
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;


