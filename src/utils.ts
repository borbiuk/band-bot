import fs from 'fs/promises';
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

	await client.start({ botAuthToken: environment.telegram.botToken });

	const session = client.session.save();
	if (!environment.isProd) {
		console.info(`Session saved: ${session}`);
	}

	return client;
}

export async function downloadFile(
	client: TelegramClient,
	{ chatId, messageId, fileName }: AudioEntity,
) {
	const message = await client.getMessages(chatId, { ids: messageId });
	if (notExist(message) || message.length === 0 || !(message[0] instanceof Message)) {
		throw new Error('Message not found or does not contain media');
	}

	const mediaMessage = message[0];
	if (notExist(mediaMessage.media)) {
		throw new Error('No media found in the message');
	}

	const startTime = Date.now();
	let lastLogged = 0;
	const buffer = await client.downloadMedia(mediaMessage.media, {
		progressCallback: (downloaded, total) => {
			const percent = Math.floor((Number(downloaded) / Number(total)) * 100);

			if (percent >= lastLogged + 10) {
				lastLogged = percent - (percent % 10);
				console.log(`(${fileName}) Downloaded ${lastLogged}%`);
			}
		}
	});
	if (notExist(buffer)) {
		throw new Error(`(${fileName}) Failed to download media`);
	}
	const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
	console.log(`(${fileName}) Download complete in ${elapsedSeconds} seconds`);

	await fs.mkdir(environment.downloadDir, { recursive: true });
	const filePath = getFilePath(fileName);
	await fs.writeFile(filePath, buffer);

	console.log(`(${fileName}) File saved`);
	return filePath;
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
	await new Promise(res => setTimeout(res, ms));
}
