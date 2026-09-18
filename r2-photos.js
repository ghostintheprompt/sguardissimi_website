// Cloudflare R2 photo/video fetcher for Fiamma
require('dotenv').config();
const fetch = require('node-fetch');

const API_KEY = process.env.CLOUDFLARE_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET;
const ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT;

// List all objects in the R2 bucket
async function listR2Objects() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Failed to list objects: ${res.status}`);
  const data = await res.json();
  return data.result?.objects || [];
}

// Example usage: list and print all objects
listR2Objects()
  .then(objects => {
    console.log('R2 Objects:', objects);
  })
  .catch(err => {
    console.error('Error:', err);
  });

module.exports = { listR2Objects };
