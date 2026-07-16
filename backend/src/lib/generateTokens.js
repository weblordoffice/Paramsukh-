
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();


export const generateTokens = (userId, res) => {
    try {
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        // Always set cookie for browser clients
        if (res) {
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
        }
        
        // Always return token for API clients (Postman, mobile apps, etc.)
        return token;
    } catch (error) {
        console.error("❌ Error generating tokens:", error);
        throw new Error("Token generation failed");
    }
}