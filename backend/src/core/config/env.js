import dotenv from 'dotenv';
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(currentDir, '../../../.env');
const legacySrcEnvPath = resolve(currentDir, '../../.env');

dotenv.config({path: envPath, quiet: true});
dotenv.config({path: legacySrcEnvPath, override: false, quiet: true});
