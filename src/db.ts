import { Pool } from 'pg';
import environment from './environment';

export interface AudioEntity {
	id: number,
	chatId: number;
	messageId: number;
	fileName: string;
	embedding: number[];
}

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
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS audio (
        id SERIAL PRIMARY KEY,
        filename TEXT,
        chatid BIGINT,
        messageid BIGINT,
        embedding vector(180)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS unique_chat_message ON audio (chatId, messageId);

      REINDEX TABLE audio;
    `);
	} catch (e) {
		console.error('Error creating table:', e);
		throw e;
	}
})();

export async function saveAudio({ fileName, chatId, messageId }): Promise<boolean> {
	try {
		await pool.query(`
      INSERT INTO audio (fileName, chatId, messageId)
      VALUES ($1, $2, $3)
    `, [fileName?.trim().toLowerCase(), chatId, messageId]);
		return true;
	} catch (e) {
		console.error('Error saving audio:', e);
		return false;
	}
}

export async function updateAudioVector({ chatId, messageId, embedding }) {
	try {
		const formattedVector = `[${embedding.join(',')}]`; // Format for pgvector
		await pool.query(`
            UPDATE audio
            SET embedding = $1
            WHERE chatid = $2 AND messageid = $3
		`, [formattedVector, chatId, messageId]);
		console.log(`Audio vector updated: ${chatId}, ${messageId}`);
	} catch (e) {
		console.error('Error updating audio vector:', e);
	}
}

export async function getAudioWithoutEmbedding(limit: number = 10): Promise<AudioEntity[]> {
	try {
		const res = await pool.query(`
      SELECT fileName, chatId, messageId
      FROM audio
      WHERE embedding IS NULL
      ORDER BY id ASC
      LIMIT $1
    `, [limit]);

		return res.rows.map(mapToAudio);
	} catch (e) {
		console.error('Error fetching audios without embedding:', e);
		return [];
	}
}


export async function searchAudioByName(query: string, limit: number = 1): Promise<AudioEntity[]> {
	try {
		const res = await pool.query(`
      SELECT messageId, chatId, fileName
      FROM audio
      WHERE fileName ILIKE $1
      ORDER BY id DESC
      LIMIT $2
    `, [`%${query.trim().toLowerCase()}%`, limit]);
		return res.rows.map(mapToAudio);
	} catch (e) {
		console.error('Error searching audio:', e);
		return [];
	}
}

function mapToAudio(x): AudioEntity {
	return {
		id: Number(x.id),
		chatId: Number(x.chatid),
		messageId: Number(x.messageid),
		fileName: x.filename,
		embedding: x.embedding as number[],
	} as AudioEntity;
}
