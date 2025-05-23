import { Context, NarrowedContext, Telegraf } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { saveAudio, searchAudioByName } from './db';
import environment from './environment';

const bot = new Telegraf(environment.botToken);

bot.on('channel_post', async (ctx) => {
	const post = ctx.channelPost as Message;

	// Audio saving
	if ('audio' in post && post.audio) {
		try {
			const { file_id: fileId, file_name: fileName } = post.audio;
			if (fileName) {
				saveAudio({
					fileId,
					fileName,
					chatId: post.chat.id,
					messageId: post.message_id,
				});
			}
		} catch (e) {
			console.error(e);
		}
	}

	// Command handling
	if ('text' in post && typeof post.text === 'string') {
		if (post.text.trim().startsWith('/search')) {
			await handleSearchCommand(ctx, post);
		}
	}
});

bot.launch();
console.log('✅ Bot is running...');

async function sendAudioAsLink(context, { fileId, fileName, chatId, messageId }): Promise<void> {
	const link = `https://t.me/c/${String(chatId).replace('-100', '')}/${messageId}`;
	await context.reply(`📎 [${fileName}](${link})`, { parse_mode: 'Markdown' });
}

async function handleSearchCommand(ctx, post: Message.TextMessage) {
	const text = post.text.trim();
	const query = text.replace(/^\/search(@\w+)?\s*/, '');

	if (!query) {
		return ctx.reply(
			'❗️ Wrong input. Example: /search Beyonce - Crazy in Love'
		);
	}

	try {
		const results = await searchAudioByName(query);

		if (results.length === 0) {
			return ctx.reply('🔍 Nothing found');
		}

		for (const { fileId, fileName, messageId, chatId, isBig } of results) {
			try {
				if (isBig) {
					await sendAudioAsLink(ctx, { fileId, fileName, chatId, messageId });
				} else {
					await ctx.telegram.sendAudio(ctx.chat.id, fileId);
				}
			} catch (err) {
				console.error(err);
			}
		}
		for (const { fileId } of results) {
			const id = Number(fileId);
			try {
				await ctx.telegram.sendAudio(
					ctx.chat.id,
					id
				);
			} catch (e) {
				console.error(e);
			}
		}
		return;

		const sendAudioPromises = results.map((audio) =>
			ctx.telegram.sendAudio(ctx.chat.id, audio.fileId)
		);

		await Promise.allSettled(sendAudioPromises);
	} catch (e) {
		ctx.reply('🪗 Oops. Something went wrong');
		console.error(e);
	}
}
