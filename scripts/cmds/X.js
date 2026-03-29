const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "h",
    aliases: ["H", "مساعدة", "اوامر"],
    version: "3.0.0",
    author: "ST | Sheikh Tamim",
    role: 0,
    countDown: 0,
    description: "عرض قائمة الأوامر بالعربية مع واجهة أنمي تفاعلية",
    category: "help",
    guide: "{pn} [اسم_الأمر]"
  },

  ST: async ({ api, event, args, prefix }) => {
    const cmdsFolderPath = __dirname;
    const files = fs.readdirSync(cmdsFolderPath).filter(file => file.endsWith(".js"));

    const p = prefix || "!";
    const send = async (body, threadID, replyTo = null) => {
      return api.sendMessage(body, threadID, replyTo);
    };

    const normalize = (v) => String(v || "").trim().toLowerCase();

    const loadCommands = () => {
      const list = [];
      for (const file of files) {
        try {
          const cmd = require(path.join(cmdsFolderPath, file));
          if (cmd && cmd.config && cmd.config.name) list.push(cmd);
        } catch {}
      }
      return list;
    };

    const commands = loadCommands();

    const toCategoryMap = () => {
      const map = {};
      for (const cmd of commands) {
        const cat = cmd.config.category || "غير مصنف";
        if (!map[cat]) map[cat] = [];
        map[cat].push(cmd);
      }
      return map;
    };

    const buildCategoriesUI = (categories, page = 1, perPage = 6) => {
      const names = Object.keys(categories).sort((a, b) => a.localeCompare(b, "ar"));
      const totalPages = Math.max(1, Math.ceil(names.length / perPage));
      const safePage = Math.min(Math.max(page, 1), totalPages);
      const start = (safePage - 1) * perPage;
      const slice = names.slice(start, start + perPage);

      let text =
`╭━━━━━━━━━━━━━━━━━━━━╮
┃  ✦ Roxy 𝐁𝐎𝐓 ✦
┃ 𝑯𝒆𝒍𝒑 𝑴𝒆𝒏𝒖 ᯓ★
╰━━━━━━━━━━━━━━━━━━━━╯

🌸 التصنيفات المتاحة:
`;

      slice.forEach((cat, i) => {
        const count = categories[cat].length;
        text += `\n🎀 ${start + i + 1}. ${cat}\n   ↳ ${count} أمر\n`;
      });

      text +=
`\n╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📄 الصفحة ${safePage}/${totalPages}
┃ ✦ رد برقم التصنيف
┃ ✦ أو اكتب: ${p}help اسم_الأمر
┃ ✦ أو اكتب: next / prev
╰━━━━━━━━━━━━━━━━━━━━╯`;

      return { text, totalPages, safePage, names, slice };
    };

    const buildCommandDetails = (cmd) => {
      const c = cmd.config || {};
      const aliases = Array.isArray(c.aliases) ? c.aliases.join(", ") : "لا يوجد";
      const guide = typeof c.guide === "string"
        ? c.guide
        : (c.guide && c.guide.en) ? c.guide.en : "لا يوجد دليل";
      const desc = typeof c.description === "string"
        ? c.description
        : (c.description && c.description.en) ? c.description.en : "لا يوجد وصف";

      return (
`╭━━━━━━━━━━━━━━━━━━━━╮
┃  ✦ 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐈𝐍𝐅𝐎 ✦
╰━━━━━━━━━━━━━━━━━━━━╯

✨ الاسم: ${c.name || "غير معروف"}
🧷 الأسماء البديلة: ${aliases}
📂 التصنيف: ${c.category || "غير مصنف"}
👤 المطور: ${c.author || "غير معروف"}
📝 الإصدار: ${c.version || "غير معروف"}
🔐 الصلاحية: ${c.role ?? "غير محدد"}
💎 بريميوم: ${c.premium ? "نعم" : "لا"}
⏱️ cooldown: ${c.countDown ?? "غير محدد"}
🔧 usePrefix: ${c.usePrefix !== undefined ? (c.usePrefix ? "نعم" : "لا") : "إعداد عام"}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📋 الوصف
╰━━━━━━━━━━━━━━━━━━━━╯
${desc}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📚 طريقة الاستخدام
╰━━━━━━━━━━━━━━━━━━━━╯
${guide.replace(/{pn}/g, `${p}${c.name}`)}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 💫 Roxy BOT
╰━━━━━━━━━━━━━━━━━━━━╯`
      );
    };

    try {
      const query = normalize(args[0]);

      if (query && !/^\d+$/.test(query)) {
        const found = commands.find(cmd => {
          const name = normalize(cmd.config?.name);
          const aliases = Array.isArray(cmd.config?.aliases) ? cmd.config.aliases.map(normalize) : [];
          return name === query || aliases.includes(query);
        });

        if (!found) {
          return send(`❌ لم أجد الأمر: ${args[0]}`, event.threadID);
        }

        return send(buildCommandDetails(found), event.threadID);
      }

      const categories = toCategoryMap();
      const { text, totalPages, safePage, names, slice } = buildCategoriesUI(categories, 1, 6);
      const sent = await send(text, event.threadID);

      if (sent) {
        global.GoatBot.onReply.set(sent.messageID, {
          commandName: "help",
          author: event.senderID,
          stage: 1,
          page: safePage,
          totalPages,
          categories: names,
          categoriesData: categories,
          pageCategories: slice
        });
      }
    } catch (err) {
      console.error(err);
      return send("❌ حدث خطأ أثناء عرض قائمة المساعدة.", event.threadID);
    }
  },

  onReply: async ({ api, event, Reply }) => {
    if (!Reply || event.senderID !== Reply.author) return;

    const cmdsFolderPath = __dirname;
    const p = "!";
    const body = String(event.body || "").trim().toLowerCase();

    const send = async (text, threadID, replyTo = null) => api.sendMessage(text, threadID, replyTo);

    const normalize = (v) => String(v || "").trim().toLowerCase();

    const loadCommands = () => {
      const files = fs.readdirSync(cmdsFolderPath).filter(file => file.endsWith(".js"));
      const list = [];
      for (const file of files) {
        try {
          const cmd = require(path.join(cmdsFolderPath, file));
          if (cmd && cmd.config && cmd.config.name) list.push(cmd);
        } catch {}
      }
      return list;
    };

    const commands = loadCommands();

    const toCategoryMap = () => {
      const map = {};
      for (const cmd of commands) {
        const cat = cmd.config.category || "غير مصنف";
        if (!map[cat]) map[cat] = [];
        map[cat].push(cmd);
      }
      return map;
    };

    const buildCategoriesUI = (categories, page = 1, perPage = 6) => {
      const names = Object.keys(categories).sort((a, b) => a.localeCompare(b, "ar"));
      const totalPages = Math.max(1, Math.ceil(names.length / perPage));
      const safePage = Math.min(Math.max(page, 1), totalPages);
      const start = (safePage - 1) * perPage;
      const slice = names.slice(start, start + perPage);

      let text =
`╭━━━━━━━━━━━━━━━━━━━━╮
┃  ✦ Roxy 𝐁𝐎𝐓 ✦
┃ 𝑯𝒆𝒍𝒑 𝑴𝒆𝒏𝒖 ᯓ★
╰━━━━━━━━━━━━━━━━━━━━╯

🌸 التصنيفات المتاحة:
`;

      slice.forEach((cat, i) => {
        const count = categories[cat].length;
        text += `\n🎀 ${start + i + 1}. ${cat}\n   ↳ ${count} أمر\n`;
      });

      text +=
`\n╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📄 الصفحة ${safePage}/${totalPages}
┃ ✦ رد برقم التصنيف
┃ ✦ أو اكتب: next / prev
┃ ✦ أو اكتب: ${p}help اسم_الأمر
╰━━━━━━━━━━━━━━━━━━━━╯`;

      return { text, totalPages, safePage, names, slice };
    };

    const buildCommandDetails = (cmd) => {
      const c = cmd.config || {};
      const aliases = Array.isArray(c.aliases) ? c.aliases.join(", ") : "لا يوجد";
      const guide = typeof c.guide === "string"
        ? c.guide
        : (c.guide && c.guide.en) ? c.guide.en : "لا يوجد دليل";
      const desc = typeof c.description === "string"
        ? c.description
        : (c.description && c.description.en) ? c.description.en : "لا يوجد وصف";

      return (
`╭━━━━━━━━━━━━━━━━━━━━╮
┃  ✦ 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐈𝐍𝐅𝐎 ✦
╰━━━━━━━━━━━━━━━━━━━━╯

✨ الاسم: ${c.name || "غير معروف"}
🧷 الأسماء البديلة: ${aliases}
📂 التصنيف: ${c.category || "غير مصنف"}
👤 المطور: ${c.author || "غير معروف"}
📝 الإصدار: ${c.version || "غير معروف"}
🔐 الصلاحية: ${c.role ?? "غير محدد"}
💎 بريميوم: ${c.premium ? "نعم" : "لا"}
⏱️ cooldown: ${c.countDown ?? "غير محدد"}
🔧 usePrefix: ${c.usePrefix !== undefined ? (c.usePrefix ? "نعم" : "لا") : "إعداد عام"}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📋 الوصف
╰━━━━━━━━━━━━━━━━━━━━╯
${desc}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📚 طريقة الاستخدام
╰━━━━━━━━━━━━━━━━━━━━╯
${guide.replace(/{pn}/g, `${p}${c.name}`)}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 💫 Roxy BOT
╰━━━━━━━━━━━━━━━━━━━━╯`
      );
    };

    try {
      if (Reply.stage === 1) {
        if (body === "next") {
          const nextPage = Math.min((Reply.page || 1) + 1, Reply.totalPages || 1);
          const categories = Reply.categoriesData || toCategoryMap();
          const { text, safePage, names, slice } = buildCategoriesUI(categories, nextPage, 6);

          try { await api.unsendMessage(Reply.messageID); } catch {}
          const sent = await send(text, event.threadID);

          if (sent) {
            global.GoatBot.onReply.set(sent.messageID, {
              commandName: "help",
              author: event.senderID,
              stage: 1,
              page: safePage,
              totalPages: Reply.totalPages || 1,
              categories: names,
              categoriesData: categories,
              pageCategories: slice
            });
          }
          return;
        }

        if (body === "prev") {
          const prevPage = Math.max((Reply.page || 1) - 1, 1);
          const categories = Reply.categoriesData || toCategoryMap();
          const { text, safePage, names, slice } = buildCategoriesUI(categories, prevPage, 6);

          try { await api.unsendMessage(Reply.messageID); } catch {}
          const sent = await send(text, event.threadID);

          if (sent) {
            global.GoatBot.onReply.set(sent.messageID, {
              commandName: "help",
              author: event.senderID,
              stage: 1,
              page: safePage,
              totalPages: Reply.totalPages || 1,
              categories: names,
              categoriesData: categories,
              pageCategories: slice
            });
          }
          return;
        }

        const choice = parseInt(body, 10);
        if (isNaN(choice) || choice < 1 || choice > (Reply.pageCategories || []).length) {
          return send(`❌ اختيار غير صحيح. رد برقم بين 1 و ${(Reply.pageCategories || []).length}`, event.threadID, event.messageID);
        }

        const selectedCategory = Reply.pageCategories[choice - 1];
        const commandsInCategory = (Reply.categoriesData?.[selectedCategory] || []).sort((a, b) =>
          String(a.config?.name || "").localeCompare(String(b.config?.name || ""), "ar")
        );

        let text =
`╭━━━━━━━━━━━━━━━━━━━━╮
┃  📂 ${selectedCategory.toUpperCase()}
╰━━━━━━━━━━━━━━━━━━━━╯

🌸 الأوامر الموجودة:
`;

        commandsInCategory.forEach((cmd, i) => {
          text += `\n🎀 ${i + 1}. ${cmd.config.name}\n`;
        });

        text +=
`\n╭━━━━━━━━━━━━━━━━━━━━╮
┃ 💡 رد برقم الأمر
┃ 💡 أو اكتب 0 للعودة
╰━━━━━━━━━━━━━━━━━━━━╯`;

        try { await api.unsendMessage(Reply.messageID); } catch {}
        const sent = await send(text, event.threadID);

        if (sent) {
          global.GoatBot.onReply.set(sent.messageID, {
            commandName: "help",
            author: event.senderID,
            stage: 2,
            commands: commandsInCategory,
            selectedCategory,
            parentCategories: Reply.categories,
            parentCategoriesData: Reply.categoriesData,
            page: Reply.page,
            totalPages: Reply.totalPages
          });
        }
        return;
      }

      if (Reply.stage === 2) {
        if (body === "0") {
          const categories = Reply.parentCategoriesData || toCategoryMap();
          const { text, safePage, names, slice } = buildCategoriesUI(categories, Reply.page || 1, 6);

          try { await api.unsendMessage(Reply.messageID); } catch {}
          const sent = await send(text, event.threadID);

          if (sent) {
            global.GoatBot.onReply.set(sent.messageID, {
              commandName: "help",
              author: event.senderID,
              stage: 1,
              page: safePage,
              totalPages: Reply.totalPages || 1,
              categories: names,
              categoriesData: categories,
              pageCategories: slice
            });
          }
          return;
        }

        const choice = parseInt(body, 10);
        if (isNaN(choice) || choice < 1 || choice > (Reply.commands || []).length) {
          return send(`❌ اختيار غير صحيح. رد برقم بين 1 و ${(Reply.commands || []).length}، أو 0 للعودة.`, event.threadID, event.messageID);
        }

        const selected = Reply.commands[choice - 1];
        let fullCommand = selected;

        try {
          const files = fs.readdirSync(cmdsFolderPath).filter(file => file.endsWith(".js"));
          for (const file of files) {
            try {
              const command = require(path.join(cmdsFolderPath, file));
              if (normalize(command?.config?.name) === normalize(selected?.config?.name)) {
                fullCommand = command;
                break;
              }
            } catch {}
          }
        } catch {}

        const c = fullCommand.config || {};
        const aliases = Array.isArray(c.aliases) ? c.aliases.join(", ") : "لا يوجد";
        const guide = typeof c.guide === "string"
          ? c.guide
          : (c.guide && c.guide.en) ? c.guide.en : "لا يوجد دليل";
        const desc = typeof c.description === "string"
          ? c.description
          : (c.description && c.description.en) ? c.description.en : "لا يوجد وصف";

        let details =
`╭━━━━━━━━━━━━━━━━━━━━╮
┃  ✦ 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐈𝐍𝐅𝐎 ✦
╰━━━━━━━━━━━━━━━━━━━━╯

✨ الاسم: ${c.name || "غير معروف"}
🧷 الأسماء البديلة: ${aliases}
📂 التصنيف: ${c.category || "غير مصنف"}
👤 المطور: ${c.author || "غير معروف"}
📝 الإصدار: ${c.version || "غير معروف"}
🔐 الصلاحية: ${c.role ?? "غير محدد"}
💎 بريميوم: ${c.premium ? "نعم" : "لا"}
⏱️ cooldown: ${c.countDown ?? "غير محدد"}
🔧 usePrefix: ${c.usePrefix !== undefined ? (c.usePrefix ? "نعم" : "لا") : "إعداد عام"}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📋 الوصف
╰━━━━━━━━━━━━━━━━━━━━╯
${desc}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📚 طريقة الاستخدام
╰━━━━━━━━━━━━━━━━━━━━╯
${guide.replace(/{pn}/g, `${p}${c.name}`)}

╭━━━━━━━━━━━━━━━━━━━━╮
┃ 💫 Roxy BOT
╰━━━━━━━━━━━━━━━━━━━━╯`;

        try { await api.unsendMessage(Reply.messageID); } catch {}
        return send(details, event.threadID);
      }
    } catch (error) {
      console.error("Error in help onReply:", error);
      return send("❌ حدث خطأ أثناء معالجة الرد.", event.threadID, event.messageID);
    }
  }
};