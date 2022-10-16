import TelegramApi from "node-telegram-bot-api";
import VkApi from "node-vk-bot-api";

import fs from "fs";

import { VK_TOKEN, TG_TOKEN, VK_CHAT_ID, TG_CHAT_ID } from "./private.mjs";
import { vkSideStart  } from "./vk-side.mjs";
import { telegramSideStart } from "./telegram-side.mjs";

import Linker from './linker.mjs'

const telegram = {
  TOKEN: TG_TOKEN, CHAT_ID: TG_CHAT_ID, bot: null,
};

const vk = {
  TOKEN: VK_TOKEN, PEER_ID: VK_CHAT_ID, bot: null,
};

if (!fs.existsSync("bin")) fs.mkdirSync("bin");
if (!fs.existsSync("bin/photos")) fs.mkdirSync("bin/photos");

vk.bot = new VkApi(vk.TOKEN);
telegram.bot = new TelegramApi(telegram.TOKEN, { polling: true });

const linker = Linker();

vkSideStart(vk, telegram, linker)
telegramSideStart(telegram, vk, linker)
