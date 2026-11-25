// Vercel Function: every request is rewritten here (see vercel.json) and handed to Nest.
const { getServer } = require('../dist/serverless');

module.exports = async (req, res) => {
  const server = await getServer();
  return server(req, res);
};
