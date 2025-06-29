const { Routeros } = require("routeros-node");

class MikroTikAPI {
    constructor() {
        this.routeros = null;
        this.config = null;
    }

    async initialize(host, port, user, password) {
        this.config = { host, port, user, password };
        try {
            this.routeros = new Routeros(this.config);
            await this.routeros.connect();
            console.log(`تم الاتصال بـ MikroTik على ${host}:${port}`);
            return { success: true };
        } catch (error) {
            console.error("خطأ في تهيئة الاتصال:", error);
            this.routeros = null;
            throw error;
        }
    }

    async ensureConnection() {
        if (!this.routeros || !this.routeros.connected) {
            console.log("إعادة الاتصال بـ MikroTik...");
            await this.initialize(
                this.config.host,
                this.config.port,
                this.config.user,
                this.config.password
            );
        }
    }

    async getSystemStats() {
        try {
            await this.ensureConnection();

            const activeUsers = await this.routeros.write(["/ip/hotspot/active/print"]);
            const totalActiveUsers = activeUsers.length;

            const allUsers = await this.routeros.write(["/ip/hotspot/user/print"]);
            const totalUsers = allUsers.length;

            let totalDataUsed = 0;
            activeUsers.forEach(user => {
                const bytesIn = parseInt(user["bytes-in"] || 0);
                const bytesOut = parseInt(user["bytes-out"] || 0);
                totalDataUsed += (bytesIn + bytesOut);
            });

            const totalDataGB = (totalDataUsed / (1024 * 1024 * 1024)).toFixed(2);

            return {
                success: true,
                data: {
                    totalUsers: totalUsers,
                    activeUsers: totalActiveUsers,
                    totalData: totalDataGB,
                    totalVouchers: totalUsers, // Assuming all users are vouchers for now
                    activeVouchers: totalActiveUsers,
                    totalSales: 0 // Placeholder
                }
            };
        } catch (error) {
            console.error("خطأ في جلب الإحصائيات:", error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async getActiveUsers() {
        try {
            await this.ensureConnection();
            const activeUsers = await this.routeros.write(["/ip/hotspot/active/print"]);
            
            const users = activeUsers.map(user => ({
                id: user[".id"],
                username: user.user || "غير محدد",
                ip: user.address || "غير محدد",
                uptime: this.formatUptime(user.uptime || "0s"),
                bytesIn: this.formatBytes(user["bytes-in"] || 0),
                bytesOut: this.formatBytes(user["bytes-out"] || 0),
                server: user.server || "غير محدد"
            }));

            return {
                success: true,
                data: users
            };
        } catch (error) {
            console.error("خطأ في جلب المستخدمين النشطين:", error);
            return {
                success: false,
                error: this.getErrorMessage(error),
                data: []
            };
        }
    }

    async disconnectUser(userId) {
        try {
            await this.ensureConnection();
            await this.routeros.write([`/ip/hotspot/active/remove .id=${userId}`]);
            return {
                success: true,
                message: "تم قطع الاتصال بنجاح"
            };
        } catch (error) {
            console.error("خطأ في قطع الاتصال:", error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async getProfiles() {
        try {
            await this.ensureConnection();
            const profiles = await this.routeros.write(["/ip/hotspot/user/profile/print"]);
            
            const profileList = profiles.map(profile => ({
                id: profile[".id"],
                name: profile.name,
                "rate-limit": profile["rate-limit"] || "غير محدد",
                "session-timeout": profile["session-timeout"] || "غير محدد"
            }));

            return {
                success: true,
                data: profileList
            };
        } catch (error) {
            console.error("خطأ في جلب البروفايلات:", error);
            return {
                success: false,
                error: this.getErrorMessage(error),
                data: []
            };
        }
    }

    async getVouchers() {
        try {
            await this.ensureConnection();
            const users = await this.routeros.write(["/ip/hotspot/user/print"]);
            
            const vouchers = users.map(user => ({
                id: user[".id"],
                username: user.name,
                password: user.password || "غير محدد",
                profile: user.profile || "default",
                disabled: user.disabled === "true",
                comment: user.comment || "",
                createdAt: new Date().toISOString()
            }));

            return {
                success: true,
                data: vouchers
            };
        } catch (error) {
            console.error("خطأ في جلب الكروت:", error);
            return {
                success: false,
                error: this.getErrorMessage(error),
                data: []
            };
        }
    }

    async generateVouchers(count, length, type, profile, group) {
        try {
            await this.ensureConnection();
            const vouchers = [];
            
            for (let i = 0; i < count; i++) {
                const username = this.generateCode(length, type);
                const password = this.generateCode(length, type);
                
                try {
                    await this.routeros.write(
                        [`/ip/hotspot/user/add name=${username} password=${password} profile=${profile} comment="${group ? `Group: ${group}` : "Generated voucher"}"`]
                    );
                    
                    vouchers.push({
                        username: username,
                        password: password,
                        profile: profile,
                        group: group
                    });
                } catch (addError) {
                    console.error(`خطأ في إضافة الكارت ${username}:`, addError);
                }
            }

            return {
                success: true,
                message: `تم إنشاء ${vouchers.length} كارت بنجاح`,
                data: vouchers
            };
        } catch (error) {
            console.error("خطأ في إنشاء الكروت:", error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    async deleteVoucher(voucherId) {
        try {
            await this.ensureConnection();
            await this.routeros.write([`/ip/hotspot/user/remove .id=${voucherId}`]);
            return {
                success: true,
                message: "تم حذف الكارت بنجاح"
            };
        } catch (error) {
            console.error("خطأ في حذف الكارت:", error);
            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    generateCode(length, type) {
        let chars = "";
        
        switch (type) {
            case "numbers":
                chars = "0123456789";
                break;
            case "letters":
                chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                break;
            case "mixed":
            default:
                chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                break;
        }
        
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    }

    formatUptime(uptime) {
        if (!uptime || uptime === "0s") return "0 ثانية";
        
        const timeRegex = /(\d+)([dhms])/g;
        let match;
        let result = "";
        
        while ((match = timeRegex.exec(uptime)) !== null) {
            const value = match[1];
            const unit = match[2];
            
            switch (unit) {
                case "d":
                    result += `${value} يوم `;
                    break;
                case "h":
                    result += `${value} ساعة `;
                    break;
                case "m":
                    result += `${value} دقيقة `;
                    break;
                case "s":
                    result += `${value} ثانية `;
                    break;
            }
        }
        
        return result.trim() || uptime;
    }

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return "0 B";
        
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
    }

    getErrorMessage(error) {
        if (error.message) {
            if (error.message.includes("timeout")) {
                return "انتهت مهلة الاتصال";
            } else if (error.message.includes("connect")) {
                return "فشل الاتصال بالراوتر";
            } else if (error.message.includes("login")) {
                return "خطأ في اسم المستخدم أو كلمة المرور";
            }
            return error.message;
        }
        return "خطأ غير معروف";
    }

    async disconnect() {
        if (this.routeros) {
            try {
                await this.routeros.destroy();
                this.routeros = null;
                this.config = null;
                console.log("تم قطع الاتصال بـ MikroTik");
            } catch (error) {
                console.error("خطأ في قطع الاتصال:", error);
            }
        }
    }
}

module.exports = new MikroTikAPI();


