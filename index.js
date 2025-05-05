import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import chalk from 'chalk';
import bs58 from 'bs58';
import axios from 'axios';
import fs from 'fs/promises';
import { HttpsProxyAgent } from 'https-proxy-agent';

function logLine(i, message) {
  const now = new Date().toLocaleTimeString();
  console.log(`${chalk.dim(`[${now} Wallet ${chalk.reset.white(i)} ${chalk.dim(']')}`)} - ${message}`);
}

function delay() {
  return Math.floor(Math.random() * (30000 - 1000 + 1)) + 1000;
}

function createAxiosWithProxy(proxyString) {
  if (!proxyString) return axios;

  let proxyUrl;
  const withAuth = /^.+?:.+?@.+?:\d+$/; // username:password@host:port
  const withoutAuth = /^.+?:\d+$/;      // host:port

  if (withAuth.test(proxyString)) {
    proxyUrl = `http://${proxyString}`;
  } else if (withoutAuth.test(proxyString)) {
    proxyUrl = `http://${proxyString}`;
  } else {
    console.warn(chalk.bgYellow.white.bold(`⚠️ Invalid proxy format: ${proxyString}`));
    return axios;
  }

  const agent = new HttpsProxyAgent(proxyUrl);
  return axios.create({ httpsAgent: agent });
}
async function getBalance(token, i, axiosInstance) {
  try {
    const res = await axiosInstance.get('https://api.assisterr.ai/incentive/users/me/', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const points = res.data.points || 0;
    const formatted = chalk.green(points.toFixed(0).replace(/(\d{2})$/, ',$1'));
    logLine(i, `💰 ${chalk.dim('Total points:')} ${formatted} | ${chalk.dim('Wallet:')} ${chalk.gray(res.data.wallet_id)}`);
  } catch (err) {
    logLine(i, chalk.bgYellow.white.bold(`⚠️ Failed to get balance: ${err.response?.data?.detail || err.message}`));
  }
}

async function authenticateAndClaimPoints(privateKey, i, proxy) {
  try {
    const privateKeyUint8Array = bs58.decode(privateKey.trim());
    const keypair = Keypair.fromSecretKey(privateKeyUint8Array);
    const publicKey = keypair.publicKey.toString();

    const axiosInstance = createAxiosWithProxy(proxy);

    const res = await axiosInstance.get('https://api.ipify.org?format=json');
    logLine(i, chalk.dim(`🌍 Your request ip: ${chalk.reset.cyan(res.data.ip)}`));

    const loginRes = await axiosInstance.get('https://api.assisterr.ai/incentive/auth/login/get_message/');
    const message = loginRes.data;
    const messageBytes = new Uint8Array(Buffer.from(message));
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signature = bs58.encode(signatureBytes);

    const authRes = await axiosInstance.post('https://api.assisterr.ai/incentive/auth/login/', {
      key: publicKey,
      message: message,
      signature: signature
    });
    
    const token = authRes.data.access_token;
    logLine(i, chalk.dim('🔓 Successfully logged in'));

    try {
      const claimRes = await axiosInstance.post(
        'https://api.assisterr.ai/incentive/users/me/daily_points/',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logLine(i, `✅ ${chalk.dim('Claimed daily points:')} ${chalk.black.bgGreen(JSON.stringify(claimRes.data))}`);
    } catch (claimErr) {
      if (claimErr.response?.data?.detail === 'Daily points not available') {
        logLine(i, `👌 ${chalk.dim('Daily points')} ${chalk.black.bgCyan('already claimed')}`);
      } else {
        logLine(i, chalk.bgRed.white.bold(`❌ Error while claiming points: ${claimErr.response?.data?.detail || claimErr.message}`));
      }
    }

    await getBalance(token, i, axiosInstance);
  } catch (error) {
    logLine(i, chalk.bgRed.white.bold(`❌ Critical error: ${error.response?.data?.detail || error.message}`));
  }
}

async function main() {
  try {
    const file = await fs.readFile('keys.txt', 'utf8');
    const keys = file.split(/\r?\n/).filter(line => line.trim());

    let proxies = [];
    try {
      const proxyFile = await fs.readFile('proxy.txt', 'utf8');
      proxies = proxyFile.split(/\r?\n/).filter(line => line.trim());
    } catch (e) {
      console.log(chalk.bgYellow.white.bold('⚠️ proxy.txt file not found or empty. No proxies will be used.'));
    }

    for (let i = 0; i < keys.length; i++) {
      const proxy = proxies[i % proxies.length] || null;
      logLine(i + 1, proxy ? chalk.dim(`🌐 Using proxy: ${chalk.reset.cyan(proxy)}`) : chalk.dim('🌐 No proxy used'));
      await authenticateAndClaimPoints(keys[i], i + 1, proxy);
      const waitTime = delay();
      console.log(`[🔄] Waiting before next request: ${waitTime / 1000} seconds`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  } catch (err) {
    console.error(chalk.bgRed.white.bold('❌ Failed to read keys.txt:', err.message));
  }
}

console.clear();

console.log(chalk.cyanBright(`
 ██████╗██████╗ ██╗   ██╗██████╗ ████████╗ ██████╗         ███████╗ █████╗ ███╗   ███╗██╗██╗     ██╗  ██╗   ██╗
██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝██╔═══██╗        ██╔════╝██╔══██╗████╗ ████║██║██║     ██║  ╚██╗ ██╔╝
██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║   ██║   ██║        █████╗  ███████║██╔████╔██║██║██║     ██║   ╚████╔╝ 
██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ██║   ██║        ██╔══╝  ██╔══██║██║╚██╔╝██║██║██║     ██║    ╚██╔╝  
╚██████╗██║  ██║   ██║   ██║        ██║   ╚██████╔╝███████╗██║     ██║  ██║██║ ╚═╝ ██║██║███████╗███████╗██║   
 ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝    ╚═════╝ ╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚══════╝╚══════╝╚═╝   
`));
console.log(chalk.gray('GitHub: ') + chalk.underline.white('https://github.com/Crypto-Familly'));
console.log(chalk.gray('Telegram: ') +chalk.underline.white('https://t.me/CryptoFamilyHub'));
console.log('\n');

main();
