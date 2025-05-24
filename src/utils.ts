import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import environment from './environment';

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
