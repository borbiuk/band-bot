import dotenv from 'dotenv';
import { notExist } from './utils';

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
	isProd: process.env.BOT_ENV_NAME === 'production',
};

Object.keys(environment).forEach((key) => {
	const value = environment[key];
	if (notExist(value)) {
		throw new Error(`${key} is not defined!`);
	}
});

export default environment;
