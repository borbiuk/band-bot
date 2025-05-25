import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import { promisify } from 'util';
import environment from './environment';

const execFileAsync = promisify(execFile);

export async function vector(filePath: string): Promise<number[]> {
	try {
		await fs.access(filePath);

		const { stdout } = await execFileAsync(environment.pythonPath, ['./audio_vector/vector.py', filePath]);

		return stdout
			.replace(/[\[\]\n]/g, '')
			.split(/\s+/)
			.filter(Boolean)
			.map(Number);
	} catch (e) {
		console.error(e);
		return null;
	}
}
