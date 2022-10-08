import { tokens, chatId } from './private.mjs';
import TelegramApi from 'node-telegram-bot-api'
import VkApi from "node-vk-bot-api"
import fs from 'fs'

import fetch from 'node-fetch';


const telegram = {
    TOKEN: tokens.telegram,
    CHAT_ID: chatId.telegram,
    bot: null,
}

const vk = {
    TOKEN: tokens.vk,
    PEER_ID: chatId.vk,
    bot: null,
}

if (!fs.existsSync('bin')){
    fs.mkdirSync('bin');
}

//////////////////////////////////////////

vk.bot = new VkApi(vk.TOKEN);
telegram.bot = new TelegramApi(telegram.TOKEN, {polling: true})

telegram.bot.on('message', async msg => {
    const {from, chat, text} = msg;

    if (chat.id !== telegram.CHAT_ID)
        return;

    await vk.bot.api('messages.send', {
        peer_id: vk.PEER_ID,
        random_id: Date.now(),
        access_token: vk.TOKEN,
        message: `👤${from.first_name} ${from.last_name} (${from.username})\n > ${text}`
        
    })

    // console.log(msg)
})

telegram.bot.on('polling_error', (error) => {
    console.log(error.code);  // => 'EFATAL'
});


const getFileBufferFromUrl = async (url) => {
    return fetch(url)
        .then(res => res.arrayBuffer())
        .catch(err => console.log(err))
}

const downloadFile = async (url, fileName) => {
    const res = await fetch(url);
    const path = `bin/${fileName}`;
    const fileStream = fs.createWriteStream(path);

    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });

    return path;
};


const downloadDocumentFromVk = async ({url, title}) => {
    return downloadFile(url, title).then((path) => path).catch((err) => console.log(err));
}


const telegramSendDocumentsFromVk = async (telegramBot, docList, author) => {
    if (!Array.isArray(docList)) return;
    if (docList.length <= 0) return;
    
    const media = []

    for (const doc of docList) {
        await downloadDocumentFromVk(doc.doc)
            .then(fileName => media.push({
                type: 'document',
                media: fileName,
                caption: author
            }))
            .catch(err => console.log(err));
    }

    console.log(media);
    console.log(media[0]);

    return (media.length > 1)

      ? telegramBot.sendMediaGroup(telegram.CHAT_ID, media).catch(err => console.log(err.response.body))

      : telegramBot.sendDocument(telegram.CHAT_ID, media[0].media, {
          caption: author,
        }).then(()=>console.log('sadasdasd')).catch(err => console.log(err.response.body));
}


const getMaxResPhotoUrlFromVk = ({photo}) => {
    const { sizes } = photo;

    return sizes[
        Object
        .keys(sizes)
        .reduce((a, b) => sizes[a].width > sizes[b].width ? a : b)].url;
}


const telegramSendPhotosFromVk = async (telegramBot, photoList, author) => {
    if (!Array.isArray(photoList)) return;
    if (photoList.length <= 0) return;
    
    const media = [...photoList].map(photo => {
        return {
            type: 'photo',
            media: getMaxResPhotoUrlFromVk(photo),
            caption: author
        }
    });

    return (media.length > 1)

      ? telegramBot.sendMediaGroup(telegram.CHAT_ID, media)
            .catch(err => console.log(err.body))

      : telegramBot.sendPhoto(telegram.CHAT_ID, media[0].media, {caption: author,})
            .catch(err => console.log(err.body));
}


const vkGetUserName = async (vk, id) => {
    return vk.bot.api('users.get', {
        user_ids: id,
        access_token: vk.TOKEN,
    }).then(
        res => {
            const {first_name, last_name} = res.response[0];
            return `👤${first_name} ${last_name}`;
        }
    ).catch(err => {
        console.log(err);
        return 'unknown'; 
    }); 
}


const vkParseReplyMessage = async (replyMsg, includes=1) => {
    if (replyMsg == null) return '';

    const {from_id, text, fwd_messages, reply_message} = replyMsg;

    let userName;
    await vkGetUserName(vk, from_id).then((usrName) => userName = usrName);

    let str = '';
    const rightArrow = '#'.repeat(includes);
    str += `${rightArrow} ${userName}\n${rightArrow} ${text}\n\n`;
    
    await vkParseReplyMessage(reply_message, includes+1).then((s) => str += s);
    await vkParseForwardedMessages(fwd_messages, includes+1).then((s) => str += s);

    return str;
}

const vkParseForwardedMessages = async (fwdMessagesList, includes = 0) => {
    if (!Array.isArray(fwdMessagesList)) return '';
    if (fwdMessagesList.length <= 0) return '';
    
    let str = '';
    for (const {reply_message, from_id, text, fwd_messages} of fwdMessagesList) {
        let userName;
        await vkGetUserName(vk, from_id).then((usrName) => userName = usrName);

        const rightArrow = '#'.repeat(includes);
        str += `${rightArrow} ${userName}\n${rightArrow} ${text}\n\n`;

        await vkParseReplyMessage(reply_message, includes+1).then((s) => str += s);

        await vkParseForwardedMessages(fwd_messages, includes+1).then((s) => {
            str += s;
        });
    }

    return str;
}

////////////////////////////////////////////

vk.bot.on(async ctx => {
    const {message} = ctx;

    console.log(message.peer_id)

    if (message.peer_id != vk.PEER_ID)
        return;

    let userName = 'unknown';

    await vkGetUserName(vk, message.from_id).then((usrName) => userName = usrName);

    const docs = message.attachments.filter(attachment => attachment.type === 'doc');
    const images = message.attachments.filter(attachment => attachment.type === 'photo');
    
    await telegramSendPhotosFromVk(telegram.bot, images, userName);
    await telegramSendDocumentsFromVk(telegram.bot, docs, userName);

    // console.log(message);

    await vkParseForwardedMessages([message]).then(resp => {
        if (resp !== '')
            telegram.bot.sendMessage(telegram.CHAT_ID, resp);
    });

});
  
vk.bot.startPolling();