
const telegramFormatUserName = (from) => {
  if (from == null) return "";

  return `👤 ${from.first_name} ${from.last_name} (${from.username})`;
};

const telegramParseMessage = (message, depth = 0) => {
  if (message == null) return "";

  const { from, text, reply_to_message, forward_from } = message;

  const arrowDepth = "▫".repeat(depth);

  return (
    `${arrowDepth} ${telegramFormatUserName(from)}\n` +
    `${
      forward_from != null
        ? `📬 Переслано от ${telegramFormatUserName(forward_from)}\n`
        : ""
    }` +
    `${arrowDepth}💬 ${text}\n` +
    telegramParseMessage(reply_to_message, depth + 1)
  );
};

const telegramGetMaxResPhotoId = (photo) => {
  return photo[
    Object.keys(photo).reduce((a, b) =>
      photo[a].width > photo[b].width ? a : b
    )
  ].file_id;
};

export { telegramFormatUserName, telegramParseMessage, telegramGetMaxResPhotoId }