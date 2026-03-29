const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");

const COMMAND_NAME = "pinterest";
const PAGE_SIZE = 8;

function isImageUrl(url) {
  if (typeof url !== "string") return false;
  return /^https?:\/\/.+/i.test(url) && (
    /pinimg\.com/i.test(url) ||
    /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url)
  );
}

function collectImageUrls(input, out = [], seen = new WeakSet()) {
  if (!input) return out;

  if (typeof input === "string") {
    if (isImageUrl(input)) out.push(input);
    return out;
  }

  if (Array.isArray(input)) {
    for (const item of input) collectImageUrls(item, out, seen);
    return out;
  }

  if (typeof input === "object") {
    if (seen.has(input)) return out;
    seen.add(input);

    for (const value of Object.values(input)) {
      if (typeof value === "string") {
        if (isImageUrl(value)) out.push(value);
      } else if (value && (Array.isArray(value) || typeof value === "object")) {
        collectImageUrls(value, out, seen);
      }
    }
  }

  return out;
}

function unique(arr) {
  return [...new Set(arr)];
}

function chunk(arr, size) {
  const pages = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages;
}

async function downloadImage(url, filePath) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  fs.writeFileSync(filePath, Buffer.from(res.data));
}

function safeExtFromUrl(url) {
  try {
    const ext = path.extname(new URL(url).pathname);
    if (ext && ext.length <= 5) return ext;
  } catch (e) {}
  return ".jpg";
}

async function loadPinterestModule() {
  return await import("@myno_21/pinterest-scraper");
}

async function buildPageFiles(urls, pageIndex) {
  const dir = path.join(os.tmpdir(), "stbot_pinterest");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = [];
  for (let i = 0; i < urls.length; i++) {
    const ext = safeExtFromUrl(urls[i]);
    const filePath = path.join(dir, `pin_${Date.now()}_${pageIndex}_${i}${ext}`);
    await downloadImage(urls[i], filePath);
    files.push(filePath);
  }
  return files;
}

async function sendPage(api, threadID, replyTo, title, query, pageIndex, pagesCount, pageUrls) {
  const files = await buildPageFiles(pageUrls, pageIndex);
  const attachments = files.map((file) => fs.createReadStream(file));

  const body =
    `🖼️ Pinterest\n` +
    `🔎 ${query}\n` +
    `📄 ${pageIndex + 1}/${pagesCount}\n\n` +
    `1\n2`;

  const msg = await new Promise((resolve, reject) => {
    api.sendMessage(
      {
        body,
        attachment: attachments
      },
      threadID,
      (err, info) => {
        if (err) return reject(err);
        resolve(info);
      },
      replyTo
    );
  });

  setTimeout(() => {
    for (const file of files) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (e) {}
    }
  }, 15000);

  return msg;
}

module.exports = {
  config: {
    name: COMMAND_NAME,
    aliases: ["pin", "pinterest", "pins"],
    version: "1.0.0",
    author: "OpenAI",
    countDown: 3,
    role: 0,
    premium: false,
    usePrefix: true,
    description: "Pinterest search with interactive paging and image downloads",
    category: "tools",
    guide: "{pn} <search>"
  },

  onStart: async function ({ api, event, args }) {
    try {
      if (!args.length) {
        return api.sendMessage("❌", event.threadID, event.messageID);
      }

      try {
        api.setMessageReaction("🖼️", event.messageID, () => {}, true);
      } catch (e) {}

      const query = args.join(" ").trim();
      const Pinterest = await loadPinterestModule();
      const searchPins = Pinterest.searchPins;

      if (typeof searchPins !== "function") {
        return api.sendMessage("❌", event.threadID, event.messageID);
      }

      const result = await searchPins(query);
      const rawUrls = collectImageUrls(result);
      const urls = unique(rawUrls).filter(isImageUrl);

      if (!urls.length) {
        return api.sendMessage("❌", event.threadID, event.messageID);
      }

      const pages = chunk(urls, PAGE_SIZE);
      const first = await sendPage(api, event.threadID, event.messageID, COMMAND_NAME, query, 0, pages.length, pages[0]);

      global.GoatBot.onReply.set(first.messageID, {
        commandName: COMMAND_NAME,
        author: event.senderID,
        query,
        pages,
        pageIndex: 0
      });
    } catch (err) {
      return api.sendMessage("❌", event.threadID, event.messageID);
    }
  },

  onReply: async function ({ api, event, Reply }) {
    if (!Reply || Reply.commandName !== COMMAND_NAME) return;
    if (event.senderID !== Reply.author) return;

    const body = String(event.body || "").trim();
    if (body !== "1" && body !== "2") return;

    const pages = Reply.pages || [];
    if (!pages.length) return;

    let pageIndex = Number(Reply.pageIndex || 0);

    if (body === "1") pageIndex = (pageIndex + 1) % pages.length;
    if (body === "2") pageIndex = (pageIndex - 1 + pages.length) % pages.length;

    try {
      api.setMessageReaction("📌", event.messageID, () => {}, true);
    } catch (e) {}

    const sent = await sendPage(
      api,
      event.threadID,
      event.messageID,
      COMMAND_NAME,
      Reply.query || "Pinterest",
      pageIndex,
      pages.length,
      pages[pageIndex]
    );

    global.GoatBot.onReply.set(sent.messageID, {
      commandName: COMMAND_NAME,
      author: Reply.author,
      query: Reply.query,
      pages,
      pageIndex
    });
  }
};