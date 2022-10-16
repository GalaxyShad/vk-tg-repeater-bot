import { downloadFile } from './common-utils.mjs'

import {
  vkErrorFormat, 
  getMaxResPhotoUrlFromVk, 
  downloadDocumentFromVk
} from './vk-utils.mjs'

const vkSideStart = (vk, telegram, linker) => {

  const onMessage = async ctx => {
    const { message } = ctx;

    console.log(message);

    if (message.text[0] === '/') {
      await handleCommands(message);
      return;
    }

    const tgPeerId = linker.getTgFromVk(message.peer_id);
    if (tgPeerId == null) return;
  
    const userName = await getUserName(message.from_id);
  
    const docs = message.attachments.filter(
      attachment => attachment.type === "doc"
    );
    const images = message.attachments.filter(
      attachment => attachment.type === "photo"
    );

    await telegramSendPhotos(images, userName, tgPeerId);
    await telegramSendDocumentsFromVk(docs, userName, tgPeerId);
  
    const respondText = await parseMessage(message);
    if (respondText !== "")
      await telegram.bot.sendMessage(tgPeerId, respondText);
  }

  const onError = err => {
    if (err == null) return;
    console.log(`[Vk] [Polling Error] ${err.toJSON().stack}`);
  }

  vk.bot.on(onMessage);
  vk.bot.startPolling(onError);


  ////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////

  const sendMessage = async (msgCtx, text) => vk.bot.api("messages.send", {
      peer_id: msgCtx.peer_id,
      random_id: Date.now(),
      access_token: vk.TOKEN,
      message: text,
    });

  const handleCommands = async (message) => {
    const commandList = {
      '/get-id': async (message, args) => sendMessage(message, `ID беседы -> ${message.peer_id}`),
  
      '/link': async (message, args) => {
        if (args[0] == null) 
          return sendMessage(message, `🚫 [Ошибка] 0 аргументов`);
  
        try {
          await telegram.bot.sendMessage(args[0], `Установлена связь с каналом VK ${message.peer_id}`)
        }
        catch (err) {
          const { error_code, description } = err.response.body;
          return sendMessage(message, `🚫 [Ошибка] [${error_code}] ${description}`);
        }
        
        linker.link(message.peer_id, args[0]);
  
        return sendMessage(message, 
          `Репитер успешно установлен на телеграм канал с ID ${linker.getTgFromVk(message.peer_id)}`);
      }
    };


    const [commandName, ...args] = message.text.split(' ');

    const command = commandList[commandName];
    if (command == null) return null;

    return command(message, args);
  }


  const getUserName = async (id) => {
    return vk.bot
      .api("users.get", {
        user_ids: id,
        access_token: vk.TOKEN,
      })
      .then((res) => {
        console.log(res.response[0]);
        const { first_name, last_name } = res.response[0];
        return `👤${first_name} ${last_name}`;
      })
      .catch((err) => {
        console.log(err);
        return "unknown user";
      });
  };

  const telegramSendDocumentsFromVk = async (docList, author, tgPeerId) => {
    if (!Array.isArray(docList)) return;
    if (docList.length <= 0) return;
  
    const media = [];
  
    for (const doc of docList) {
      await downloadDocumentFromVk(doc.doc)
        .then((fileName) =>
          media.push({
            type: "document",
            media: fileName,
            caption: author,
          })
        )
        .catch((err) => console.log(err));
    }
  
    return media.length > 1
      ? telegram.bot
          .sendMediaGroup(tgPeerId, media)
          .catch((err) => console.log(err.response.body))
      : telegram.bot
          .sendDocument(tgPeerId, media[0].media, {
            caption: author,
          })
          .then(() => console.log("sadasdasd"))
          .catch((err) => console.log(err.response.body));
  };
  
  const telegramSendPhotos = async (photoList, author, tgPeerId) => {
    if (!Array.isArray(photoList)) return;
    if (photoList.length <= 0) return;
  
    const media = [...photoList].map((photo) => {
      return {
        type: "photo",
        media: getMaxResPhotoUrlFromVk(photo),
        caption: author,
      };
    });
  
    return media.length > 1
      ? telegram.bot
          .sendMediaGroup(tgPeerId, media)
          .catch((err) => console.log(err.body))
      : telegram.bot
          .sendPhoto(tgPeerId, media[0].media, { caption: author })
          .catch((err) => console.log(err.body));
  };

  const parseMessage = async (vkMessage, depth = 0) => {
    if (vkMessage == null) return "";
  
    const { reply_message, from_id, text, fwd_messages } = vkMessage;
  
    let str = "";
  
    const userName = await getUserName(from_id);
    const rightArrow = "▫".repeat(depth);
    str += `${rightArrow} ${userName}\n${rightArrow}💬 ${text}\n\n`;

    str +=
      (await parseMessage(reply_message, depth + 1)) +
      (await parseForwardedMessages(fwd_messages, depth + 1));
  
    return str;
  };
  
  const parseForwardedMessages = async (fwdMessagesList, depth = 0) => {
    if (!Array.isArray(fwdMessagesList)) return "";
    if (fwdMessagesList.length <= 0) return "";
  
    let str = "";
    for (const msg of fwdMessagesList) {
      str += await parseMessage(msg, depth);
    }
  
    return str;
  };
}

export { vkSideStart }