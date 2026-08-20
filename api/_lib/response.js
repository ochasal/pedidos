/**
 * Helpers de respuesta HTTP para las serverless functions
 */

/**
 * Respuesta exitosa
 */
function success(res, data, status = 200) {
  return res.status(status).json(data);
}

/**
 * Respuesta de error
 */
function error(res, message, status = 400) {
  return res.status(status).json({ error: message });
}

/**
 * Respuesta 404
 */
function notFound(res, message = 'Recurso no encontrado') {
  return res.status(404).json({ error: message });
}

/**
 * CORS headers para las APIs
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

/**
 * Handler para preflight OPTIONS
 */
function handleCors(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  return null; // continuar con el handler
}

/**
 * Wrapper que aplica CORS + manejo de errores a un handler
 */
function apiHandler(handler) {
  return async (req, res) => {
    // CORS
    const corsResult = handleCors(req, res);
    if (corsResult) return corsResult;

    try {
      return await handler(req, res);
    } catch (err) {
      console.error('API Error:', err);
      return res.status(500).json({ 
        error: 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
      });
    }
  };
}

module.exports = {
  success,
  error,
  notFound,
  setCorsHeaders,
  handleCors,
  apiHandler
};
