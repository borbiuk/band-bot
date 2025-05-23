import input from 'input';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { saveAudio } from './db';
import environment from './environment';

// 🤦‍♂️
// 👨‍🍳
// 👨‍🚀
// 👨‍🏫

const stringSession = new StringSession(environment.appSession);

(async () => {
	console.log('👨‍🍳 Loading interactive session...');
	const client = new TelegramClient(
		stringSession,
		environment.appApiId,
		environment.appApiHash,
		{
			connectionRetries: 5,
		}
	);
	await client.start({
		phoneNumber: async () => await input.text('Phone number: '),
		password: async () => await input.text('2FA Password (if any): '),
		phoneCode: async () => await input.text('Code sent to Telegram: '),
		onError: (err) => console.log(err),
	});

	client.session.save();
	console.log('👨‍🏫 Session saved:');

	const channel = await client.getEntity(
		`https://t.me/${environment.channelName}`
	);

	let offsetId = 0;
	const limit = 10;
	let totalFetched = 0;

	while (true) {
		const messages = await client.getMessages(
			channel,
			{ limit, offsetId, }
		);

		const audioMessages = messages
			.filter((x) => 'audio' in x && x.audio !== null && x.audio !== undefined)
			.map(({ id, chatId, audio }) => ({
				messageId: id,
				chatId: chatId?.toString(),
				fileId: audio.id.toString(),
				fileName: audio.attributes?.find(
					(attr) => attr instanceof Api.DocumentAttributeFilename
				)?.fileName,
			}));

		if (audioMessages.length === 0) {
			break;
		}

		for (const message of audioMessages) {
			console.log(message);
			saveAudio(message);
		}

		offsetId = messages[messages.length - 1].id;
		totalFetched += messages.length;
		console.log(`👨‍🍳️ Fetched ${totalFetched} messages...`);
	}

	console.log('👨‍🚀 Finished fetching all messages.');
	return 0;
})();
