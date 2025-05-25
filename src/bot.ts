import { Api, TelegramClient } from 'telegram';
import { AudioEntity, getAudioWithoutEmbedding, saveAudio, searchAudioByName, updateAudioVector } from './db';
import environment from './environment';
import { downloadFile, exist, getClient, getFilePath, notExist, removeFile, sleep } from './utils';
import { vector } from './vector';

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

		if (message.startsWith('/s')) {
			await searchAudio(client, chatId, message);
		} else if (message.startsWith('/analyze')) {
			await analyzeChannel(client, chatId, message);
		}

		await vectorizingJob(client);
	});
})();

async function searchAudio(client: TelegramClient, chatId: number, message: string): Promise<void> {
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

	const chatResults = results.reduce((p, c) => {
		const key = String(c.chatId);
		if (notExist(p[key])) {
			p[key] = [];
		}
		p[key].push(c);
		return p;
	}, {}) as {
		[key: string]: Required<{ messageId: string }>[];
	};

	for (const groupChatId of Object.keys(chatResults)) {
		const audioMessages = await client.getMessages(groupChatId, {
			ids: chatResults[groupChatId].map(({ messageId }) => Number(messageId)),
		});

		const messagesToSend = audioMessages.filter(exist);

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

async function analyzeChannel(client: TelegramClient, chatId: number, message: string): Promise<void> {
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
				(x) => 'audio' in x && exist(x.audio !== null)
			)
			.map(({ id, chatId, audio }) => ({
				messageId: id,
				chatId: chatId?.toString(),
				fileName: audio.attributes?.find(
					(attr) => attr instanceof Api.DocumentAttributeFilename
				)?.fileName,
			}));

		for (const message of audioMessages) {
			const isSaved = await saveAudio(message);
			if (isSaved) {
				totalFetched++;
			}
		}

		offsetId = messages[messages.length - 1].id;
		await client.sendMessage(chatId, {
			message: `👨‍🍳️ Fetched ${totalFetched} messages...`,
		});
	}

	await client.sendMessage(chatId, {
		message: `👨‍🍳️ Analysis done. Total fetched: ${totalFetched}`,
	});
}

async function vectorizingJob(client: TelegramClient) {

	const filesToVectorize: AudioEntity[] = [];
	let isRunning = true;
	const fetchFilesLoop = async () => {
		while (isRunning) {
			if (filesToVectorize.length < 10) {
				const notVectorizedFiles = await getAudioWithoutEmbedding();
				if (notVectorizedFiles.length > 0) {
					filesToVectorize.push(...notVectorizedFiles);
				}
			}
			await sleep(5_000);
		}
	}

	const workerThread = async (id: number) => {
		while (isRunning) {
			const audioEntity = filesToVectorize.shift();
			if (notExist(audioEntity)) {
				await sleep(100);
				continue;
			}

			let isFileDownloaded = false;
			try {
				const filePath = await downloadFile(client, audioEntity);
				isFileDownloaded = true;

				const embedding = await vector(filePath);
				if (notExist(embedding)) {
					return;
				}

				await updateAudioVector({ ...audioEntity, embedding });
			} catch (e) {
				console.error(`File ${audioEntity.fileName} failed`, e);
				console.error(`Worker ${id} error processing file:`, e);
			} finally {
				if (isFileDownloaded) {
					await removeFile(getFilePath(audioEntity.fileName));
				}
			}
		}
	}

	const workers = Array.from({ length: 5 }).map((_, index) => workerThread(index));
	await Promise.all([fetchFilesLoop(), ...workers]);
}
