interface Content {
  isBuy: boolean;
  userAddress: string;
  solAmount: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenAmount: number;
  signature: string;
}

export async function publishToChannel(url: string, content: Content) {
  const { isBuy, userAddress, solAmount, tokenAddress, tokenSymbol, tokenAmount, signature } =
    content;
  const shorthenUserAddress = shorthenAddress(content.userAddress);

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "Webhook",
      embeds: [
        {
          title: "Alert Bot",
          color: 2326507,
          fields: [
            {
              name: "Address",
              value: `[${shorthenUserAddress}](https://solscan.io/account/${userAddress})`,
              inline: true,
            },
            {
              name: "Type",
              value: isBuy ? "Buy via pump.fun" : "Sell via pump.fun",
              inline: true,
            },
            {
              name: "Action",
              value: isBuy
                ? `Swapped *${solAmount} SOL* for *${tokenAmount} ${tokenSymbol}*`
                : `Swapped *${tokenAmount} ${tokenSymbol}* for *${solAmount} SOL*`,
            },
            {
              name: `Token Address (${tokenSymbol})`,
              value: `\`\`\`${tokenAddress}\`\`\``,
            },
            { name: "External", value: `https://pump.fun/${tokenAddress}` },
            { name: "Explorer", value: `https://solscan.io/tx/${signature}` },
          ],
        },
      ],
    }),
  });
}

function shorthenAddress(address: string) {
  // for example, shorthen from 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV to 7EcD...FLtV
  const shorthenAddress = `${address.substring(0, 4)}...${address.substring(
    address.length - 5,
    address.length - 1
  )}`;

  return shorthenAddress;
}
