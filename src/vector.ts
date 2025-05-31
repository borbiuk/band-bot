import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import { promisify } from 'util';
import environment from './environment';
import { sleep } from './utils';

const execFileAsync = promisify(execFile);

const configVectorLengths = {
	vector: 180,
	vector1: 40,
	vector2: 240,
	vector3: 180,
	vector4: 300,
	vector5: 20,
	vector6: 150,
	vector7: 30,
	vector8: 240,
	vector9: 360,
};

const configIndexes: { [key: string]: number } = Object.fromEntries(
	Object.keys(configVectorLengths).map((key, index) => [key, index])
);

/**
 * Generates vectors for the given configurations based on the input file.
 *
 * @param {string} filePath - The path to the input file to be processed.
 * @param {VectorInput} configMap - A mapping of configuration keys to a boolean indicating whether the configuration is enabled.
 * @param {number} [maxConcurrent=1] - The maximum number of configurations to process concurrently.
 * @return {Promise<VectorOutput>} A promise that resolves to a mapping of configuration keys to their corresponding computed vectors, or `null` in case of errors.
 */
export async function generateVectors(
	filePath: string,
	configMap: VectorInput,
	maxConcurrent: number = 1
): Promise<VectorOutput> {
	const results: VectorOutput = {};

	try {
		await fs.access(filePath);

		const configs = Object.entries(configMap)
			.filter(([key, isEnabled]) => isEnabled && key in configIndexes)
			.map(([key]) => ({
				key,
				index: configIndexes[key],
			}));

		const processConfig = async (key: string, index: number) => {
			try {
				const { stdout } = await execFileAsync(environment.pythonPath, [
					'./audio_vector/vector.py',
					filePath,
					index.toString(),
				]);

				const vector = stdout
					.replace(/[\[\]]/g, '')
					.split(/\s+/)
					.filter(Boolean)
					.map(Number)
					.filter((x) => !Number.isNaN(x));

				const expectedLength = configVectorLengths[key];
				if (vector.length !== expectedLength) {
					console.error(
						`Vector length mismatch for configuration "${key}". Expected ${expectedLength}, got ${vector.length}.`
					);
					console.log(stdout);
					console.log(vector);
					results[key] = null;
					return;
				}

				results[key] = vector;
			} catch (error) {
				console.error(
					`Error processing configuration "${key}" (index ${index}):`,
					error
				);
				results[key] = null;
			}
		};

		const pool = async (
			tasks: Array<{ key: string; index: number }>,
			concurrency: number
		) => {
			const processing: Promise<void>[] = [];

			for (const task of tasks) {
				const promise = processConfig(task.key, task.index);
				processing.push(promise);

				if (processing.length >= concurrency) {
					await Promise.race(processing);
					await sleep(100);
					processing.splice(
						processing.findIndex((p) => p === promise),
						1
					);
				}
			}

			await Promise.all(processing);
		};

		await pool(configs, maxConcurrent);

		return results;
	} catch (error) {
		console.error(`Error processing file "${filePath}":`, error);
		return null;
	}
}

export interface VectorInput {
	vector?: boolean;
	vector1?: boolean;
	vector2?: boolean;
	vector3?: boolean;
	vector4?: boolean;
	vector5?: boolean;
	vector6?: boolean;
	vector7?: boolean;
	vector8?: boolean;
	vector9?: boolean;
}

/**
 * Interface representing a structure for various vector outputs. This interface
 * allows storing multiple sets of numerical vectors, where each vector is represented
 * as an array of numbers. These properties are optional, enabling flexibility in
 * defining the structure based on specific needs.
 *
 * Properties:
 * - vector: Primary vector represented as an array of numbers.
 * - vector1: An additional vector represented as an array of numbers.
 * - vector2: Another optional vector represented as an array of numbers.
 * - vector3: Optional vector with numerical data representation.
 * - vector4: Arbitrary numerical vector, optional in definition.
 * - vector5: Supplementary vector represented optionally as numbers array.
 * - vector6: Additional optional vector for specialized use-cases.
 * - vector7: Optional representation of vector data in numeric array form.
 * - vector8: Secondary optional numeric array for data representation.
 * - vector9: A further optional vector definition in numeric array form.
 */
export interface VectorOutput {
	vector?: number[];
	vector1?: number[];
	vector2?: number[];
	vector3?: number[];
	vector4?: number[];
	vector5?: number[];
	vector6?: number[];
	vector7?: number[];
	vector8?: number[];
	vector9?: number[];
}
