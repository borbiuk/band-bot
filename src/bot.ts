import { Api, TelegramClient } from 'telegram';
import {
	AudioEntity,
	getAudioWithoutEmbedding,
	saveAudio,
	searchAudioByName,
	updateAudioVector,
} from './db';
import {
	downloadFile,
	exist,
	getClient,
	getFilePath,
	notExist,
	removeFile,
	sendAudio,
	sleep,
} from './utils';
import { vector } from './vector';

const WORKERS_COUNT = 0;

(async () => {
	const client = await getClient();

	client.addEventHandler(async (event) => {
		if (notExist(event.message?.id)) {
			return;
		}

		const { chatId: userChatId, message } = event.message;

		if (notExist(message)) {
			return;
		}

		if (message.startsWith('/s')) {
			await searchAudio(client, userChatId, message);
		} else if (message.startsWith('/analyze')) {
			await analyzeChannel(client, userChatId, message);
		}
	});

	await vectorizingJob(client);
})();

async function searchAudio(
	client: TelegramClient,
	userChatId: number,
	message: string
): Promise<void> {
	const query = message.replace(/^\/s(@\w+)?\s*/, '');

	if (notExist(query)) {
		await client.sendMessage(userChatId, {
			message:
				'❗️Search term missed. Example: /s Beyonce - Crazy in Love',
		});
		return;
	}

	await client.sendMessage(userChatId, {
		message: '🔍 Searching...',
	});

	const results = await searchAudioByName(query, 10);

	if (results.length === 0) {
		await client.sendMessage(userChatId, {
			message: '🔍 Nothing found',
		});
		return;
	}

	await client.sendMessage(userChatId, {
		message: `📀 Found ${results.length} tracks`,
	});

	await sendAudio(client, userChatId, results);
}

async function analyzeChannel(
	client: TelegramClient,
	userChatId: number,
	message: string
): Promise<void> {
	const channelName = message.replace(/^\/analyze\s*@?/, '');

	if (notExist(channelName)) {
		await client.sendMessage(userChatId, {
			message: '❗️Channel name missed. Example: /analyze @cats',
		});
		return;
	}

	const channel = await client.getEntity(`https://t.me/${channelName}`);

	if (notExist(channel) || !(channel instanceof Api.Channel)) {
		await client.sendMessage(userChatId, {
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
			.filter((x) => 'audio' in x && exist(x.audio))
			.map(({ id, chatId, audio }) => ({
				messageId: id,
				chatId: Number(chatId),
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
		await client.sendMessage(userChatId, {
			message: `👨‍🍳️ Fetched ${totalFetched} messages...`,
		});
	}

	await client.sendMessage(userChatId, {
		message: `👨‍🍳️ Analysis done. Total fetched: ${totalFetched}`,
	});
}

async function vectorizingJob(client: TelegramClient) {
	const filesToVectorize: AudioEntity[] = [];
	const isRunning = true;

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
	};

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

				await updateAudioVector(
					audioEntity.chatId,
					audioEntity.messageId,
					embedding
				);
			} catch (e) {
				console.error(`File ${audioEntity.fileName} failed`, e);
				console.error(`Worker ${id} error processing file:`, e);
			} finally {
				if (isFileDownloaded) {
					await removeFile(getFilePath(audioEntity.fileName));
				}
			}
		}
	};

	const workers = Array.from({ length: WORKERS_COUNT }).map((_, index) =>
		workerThread(index)
	);
	await Promise.all([fetchFilesLoop(), ...workers]);
}
