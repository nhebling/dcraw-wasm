import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_URL = 'https://rawcameraimages.com/demo/SAMPLE.ARW';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');
const fixturesLocalDir = path.join(__dirname, 'fixtures-local');
const fixturePath = path.join(fixturesDir, 'SAMPLE.ARW');
const fixtureLocalPath = path.join(fixturesLocalDir, 'SAMPLE.ARW');

async function fileExists(filePath) {
	try {
		await fsPromises.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function copyIfMissing(sourcePath, destinationPath) {
	if (!(await fileExists(sourcePath)) || (await fileExists(destinationPath))) {
		return;
	}
	await fsPromises.copyFile(sourcePath, destinationPath);
}

async function persistFixture(sourcePath) {
	await copyIfMissing(sourcePath, fixturePath);
	await copyIfMissing(sourcePath, fixtureLocalPath);
}

function downloadToFile(url, destinationPath, allowInsecureTls = false) {
	return new Promise((resolve, reject) => {
		const request = allowInsecureTls
			? https.get(url, { rejectUnauthorized: false }, onResponse)
			: https.get(url, onResponse);

		function onResponse(response) {
				if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
					response.resume();
					const redirectedUrl = new URL(response.headers.location, url).toString();
					downloadToFile(redirectedUrl, destinationPath, allowInsecureTls).then(resolve).catch(reject);
					return;
				}

				if (response.statusCode !== 200) {
					response.resume();
					reject(new Error(`Fixture download failed with status ${response.statusCode}`));
					return;
				}

				const output = fs.createWriteStream(destinationPath);
				output.on('error', (error) => {
					output.close(() => {
						fsPromises.unlink(destinationPath).catch(() => undefined).finally(() => reject(error));
					});
				});
				output.on('finish', () => {
					output.close(resolve);
				});

				response.pipe(output);
		}

		request.on('error', (error) => {
			if (!allowInsecureTls && error?.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
				console.warn('TLS certificate mismatch for fixture host. Retrying fixture download with insecure TLS.');
				downloadToFile(url, destinationPath, true).then(resolve).catch(reject);
				return;
			}
			reject(error);
		});
	});
}

async function main() {
	await fsPromises.mkdir(fixturesDir, { recursive: true });
	await fsPromises.mkdir(fixturesLocalDir, { recursive: true });

	if (await fileExists(fixtureLocalPath)) {
		await persistFixture(fixtureLocalPath);
		console.log(`Fixture ready from local cache: ${fixtureLocalPath}`);
		return;
	}

	if (await fileExists(fixturePath)) {
		await persistFixture(fixturePath);
		console.log(`Fixture ready from local workspace copy: ${fixturePath}`);
		return;
	}

	console.log(`Downloading RAW fixture from ${FIXTURE_URL}`);

	try {
		await downloadToFile(FIXTURE_URL, fixtureLocalPath);
		await persistFixture(fixtureLocalPath);
		console.log(`Fixture downloaded and persisted: ${fixtureLocalPath}`);
		return;
	} catch (error) {
		console.warn(`Fixture download failed: ${error.message || error}`);
	}

	if (await fileExists(fixtureLocalPath)) {
		await persistFixture(fixtureLocalPath);
		console.log(`Fixture ready from local cache after download failure: ${fixtureLocalPath}`);
		return;
	}

	throw new Error(
		`No fixture available. Place SAMPLE.ARW at ${fixtureLocalPath} and re-run tests, or wait until ${FIXTURE_URL} is reachable.`,
	);
}

main().catch((error) => {
	console.error(error.message || error);
	process.exit(1);
});
