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

        // Try to find venv in project root
        const venvPython = path.resolve(process.cwd(), 'venv/bin/python');
        const pythonCommand = fs.existsSync(venvPython) ? venvPython : 'python3';

        const args = [scriptPath, imagePath];
        if (roi) {
            args.push(roi.x.toString(), roi.y.toString(), roi.w.toString(), roi.h.toString());
        }

        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(pythonCommand, args);
            console.log(`Executing Magic Scan: ${pythonCommand} ${args.join(' ')}`);

            let dataString = '';
            let errorString = '';

            pythonProcess.on('error', (err) => {
                console.error(`❌ FAILED TO START PYTHON PROCESS: ${err.message}`);
                reject(new InternalServerErrorException('Sunucuda Python başlatılamadı.'));
            });

            pythonProcess.stdout.on('data', (data) => (dataString += data.toString()));
            pythonProcess.stderr.on('data', (data) => (errorString += data.toString()));

            pythonProcess.on('close', (code) => {
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
