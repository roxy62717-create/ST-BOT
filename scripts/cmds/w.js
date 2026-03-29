const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { JSDOM } = require("jsdom"); // لتحويل HTML لنص عادي

const PAGE_SIZE = 800;

function tempDir() {
  const dir = path.join(os.tmpdir(), "stbot_wiki");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function downloadImage(url, filePath) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36"
      }
    });
    fs.writeFileSync(filePath, Buffer.from(res.data));
    return filePath;
  } catch (e) {
    return null;
  }
}

function chunkText(text, size) {
  const pages = [];
  for (let i = 0; i < text.length; i += size) pages.push(text.slice(i, i + size));
  return pages;
}

async function fetchWikipediaFull(query) {
  const url = `https://ar.wikipedia.org/api/rest_v1/page/mobile-sections/${encodeURIComponent(query)}`;
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36"
    }
  });

  // جمع جميع الفقرات من كل قسم
  let text = "";
  res.data.sections.forEach(sec => {
    if (sec.text) {
      const dom = new JSDOM(sec.text);
      text += dom.window.document.body.textContent + "\n\n";
    }
  });

  return {
    title: res.data.lead?.normalizedtitle || query,
    extract: text.trim(),
    thumbnail: res.data.lead?.image || null
  };
}

async function sendPage(api, threadID, replyTo, title, pages, pageIndex, imageFile) {
  let body = `🔍 ويكيبيديا: ${title}\n\n${pages[pageIndex]}\n\n📄 ${pageIndex + 1}/${pages.length}\n\n1 = التالي\n2 = السابق`;

  const attachments = imageFile ? [fs.createReadStream(imageFile)] : [];

  const msg = await new Promise((resolve, reject) => {
    api.sendMessage(
      { body, attachment: attachments },
      threadID,
      (err, info) => (err ? reject(err) : resolve(info)),
      replyTo
    );
  });

  if (imageFile)
    setTimeout(() => {
      try {
        if (fs.existsSync(imageFile)) fs.unlinkSync(imageFile);
      } catch (e) {}
    }, 15000);

  return msg;
}

module.exports = {
  config: {
    name: "wikipedia",
    aliases: ["wiki", "ويكيبيديا", "بحث"],
    version: "2.0.0",
    author: "OpenAI",
    countDown: 3,
    role: 0,
    premium: false,
    usePrefix: true,
    description: "بحث كامل في ويكيبيديا العربي مع تفاعلية وتقسيم صفحات",
    category: "tools",
    guide: "{pn} <كلمة البحث>"
  },

  onStart: async function ({ api, event, args, message }) {
    if (!args.length) return message.reply("❌ اكتب كلمة للبحث");

    const query = args.join(" ").trim();
    try {
      api.setMessageReaction("🔍", event.messageID, () => {}, true);
    } catch (e) {}

    let wikiData;
    try {
      wikiData = await fetchWikipediaFull(query);
    } catch (err) {
      return message.reply("❌ فشل البحث، حاول لاحقًا أو تحقق من اتصالك بالإنترنت");
    }

    if (!wikiData || !wikiData.extract) return message.reply("❌ لم أجد مقالة بهذا الاسم");

    const pages = chunkText(wikiData.extract, PAGE_SIZE);

    let imageFile = null;
    if (wikiData.thumbnail?.source) {
      const ext = path.extname(new URL(wikiData.thumbnail.source).pathname) || ".jpg";
      imageFile = path.join(tempDir(), `wiki_${Date.now()}${ext}`);
      await downloadImage(wikiData.thumbnail.source, imageFile);
    }

    const first = await sendPage(api, event.threadID, event.messageID, wikiData.title, pages, 0, imageFile);

    global.GoatBot.onReply.set(first.messageID, {
      commandName: this.config.name,
      author: event.senderID,
      title: wikiData.title,
      pages,
      pageIndex: 0,
      imageFile
    });
  },

  onReply: async function ({ api, event, Reply }) {
    if (!Reply || Reply.commandName !== this.config.name) return;
    if (event.senderID !== Reply.author) return;

    const choice = String(event.body || "").trim();
    if (choice !== "1" && choice !== "2") return;

    let pageIndex = Reply.pageIndex || 0;
    if (choice === "1") pageIndex = (pageIndex + 1) % Reply.pages.length;
    if (choice === "2") pageIndex = (pageIndex - 1 + Reply.pages.length) % Reply.pages.length;

    try {
      api.setMessageReaction("🔍", event.messageID, () => {}, true);
    } catch (e) {}

    const sent = await sendPage(
      api,
      event.threadID,
      event.messageID,
      Reply.title,
      Reply.pages,
      pageIndex,
      Reply.imageFile
    );

    global.GoatBot.onReply.set(sent.messageID, {
      ...Reply,
      pageIndex
    });
  }
};