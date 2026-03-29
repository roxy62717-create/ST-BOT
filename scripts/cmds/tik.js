const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "tik",
    aliases: ["tiktok", "tt"],
    version: "1.0.0",
    author: "OpenAI",
    countDown: 3,
    role: 0,
    premium: false,
    usePrefix: true,
    description: "Search and send a TikTok video by keyword",
    category: "tools",
    guide: "{pn} <search>"
  },

  onStart: async function ({ api, event, args, message }) {
    const query = args.join(" ").trim();
    if (!query) return message.reply("❌ اكتب اسم للبحث");

    let loadingMsg;
    try {
      loadingMsg = await message.reply(
        "🔎 Searching TikTok...\n\n[▰▱▱▱▱] 20%"
      );
    } catch (e) {}

    const frames = [
      "🔎 Searching TikTok...\n\n[▰▱▱▱▱] 20%",
      "🔎 Searching TikTok...\n\n[▰▰▱▱▱] 40%",
      "🔎 Processing...\n\n[▰▰▰▱▱] 60%",
      "🔎 Fetching video...\n\n[▰▰▰▰▱] 80%",
      "🔎 Finalizing...\n\n[▰▰▰▰▰] 100%"
    ];

    const editMsg = async (text) => {
      try {
        if (loadingMsg && loadingMsg.messageID) {
          if (typeof api.changeMessageText === "function") {
            return api.changeMessageText(loadingMsg.messageID, text);
          }
          if (typeof api.editMessage === "function") {
            return api.editMessage(text, loadingMsg.messageID);
          }
        }
      } catch (e) {}
    };

    for (let i = 1; i < frames.length; i++) {
      await new Promise((r) => setTimeout(r, 500));
      await editMsg(frames[i]);
    }

    try {
      const searchRes = await axios.get("https://www.tikwm.com/api/feed/search", {
        params: {
          keywords: query,
          count: 1
        },
        timeout: 20000
      });

      const video = searchRes.data?.data?.videos?.[0];
      if (!video) {
        return editMsg("❌ لم أجد نتائج");
      }

      const videoUrl = video.play || video.hdplay || video.wmplay;
      if (!videoUrl) {
        return editMsg("❌ لم أتمكن من جلب رابط الفيديو");
      }

      const title = video.title || "TikTok Video";
      const author = video.author?.nickname || video.author?.unique_id || "Unknown";

      const filePath = path.join(__dirname, `tik_${Date.now()}.mp4`);
      const writer = fs.createWriteStream(filePath);

      const videoRes = await axios.get(videoUrl, { responseType: "stream", timeout: 30000 });
      videoRes.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      await api.sendMessage(
        {
          body: `🎬 ${title}\n👤 ${author}`,
          attachment: fs.createReadStream(filePath)
        },
        event.threadID,
        event.messageID
      );

      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    } catch (err) {
      await editMsg(`❌ Error: ${err.message || String(err)}`);
    }
  }
};