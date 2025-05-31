import fs from 'fs/promises';
import input from 'input';
import path from 'node:path';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { AudioEntity } from './db';
import environment from './environment';
import Message = Api.Message;

export async function getClient() {
	const client = new TelegramClient(
		new StringSession(environment.telegram.appSession),
		environment.telegram.appApiId,
		environment.telegram.appApiHash,
		{
			connectionRetries: 5,
		}
	);

	//await client.start({botAuthToken: environment.telegram.botToken });
	await client.start({
		phoneNumber: async () => await input.text('Phone number: '),
		password: async () => await input.text('2FA Password (if any): '),
		phoneCode: async () => await input.text('Code sent to Telegram: '),
		onError: (err) => console.log(err),
		botAuthToken: environment.telegram.botToken,
	});

	const session = client.session.save();
	if (!environment.isProd) {
		console.info(`Session saved: ${session}`);
	}

	return client;
}

export async function downloadFile(
	client: TelegramClient,
	{
		chatId,
		messageId,
		fileName,
	}: { chatId: number; messageId: number; fileName: string },
	filePath: string
): Promise<void> {
	const message = await client.getMessages(chatId, { ids: messageId });
	if (
		notExist(message) ||
		message.length === 0 ||
		!(message[0] instanceof Message)
	) {
		throw new Error('Message not found or does not contain media');
	}

	const mediaMessage = message[0];
	if (notExist(mediaMessage.media)) {
		throw new Error('No media found in the message');
	}

	console.log(`(${fileName}) Downloading...`);
	const startTime = Date.now();
	let lastLogged = 0;
	const buffer = await client.downloadMedia(mediaMessage.media, {
		progressCallback: (downloaded, total) => {
			const percent = Math.floor(
				(Number(downloaded) / Number(total)) * 100
			);

			if (percent >= lastLogged + 50 && lastLogged !== 50) {
				lastLogged = percent - (percent % 50);
				console.log(`(${fileName}) Downloading ${lastLogged}%...`);
			}
		},
	});
	if (notExist(buffer)) {
		throw new Error(`(${fileName}) Downloading failed`);
	}

	const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
	const fileSize = (buffer.length / (1024 * 1024)).toFixed(2);
	console.log(
		`(${fileName}) Downloading complete in ${elapsedSeconds} seconds, ${fileSize} MB`
	);

	await fs.mkdir(environment.downloadDir, { recursive: true });
	await fs.writeFile(filePath, buffer);

	console.log(`(${fileName}) Saved`);
}

export async function removeFile(filePath: string) {
	try {
		await fs.unlink(filePath);
		console.log(`File removed: ${filePath}`);
	} catch (error) {
		console.error(`Error removing file: ${error.message}`);
	}
}

export async function removeAllFilesInDirectory() {
	try {
		const files = await fs.readdir(environment.downloadDir);

		for (const file of files) {
			const filePath = path.join(environment.downloadDir, file);
			const stat = await fs.stat(filePath);
			if (stat.isFile()) {
				await removeFile(filePath);
			}
		}
	} catch (error) {
		console.error(`Error removing files: ${error.message}`);
	}
}

export function getFilePath(fileName: string): string {
	return path.join(environment.downloadDir, fileName);
}

export function notExist(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		Number.isNaN(value) ||
		value === ''
	);
}

export function exist(value: unknown): boolean {
	return !notExist(value);
}

export async function sleep(ms: number): Promise<void> {
	await new Promise((res) => setTimeout(res, ms));
}

export async function sendAudio(
	client: TelegramClient,
	userChatId: number,
	audioEntities: AudioEntity[]
): Promise<void> {
	const channelMessages = audioEntities.reduce((p, c) => {
		const channelId = String(c.chatId);
		if (notExist(p[channelId])) {
			p[channelId] = [];
		}
		p[channelId].push(Number(c.messageId));
		return p;
	}, {}) as {
		[channelId: string]: number[];
	};

	for (const [channelId, messageIds] of Object.entries(channelMessages)) {
		const channel = await client.getEntity(channelId);

		if (notExist(channel) || !(channel instanceof Api.Channel)) {
			continue;
		}

		const channelName = '@' + channel.username;

		await client.sendMessage(userChatId, {
			message:
				messageIds.length === 1
					? `📤 Sending message from ${channelName} channel...`
					: `📤 Sending ${messageIds.length} messages from ${channelName} channel ...`,
		});

		await client.forwardMessages(userChatId, {
			fromPeer: channelId,
			messages: messageIds,
		});
	}
}
