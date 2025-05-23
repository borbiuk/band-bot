import dotenv from 'dotenv';

dotenv.config();

if (!process.env.BOT_TOKEN) {
	throw new Error('BOT_TOKEN is not defined in .env');
}

const environment = {
	botToken: process.env.BOT_TOKEN,
	appApiId: Number(process.env.APP_API_ID),
	appApiHash: process.env.APP_API_HASH,
	channelName: process.env.CHANNEL_NAME,
	appSession: process.env.APP_SESSION,
};

Object.keys(environment).forEach((key) => {
	const value = environment[key];
	if (value === null || value === undefined || Number.isNaN(value)) {
		throw new Error(`${key} is not defined!`);
	}
});

export default environment;
