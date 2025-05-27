import { Pool } from 'pg';
import environment from './environment';

export interface AudioEntity {
	id: number;
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
        chatid BIGINT,
        messageid BIGINT,
        filename TEXT,
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

export async function saveAudio({
	chatId,
	messageId,
	fileName,
}): Promise<boolean> {
	try {
		await pool.query(
			`
                INSERT INTO audio (chatId, messageId, fileName)
                VALUES ($1, $2, $3)
			`,
			[chatId, messageId, fileName?.trim().toLowerCase()]
		);
		return true;
	} catch (e) {
		console.error('Error saving audio:', e);
		return false;
	}
}

export async function updateAudioVector(
	chatId: number,
	messageId: number,
	embedding: number[]
) {
	try {
		const formattedVector = `[${embedding.join(',')}]`; // Format for pgvector
		await pool.query(
			`
                UPDATE audio
                SET embedding = $1
                WHERE chatid = $2 AND messageid = $3
			`,
			[formattedVector, chatId, messageId]
		);
		console.log(`Audio vector updated: ${chatId}, ${messageId}`);
	} catch (e) {
		console.error('Error updating audio vector:', e);
	}
}

export async function getAudioWithoutEmbedding(
	limit: number = 10
): Promise<AudioEntity[]> {
	try {
		const res = await pool.query(
			`
                SELECT chatId, messageId, fileName
                FROM audio
                WHERE embedding IS NULL
                ORDER BY id ASC
                    LIMIT $1
			`,
			[limit]
		);

		return res.rows.map(mapToAudio);
	} catch (e) {
		console.error('Error fetching audios without embedding:', e);
		return [];
	}
}

export async function searchAudioByName(
	query: string,
	limit: number = 1
): Promise<AudioEntity[]> {
	try {
		const res = await pool.query(
			`
                SELECT chatId, messageId, fileName
                FROM audio
                WHERE fileName ILIKE $1
                ORDER BY id DESC
                    LIMIT $2
			`,
			[`%${query.trim().toLowerCase()}%`, limit]
		);
		return res.rows.map(mapToAudio);
	} catch (e) {
		console.error('Error searching audio:', e);
		return [];
	}
}

export async function searchRecommended(
	chatId: number,
	messageId: number,
	limit: number = 10
): Promise<AudioEntity[]> {
	try {
		const res = await pool.query(
			`
                WITH target AS (
                    SELECT embedding
                    FROM audio
                    WHERE chatId = $1 AND messageId = $2 AND embedding IS NOT NULL
                        LIMIT 1
                )
                SELECT
                    a.id,
                    a.fileName,
                    a.chatId,
                    a.messageId,
                    a.embedding,
                    a.embedding <-> target.embedding AS distance  -- Euclidean distance (adjust based on your pgvector config)
                FROM audio a, target
                WHERE a.embedding IS NOT NULL
                  AND (a.chatId != $1 AND a.messageId != $w)  -- exclude the target file itself
                ORDER BY distance ASC
                    LIMIT $3;
			`,
			[chatId, messageId, limit]
		);

		return res.rows.map(mapToAudio);
	} catch (e) {
		console.error('Error searching recommended:', e);
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
