import { Telegraf } from 'telegraf';
import environment from './environment/environment';

const bot = new Telegraf(environment.botToken);

// template:
bot.on('channel_post', (context) => {
	console.log('channel_post:');
	console.log(context);
});

bot.command('search', (context) => {
	console.log('search:');
	console.log(context);
});

bot.launch();
