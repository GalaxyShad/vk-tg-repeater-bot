import FormData from "form-data";
import fs from "fs";
import fetch from "node-fetch";

import { downloadFile } from "./common-utils.mjs";

import {
  telegramFormatUserName,
  telegramParseMessage,
  telegramGetMaxResPhotoId,
} from "./telegram-utils.mjs";

const telegramSideStart = (telegram, vk, linker) => {
  const tg = telegram;

  telegram.bot.on("message", async (msg) => {
    const { chat, photo, from, date, text } = msg;

    console.log(msg);

    if (text != null && text[0] === '/') {
      await handleCommands(msg);
      return;
    }

    const vkPeerId = linker.getVkFromTg(chat.id);

    if (vkPeerId == null) return;

    await vkSendPhoto(photo, from, vkPeerId);

    if (msg.text != null)
      await vk.bot
        .api("messages.send", {
          peer_id: vkPeerId,
          random_id: date,
          access_token: vk.TOKEN,
          message: telegramParseMessage(msg),
        })
        .catch((err) => {
          console.log(err);
          telegramSendError(err);
        });
  });

  telegram.bot.on("polling_error", (error) => {
    console.log(`[Telegram] [Polling Error] ${error}`);
  });

  ///////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////

  const handleCommands = async (msg) => {
    if (msg.text !== '/getid') return;

    return telegram.bot.sendMessage(msg.chat.id, `ID Беседы ${msg.chat.id}`);
  }

  const telegramDownloadPhoto = async (photo) => {
    if (photo == null) return;

    const file = await tg.bot
      .getFile(telegramGetMaxResPhotoId(photo))
      .catch((err) => console.log(err.response.body));

    return await downloadFile(
      `https://api.telegram.org/file/bot${tg.TOKEN}/${file.file_path}`,
      file.file_path
    );
  };

  const vkSendPhoto = async (photo, from, vkPeerId) => {
    if (photo == null) return;

    const filePath = await telegramDownloadPhoto(photo);

    const { upload_url } = (
      await vk.bot.api("photos.getMessagesUploadServer", {
        access_token: vk.TOKEN,
        peer_id: vkPeerId,
      })
    ).response;

    const formData = new FormData();
    formData.append("photo", fs.createReadStream(filePath));

    const response = await fetch(upload_url, {
      method: "post",
      body: formData,
    });
    const photoLink = await response.json();

    const { owner_id, id } = (
      await vk.bot.api("photos.saveMessagesPhoto", {
        access_token: vk.TOKEN,
        ...photoLink,
      })
    ).response[0];

    await vk.bot.api("messages.send", {
      access_token: vk.TOKEN,
      peer_id: vkPeerId,
      random_id: Date.now(),
      message: telegramFormatUserName(from),
      attachment: `photo${owner_id}_${id}`,
    });
  };

  const telegramSendError = (err) => {
    if (typeof err === "object") err = JSON.stringify(err, null, 2);

    tg.bot
      .sendMessage(tg.CHAT_ID, `❌ ЬЬььуууууу(( Ошибка!!! ❌\n\n${err}`)
      .catch((error) => {
        // console.log(`>> Vk Fail <<\n${err}\n`)
        // console.log(`>> Telegram Fail <<\n${error.body}`)
      });
  };

  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
};

export { telegramSideStart };
