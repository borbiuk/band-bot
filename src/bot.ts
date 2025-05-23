import { Api, TelegramClient } from 'telegram';
import { saveAudio, searchAudioByName } from './db';
import environment from './environment';
import { exist, getClient, notExist } from './utils';

(async () => {
	const client = await getClient();

	client.addEventHandler(async (event) => {
		if (notExist(event.message?.id)) {
			return;
		}

		const { chatId, message } = event.message;

		if (notExist(message)) {
			return;
		}

		console.log(event.message)

		if (message.startsWith('/s')) {
			await search(client, chatId, message);
		} else if (message.startsWith('/analyze')) {
			await analyze(client, chatId, message);
		}
	});
})();

async function search(client: TelegramClient, chatId: number, message: string): Promise<void> {
	const query = message.replace(/^\/s(@\w+)?\s*/, '');

	if (notExist(query)) {
		await client.sendMessage(chatId, {
			message: '❗️Search term missed. Example: /s Beyonce - Crazy in Love',
		});
		return;
	}

	await client.sendMessage(chatId, {
		message: `🔍 Searching...`,
	});

	const results = await searchAudioByName(query, 20);

	if (results.length === 0) {
		await client.sendMessage(chatId, {
			message: '🔍 Nothing found',
		});
		return;
	}

	await client.sendMessage(chatId, {
		message: `📀 Found ${results.length} tracks`,
	});

	const chatResults: {
		[key: string]: Required<{ messageId: number }>[];
	} = results.reduce((result, x) => {
		const key = String(x.chatId);
		if (notExist(result[key])) {
			result[key] = [];
		}
		result[key].push(x);
		return result;
	}, {});

	for (const groupChatId of Object.keys(chatResults)) {
		const audioMessages = await client.getMessages(groupChatId, {
			ids: chatResults[groupChatId].map((x) => x.messageId),
		});

		const messagesToSend = audioMessages.filter(exist);
		if (messagesToSend.length !== results.length) {
			console.error('❗️Something went wrong');
			console.log(results);
			console.log(messagesToSend);
		}

		if (messagesToSend.length === 0) {
			continue;
		}

		await client.sendMessage(chatId, {
			message: messagesToSend.length === 1
				? '📤 Sending...'
				: `📤 ${messagesToSend.length} Sending...`,
		});

		await client.forwardMessages(chatId, {
			messages: messagesToSend,
			fromPeer: groupChatId,
		});
	}
}

async function analyze(client: TelegramClient, chatId: number, message: string): Promise<void> {
	const channelName = message.replace(/^\/analyze\s*@?/, '');

	if (notExist(channelName)) {
		await client.sendMessage(chatId, {
			message: '❗️Channel name missed. Example: /analyze @cats',
		});
		return;
	}

	const channel = await client.getEntity(
		`https://t.me/${environment.channelName}`
	);

	if (notExist(channel) || !(channel instanceof Api.Channel) || channel.username !== channelName) {
		await client.sendMessage(chatId, {
			message: '❗️Channel not found',
		});
		return;
	}

	let offsetId = 0;
	const limit = 100;
	let totalFetched = 0;

	while (true) {
		const messages = await client.getMessages(channel, { limit, offsetId });

		if (messages.length === 0) {
			break;
		}

		const audioMessages = messages
			.filter(
				(x) => 'audio' in x && x.audio !== null && x.audio !== undefined
			)
			.map(({ id, chatId, audio }) => ({
				messageId: id,
				chatId: chatId?.toString(),
				fileId: audio.id.toString(),
				fileName: audio.attributes?.find(
					(attr) => attr instanceof Api.DocumentAttributeFilename
				)?.fileName,
			}));

		for (const message of audioMessages) {
			console.log(message);
			saveAudio(message);
		}

		offsetId = messages[messages.length - 1].id;
		totalFetched += messages.length;
		await client.sendMessage(chatId, {
			message: `👨‍🍳️ Fetched ${totalFetched} messages...`,
		});
		console.log(`👨‍🍳️ Fetched ${totalFetched} messages...`);
	}
}
