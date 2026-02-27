/**
 * Consolidated template processor for all modules.
 * Supports both [token] and {token} formats.
 * Includes English aliases for Spanish tokens to ensure interoperability.
 */
function processTemplate(content, data) {
    if (!content) return '';

    // Define aliases (English -> Spanish)
    const aliases = {
        'nickname': 'apodo',
        'workshop': 'taller',
        'vehicle': 'vehiculo',
        'client': 'cliente',
        'services': 'servicios',
        'appointment_date': 'turno_fecha',
        'order_id': 'orden_id',
        'contact_data': 'datos_contacto_taller',
        'user': 'usuario',
        'total_amount': 'total',
        'supplier': 'proveedor',
        'part': 'repuesto'
    };

    // Prepare final data object by merging aliases
    const finalData = { ...data };
    Object.keys(aliases).forEach(engKey => {
        const spanKey = aliases[engKey];
        // If we have Spanish but not English, fill English
        if (data[spanKey] !== undefined && data[engKey] === undefined) {
            finalData[engKey] = data[spanKey];
        }
        // If we have English but not Spanish, fill Spanish
        else if (data[engKey] !== undefined && data[spanKey] === undefined) {
            finalData[spanKey] = data[engKey];
        }
    });

    let result = content;

    // Replace tokens - We iterate through all keys in finalData
    // tokens can be [token] or {token}
    Object.keys(finalData).forEach(key => {
        const value = String(finalData[key] ?? '');
        // Escape special characters in key for regex just in case
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match [key] or {key} case-insensitive
        const regex = new RegExp(`[\\{\\[]${escapedKey}[\\}\\]]`, 'gi');
        result = result.replace(regex, value);
    });

    return result;
}

module.exports = { processTemplate };
