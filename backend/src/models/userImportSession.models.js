import mongoose from 'mongoose';

const userImportSessionSchema = new mongoose.Schema({
  adminIdentifier: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  checksum: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['previewed', 'committed'],
    default: 'previewed',
    index: true,
  },
  rows: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  summary: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  committedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 30 * 60 * 1000),
    index: true,
  },
}, {
  timestamps: true,
});

userImportSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserImportSession = mongoose.model('UserImportSession', userImportSessionSchema);
