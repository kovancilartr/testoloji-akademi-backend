import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ToolsService {
    async magicScan(imagePath: string, roi?: { x: number; y: number; w: number; h: number }) {
        // Path resolution: Works in both dev and dist
        // Path resolution: Check multiple locations to be robust for local/live
        const possiblePaths = [
            path.resolve(process.cwd(), 'src/tools/scripts/magic_scan.py'),
            path.resolve(process.cwd(), 'dist/tools/scripts/magic_scan.py'),
            path.resolve(__dirname, 'scripts/magic_scan.py'),
            path.resolve(__dirname, '../scripts/magic_scan.py'),
        ];

        const scriptPath = possiblePaths.find(p => fs.existsSync(p));

        if (!scriptPath) {
            console.error('Magic Scan script not found in:', possiblePaths);
            throw new InternalServerErrorException('Görüntü işleme betiği bulunamadı.');
        }

        // Try to find venv in project root, then system python3, then system python
        const venvPython = path.resolve(process.cwd(), 'venv/bin/python');
        let pythonCommand = 'python3';

        if (fs.existsSync(venvPython)) {
            pythonCommand = venvPython;
        }

        const args = [scriptPath, imagePath];
        if (roi) {
            args.push(roi.x.toString(), roi.y.toString(), roi.w.toString(), roi.h.toString());
        }

        return new Promise((resolve, reject) => {
            let pythonProcess = spawn(pythonCommand, args);

            pythonProcess.on('error', (err: any) => {
                if (err.code === 'ENOENT' && pythonCommand === 'python3') {
                    console.log('⚠️ python3 not found, retrying with python...');
                    pythonCommand = 'python';
                    pythonProcess = spawn(pythonCommand, args);
                    setupHandlers(pythonProcess);
                } else {
                    console.error(`❌ FAILED TO START PYTHON PROCESS: ${err.message}`);
                    reject(new InternalServerErrorException('Sunucuda Python başlatılamadı.'));
                }
            });

            let dataString = '';
            let errorString = '';

            const setupHandlers = (proc: any) => {
                proc.stdout.on('data', (data: any) => (dataString += data.toString()));
                proc.stderr.on('data', (data: any) => (errorString += data.toString()));

                proc.on('close', (code: any) => {
                    // Cleanup temp file
                    fs.unlink(imagePath, (err) => {
                        if (err) console.error('Failed to delete temp file:', err);
                    });

                    if (code !== 0) {
                        console.error(`Python script exited with code ${code}: ${errorString}`);
                        return reject(new InternalServerErrorException('Image processing failed'));
                    }

                    try {
                        resolve(JSON.parse(dataString));
                    } catch (e) {
                        reject(new InternalServerErrorException('Invalid response from processor'));
                    }
                });
            };

            if (pythonCommand !== 'python') { // If not already retrying
                setupHandlers(pythonProcess);
            }
        });
    }

    async saveFeedback(data: any, ip: string) {
        const datasetDir = path.resolve(process.cwd(), 'datasets/positive_samples');
        if (!fs.existsSync(datasetDir)) {
            fs.mkdirSync(datasetDir, { recursive: true });
        }

        const today = new Date().toISOString().split('T')[0];
        const filePath = path.join(datasetDir, `dataset_${today}.jsonl`);

        const entry = {
            ...data,
            serverTimestamp: Date.now(),
            clientIp: ip,
        };

        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(filePath, line);
        return { success: true };
    }
}
