import { downloadFile } from './common-utils.mjs'

const vkErrorFormat = (err) => {
  const { message, response } = err;

  let str = `[${message}]`;

  if (response) {
    const { error_code, error_msg } = response;
    str += `[${error_code}] ${error_msg}`;
  } else {
    str += `[${message}] [Unknown Error]`;
  }

  return `>> VK Bot Error <<\n` + str;
};

const getMaxResPhotoUrlFromVk = ({ photo }) => {
  const { sizes } = photo;

  return sizes[
    Object.keys(sizes).reduce((a, b) =>
      sizes[a].width > sizes[b].width ? a : b
    )
  ].url;
};

const downloadDocumentFromVk = async ({ url, title }) => {
  return downloadFile(url, title)
    .then((path) => path)
    .catch((err) => console.log(err));
};

export { vkErrorFormat, getMaxResPhotoUrlFromVk, downloadDocumentFromVk }