const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitInfo() {
  try {
    const commit = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    const commitMessage = execSync('git log -1 --pretty=format:%s', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    const commitDate = execSync('git log -1 --pretty=format:%cI', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    const commitAuthor = execSync('git log -1 --pretty=format:%an', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();

    return { commit, branch, commitMessage, commitDate, commitAuthor };
  } catch (_err) {
    return {
      commit: 'unknown',
      branch: 'unknown',
      commitMessage: 'Git metadata unavailable',
      commitDate: null,
      commitAuthor: null,
    };
  }
}

const info = {
  ...getGitInfo(),
  buildTime: new Date().toISOString(),
};

const srcPath = path.join(__dirname, '..', 'src', 'build-info.json');
fs.writeFileSync(srcPath, JSON.stringify(info, null, 2) + '\n');
console.log('✅ Generated build-info.json:', JSON.stringify(info));
