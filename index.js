const { spawn } = require("child_process");
const express = require("express");
const log = require("./logger/log.js");

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("I am alive 🟢");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

function startProject() {
  const child = spawn("node", ["Goat.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true,
  });

  child.on("close", (code) => {
    if (code !== 0) {
      log.info(`Restarting Project... exited with code ${code}`);
      setTimeout(startProject, 2000);
    }
  });
}

startProject();