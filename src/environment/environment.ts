console.log('env')

import dotenv from 'dotenv';
dotenv.config();

if (!process.env.BOT_TOKEN) {
	throw new Error('BOT_TOKEN is not defined in .env');
}

const environment = {
	botToken: process.env.BOT_TOKEN!,
};

export default environment;
