import Admin from '../../models/admin.models.js';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const generateAdminToken = (adminId, res) => {
    const token = jwt.sign({ id: adminId, role: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });

    if (res) {
        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });
    }

    return token;
};

// @desc    Admin Login
// @route   POST /api/admin/auth/login
// @access  Public
export const loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    try {
        const admin = await Admin.findOne({ email }).select('+password');

        if (admin && (await admin.comparePassword(password))) {
            if (!admin.isActive) {
                return res.status(401).json({ success: false, message: 'Admin account is disabled' });
            }

            const token = generateAdminToken(admin._id, res);

            // Update last login
            admin.lastLogin = Date.now();
            await admin.save();

            res.json({
                success: true,
                token,
                admin: {
                    _id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    permissions: admin.permissions,
                },
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get current admin profile
// @route   GET /api/admin/auth/me
// @access  Private
export const getAdminMe = async (req, res) => {
    const admin = await Admin.findById(req.admin._id).select('-password');
    res.json({ success: true, admin });
};

// Resolve email from Google: either verify id_token or fetch userinfo with access_token
async function getGoogleEmail(idToken, accessToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set');

    if (idToken) {
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({ idToken, audience: clientId });
        const payload = ticket.getPayload();
        return payload?.email?.toLowerCase?.();
    }
    if (accessToken) {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error('Invalid access token');
        const data = await res.json();
        return data?.email?.toLowerCase?.();
    }
    return null;
}

// @desc    Verify Google ID token (or access token) and issue admin JWT (no password; admin must be added by super admin first)
// @route   POST /api/admin/auth/google
// @access  Public
export const verifyGoogleAndIssueToken = async (req, res) => {
    const { idToken, accessToken } = req.body;

    if (!idToken && !accessToken) {
        return res.status(400).json({ success: false, message: 'idToken or accessToken is required' });
    }

    try {
        const email = await getGoogleEmail(idToken, accessToken);
        console.log('[Admin Auth] Google email resolved:', email);
        if (!email) {
            return res.status(400).json({ success: false, message: 'Could not get email from Google' });
        }

        const admin = await Admin.findOne({ email }).select('-password');
        if (!admin) {
            const allAdmins = await Admin.find({}).select('email role');
            console.log('[Admin Auth] No admin found for email:', email);
            console.log('[Admin Auth] Existing admins in DB:', allAdmins.map(a => `${a.email} (${a.role})`));
            return res.status(403).json({ success: false, message: 'This Google account is not an admin. Ask a super admin to add your email in Settings.' });
        }
        if (!admin.isActive) {
            return res.status(403).json({ success: false, message: 'Admin account is deactivated' });
        }

        const token = generateAdminToken(admin._id, res);
        admin.lastLogin = new Date();
        await Admin.findByIdAndUpdate(admin._id, { lastLogin: admin.lastLogin });

        res.json({
            success: true,
            token,
            admin: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions || [],
            },
        });
    } catch (error) {
        console.error('Google admin auth error:', error);
        if (error.message?.includes('Token used too late') || error.message?.includes('expired')) {
            return res.status(401).json({ success: false, message: 'Google sign-in expired. Please sign in again.' });
        }
        res.status(401).json({ success: false, message: error.message || 'Invalid Google token' });
    }
};

// @desc    Create new admin (Super Admin only) – add by email; they sign in with Google
// @route   POST /api/admin/users
// @access  Private (Super Admin)
export const createAdmin = async (req, res) => {
    const { name, email, password, role, permissions } = req.body;

    try {
        const adminExists = await Admin.findOne({ email });

        if (adminExists) {
            return res.status(400).json({ success: false, message: 'Admin already exists with this email' });
        }

        const createPayload = {
            name: name || email?.split('@')[0] || 'Admin',
            email,
            role: role || 'admin',
            permissions: permissions || [],
        };
        if (password && String(password).trim()) {
            createPayload.password = password;
        }

        const admin = await Admin.create(createPayload);

        if (admin) {
            res.status(201).json({
                success: true,
                message: 'Admin created successfully',
                admin: {
                    _id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    permissions: admin.permissions,
                },
            });
        } else {
            res.status(400).json({ success: false, message: 'Invalid admin data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all admins (Super Admin only)
// @route   GET /api/admin/users
// @access  Private (Super Admin)
export const getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.find({}).select('-password');
        res.json({ success: true, admins });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update admin permissions (Super Admin only)
// @route   PUT /api/admin/users/:id
// @access  Private (Super Admin)
export const updateAdmin = async (req, res) => {
    const { name, email, role, permissions, isActive } = req.body;

    try {
        const admin = await Admin.findById(req.params.id);

        if (admin) {
            admin.name = name || admin.name;
            admin.email = email || admin.email;
            if (role) admin.role = role;
            if (permissions) admin.permissions = permissions;
            if (typeof isActive !== 'undefined') admin.isActive = isActive;

            // Only allow updating password if provided explicitly? Maybe separate route.

            const updatedAdmin = await admin.save();

            res.json({
                success: true,
                message: 'Admin updated successfully',
                admin: {
                    _id: updatedAdmin._id,
                    name: updatedAdmin.name,
                    email: updatedAdmin.email,
                    role: updatedAdmin.role,
                    permissions: updatedAdmin.permissions,
                    isActive: updatedAdmin.isActive,
                },
            });
        } else {
            res.status(404).json({ success: false, message: 'Admin not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete admin (Super Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private (Super Admin)
export const deleteAdmin = async (req, res) => {
    try {
        const admin = await Admin.findById(req.params.id);

        if (admin) {
            // Prevent deleting self?
            if (admin._id.toString() === req.admin._id.toString()) {
                return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
            }

            await admin.deleteOne();
            res.json({ success: true, message: 'Admin removed' });
        } else {
            res.status(404).json({ success: false, message: 'Admin not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Logout admin
// @route   POST /api/admin/auth/logout
// @access  Private
export const logoutAdmin = (req, res) => {
    res.cookie('adminToken', '', {
        httpOnly: true,
        expires: new Date(0),
    });
    res.json({ success: true, message: 'Logged out successfully' });
};
