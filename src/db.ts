import Database from 'better-sqlite3';

const db = new Database('playlist.db');

// Init DB
db.exec(`
    CREATE TABLE IF NOT EXISTS audio
    (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fileId TEXT NOT NULL,
        fileName TEXT,
        chatId INTEGER,
        messageId INTEGER
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_audio_fileId ON audio(fileId);
    CREATE INDEX IF NOT EXISTS idx_audio_fileName ON audio(fileName);
    VACUUM;
    REINDEX audio;
`);

export function saveAudio({ fileId, fileName, chatId, messageId }) {
	try {
		const stmt = db.prepare(`
            INSERT INTO audio (fileId, fileName, chatId, messageId)
            VALUES (?, ?, ?, ?)
		`);
		stmt.run(fileId, fileName.trim().toLowerCase(), chatId, messageId);
	} catch (e) {
		console.error(e);
	}
}

export function searchAudioByName(query: string, limit: number = 10) {
	try {
		const stmt = db.prepare(`
            SELECT fileId, messageId, chatId, fileName
            FROM audio
            WHERE fileName LIKE ?
            ORDER BY id DESC LIMIT ?
		`);
		return stmt.all(`%${query.trim().toLowerCase()}%`, limit);
	} catch (e) {
		console.error(e);
	}
}
