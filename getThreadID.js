const fca = require('fca'); // تأكد أن fca موجود في node_modules
const config = require('./ST-BOT-config.json');

// تسجيل الدخول بالحساب الموجود في config.json
fca(config.botAccount).then((api) => {
    console.log("✅ البوت سجل دخول بنجاح");

    // جلب جميع الجروبات والمحادثات
    api.getThreadList(0, 50, "inbox").then(threads => {
        console.log("=== قائمة الـ Threads المتاحة ===");
        threads.forEach(thread => {
            console.log(`Name: ${thread.name || 'Private Chat'} | ID: ${thread.threadID}`);
        });
        console.log("=================================");
        process.exit(0); // إنهاء السكربت بعد الطباعة
    }).catch(err => {
        console.error("خطأ في جلب الـ Threads:", err);
        process.exit(1);
    });
}).catch(err => {
    console.error("خطأ في تسجيل الدخول:", err);
});