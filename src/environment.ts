import dotenv from 'dotenv';

dotenv.config();

if (!process.env.BOT_TOKEN) {
	throw new Error('BOT_TOKEN is not defined in .env');
}

const environment = {
	isProd: process.env.BOT_ENV_NAME === 'production',
	channelName: process.env.CHANNEL_NAME,
	downloadDir: './downloads',
	pythonPath: './audio_vector/venv/bin/python3',
	telegram: {
		botToken: process.env.BOT_TOKEN,
		appApiId: Number(process.env.APP_API_ID),
		appApiHash: process.env.APP_API_HASH,
		appSession: process.env.APP_SESSION,
	},
	postgres: {
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		database: process.env.POSTGRES_DB,
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
	}
};

export default environment;
