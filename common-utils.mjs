import fetch from "node-fetch";
import fs from "fs";

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

export { downloadFile }