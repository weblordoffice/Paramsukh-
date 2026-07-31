
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const ACCESS_EXPIRY = '15m';
const ACCESS_MS = 15 * 60 * 1000;

export const generateTokens = (userId, deviceId, tokenVersion, res) => {
    try {
        const token = jwt.sign(
            { id: userId, deviceId, v: tokenVersion },
            process.env.JWT_SECRET,
            { expiresIn: ACCESS_EXPIRY }
        );

        if (res) {
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: ACCESS_MS
            });
        }

        return token;
    } catch (error) {
        console.error("Error generating tokens:", error);
        throw new Error("Token generation failed");
    }
}