/**
 * Escapes special regex characters to prevent ReDoS attacks.
 * Safe to use with MongoDB $regex queries.
 */
export const escapeRegex = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
};

/**
 * Basic HTML/script tag sanitization for user inputs.
 * Removes or escapes HTML tags to prevent XSS attacks.
 */
export const sanitizeHtml = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: URLs
        .replace(/on\w+=/gi, '') // Remove event handlers
        .replace(/&lt;/g, '<') // Decode encoded brackets
        .replace(/&gt;/g, '>')
        .trim();
};

/**
 * Sanitizes user-provided notes field.
 * Applies HTML sanitization and enforces max length.
 */
export const sanitizeNotes = (notes, maxLength = 1000) => {
    if (typeof notes !== 'string') return '';
    return sanitizeHtml(notes).slice(0, maxLength);
};
