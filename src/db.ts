import { Pool } from 'pg';
import environment from './environment';

const pool = new Pool({
	host: environment.postgres.host,
	port: environment.postgres.port,
	database: environment.postgres.database,
	user: environment.postgres.user,
	password: environment.postgres.password,
});

(async () => {
	try {
		await pool.query(`
      CREATE TABLE IF NOT EXISTS audio (
        id SERIAL PRIMARY KEY,
        fileId BIGINT NOT NULL UNIQUE,
        fileName TEXT,
        chatId BIGINT,
        messageId BIGINT
      );
    `);
	} catch (e) {
		console.error('Error creating table:', e);
		throw e;
	}
})();

export async function saveAudio({ fileId, fileName, chatId, messageId }) {
	try {
		await pool.query(`
      INSERT INTO audio (fileId, fileName, chatId, messageId)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (fileId) DO NOTHING
    `, [fileId, fileName?.trim().toLowerCase(), chatId, messageId]);
	} catch (e) {
		console.error('Error saving audio:', e);
	}
}

export async function searchAudioByName(query: string, limit: number = 1) {
	try {
		const res = await pool.query(`
      SELECT fileId, messageId, chatId, fileName
      FROM audio
      WHERE fileName ILIKE $1
      ORDER BY id DESC
      LIMIT $2
    `, [`%${query.trim().toLowerCase()}%`, limit]);
		return res.rows.map(({ fileid, messageid, chatid, filename }) => ({ fileId: fileid, messageId: messageid, chatId: chatid, fileName: filename }));
	} catch (e) {
		console.error('Error searching audio:', e);
		return [];
	}
}
