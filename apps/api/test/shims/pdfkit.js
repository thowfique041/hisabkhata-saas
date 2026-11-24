// PDFKit depends on fontkit, which is ESM-only and uses import.meta. Jest's CommonJS runtime
// cannot load it, so tests load PDFKit through Node's own loader (Node >= 22 can require ESM).
const { createRequire } = process.getBuiltinModule('node:module');
module.exports = createRequire(require.resolve('pdfkit'))('pdfkit');
