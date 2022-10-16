import fs from "fs";

const Linker = () => {
  let links = {
    vk2tg: {},
    tg2vk: {},
  };

  const link = (vkPeerId, tgPeerId) => {
    linkVk2Tg(vkPeerId, tgPeerId);
    linkTg2Vk(tgPeerId, vkPeerId);

    save();
  };

  const getTgFromVk = (vkPeerId) => links.vk2tg[vkPeerId];

  const getVkFromTg = (tgPeerId) => links.tg2vk[tgPeerId];

  const linkVk2Tg = (vkPeerId, tgPeerId) => (links.vk2tg[vkPeerId] = tgPeerId);

  const linkTg2Vk = (tgPeerId, vkPeerId) => (links.tg2vk[tgPeerId] = vkPeerId);

  const save = () =>
    fs.writeFile("bin/links.json", JSON.stringify(links, null, 2), err => {
      if (err) { return; }
    });

  const load = () =>
    fs.readFile("bin/links.json", "utf-8", (err, data) => {
      if (err) return;
      links = JSON.parse(data.toString());
    });

  return {
    link,
    getTgFromVk,
    getVkFromTg,
    linkVk2Tg,
    linkTg2Vk,
    save,
    load
  };
};

export default Linker;
