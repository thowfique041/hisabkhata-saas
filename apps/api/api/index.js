// Vercel Function: every request is rewritten here (see vercel.json) and handed to Nest.
const { getServer } = require('../dist/serverless');

// Never runs: only tells Vercel's file tracer to ship pdfkit's ES module build, which the PDF
// code loads with import() on runtimes that refuse require() of ES modules.
if (process.env.HK_TRACE_ONLY === 'never') import('pdfkit');

module.exports = async (req, res) => {
  const server = await getServer();
  return server(req, res);
};
