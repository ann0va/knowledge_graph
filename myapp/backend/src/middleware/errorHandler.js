// src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    // Standard Fehlerstruktur
    const error = {
        success: false,
        error: {
            message: err.message || 'Ein unerwarteter Fehler ist aufgetreten',
            type: err.name || 'Error'
        }
    };

    // Zusätzliche Informationen im Development-Modus
    if (process.env.NODE_ENV === 'development') {
        error.error.stack = err.stack;
    }

    // Status Code bestimmen
    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json(error);
}

module.exports = errorHandler;