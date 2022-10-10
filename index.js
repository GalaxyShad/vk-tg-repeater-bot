import TelegramApi from 'node-telegram-bot-api'
import VkApi from "node-vk-bot-api"
import fetch from 'node-fetch';
import FormData from 'form-data';

import fs from 'fs'

import { VK_TOKEN, TG_TOKEN, VK_CHAT_ID, TG_CHAT_ID } from './private.mjs';

const telegram = {
    TOKEN: TG_TOKEN,
    CHAT_ID: TG_CHAT_ID,
    bot: null,
}

const vk = {
    TOKEN: VK_TOKEN,
    PEER_ID: VK_CHAT_ID,
    bot: null,
}

//////////////////////////////////////////


const vkErrorFormat = (err) => {
    const { message, response } = err;
    
    const { error_code, error_msg } = response;

    return  `>> VK Bot Error <<\n` +
            `[${message}] [${error_code}] ${error_msg}`;
}


const telegramSendError = (tg, err) => {
    if (typeof err === 'object')
        err = JSON.stringify(err, null, 2)


    tg.bot.sendMessage(
        tg.CHAT_ID, 
        `❌ ЬЬььуууууу(( Ошибка!!! ❌\n\n${err}` 
    ).catch(error => {
        console.log(`>> Vk Fail <<\n${err}\n`)
        console.log(`>> Telegram Fail <<\n${error?.response?.body}`)
    })
}


const telegramFormatUserName = (from) => {
    if (from == null) return '';

    return `👤 ${from.first_name} ${from.last_name} (${from.username})`;
}


const telegramParseMessage = (message, depth = 0) => {
    if (message == null) 
        return '';

    const {from, text, reply_to_message, forward_from} = message;

    const arrowDepth = '▫'.repeat(depth);

    return  `${arrowDepth} ${telegramFormatUserName(from)}\n`
            + `${forward_from != null ? `📬 Переслано от ${telegramFormatUserName(forward_from)}\n` : '' }`
            + `${arrowDepth}${text}\n`
            + telegramParseMessage(reply_to_message, depth+1);
}

const telegramGetMaxResPhotoId = (photo) => {
    return photo[
        Object
        .keys(photo)
        .reduce((a, b) => photo[a].width > photo[b].width ? a : b)].file_id;
}


const telegramDownloadPhoto = async (tg, photo) => {
    if (photo == null)
        return;

    const file = await tg.bot
        .getFile(telegramGetMaxResPhotoId(photo))
        .catch(err => console.log(err.response.body));

    return await downloadFile(`https://api.telegram.org/file/bot${tg.TOKEN}/${file.file_path}`, file.file_path);
}


const vkSendPhoto = async (vk, photo, from) => {
    if (photo == null) return;

    const filePath = await telegramDownloadPhoto(telegram, photo);

    const {upload_url} = (await vk.bot.api('photos.getMessagesUploadServer', {
        access_token: vk.TOKEN, peer_id: vk.PEER_ID,
    })).response;

    const formData  = new FormData();
    formData.append('photo', fs.createReadStream(filePath));

    const response = await fetch(upload_url, { method: 'post', body: formData});
    const photoLink = await response.json();

    const {owner_id, id} = (await vk.bot.api('photos.saveMessagesPhoto', 
        { access_token: vk.TOKEN, ...photoLink})).response[0]

    await vk.bot.api('messages.send', {
        access_token: vk.TOKEN,
        peer_id: vk.PEER_ID,
        random_id: Date.now(),
        message: telegramFormatUserName(from),
        attachment: `photo${owner_id}_${id}`
    })
}


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

    return (media.length > 1)

      ? telegramBot.sendMediaGroup(telegram.CHAT_ID, media).catch(err => console.log(err.response.body))

      : telegramBot.sendDocument(telegram.CHAT_ID, media[0].media, {
          caption: author,
        }).then(() => console.log('sadasdasd')).catch(err => console.log(err.response.body));
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


const vkParseMessage = async (vk, vkMessage, depth = 0) => {
    if (vkMessage == null) return '';

    const {reply_message, from_id, text, fwd_messages} = vkMessage;

    let str = '';
    
    const userName = await vkGetUserName(vk, from_id);

    const rightArrow = '#'.repeat(depth);
    str += `${rightArrow} ${userName}\n${rightArrow} ${text}\n\n`;

    str += await vkParseMessage(vk, reply_message, depth+1) 
        +  await vkParseForwardedMessages(vk, fwd_messages, depth+1);

    return str;
}

const vkParseForwardedMessages = async (vk, fwdMessagesList, depth = 0) => {
    if (!Array.isArray(fwdMessagesList)) return '';
    if (fwdMessagesList.length <= 0) return '';
    
    let str = '';
    for (const msg of fwdMessagesList) {
        str += await vkParseMessage(vk, msg, depth);
    }

    return str;
}

////////////////////////////////////////////

if (!fs.existsSync('bin')) fs.mkdirSync('bin');  
if (!fs.existsSync('bin/photos')) fs.mkdirSync('bin/photos');

vk.bot = new VkApi(vk.TOKEN);
telegram.bot = new TelegramApi(telegram.TOKEN, { polling: true });


vk.bot.on(async ctx => {
    const {message} = ctx;

    if (message.peer_id !== vk.PEER_ID) return;

    const userName = await vkGetUserName(vk, message.from_id);

    const docs = message.attachments.filter(attachment => attachment.type === 'doc');
    const images = message.attachments.filter(attachment => attachment.type === 'photo');

    await telegramSendPhotosFromVk(telegram.bot, images, userName);
    await telegramSendDocumentsFromVk(telegram.bot, docs, userName);

    const respondText = await vkParseMessage(vk, message);
    if (respondText !== '') telegram.bot.sendMessage(telegram.CHAT_ID, respondText);

});


telegram.bot.on('message', async msg => {
    const {chat, photo, from} = msg;

    if (chat.id !== telegram.CHAT_ID)
        return;
        
    await vkSendPhoto(vk, photo, from)
        .catch((err) => {
            console.log(err);
            telegramSendError(telegram, vkErrorFormat(err))
        });
    
    if (msg.text != null)
        await vk.bot.api('messages.send', {
            peer_id: vk.PEER_ID,
            random_id: Date.now(),
            access_token: vk.TOKEN,
            message: telegramParseMessage(msg)
        }).catch((err) => {
            console.log(err);
            telegramSendError(telegram, vkErrorFormat(err))
        });

})

telegram.bot.on('polling_error', (error) => {
    telegramSendError(telegram, error);
    console.log(error.code); 
});

vk.bot.startPolling((err) => {
    if (err == null) return;
    telegramSendError(telegram, vkErrorFormat(err));
    console.log(err);
});

