const { spawn } = require("child_process");
const log = require("./logger/log.js");
const express = require("express");
const app = express();

// 👇 سيرفر لإبقاء Render نشيط
app.get("/", (req, res) => {
  res.send("I am alive 🟢");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌐 Web server running on port " + PORT);
});

// 👇 wrapper لإعادة تشغيل البوت تلقائيًا عند الخطأ
function startProject() {
  const child = spawn("node", ["Goat.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true
  });

  child.on("close", (code) => {
    if (code == 2) {
      log.info("Restarting Project...");
      startProject();
    }
  });
}

startProject();