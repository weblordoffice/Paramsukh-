/**
 * Escapes special regex characters to prevent ReDoS attacks.
 * Safe to use with MongoDB $regex queries.
 */
export const escapeRegex = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
};
