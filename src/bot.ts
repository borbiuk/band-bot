import fs from 'fs/promises';
import { Api, TelegramClient } from 'telegram';
import {
	AudioVectorStatus,
	getAudioWithoutVector,
	saveAudio,
	searchAudioByName,
	updateAudioVector,
} from './db';
import environment from './environment';
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
import { generateVectors } from './vector';

const WORKERS_COUNT = 3;

(async () => {
	const client = await getClient();

	client.addEventHandler(async (event) => {
		if (notExist(event.message?.id)) {
			return;
		}

		const { chatId: userChatId, message: messageText } = event.message;

		if (notExist(messageText)) {
			return;
		}

		if (messageText.startsWith('/r') && event.message.isReply) {
			console.log(event);
			const reply = await event.message.getReplyMessage();
			console.log(reply);
		} else if (messageText.startsWith('/s')) {
			await searchAudio(client, userChatId, messageText);
		} else if (messageText.startsWith('/analyze')) {
			await analyzeChannel(client, userChatId, messageText);
		} else if (messageText.startsWith('/health')) {
			await client.sendMessage(userChatId, {
				message: '👍',
			});
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
	const filesToVectorize: AudioVectorStatus[] = [];
	const isRunning = true;

	const fetchFilesLoop = async () => {
		while (isRunning) {
			if (filesToVectorize.length < 10) {
				const notVectorizedFiles = await getAudioWithoutVector();
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

			const filePath = getFilePath(audioEntity.fileName);
			let isFileDownloaded: boolean;
			try {
				await fs.access(filePath);
				isFileDownloaded = true;
			} catch {
				isFileDownloaded = false;
			}

			try {
				if (!isFileDownloaded) {
					await downloadFile(client, audioEntity, filePath);
					isFileDownloaded = true;
				}

				const vectors = await generateVectors(filePath, audioEntity, 1);
				if (notExist(vectors)) {
					return;
				}

				await updateAudioVector(
					audioEntity.chatId,
					audioEntity.messageId,
					vectors
				);
			} catch (e) {
				console.error(`File ${audioEntity.fileName} failed`, e);
				console.error(`Worker ${id} error processing file:`, e);
			} finally {
				if (isFileDownloaded && environment.isProd) {
					await removeFile(filePath);
				}
			}
		}
	};

	const workers = Array.from({ length: WORKERS_COUNT }).map((_, index) =>
		workerThread(index)
	);
	await Promise.all([fetchFilesLoop(), ...workers]);
}
