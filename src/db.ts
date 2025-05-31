import { Pool } from 'pg';
import environment from './environment';
import { VectorOutput } from './vector';

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
        vector  vector(180),
        vector1 vector(40),
        vector2 vector(240),
        vector3 vector(180),
        vector4 vector(300),
        vector5 vector(20),
        vector6 vector(150),
        vector7 vector(30),
        vector8 vector(240),
        vector9 vector(240)
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
}: Partial<AudioEntity>): Promise<boolean> {
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

export async function getAudioWithoutVector(
	limit: number = 10
): Promise<AudioVectorStatus[]> {
	try {
		const res = await pool.query(
			`
                SELECT chatId,
                       messageId,
                       fileName,
                       (vector  IS NULL) as vector,
                       (vector1 IS NULL) as vector1,
                       (vector2 IS NULL) as vector2,
                       (vector3 IS NULL) as vector3,
                       (vector4 IS NULL) as vector4,
                       (vector5 IS NULL) as vector5,
                       (vector6 IS NULL) as vector6,
                       (vector7 IS NULL) as vector7,
                       (vector8 IS NULL) as vector8,
                       (vector9 IS NULL) as vector9
                FROM audio
                WHERE vector IS NULL
                   OR vector1 IS NULL
                   OR vector2 IS NULL
                   OR vector3 IS NULL
                   OR vector4 IS NULL
                   OR vector5 IS NULL
                   OR vector6 IS NULL
                   OR vector7 IS NULL
                   OR vector8 IS NULL
                   OR vector9 IS NULL
                ORDER BY id ASC
                    LIMIT $1
			`,
			[limit]
		);

		return res.rows.map(mapToVectorStatus);
	} catch (e) {
		console.error('Error fetching audios without vector:', e);
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
                    SELECT vector
                    FROM audio
                    WHERE chatId = $1 AND messageId = $2 AND vector IS NOT NULL
                        LIMIT 1
                )
                SELECT
                    a.id,
                    a.fileName,
                    a.chatId,
                    a.messageId,
                    a.vector,
                    a.vector <-> target.vector AS distance  -- Euclidean distance (adjust based on your pgvector config)
                FROM audio a, target
                WHERE a.vector IS NOT NULL
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

export async function updateAudioVector(
	chatId: number,
	messageId: number,
	{
		vector,
		vector1,
		vector2,
		vector3,
		vector4,
		vector5,
		vector6,
		vector7,
		vector8,
		vector9,
	}: VectorOutput
) {
	try {
		// Масив для виконання запитів для кожного вектора
		const vectorUpdates = [];

		// Створення запиту для кожного вектора, якщо він існує (не undefined)
		if (vector) {
			vectorUpdates.push({
				column: 'vector',
				value: `[${vector.join(',')}]`,
			});
		}
		if (vector1) {
			vectorUpdates.push({
				column: 'vector1',
				value: `[${vector1.join(',')}]`,
			});
		}
		if (vector2) {
			vectorUpdates.push({
				column: 'vector2',
				value: `[${vector2.join(',')}]`,
			});
		}
		if (vector3) {
			vectorUpdates.push({
				column: 'vector3',
				value: `[${vector3.join(',')}]`,
			});
		}
		if (vector4) {
			vectorUpdates.push({
				column: 'vector4',
				value: `[${vector4.join(',')}]`,
			});
		}
		if (vector5) {
			vectorUpdates.push({
				column: 'vector5',
				value: `[${vector5.join(',')}]`,
			});
		}
		if (vector6) {
			vectorUpdates.push({
				column: 'vector6',
				value: `[${vector6.join(',')}]`,
			});
		}
		if (vector7) {
			vectorUpdates.push({
				column: 'vector7',
				value: `[${vector7.join(',')}]`,
			});
		}
		if (vector8) {
			vectorUpdates.push({
				column: 'vector8',
				value: `[${vector8.join(',')}]`,
			});
		}
		if (vector9) {
			vectorUpdates.push({
				column: 'vector9',
				value: `[${vector9.join(',')}]`,
			});
		}

		// Якщо немає векторів для оновлення — завершити
		if (vectorUpdates.length === 0) {
			console.log(
				`No vectors to update for chatId: ${chatId}, messageId: ${messageId}`
			);
			return;
		}

		// Створення динамічного SQL для оновлення тільки тих значень, які наразі є NULL
		const updates = vectorUpdates.map(
			(vu, index) =>
				`${vu.column} = CASE WHEN ${vu.column} IS NULL THEN $${index + 1} ELSE ${vu.column} END`
		);
		const values = vectorUpdates.map((vu) => vu.value);

		// Виконання запиту
		await pool.query(
			`
                UPDATE audio
                SET ${updates.join(', ')}
                WHERE chatid = $${values.length + 1} AND messageid = $${values.length + 2}
			`,
			[...values, chatId, messageId]
		);

		console.log(
			`Audio vectors updated for chatId: ${chatId}, messageId: ${messageId}`
		);
	} catch (e) {
		console.error('Error updating audio vector:', e);
	}
}

function mapToAudio(x): AudioEntity {
	return {
		id: Number(x.id),
		chatId: Number(x.chatid),
		messageId: Number(x.messageid),
		fileName: x.filename,
		vector: x.vector as number[],
	} as AudioEntity;
}

function mapToVectorStatus(x): AudioVectorStatus {
	return {
		chatId: Number(x.chatid),
		messageId: Number(x.messageid),
		fileName: x.filename,
		vector: Boolean(x.vector),
		vector1: Boolean(x.vector1),
		vector2: Boolean(x.vector2),
		vector3: Boolean(x.vector3),
		vector4: Boolean(x.vector4),
		vector5: Boolean(x.vector5),
		vector6: Boolean(x.vector6),
		vector7: Boolean(x.vector7),
		vector8: Boolean(x.vector8),
		vector9: Boolean(x.vector9),
	} as AudioVectorStatus;
}

export interface AudioEntity {
	id: number;
	chatId: number;
	messageId: number;
	fileName: string;
	vector: number[];
	vector1: number[];
	vector2: number[];
	vector3: number[];
	vector4: number[];
	vector5: number[];
	vector6: number[];
	vector7: number[];
	vector8: number[];
	vector9: number[];
}

export interface AudioVectorStatus {
	chatId: number;
	messageId: number;
	fileName: string;
	vector: boolean;
	vector1: boolean;
	vector2: boolean;
	vector3: boolean;
	vector4: boolean;
	vector5: boolean;
	vector6: boolean;
	vector7: boolean;
	vector8: boolean;
	vector9: boolean;
}
