import Address from '../../models/address.models.js';

// @desc    Get user's addresses
// @route   GET /api/addresses
// @access  Private
export const getAddresses = async (req, res) => {
  try {
    const userId = req.user._id;

    const addresses = await Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { addresses }
    });
  } catch (error) {
    console.error('Get Addresses Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve addresses',
      error: error.message
    });
  }
};

// @desc    Add new address
// @route   POST /api/addresses/add
// @access  Private
export const addAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      type, fullName, phone, alternatePhone,
      addressLine1, addressLine2, landmark,
      city, state, pincode, country, isDefault
    } = req.body;

    // Validate required fields
    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate pincode format (6 digits)
    if (!/^\d{6}$/.test(String(pincode).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pincode format (must be 6 digits)'
      });
    }

    const address = new Address({
      user: userId,
      type,
      fullName,
      phone,
      alternatePhone,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country: country || 'India',
      isDefault: isDefault || false
    });

    await address.save();

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: { address }
    });
  } catch (error) {
    console.error('Add Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add address',
      error: error.message
    });
  }
};

// @desc    Update address
// @route   PUT /api/addresses/:id
// @access  Private
export const updateAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Update fields
    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        address[key] = updates[key];
      }
    });

    await address.save();

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: { address }
    });
  } catch (error) {
    console.error('Update Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update address',
      error: error.message
    });
  }
};

// @desc    Delete address
// @route   DELETE /api/addresses/:id
// @access  Private
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await Address.findOneAndDelete({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message
    });
  }
};

// @desc    Set default address
// @route   PATCH /api/addresses/:id/default
// @access  Private
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Set this address as default (middleware will handle unsetting others)
    address.isDefault = true;
    await address.save();

    res.status(200).json({
      success: true,
      message: 'Default address updated',
      data: { address }
    });
  } catch (error) {
    console.error('Set Default Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default address',
      error: error.message
    });
  }
};
