const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = 'c:\\Users\\jorge\\OneDrive\\Documentos\\Taller\\backend';
const frontendDir = 'c:\\Users\\jorge\\OneDrive\\Documentos\\Taller\\frontend';

function startService(name, dir, command, args) {
    const logFile = path.join(dir, `${name}.log`);
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const p = spawn(command, args, {
        cwd: dir,
        detached: true,
        stdio: ['ignore', out, err],
        shell: true
    });

    p.unref();

    console.log(`Started ${name} (PID: ${p.pid}), logging to ${logFile}`);
}

startService('backend', backendDir, 'npm', ['run', 'dev']);
startService('frontend', frontendDir, 'npm', ['run', 'dev']);
